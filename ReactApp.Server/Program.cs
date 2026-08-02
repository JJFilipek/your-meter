using System.Text.Json.Serialization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Configuration;
using ReactApp.Server.Data;
using ReactApp.Server.Models;
using ReactApp.Server.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    var dataDirectory = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
    Directory.CreateDirectory(dataDirectory);
    connectionString = $"Data Source={Path.Combine(dataDirectory, "your-meter.db")}";
}

builder.Services
    .AddControllers(options => options.Filters.Add(new AuthorizeFilter()))
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy
                .WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
    });
});
var authenticationOptions = builder.Configuration
    .GetSection(AppAuthenticationOptions.SectionName)
    .Get<AppAuthenticationOptions>() ?? new AppAuthenticationOptions();
builder.Services
    .AddOptions<AppAuthenticationOptions>()
    .Bind(builder.Configuration.GetSection(AppAuthenticationOptions.SectionName));
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "your_meter_session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Strict;
        if (!string.IsNullOrWhiteSpace(authenticationOptions.CookieDomain))
        {
            options.Cookie.Domain = authenticationOptions.CookieDomain;
        }

        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = async context =>
        {
            var userIdClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var sessionVersionClaim = context.Principal?.FindFirstValue(
                AppClaimTypes.SessionVersion);
            var readOnlyClaim = context.Principal?.FindFirstValue(
                AppClaimTypes.ReadOnly);
            if (!Guid.TryParse(userIdClaim, out var userId)
                || !int.TryParse(sessionVersionClaim, out var sessionVersion)
                || !bool.TryParse(readOnlyClaim, out var isReadOnly))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync();
                return;
            }

            var dbContext = context.HttpContext.RequestServices
                .GetRequiredService<AppDbContext>();
            var isSessionValid = await dbContext.Users
                .AnyAsync(user => user.Id == userId
                    && user.IsActive
                    && user.SessionVersion == sessionVersion
                    && user.IsReadOnly == isReadOnly);
            if (!isSessionValid)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync();
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddScoped<AdminUserSeeder>();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services
    .AddOptions<SimulationOptions>()
    .Bind(builder.Configuration.GetSection(SimulationOptions.SectionName))
    .Validate(
        options => options.BackfillDays is >= 1 and <= 365,
        "Simulation:BackfillDays musi mieścić się w zakresie od 1 do 365.")
    .Validate(
        options => options.HistoricalIntervalMinutes is >= 5 and <= 60,
        "Simulation:HistoricalIntervalMinutes musi mieścić się w zakresie od 5 do 60.")
    .Validate(
        options => options.LiveIntervalSeconds is >= 5 and <= 3600,
        "Simulation:LiveIntervalSeconds musi mieścić się w zakresie od 5 do 3600.")
    .ValidateOnStart();
builder.Services.AddSingleton<SimulationWriteLock>();
builder.Services.AddHostedService<MeterSimulationWorker>();

builder.Services
    .AddOptions<TariffPricingOptions>()
    .Bind(builder.Configuration.GetSection(TariffPricingOptions.SectionName));
builder.Services.AddScoped<EnergyPricingService>();

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseForwardedHeaders();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
    var adminUserSeeder = scope.ServiceProvider.GetRequiredService<AdminUserSeeder>();
    await adminUserSeeder.SeedAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    var isSafeMethod = HttpMethods.IsGet(context.Request.Method)
        || HttpMethods.IsHead(context.Request.Method)
        || HttpMethods.IsOptions(context.Request.Method);
    var isApiRequest = context.Request.Path.StartsWithSegments("/api");
    var hasAppRequestHeader = string.Equals(
        context.Request.Headers["X-App-Request"],
        "Your-Meter",
        StringComparison.Ordinal);

    if (isApiRequest && !isSafeMethod && !hasAppRequestHeader)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new
        {
            title = "Brak wymaganego nagłówka żądania.",
            status = StatusCodes.Status400BadRequest
        });
        return;
    }

    await next();
});
app.UseAuthentication();
app.Use(async (context, next) =>
{
    var isSafeMethod = HttpMethods.IsGet(context.Request.Method)
        || HttpMethods.IsHead(context.Request.Method)
        || HttpMethods.IsOptions(context.Request.Method);
    var isApiRequest = context.Request.Path.StartsWithSegments("/api");
    var isLogoutRequest = context.Request.Path.Equals(
        "/api/auth/logout",
        StringComparison.OrdinalIgnoreCase);
    var isLoginRequest = context.Request.Path.Equals(
        "/api/auth/login",
        StringComparison.OrdinalIgnoreCase);
    var isReadOnlyUser = string.Equals(
        context.User.FindFirstValue(AppClaimTypes.ReadOnly),
        bool.TrueString,
        StringComparison.OrdinalIgnoreCase);

    if (isApiRequest
        && !isSafeMethod
        && !isLoginRequest
        && !isLogoutRequest
        && isReadOnlyUser)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new
        {
            title = "Konto demonstracyjne działa tylko w trybie odczytu.",
            status = StatusCodes.Status403Forbidden
        });
        return;
    }

    await next();
});
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Ok(new
{
    service = "Your Meter API",
    status = "ok",
    health = "/health",
    meters = "/api/meters",
    simulators = "/api/simulators"
}));
app.MapControllers();

app.Run();

public partial class Program;
