namespace ReactApp.Server.Configuration;

public sealed class AppAuthenticationOptions
{
    public const string SectionName = "Authentication";

    public string CookieDomain { get; init; } = string.Empty;
    public string BootstrapUsername { get; init; } = "admin";
    public string BootstrapEmail { get; init; } = "admin@localhost";
    public string BootstrapPassword { get; init; } = string.Empty;
    public string DemoUsername { get; init; } = "demo";
    public string DemoEmail { get; init; } = "demo@localhost";
    public string DemoPassword { get; init; } = string.Empty;
}
