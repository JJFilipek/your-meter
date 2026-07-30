using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Contracts;
using ReactApp.Server.Data;
using ReactApp.Server.Models;
using ReactApp.Server.Services;

namespace ReactApp.Server.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AppDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher) : ControllerBase
{
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private const int LockoutThreshold = 5;

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    [ProducesResponseType<AuthUserDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthUserDto>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedUsername = AdminUserSeeder.NormalizeUsername(request.Username);
        var user = await dbContext.Users.SingleOrDefaultAsync(
            item => item.NormalizedUsername == normalizedUsername,
            cancellationToken);
        var utcNow = DateTime.UtcNow;

        if (user is null || !user.IsActive)
        {
            return UnauthorizedProblem();
        }

        if (user.LockoutEndUtc > utcNow)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = "Konto jest tymczasowo zablokowane.",
                Detail = "Spróbuj ponownie za kilka minut.",
                Status = StatusCodes.Status401Unauthorized
            });
        }

        var verification = passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            request.Password);
        if (verification is PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= LockoutThreshold)
            {
                user.LockoutEndUtc = utcNow.Add(LockoutDuration);
                user.FailedLoginCount = 0;
            }

            user.UpdatedAtUtc = utcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return UnauthorizedProblem();
        }

        if (verification is PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        }

        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        user.LastLoginAtUtc = utcNow;
        user.UpdatedAtUtc = utcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await SignInAsync(user);

        return Ok(ToDto(user));
    }

    [HttpGet("me")]
    [ProducesResponseType<AuthUserDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthUserDto>> Me(CancellationToken cancellationToken)
    {
        var user = await FindCurrentUserAsync(cancellationToken);
        return user is null ? Unauthorized() : Ok(ToDto(user));
    }

    [HttpPut("profile")]
    [ProducesResponseType<AuthUserDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthUserDto>> UpdateProfile(
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var user = await FindCurrentUserAsync(cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var username = request.Username.Trim();
        var normalizedUsername = AdminUserSeeder.NormalizeUsername(username);
        if (await dbContext.Users.AnyAsync(
                item => item.Id != user.Id
                    && item.NormalizedUsername == normalizedUsername,
                cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Podana nazwa użytkownika jest już zajęta.",
                Status = StatusCodes.Status409Conflict
            });
        }

        user.Username = username;
        user.NormalizedUsername = normalizedUsername;
        user.Email = request.Email.Trim();
        user.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await SignInAsync(user);

        return Ok(ToDto(user));
    }

    [HttpPut("password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var user = await FindCurrentUserAsync(cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var verification = passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            request.CurrentPassword);
        if (verification is PasswordVerificationResult.Failed)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Aktualne hasło jest nieprawidłowe.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        user.SessionVersion++;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    private async Task<AppUser?> FindCurrentUserAsync(CancellationToken cancellationToken)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var userId)
            ? await dbContext.Users.SingleOrDefaultAsync(
                item => item.Id == userId && item.IsActive,
                cancellationToken)
            : null;
    }

    private async Task SignInAsync(AppUser user)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(AppClaimTypes.SessionVersion, user.SessionVersion.ToString())
            ],
            CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                AllowRefresh = true,
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });
    }

    private UnauthorizedObjectResult UnauthorizedProblem() =>
        Unauthorized(new ProblemDetails
        {
            Title = "Nieprawidłowa nazwa użytkownika lub hasło.",
            Status = StatusCodes.Status401Unauthorized
        });

    private static AuthUserDto ToDto(AppUser user) =>
        new(user.Id, user.Username, user.Email);
}
