namespace ReactApp.Server.Services;

public sealed class SimulationWriteLock
{
    public SemaphoreSlim Gate { get; } = new(1, 1);
}
