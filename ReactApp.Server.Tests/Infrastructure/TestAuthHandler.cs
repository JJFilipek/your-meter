using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ReactApp.Server.Services;

namespace ReactApp.Server.Tests.Infrastructure;

/// <summary>
/// Mutable per-factory state read by <see cref="TestAuthHandler"/>. Registered as a singleton so
/// tests can flip <see cref="IsReadOnly"/> to exercise the read-only account restrictions without
/// touching the real login flow.
/// </summary>
public sealed class TestAuthState
{
    public bool IsReadOnly { get; set; }
}

/// <summary>
/// Authenticates every request as a fixed, always-valid user so integration tests can call the
/// API directly without going through <c>/api/auth/login</c> or the cookie-session database
/// checks. Claim shapes mirror what <c>Program.cs</c> expects from the real cookie scheme.
/// </summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    TestAuthState state)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.Empty.ToString()),
            new Claim(AppClaimTypes.SessionVersion, "1"),
            new Claim(AppClaimTypes.ReadOnly, state.IsReadOnly.ToString()),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
