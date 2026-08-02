using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ReactApp.Server.Data;

namespace ReactApp.Server.Tests.Infrastructure;

/// <summary>
/// Boots the real ASP.NET Core pipeline (routing, model binding, EF Core, business logic)
/// against an isolated in-memory SQLite database, with authentication swapped for
/// <see cref="TestAuthHandler"/> so tests exercise the actual controllers and computations
/// without depending on the login flow or a real file-based database.
/// </summary>
public sealed class TestApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Authentication:BootstrapPassword", "Integration-Test-Password-1!");
        builder.UseSetting("Simulation:Enabled", "false");
        builder.UseSetting("Simulation:SeedDefaults", "false");

        // Round numbers instead of the production defaults (appsettings.json) so expected values
        // in calculation tests can be computed by hand rather than tracking real-world tariffs.
        builder.UseSetting("Network:LineResistanceOhms", "1");
        builder.UseSetting("TariffPricing:ContractedPowerExceedancePenaltyPlnPerKw", "10");
        builder.UseSetting("TariffPricing:ConnectionPowerExceedancePenaltyPlnPerKw", "20");
        builder.UseSetting("TariffPricing:ExportCompensationPlnPerKwh", "0.5");
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
        builder.UseSetting("Logging:LogLevel:Microsoft.EntityFrameworkCore", "Warning");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));

            services.AddSingleton<TestAuthState>();
            services
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            services.PostConfigure<AuthenticationOptions>(authOptions =>
            {
                authOptions.DefaultScheme = TestAuthHandler.SchemeName;
                authOptions.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                authOptions.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });
        });
    }

    /// <summary>Creates an <see cref="HttpClient"/> that satisfies the anti-CSRF header the app requires on mutating API calls.</summary>
    public HttpClient CreateApiClient()
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-App-Request", "Your-Meter");
        return client;
    }

    public void SetReadOnly(bool isReadOnly) => Services.GetRequiredService<TestAuthState>().IsReadOnly = isReadOnly;

    /// <summary>Runs <paramref name="action"/> against a freshly scoped <see cref="AppDbContext"/> and persists changes.</summary>
    public async Task SeedAsync(Func<AppDbContext, Task> action)
    {
        await using var scope = Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await action(dbContext);
        await dbContext.SaveChangesAsync();
    }

    Task IAsyncLifetime.InitializeAsync()
    {
        connection.Open();
        return Task.CompletedTask;
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await connection.DisposeAsync();
    }
}
