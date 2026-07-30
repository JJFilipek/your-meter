using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ReactApp.Server.Configuration;
using ReactApp.Server.Data;
using ReactApp.Server.Models;

namespace ReactApp.Server.Services;

public sealed class AdminUserSeeder(
    AppDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    IOptions<AppAuthenticationOptions> options,
    ILogger<AdminUserSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var authenticationOptions = options.Value;
        if (!await dbContext.Users.AnyAsync(cancellationToken))
        {
            await SeedAdministratorAsync(authenticationOptions, cancellationToken);
        }

        await SeedDemoUserAsync(authenticationOptions, cancellationToken);
    }

    private async Task SeedAdministratorAsync(
        AppAuthenticationOptions authenticationOptions,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(authenticationOptions.BootstrapPassword))
        {
            throw new InvalidOperationException(
                "Baza nie zawiera użytkownika, a Authentication:BootstrapPassword nie zostało ustawione.");
        }

        var username = authenticationOptions.BootstrapUsername.Trim();
        var user = new AppUser
        {
            Username = username,
            NormalizedUsername = NormalizeUsername(username),
            Email = authenticationOptions.BootstrapEmail.Trim(),
            PasswordHash = string.Empty
        };
        user.PasswordHash = passwordHasher.HashPassword(
            user,
            authenticationOptions.BootstrapPassword);

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Utworzono początkowe konto administratora {Username}.",
            user.Username);
    }

    private async Task SeedDemoUserAsync(
        AppAuthenticationOptions authenticationOptions,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(authenticationOptions.DemoUsername)
            || string.IsNullOrWhiteSpace(authenticationOptions.DemoPassword))
        {
            return;
        }

        var username = authenticationOptions.DemoUsername.Trim();
        var normalizedUsername = NormalizeUsername(username);
        var user = await dbContext.Users.SingleOrDefaultAsync(
            item => item.NormalizedUsername == normalizedUsername,
            cancellationToken);

        if (user is null)
        {
            user = new AppUser
            {
                Username = username,
                NormalizedUsername = normalizedUsername,
                Email = authenticationOptions.DemoEmail.Trim(),
                PasswordHash = string.Empty,
                IsReadOnly = true
            };
            user.PasswordHash = passwordHasher.HashPassword(
                user,
                authenticationOptions.DemoPassword);
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Utworzono konto demonstracyjne {Username}.",
                user.Username);
            return;
        }

        var passwordVerification = passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            authenticationOptions.DemoPassword);
        var requiresUpdate = !user.IsReadOnly
            || !user.IsActive
            || user.Username != username
            || user.Email != authenticationOptions.DemoEmail.Trim()
            || passwordVerification is not PasswordVerificationResult.Success;
        if (!requiresUpdate)
        {
            return;
        }

        user.Username = username;
        user.Email = authenticationOptions.DemoEmail.Trim();
        user.IsActive = true;
        user.IsReadOnly = true;
        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        user.SessionVersion++;
        user.UpdatedAtUtc = DateTime.UtcNow;
        if (passwordVerification is not PasswordVerificationResult.Success)
        {
            user.PasswordHash = passwordHasher.HashPassword(
                user,
                authenticationOptions.DemoPassword);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Zaktualizowano konto demonstracyjne {Username}.",
            user.Username);
    }

    public static string NormalizeUsername(string username) =>
        username.Trim().ToUpperInvariant();
}
