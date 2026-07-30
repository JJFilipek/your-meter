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
        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var authenticationOptions = options.Value;
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

    public static string NormalizeUsername(string username) =>
        username.Trim().ToUpperInvariant();
}
