using ReactApp.Server.Models;

namespace ReactApp.Server.Tests.Infrastructure;

/// <summary>Builds a <see cref="Meter"/> with a deterministic reading sequence for calculation tests.</summary>
public sealed class MeterSeedBuilder
{
    private readonly Meter meter;
    private readonly List<MeterReading> readings = [];

    public MeterSeedBuilder(string tariff = "G11", double? simulationBasePowerKw = 2.4, string serialNumber = "TEST-0001")
    {
        meter = new Meter
        {
            SerialNumber = serialNumber,
            Name = $"Test meter {serialNumber}",
            Manufacturer = "Test",
            Model = "Test",
            FirmwareVersion = "1.0.0",
            Tariff = tariff,
            SamplingIntervalSeconds = 3600,
            City = "Warszawa",
            Site = "Test",
            Latitude = 52.2297,
            Longitude = 21.0122,
            IsSimulated = true,
            SimulationBasePowerKw = simulationBasePowerKw,
        };
    }

    public Meter Meter => meter;

    public IReadOnlyList<MeterReading> Readings => readings;

    /// <summary>
    /// Appends a reading. Register values (import/export/generation) are cumulative totals as
    /// stored on the wire, not deltas, matching how <see cref="MeterReading"/> registers behave.
    /// </summary>
    public MeterSeedBuilder AddReading(
        DateTime timestampUtc,
        double activeImportKwh,
        double activeExportKwh = 0,
        double activeGenerationKwh = 0,
        double activePowerKw = 0,
        double generationPowerKw = 0,
        double? current = null,
        ReadingQuality quality = ReadingQuality.Valid)
    {
        readings.Add(new MeterReading
        {
            MeterId = meter.Id,
            Meter = meter,
            TimestampUtc = DateTime.SpecifyKind(timestampUtc, DateTimeKind.Utc),
            ActiveImportKwh = activeImportKwh,
            ActiveExportKwh = activeExportKwh,
            ActiveGenerationKwh = activeGenerationKwh,
            ActivePowerKw = activePowerKw,
            GenerationPowerKw = generationPowerKw,
            Current = current,
            Quality = quality,
        });
        return this;
    }

    public MeterSeedBuilder WithLastSeen(DateTime lastSeenUtc)
    {
        meter.LastSeenAtUtc = DateTime.SpecifyKind(lastSeenUtc, DateTimeKind.Utc);
        meter.LastReadingQuality = ReadingQuality.Valid;
        return this;
    }
}
