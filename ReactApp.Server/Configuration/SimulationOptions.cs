namespace ReactApp.Server.Configuration;

public sealed class SimulationOptions
{
    public const string SectionName = "Simulation";

    public bool Enabled { get; init; }
    public bool SeedDefaults { get; init; }
    public int BackfillDays { get; init; } = 30;
    public int HistoricalIntervalMinutes { get; init; } = 15;
    public int LiveIntervalSeconds { get; init; } = 30;
}
