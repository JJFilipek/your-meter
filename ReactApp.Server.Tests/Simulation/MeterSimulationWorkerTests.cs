using ReactApp.Server.Models;
using ReactApp.Server.Services;

namespace ReactApp.Server.Tests.Simulation;

/// <summary>
/// Tests the deterministic reading generator that backs every simulated meter (the demo data
/// source for the whole app). Exercised via <c>internal</c> access
/// (<c>InternalsVisibleTo</c> in ReactApp.Server.csproj) rather than reflection or a refactor,
/// so production code is untouched.
/// </summary>
public sealed class MeterSimulationWorkerTests
{
    private static readonly DateTime Timestamp = new(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);

    private static Meter BuildMeter(string tariff, double basePowerKw, string serialNumber) => new()
    {
        SerialNumber = serialNumber,
        Name = "Simulation test meter",
        Manufacturer = "Test",
        Model = "Test",
        FirmwareVersion = "1.0.0",
        Tariff = tariff,
        City = "Warszawa",
        Site = "Test",
        Latitude = 52.2297,
        Longitude = 21.0122,
        IsSimulated = true,
        SimulationBasePowerKw = basePowerKw,
    };

    [Fact]
    public void CreateReading_RegistersNeverDecrease_ForConsumptionMeter()
    {
        var meter = BuildMeter("G11", 2.4, "SIM-TEST-G11");

        var reading = MeterSimulationWorker.CreateReading(
            meter, Timestamp, TimeSpan.FromHours(1),
            previousImportKwh: 100, previousExportKwh: 50, previousGenerationKwh: 0);

        Assert.True(reading.ActiveImportKwh >= 100);
        Assert.True(reading.ActiveExportKwh >= 50);
        Assert.Equal(ReadingQuality.Valid, reading.Quality);
    }

    [Fact]
    public void CreateReading_ProducesGeneration_ForPhotovoltaicMeterAtMidday()
    {
        // G12W is the photovoltaic profile; a summer midday timestamp should yield export/generation.
        var meter = BuildMeter("G12W", 3.6, "SIM-TEST-G12W");

        var reading = MeterSimulationWorker.CreateReading(
            meter, Timestamp, TimeSpan.FromHours(1),
            previousImportKwh: 0, previousExportKwh: 0, previousGenerationKwh: 0);

        Assert.True(reading.ActiveExportKwh > 0, "PV meter at midday should export some energy.");
        Assert.True(reading.ActiveGenerationKwh >= reading.ActiveExportKwh,
            "Total generation must cover at least the exported portion (generation = self-consumed + exported).");
    }

    [Fact]
    public void CreateReading_ProducesNoGeneration_ForNonPhotovoltaicMeter()
    {
        var meter = BuildMeter("G11", 2.4, "SIM-TEST-G11-NOPV");

        var reading = MeterSimulationWorker.CreateReading(
            meter, Timestamp, TimeSpan.FromHours(1),
            previousImportKwh: 0, previousExportKwh: 0, previousGenerationKwh: 0);

        Assert.Equal(0, reading.ActiveExportKwh);
        Assert.Equal(0, reading.ActiveGenerationKwh);
        Assert.Equal(0, reading.GenerationPowerKw);
    }

    [Fact]
    public void CreateReading_IsDeterministic_ForTheSameSerialAndTimestamp()
    {
        var meterA = BuildMeter("G12", 4.8, "SIM-TEST-REPEAT");
        var meterB = BuildMeter("G12", 4.8, "SIM-TEST-REPEAT");

        var first = MeterSimulationWorker.CreateReading(
            meterA, Timestamp, TimeSpan.FromMinutes(30),
            previousImportKwh: 10, previousExportKwh: 0, previousGenerationKwh: 0);
        var second = MeterSimulationWorker.CreateReading(
            meterB, Timestamp, TimeSpan.FromMinutes(30),
            previousImportKwh: 10, previousExportKwh: 0, previousGenerationKwh: 0);

        // The per-interval variation is seeded from serial number + timestamp, so calling the
        // generator twice with identical inputs must produce identical output — the function
        // has to behave as pure/deterministic, which backfill and live simulation both rely on.
        Assert.Equal(first.ActiveImportKwh, second.ActiveImportKwh);
        Assert.Equal(first.ActivePowerKw, second.ActivePowerKw);
        Assert.Equal(first.Voltage, second.Voltage);
    }

    [Fact]
    public void CreateReading_ClampsElapsedTimeToTwentyFourHours()
    {
        var meterShort = BuildMeter("G11", 2.4, "SIM-TEST-CLAMP");
        var meterLong = BuildMeter("G11", 2.4, "SIM-TEST-CLAMP");

        var atCap = MeterSimulationWorker.CreateReading(
            meterShort, Timestamp, TimeSpan.FromHours(24),
            previousImportKwh: 0, previousExportKwh: 0, previousGenerationKwh: 0);
        var beyondCap = MeterSimulationWorker.CreateReading(
            meterLong, Timestamp, TimeSpan.FromHours(200),
            previousImportKwh: 0, previousExportKwh: 0, previousGenerationKwh: 0);

        // A gap far longer than 24h (e.g. a meter reconnecting after a week) must not be
        // extrapolated into an implausible energy jump; both should stop accruing at 24h.
        Assert.Equal(atCap.ActiveImportKwh, beyondCap.ActiveImportKwh, precision: 6);
    }

    [Fact]
    public void CreateReading_KeepsVoltageAndFrequencyWithinPlausibleRange()
    {
        var meter = BuildMeter("A23", 72, "SIM-TEST-VOLT");

        var reading = MeterSimulationWorker.CreateReading(
            meter, Timestamp, TimeSpan.FromHours(1),
            previousImportKwh: 0, previousExportKwh: 0, previousGenerationKwh: 0);

        Assert.InRange(reading.Voltage!.Value, 220, 240);
        Assert.InRange(reading.FrequencyHz!.Value, 49.9, 50.1);
    }
}
