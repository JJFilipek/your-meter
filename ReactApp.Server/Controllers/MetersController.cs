using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Contracts;
using ReactApp.Server.Data;
using ReactApp.Server.Models;
using ReactApp.Server.Services;

namespace ReactApp.Server.Controllers;

[ApiController]
[Route("api/meters")]
public sealed class MetersController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<MeterDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MeterDto>>> GetAll(
        [FromQuery] bool includeDisabled = false,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Meters.AsNoTracking();
        if (!includeDisabled)
        {
            query = query.Where(x => x.IsEnabled);
        }

        var meters = await query
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var utcNow = DateTime.UtcNow;

        return Ok(meters.Select(x => MeterMapper.ToDto(x, utcNow)).ToArray());
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<MeterDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MeterDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var meter = await dbContext.Meters
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        return meter is null
            ? NotFound()
            : Ok(MeterMapper.ToDto(meter, DateTime.UtcNow));
    }

    [HttpPost]
    [ProducesResponseType<MeterDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MeterDto>> Create(
        UpsertMeterRequest request,
        CancellationToken cancellationToken)
    {
        var serialNumber = request.SerialNumber.Trim();
        if (await dbContext.Meters.AnyAsync(x => x.SerialNumber == serialNumber, cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Licznik o podanym numerze seryjnym już istnieje.",
                Status = StatusCodes.Status409Conflict
            });
        }

        var meter = new Meter
        {
            SerialNumber = serialNumber,
            Name = request.Name.Trim(),
            Manufacturer = request.Manufacturer.Trim(),
            Model = request.Model.Trim(),
            FirmwareVersion = request.FirmwareVersion.Trim(),
            Tariff = request.Tariff.Trim(),
            SamplingIntervalSeconds = request.SamplingIntervalSeconds,
            City = request.Location.City.Trim(),
            Site = request.Location.Site.Trim(),
            Latitude = request.Location.Lat,
            Longitude = request.Location.Lng
        };

        dbContext.Meters.Add(meter);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = MeterMapper.ToDto(meter, DateTime.UtcNow);

        return Created($"/api/meters/{meter.Id}", dto);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<MeterDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MeterDto>> Update(
        Guid id,
        UpsertMeterRequest request,
        CancellationToken cancellationToken)
    {
        var meter = await dbContext.Meters.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meter is null)
        {
            return NotFound();
        }

        var serialNumber = request.SerialNumber.Trim();
        if (await dbContext.Meters.AnyAsync(
                x => x.Id != id && x.SerialNumber == serialNumber,
                cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Licznik o podanym numerze seryjnym już istnieje.",
                Status = StatusCodes.Status409Conflict
            });
        }

        meter.SerialNumber = serialNumber;
        meter.Name = request.Name.Trim();
        meter.Manufacturer = request.Manufacturer.Trim();
        meter.Model = request.Model.Trim();
        meter.FirmwareVersion = request.FirmwareVersion.Trim();
        meter.Tariff = request.Tariff.Trim();
        meter.SamplingIntervalSeconds = request.SamplingIntervalSeconds;
        meter.City = request.Location.City.Trim();
        meter.Site = request.Location.Site.Trim();
        meter.Latitude = request.Location.Lat;
        meter.Longitude = request.Location.Lng;
        meter.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MeterMapper.ToDto(meter, DateTime.UtcNow));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Disable(Guid id, CancellationToken cancellationToken)
    {
        var meter = await dbContext.Meters.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meter is null)
        {
            return NotFound();
        }

        meter.IsEnabled = false;
        meter.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/readings")]
    [ProducesResponseType<IReadOnlyList<MeterReadingDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MeterReadingDto>>> GetReadings(
        Guid id,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int limit = 2000,
        CancellationToken cancellationToken = default)
    {
        if (!await dbContext.Meters.AnyAsync(x => x.Id == id, cancellationToken))
        {
            return NotFound();
        }

        var from = NormalizeUtc(fromUtc ?? DateTime.UtcNow.AddDays(-1));
        var to = NormalizeUtc(toUtc ?? DateTime.UtcNow);
        if (from > to)
        {
            ModelState.AddModelError(nameof(fromUtc), "Początek zakresu nie może być późniejszy niż koniec.");
            return ValidationProblem(ModelState);
        }

        limit = Math.Clamp(limit, 1, 10000);
        var readings = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == id && x.TimestampUtc >= from && x.TimestampUtc <= to)
            .OrderByDescending(x => x.TimestampUtc)
            .Take(limit)
            .OrderBy(x => x.TimestampUtc)
            .Select(x => new MeterReadingDto(
                x.TimestampUtc,
                x.ActiveImportKwh,
                x.ActiveExportKwh,
                x.ActivePowerKw,
                x.ReactivePowerKvar,
                x.Voltage,
                x.Current,
                x.FrequencyHz,
                x.Quality))
            .ToListAsync(cancellationToken);

        return Ok(readings);
    }

    [HttpGet("{id:guid}/analytics")]
    [ProducesResponseType<MeterAnalyticsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MeterAnalyticsDto>> GetAnalytics(
        Guid id,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string bucket = "day",
        CancellationToken cancellationToken = default)
    {
        var meter = await dbContext.Meters
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meter is null)
        {
            return NotFound();
        }

        var to = NormalizeUtc(toUtc ?? DateTime.UtcNow);
        var from = NormalizeUtc(fromUtc ?? to.AddDays(-30));
        var normalizedBucket = bucket.Trim().ToLowerInvariant();
        if (from >= to)
        {
            ModelState.AddModelError(nameof(fromUtc), "Początek zakresu musi być wcześniejszy niż koniec.");
        }

        if (to - from > TimeSpan.FromDays(366))
        {
            ModelState.AddModelError(nameof(fromUtc), "Zakres analizy nie może przekraczać 366 dni.");
        }

        if (normalizedBucket is not ("hour" or "day" or "month"))
        {
            ModelState.AddModelError(nameof(bucket), "Obsługiwane agregacje to hour, day i month.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var previous = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == id && x.TimestampUtc < from)
            .OrderByDescending(x => x.TimestampUtc)
            .FirstOrDefaultAsync(cancellationToken);
        var readings = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == id && x.TimestampUtc >= from && x.TimestampUtc <= to)
            .OrderBy(x => x.TimestampUtc)
            .ToListAsync(cancellationToken);

        var aggregates = new SortedDictionary<DateTime, AnalyticsAccumulator>();
        MeterReading? preceding = previous;
        foreach (var reading in readings)
        {
            var bucketStart = ResolveBucketStart(reading.TimestampUtc, normalizedBucket);
            if (!aggregates.TryGetValue(bucketStart, out var accumulator))
            {
                accumulator = new AnalyticsAccumulator();
                aggregates.Add(bucketStart, accumulator);
            }

            if (preceding is not null)
            {
                accumulator.ImportedKwh += Math.Max(
                    0,
                    reading.ActiveImportKwh - preceding.ActiveImportKwh);
                accumulator.ExportedKwh += Math.Max(
                    0,
                    reading.ActiveExportKwh - preceding.ActiveExportKwh);
            }

            accumulator.AddPower(reading.ActivePowerKw);
            preceding = reading;
        }

        var maximumImportReading = readings
            .Where(x => x.ActivePowerKw > 0)
            .MaxBy(x => x.ActivePowerKw);
        var maximumExportReading = readings
            .Where(x => x.ActivePowerKw < 0)
            .MinBy(x => x.ActivePowerKw);
        var buckets = aggregates
            .Select(item => new MeterAnalyticsBucketDto(
                item.Key,
                ResolveBucketEnd(item.Key, normalizedBucket),
                Math.Round(item.Value.ImportedKwh, 6),
                Math.Round(item.Value.ExportedKwh, 6),
                Math.Round(item.Value.AveragePowerKw, 4),
                Math.Round(item.Value.AverageAbsolutePowerKw, 4),
                Math.Round(item.Value.MaximumImportPowerKw, 4),
                Math.Round(item.Value.MaximumExportPowerKw, 4),
                item.Value.SampleCount))
            .ToArray();
        var latest = readings.LastOrDefault();

        return Ok(new MeterAnalyticsDto(
            meter.Id,
            meter.SerialNumber,
            meter.Name,
            meter.Tariff,
            meter.SimulationBasePowerKw,
            from,
            to,
            normalizedBucket,
            Math.Round(buckets.Sum(x => x.ImportedKwh), 6),
            Math.Round(buckets.Sum(x => x.ExportedKwh), 6),
            latest?.ActivePowerKw,
            latest?.TimestampUtc,
            Math.Round(maximumImportReading?.ActivePowerKw ?? 0, 4),
            maximumImportReading?.TimestampUtc,
            Math.Round(Math.Abs(maximumExportReading?.ActivePowerKw ?? 0), 4),
            maximumExportReading?.TimestampUtc,
            Math.Round(
                readings.Count == 0
                    ? 0
                    : readings.Average(x => Math.Abs(x.ActivePowerKw)),
                4),
            buckets));
    }

    [HttpGet("{id:guid}/tariff-simulation")]
    [ProducesResponseType<TariffSimulationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TariffSimulationDto>> GetTariffSimulation(
        Guid id,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string tariff = "G12",
        CancellationToken cancellationToken = default)
    {
        var meter = await dbContext.Meters
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (meter is null)
        {
            return NotFound();
        }

        var to = NormalizeUtc(toUtc ?? DateTime.UtcNow);
        var from = NormalizeUtc(fromUtc ?? to.AddDays(-30));
        var targetTariff = tariff.Trim().ToUpperInvariant();
        if (from >= to)
        {
            ModelState.AddModelError(nameof(fromUtc), "Początek zakresu musi być wcześniejszy niż koniec.");
        }

        if (to - from > TimeSpan.FromDays(366))
        {
            ModelState.AddModelError(nameof(fromUtc), "Zakres przeliczenia nie może przekraczać 366 dni.");
        }

        if (targetTariff is not ("G11" or "G12" or "G12W"))
        {
            ModelState.AddModelError(nameof(tariff), "Obsługiwane taryfy to G11, G12 i G12W.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var previous = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == id && x.TimestampUtc < from)
            .OrderByDescending(x => x.TimestampUtc)
            .FirstOrDefaultAsync(cancellationToken);
        var readings = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == id && x.TimestampUtc >= from && x.TimestampUtc <= to)
            .OrderBy(x => x.TimestampUtc)
            .ToListAsync(cancellationToken);

        var zones = CreateTariffZones(targetTariff);
        MeterReading? preceding = previous;
        foreach (var reading in readings)
        {
            if (preceding is not null)
            {
                var importedKwh = Math.Max(0, reading.ActiveImportKwh - preceding.ActiveImportKwh);
                var intervalMiddleUtc = preceding.TimestampUtc.AddTicks(
                    (reading.TimestampUtc - preceding.TimestampUtc).Ticks / 2);
                zones[ResolveTariffZone(targetTariff, intervalMiddleUtc)].EnergyKwh += importedKwh;
            }

            preceding = reading;
        }

        var totalImportedKwh = zones.Values.Sum(x => x.EnergyKwh);
        var zoneDtos = zones.Values
            .Select(x => new TariffZoneDto(
                x.Code,
                x.Name,
                Math.Round(x.EnergyKwh, 6),
                totalImportedKwh == 0
                    ? 0
                    : Math.Round(x.EnergyKwh / totalImportedKwh * 100, 2)))
            .ToArray();

        return Ok(new TariffSimulationDto(
            meter.Id,
            meter.Tariff,
            targetTariff,
            from,
            to,
            Math.Round(totalImportedKwh, 6),
            zoneDtos));
    }

    private static Dictionary<string, TariffZoneAccumulator> CreateTariffZones(string tariff) =>
        tariff switch
        {
            "G11" => new()
            {
                ["ALL_DAY"] = new("ALL_DAY", "Całodobowa")
            },
            "G12" => new()
            {
                ["DAY"] = new("DAY", "Dzienna"),
                ["NIGHT"] = new("NIGHT", "Nocna")
            },
            _ => new()
            {
                ["PEAK"] = new("PEAK", "Szczytowa"),
                ["OFF_PEAK"] = new("OFF_PEAK", "Pozaszczytowa i weekend")
            }
        };

    private static string ResolveTariffZone(string tariff, DateTime timestampUtc)
    {
        if (tariff == "G11")
        {
            return "ALL_DAY";
        }

        var local = TimeZoneInfo.ConvertTimeFromUtc(timestampUtc, WarsawTimeZone);
        var isOffPeakHour = local.Hour < 6 || local.Hour >= 22 || local.Hour is >= 13 and < 15;
        if (tariff == "G12")
        {
            return isOffPeakHour ? "NIGHT" : "DAY";
        }

        var isWeekend = local.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
        return isWeekend || isOffPeakHour ? "OFF_PEAK" : "PEAK";
    }

    private static readonly TimeZoneInfo WarsawTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    private sealed record TariffZoneAccumulator(string Code, string Name)
    {
        public double EnergyKwh { get; set; }
    }

    private static DateTime ResolveBucketStart(DateTime timestamp, string bucket) =>
        bucket switch
        {
            "hour" => new DateTime(
                timestamp.Year,
                timestamp.Month,
                timestamp.Day,
                timestamp.Hour,
                0,
                0,
                DateTimeKind.Utc),
            "month" => new DateTime(
                timestamp.Year,
                timestamp.Month,
                1,
                0,
                0,
                0,
                DateTimeKind.Utc),
            _ => timestamp.Date
        };

    private static DateTime ResolveBucketEnd(DateTime start, string bucket) =>
        bucket switch
        {
            "hour" => start.AddHours(1),
            "month" => start.AddMonths(1),
            _ => start.AddDays(1)
        };

    private sealed class AnalyticsAccumulator
    {
        private double powerSum;
        private double absolutePowerSum;

        public double ImportedKwh { get; set; }
        public double ExportedKwh { get; set; }
        public double MaximumImportPowerKw { get; private set; }
        public double MaximumExportPowerKw { get; private set; }
        public int SampleCount { get; private set; }
        public double AveragePowerKw => SampleCount == 0 ? 0 : powerSum / SampleCount;
        public double AverageAbsolutePowerKw =>
            SampleCount == 0 ? 0 : absolutePowerSum / SampleCount;

        public void AddPower(double powerKw)
        {
            powerSum += powerKw;
            absolutePowerSum += Math.Abs(powerKw);
            MaximumImportPowerKw = Math.Max(MaximumImportPowerKw, powerKw);
            MaximumExportPowerKw = Math.Max(MaximumExportPowerKw, -powerKw);
            SampleCount++;
        }
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
