using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Configuration;
using ReactApp.Server.Data;
using ReactApp.Server.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    var dataDirectory = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
    Directory.CreateDirectory(dataDirectory);
    connectionString = $"Data Source={Path.Combine(dataDirectory, "twoj-licznik.db")}";
}

builder.Services
    .AddControllers()
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
                .AllowAnyMethod();
        }
    });
});
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
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Ok(new
{
    service = "Twój Licznik API",
    status = "ok",
    health = "/health",
    meters = "/api/meters",
    simulators = "/api/simulators"
}));
app.MapControllers();

app.Run();

public partial class Program;
