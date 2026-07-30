using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ReactApp.Server.Configuration;
using ReactApp.Server.Data;
using ReactApp.Server.Models;

namespace ReactApp.Server.Services;

public sealed class MeterSimulationWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<SimulationOptions> options,
    SimulationWriteLock simulationWriteLock,
    ILogger<MeterSimulationWorker> logger) : BackgroundService
{
    private static readonly TimeZoneInfo WarsawTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    private static readonly SimulatedMeterDefinition[] Definitions =
    [
        new(
            "SIM-G11-001",
            "Mieszkanie pokazowe",
            "G11",
            2.4,
            "Warszawa",
            "Budynek mieszkalny",
            52.2297,
            21.0122,
            SimulationKind.Residential),
        new(
            "SIM-G12-001",
            "Dom z pompą ciepła",
            "G12",
            4.8,
            "Piaseczno",
            "Dom jednorodzinny",
            52.0733,
            21.0265,
            SimulationKind.HeatPump),
        new(
            "SIM-G12W-001",
            "Dom z instalacją PV",
            "G12W",
            3.6,
            "Pruszków",
            "Instalacja prosumencka",
            52.1705,
            20.8119,
            SimulationKind.Photovoltaic),
        new(
            "SIM-C11-001",
            "Sklep osiedlowy",
            "C11",
            9.5,
            "Warszawa",
            "Lokal handlowy",
            52.2449,
            21.0008,
            SimulationKind.Business),
        new(
            "SIM-A23-001",
            "Zakład produkcyjny",
            "A23",
            72,
            "Ożarów Mazowiecki",
            "Hala produkcyjna",
            52.2108,
            20.7972,
            SimulationKind.Industrial)
    ];

    private readonly SimulationOptions simulationOptions = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!simulationOptions.Enabled)
        {
            logger.LogInformation("Symulacja liczników jest wyłączona.");
            return;
        }

        if (simulationOptions.SeedDefaults)
        {
            await PrepareSimulationAsync(stoppingToken);
        }

        var interval = TimeSpan.FromSeconds(
            Math.Clamp(simulationOptions.LiveIntervalSeconds, 5, 3600));
        using var timer = new PeriodicTimer(interval);

        logger.LogInformation(
            "Symulacja liczników działa z interwałem {IntervalSeconds} sekund.",
            interval.TotalSeconds);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await AppendLiveReadingsAsync(stoppingToken);
        }
    }

    private async Task PrepareSimulationAsync(CancellationToken cancellationToken)
    {
        await simulationWriteLock.Gate.WaitAsync(cancellationToken);
        try
        {
            await PrepareSimulationCoreAsync(cancellationToken);
        }
        finally
        {
            simulationWriteLock.Gate.Release();
        }
    }

    private async Task PrepareSimulationCoreAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        foreach (var definition in Definitions)
        {
            var meter = await dbContext.Meters
                .SingleOrDefaultAsync(
                    item => item.SerialNumber == definition.SerialNumber,
                    cancellationToken);

            if (meter is null)
            {
                meter = CreateMeter(definition);
                dbContext.Meters.Add(meter);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            if (!meter.IsSimulated)
            {
                logger.LogWarning(
                    "Numer seryjny {SerialNumber} jest zajęty przez licznik niesymulowany.",
                    definition.SerialNumber);
                continue;
            }

            var hasReadings = await dbContext.MeterReadings
                .AnyAsync(item => item.MeterId == meter.Id, cancellationToken);
            if (!hasReadings)
            {
                await BackfillMeterAsync(dbContext, meter, definition, cancellationToken);
            }
        }
    }

    private async Task BackfillMeterAsync(
        AppDbContext dbContext,
        Meter meter,
        SimulatedMeterDefinition definition,
        CancellationToken cancellationToken)
    {
        var intervalMinutes = Math.Clamp(
            simulationOptions.HistoricalIntervalMinutes,
            5,
            60);
        var interval = TimeSpan.FromMinutes(intervalMinutes);
        var backfillDays = Math.Clamp(simulationOptions.BackfillDays, 1, 365);
        var end = FloorTimestamp(DateTime.UtcNow, interval);
        var timestamp = end.AddDays(-backfillDays);
        var importKwh = 1000d + Array.IndexOf(Definitions, definition) * 750d;
        var exportKwh = definition.Kind is SimulationKind.Photovoltaic ? 150d : 0d;
        var readings = new List<MeterReading>();

        while (timestamp <= end)
        {
            var reading = CreateReading(
                meter,
                definition,
                timestamp,
                interval,
                importKwh,
                exportKwh);
            importKwh = reading.ActiveImportKwh;
            exportKwh = reading.ActiveExportKwh;
            readings.Add(reading);
            timestamp = timestamp.Add(interval);
        }

        dbContext.MeterReadings.AddRange(readings);
        ApplyLatestReading(meter, readings[^1]);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Utworzono {ReadingCount} historycznych odczytów dla {SerialNumber}.",
            readings.Count,
            meter.SerialNumber);
    }

    private async Task AppendLiveReadingsAsync(CancellationToken cancellationToken)
    {
        await simulationWriteLock.Gate.WaitAsync(cancellationToken);
        try
        {
            await AppendLiveReadingsCoreAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            logger.LogWarning(exception, "Pominięto cykl symulacji z powodu równoległej zmiany danych.");
        }
        finally
        {
            simulationWriteLock.Gate.Release();
        }
    }

    private async Task AppendLiveReadingsCoreAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var meters = await dbContext.Meters
            .Where(item => item.IsEnabled && item.IsSimulated)
            .ToListAsync(cancellationToken);

        foreach (var meter in meters)
        {
            var definition = ResolveDefinition(meter);

            var latest = await dbContext.MeterReadings
                .Where(item => item.MeterId == meter.Id)
                .OrderByDescending(item => item.TimestampUtc)
                .FirstOrDefaultAsync(cancellationToken);
            if (latest is null)
            {
                continue;
            }

            var timestamp = DateTime.UtcNow;
            var elapsed = timestamp - latest.TimestampUtc;
            var samplingInterval = TimeSpan.FromSeconds(
                Math.Clamp(meter.SamplingIntervalSeconds, 5, 3600));
            if (elapsed < samplingInterval)
            {
                continue;
            }

            var reading = CreateReading(
                meter,
                definition,
                timestamp,
                elapsed,
                latest.ActiveImportKwh,
                latest.ActiveExportKwh);
            dbContext.MeterReadings.Add(reading);
            ApplyLatestReading(meter, reading);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static MeterReading CreateReading(
        Meter meter,
        SimulatedMeterDefinition definition,
        DateTime timestampUtc,
        TimeSpan elapsed,
        double previousImportKwh,
        double previousExportKwh)
    {
        var localTimestamp = TimeZoneInfo.ConvertTimeFromUtc(timestampUtc, WarsawTimeZone);
        var variation = ResolveVariation(meter.SerialNumber, timestampUtc);
        var importPowerKw = ResolveImportPower(definition, localTimestamp) * variation;
        var exportPowerKw = ResolveExportPower(definition, localTimestamp) * variation;
        var elapsedHours = Math.Min(elapsed.TotalHours, 24);
        var importKwh = previousImportKwh + importPowerKw * elapsedHours;
        var exportKwh = previousExportKwh + exportPowerKw * elapsedHours;
        var netPowerKw = importPowerKw - exportPowerKw;
        var voltage = 230 + 2.5 * Math.Sin(timestampUtc.Minute / 60d * Math.PI * 2);
        var current = Math.Abs(netPowerKw) * 1000 / (voltage * Math.Sqrt(3));

        return new MeterReading
        {
            MeterId = meter.Id,
            TimestampUtc = timestampUtc,
            ActiveImportKwh = Math.Round(importKwh, 6),
            ActiveExportKwh = Math.Round(exportKwh, 6),
            ActivePowerKw = Math.Round(netPowerKw, 4),
            ReactivePowerKvar = Math.Round(Math.Abs(netPowerKw) * 0.18, 4),
            Voltage = Math.Round(voltage, 2),
            Current = Math.Round(current, 3),
            FrequencyHz = Math.Round(
                50 + 0.025 * Math.Sin(timestampUtc.Second / 60d * Math.PI * 2),
                3),
            Quality = ReadingQuality.Valid
        };
    }

    internal static MeterReading CreateReading(
        Meter meter,
        DateTime timestampUtc,
        TimeSpan elapsed,
        double previousImportKwh,
        double previousExportKwh) =>
        CreateReading(
            meter,
            ResolveDefinition(meter),
            timestampUtc,
            elapsed,
            previousImportKwh,
            previousExportKwh);

    private static double ResolveImportPower(
        SimulatedMeterDefinition definition,
        DateTime localTimestamp)
    {
        var hour = localTimestamp.Hour + localTimestamp.Minute / 60d;
        var isWeekend = localTimestamp.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

        return definition.Kind switch
        {
            SimulationKind.Residential =>
                definition.BasePowerKw * (
                    0.22
                    + BellCurve(hour, 7.5, 1.5) * 0.55
                    + BellCurve(hour, 19.5, 2.6) * 1.05),
            SimulationKind.HeatPump =>
                definition.BasePowerKw * (
                    0.28
                    + (IsG12OffPeak(localTimestamp) ? 0.62 : 0.18)
                    + BellCurve(hour, 6.5, 1.4) * 0.35),
            SimulationKind.Photovoltaic =>
                definition.BasePowerKw * (
                    0.18
                    + BellCurve(hour, 7.5, 1.5) * 0.3
                    + BellCurve(hour, 20, 2.4) * 0.65
                    + (IsG12WOffPeak(localTimestamp) ? 0.16 : 0)),
            SimulationKind.Business =>
                definition.BasePowerKw * (
                    isWeekend
                        ? 0.16
                        : 0.18 + WorkdayWindow(hour, 7, 20) * 0.82),
            SimulationKind.Industrial =>
                definition.BasePowerKw * (
                    isWeekend
                        ? 0.24
                        : 0.34 + WorkdayWindow(hour, 6, 22) * 0.66),
            _ => definition.BasePowerKw * 0.3
        };
    }

    private static double ResolveExportPower(
        SimulatedMeterDefinition definition,
        DateTime localTimestamp)
    {
        if (definition.Kind is not SimulationKind.Photovoltaic)
        {
            return 0;
        }

        var hour = localTimestamp.Hour + localTimestamp.Minute / 60d;
        if (hour is < 5.5 or > 21)
        {
            return 0;
        }

        var daylightProgress = (hour - 5.5) / 15.5 * Math.PI;
        var seasonalFactor = 0.62 + 0.38 * Math.Sin(
            (localTimestamp.DayOfYear - 80) / 365d * Math.PI * 2);
        return Math.Max(
            0,
            definition.BasePowerKw
            * 1.65
            * Math.Sin(daylightProgress)
            * seasonalFactor);
    }

    private static bool IsG12OffPeak(DateTime timestamp) =>
        timestamp.Hour < 6
        || timestamp.Hour >= 22
        || timestamp.Hour is >= 13 and < 15;

    private static bool IsG12WOffPeak(DateTime timestamp) =>
        timestamp.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday
        || IsG12OffPeak(timestamp);

    private static double BellCurve(double hour, double center, double width)
    {
        var distance = (hour - center) / width;
        return Math.Exp(-0.5 * distance * distance);
    }

    private static double WorkdayWindow(double hour, double start, double end)
    {
        var rampUp = 1 / (1 + Math.Exp(-(hour - start) * 3));
        var rampDown = 1 / (1 + Math.Exp((hour - end) * 3));
        return rampUp * rampDown;
    }

    private static double ResolveVariation(string serialNumber, DateTime timestamp)
    {
        var seed = HashCode.Combine(
            serialNumber,
            timestamp.Year,
            timestamp.DayOfYear,
            timestamp.Hour,
            timestamp.Minute);
        var random = new Random(seed);
        return 0.9 + random.NextDouble() * 0.2;
    }

    private static DateTime FloorTimestamp(DateTime timestamp, TimeSpan interval)
    {
        var ticks = timestamp.Ticks - timestamp.Ticks % interval.Ticks;
        return new DateTime(ticks, DateTimeKind.Utc);
    }

    private static Meter CreateMeter(SimulatedMeterDefinition definition) =>
        new()
        {
            SerialNumber = definition.SerialNumber,
            Name = definition.Name,
            Manufacturer = "Your Meter Simulator",
            Model = $"Profil {definition.Tariff}",
            FirmwareVersion = "1.0.0",
            Tariff = definition.Tariff,
            SamplingIntervalSeconds = 900,
            City = definition.City,
            Site = definition.Site,
            Latitude = definition.Latitude,
            Longitude = definition.Longitude,
            IsSimulated = true,
            SimulationBasePowerKw = definition.BasePowerKw
        };

    private static SimulatedMeterDefinition ResolveDefinition(Meter meter)
    {
        var predefined = Definitions.SingleOrDefault(
            item => item.SerialNumber == meter.SerialNumber);
        if (predefined is not null)
        {
            return predefined;
        }

        return new SimulatedMeterDefinition(
            meter.SerialNumber,
            meter.Name,
            meter.Tariff,
            meter.SimulationBasePowerKw ?? ResolveDefaultBasePower(meter.Tariff),
            meter.City,
            meter.Site,
            meter.Latitude,
            meter.Longitude,
            ResolveSimulationKind(meter.Tariff));
    }

    private static double ResolveDefaultBasePower(string tariff) =>
        tariff.ToUpperInvariant() switch
        {
            "G11" => 2.4,
            "G12" => 4.8,
            "G12W" => 3.6,
            "C11" => 9.5,
            "A23" => 72,
            _ => 2.4
        };

    private static SimulationKind ResolveSimulationKind(string tariff) =>
        tariff.ToUpperInvariant() switch
        {
            "G12" => SimulationKind.HeatPump,
            "G12W" => SimulationKind.Photovoltaic,
            "C11" => SimulationKind.Business,
            "A23" => SimulationKind.Industrial,
            _ => SimulationKind.Residential
        };

    private static void ApplyLatestReading(Meter meter, MeterReading reading)
    {
        meter.LastSeenAtUtc = reading.TimestampUtc;
        meter.LastReadingQuality = reading.Quality;
        meter.LatestActiveImportKwh = reading.ActiveImportKwh;
        meter.LatestActiveExportKwh = reading.ActiveExportKwh;
        meter.LatestActivePowerKw = reading.ActivePowerKw;
        meter.UpdatedAtUtc = DateTime.UtcNow;
    }

    private sealed record SimulatedMeterDefinition(
        string SerialNumber,
        string Name,
        string Tariff,
        double BasePowerKw,
        string City,
        string Site,
        double Latitude,
        double Longitude,
        SimulationKind Kind);

    private enum SimulationKind
    {
        Residential,
        HeatPump,
        Photovoltaic,
        Business,
        Industrial
    }
}
