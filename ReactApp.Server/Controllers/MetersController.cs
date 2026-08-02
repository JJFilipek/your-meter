using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ReactApp.Server.Configuration;
using ReactApp.Server.Contracts;
using ReactApp.Server.Data;
using ReactApp.Server.Models;
using ReactApp.Server.Services;

namespace ReactApp.Server.Controllers;

[ApiController]
[Route("api/meters")]
public sealed class MetersController(
    AppDbContext dbContext,
    EnergyPricingService pricing,
    IOptions<NetworkOptions> networkOptions) : ControllerBase
{
    private readonly NetworkOptions network = networkOptions.Value;

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
                x.ActiveGenerationKwh,
                x.ActivePowerKw,
                x.GenerationPowerKw,
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

        var exportRate = pricing.ExportCompensationPlnPerKwh;
        var lineResistanceOhms = Math.Max(0, network.LineResistanceOhms);
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
                var importedKwh = Math.Max(0, reading.ActiveImportKwh - preceding.ActiveImportKwh);
                var exportedKwh = Math.Max(0, reading.ActiveExportKwh - preceding.ActiveExportKwh);
                var generatedKwh = Math.Max(0, reading.ActiveGenerationKwh - preceding.ActiveGenerationKwh);
                var intervalMiddleUtc = preceding.TimestampUtc.AddTicks(
                    (reading.TimestampUtc - preceding.TimestampUtc).Ticks / 2);
                var zoneRate = pricing.ZoneRatePlnPerKwh(
                    meter.Tariff,
                    ResolveTariffZone(meter.Tariff, intervalMiddleUtc));
                accumulator.ImportedKwh += importedKwh;
                accumulator.ExportedKwh += exportedKwh;
                accumulator.GeneratedKwh += generatedKwh;
                accumulator.SelfConsumedKwh += Math.Max(0, generatedKwh - exportedKwh);
                accumulator.NetCostPln += importedKwh * zoneRate - exportedKwh * exportRate;

                // Real resistive losses over the interval: E = I²·R·Δt, from the measured current.
                var current = reading.Current ?? 0;
                var intervalHours = Math.Min((reading.TimestampUtc - preceding.TimestampUtc).TotalHours, 3);
                if (current > 0 && intervalHours > 0)
                {
                    accumulator.LossKwh += current * current * lineResistanceOhms * intervalHours / 1000d;
                }
            }

            accumulator.AddPower(reading.ActivePowerKw);
            accumulator.AddGenerationPower(reading.GenerationPowerKw);
            preceding = reading;
        }

        var maximumImportReading = readings
            .Where(x => x.ActivePowerKw > 0)
            .MaxBy(x => x.ActivePowerKw);
        var maximumExportReading = readings
            .Where(x => x.ActivePowerKw < 0)
            .MinBy(x => x.ActivePowerKw);
        var maximumGenerationReading = readings
            .Where(x => x.GenerationPowerKw > 0)
            .MaxBy(x => x.GenerationPowerKw);
        var buckets = aggregates
            .Select(item => new MeterAnalyticsBucketDto(
                item.Key,
                ResolveBucketEnd(item.Key, normalizedBucket),
                Math.Round(item.Value.ImportedKwh, 6),
                Math.Round(item.Value.ExportedKwh, 6),
                Math.Round(item.Value.GeneratedKwh, 6),
                Math.Round(item.Value.SelfConsumedKwh, 6),
                Math.Round(item.Value.AveragePowerKw, 4),
                Math.Round(item.Value.AverageAbsolutePowerKw, 4),
                Math.Round(item.Value.MaximumImportPowerKw, 4),
                Math.Round(item.Value.MaximumExportPowerKw, 4),
                Math.Round(item.Value.MaximumGenerationPowerKw, 4),
                Math.Round(item.Value.NetCostPln, 2),
                Math.Round(item.Value.LossKwh, 6),
                item.Value.SampleCount))
            .ToArray();
        var latest = readings.LastOrDefault();
        var basePowerKw = pricing.ResolveBasePowerKw(meter);
        var totalGeneratedKwh = buckets.Sum(x => x.GeneratedKwh);
        var totalSelfConsumedKwh = buckets.Sum(x => x.SelfConsumedKwh);
        // Only completed periods feed the forecast; the current, still-open bucket would
        // otherwise drag the fit toward zero.
        var (generatedForecastKwh, generatedTrendPercent) = ForecastNext(
            buckets.Where(x => x.EndUtc <= to).Select(x => x.GeneratedKwh).ToArray());

        return Ok(new MeterAnalyticsDto(
            meter.Id,
            meter.SerialNumber,
            meter.Name,
            meter.Tariff,
            meter.SimulationBasePowerKw,
            EnergyPricingService.ContractedPowerKw(basePowerKw),
            EnergyPricingService.ConnectionPowerKw(basePowerKw),
            from,
            to,
            normalizedBucket,
            Math.Round(buckets.Sum(x => x.ImportedKwh), 6),
            Math.Round(buckets.Sum(x => x.ExportedKwh), 6),
            Math.Round(totalGeneratedKwh, 6),
            Math.Round(totalSelfConsumedKwh, 6),
            totalGeneratedKwh <= 0 ? 0 : Math.Round(totalSelfConsumedKwh / totalGeneratedKwh, 4),
            Math.Round(buckets.Sum(x => x.NetCostPln), 2),
            Math.Round(buckets.Sum(x => x.LossKwh), 6),
            Math.Round(generatedForecastKwh, 4),
            Math.Round(generatedTrendPercent, 2),
            latest?.ActivePowerKw,
            latest?.GenerationPowerKw,
            latest?.TimestampUtc,
            Math.Round(maximumImportReading?.ActivePowerKw ?? 0, 4),
            maximumImportReading?.TimestampUtc,
            Math.Round(Math.Abs(maximumExportReading?.ActivePowerKw ?? 0), 4),
            maximumExportReading?.TimestampUtc,
            Math.Round(maximumGenerationReading?.GenerationPowerKw ?? 0, 4),
            maximumGenerationReading?.TimestampUtc,
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
        var totalExportedKwh = 0d;
        MeterReading? preceding = previous;
        foreach (var reading in readings)
        {
            if (preceding is not null)
            {
                var importedKwh = Math.Max(0, reading.ActiveImportKwh - preceding.ActiveImportKwh);
                totalExportedKwh += Math.Max(0, reading.ActiveExportKwh - preceding.ActiveExportKwh);
                var intervalMiddleUtc = preceding.TimestampUtc.AddTicks(
                    (reading.TimestampUtc - preceding.TimestampUtc).Ticks / 2);
                zones[ResolveTariffZone(targetTariff, intervalMiddleUtc)].EnergyKwh += importedKwh;
            }

            preceding = reading;
        }

        var totalImportedKwh = zones.Values.Sum(x => x.EnergyKwh);
        var zoneDtos = zones.Values
            .Select(x =>
            {
                var rate = pricing.ZoneRatePlnPerKwh(targetTariff, x.Code);
                return new TariffZoneDto(
                    x.Code,
                    x.Name,
                    Math.Round(x.EnergyKwh, 6),
                    totalImportedKwh == 0
                        ? 0
                        : Math.Round(x.EnergyKwh / totalImportedKwh * 100, 2),
                    rate,
                    Math.Round(x.EnergyKwh * rate, 2));
            })
            .ToArray();
        var energyCostPln = zoneDtos.Sum(x => x.CostPln);
        var exportCompensationPln = totalExportedKwh * pricing.ExportCompensationPlnPerKwh;

        return Ok(new TariffSimulationDto(
            meter.Id,
            meter.Tariff,
            targetTariff,
            from,
            to,
            Math.Round(totalImportedKwh, 6),
            Math.Round(totalExportedKwh, 6),
            Math.Round(energyCostPln, 2),
            Math.Round(exportCompensationPln, 2),
            Math.Round(energyCostPln - exportCompensationPln, 2),
            zoneDtos));
    }

    [HttpGet("{id:guid}/insights")]
    [ProducesResponseType<MeterInsightsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MeterInsightsDto>> GetInsights(
        Guid id,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string register = "import",
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
        var normalizedRegister = register.Trim().ToLowerInvariant() == "export" ? "export" : "import";
        if (from >= to)
        {
            ModelState.AddModelError(nameof(fromUtc), "Początek zakresu musi być wcześniejszy niż koniec.");
        }

        if (to - from > TimeSpan.FromDays(366))
        {
            ModelState.AddModelError(nameof(fromUtc), "Zakres analizy nie może przekraczać 366 dni.");
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

        var basePowerKw = pricing.ResolveBasePowerKw(meter);
        var contractedPowerKw = EnergyPricingService.ContractedPowerKw(basePowerKw);
        var connectionPowerKw = EnergyPricingService.ConnectionPowerKw(basePowerKw);
        var alertThresholdKw = Math.Round(contractedPowerKw * 0.9, 4);

        double RegisterPower(MeterReading reading) => normalizedRegister == "export"
            ? Math.Max(0, -reading.ActivePowerKw)
            : Math.Max(0, reading.ActivePowerKw);

        var latest = readings.LastOrDefault();
        var currentPowerKw = latest is null ? 0 : RegisterPower(latest);
        var peakReading = readings.MaxBy(RegisterPower);
        var peakPowerKw = peakReading is null ? 0 : RegisterPower(peakReading);
        var averagePowerKw = readings.Count == 0 ? 0 : readings.Average(RegisterPower);

        // Daily maxima (local calendar day).
        var dailyMaxima = readings
            .GroupBy(x => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(x.TimestampUtc, WarsawTimeZone)))
            .Select(g => new PmaxDailyMaximumDto(g.Key, Math.Round(g.Max(RegisterPower), 4)))
            .OrderByDescending(x => x.Date)
            .ToArray();
        var utilizationPercent = dailyMaxima.Length == 0 || contractedPowerKw <= 0
            ? 0
            : Math.Round(dailyMaxima.Average(x => x.MaximumPowerKw) / contractedPowerKw * 100, 1);

        // Hour x weekday distribution (Mon=0 .. Sun=6).
        var distributionAccumulators = new Dictionary<(int Weekday, int Hour), (double Sum, double Max, int Count)>();
        foreach (var reading in readings)
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(reading.TimestampUtc, WarsawTimeZone);
            var weekday = ((int)local.DayOfWeek + 6) % 7;
            var key = (weekday, local.Hour);
            var power = RegisterPower(reading);
            distributionAccumulators.TryGetValue(key, out var cell);
            distributionAccumulators[key] = (cell.Sum + power, Math.Max(cell.Max, power), cell.Count + 1);
        }

        var distribution = distributionAccumulators
            .Select(x => new PmaxDistributionCellDto(
                x.Key.Weekday,
                x.Key.Hour,
                Math.Round(x.Value.Sum / x.Value.Count, 4),
                Math.Round(x.Value.Max, 4),
                x.Value.Count))
            .OrderBy(x => x.Weekday).ThenBy(x => x.Hour)
            .ToArray();

        // Exceedance events (rising edges above a threshold).
        var contractedEvents = FindExceedanceEvents(readings, RegisterPower, contractedPowerKw);
        var connectionEvents = FindExceedanceEvents(readings, RegisterPower, connectionPowerKw);
        var thresholdEvents = FindExceedanceEvents(readings, RegisterPower, alertThresholdKw);

        // Estimated energy cost of the period (for bill-impact context).
        var estimatedEnergyCostPln = 0d;
        MeterReading? preceding = previous;
        foreach (var reading in readings)
        {
            if (preceding is not null)
            {
                var importedKwh = Math.Max(0, reading.ActiveImportKwh - preceding.ActiveImportKwh);
                var intervalMiddleUtc = preceding.TimestampUtc.AddTicks(
                    (reading.TimestampUtc - preceding.TimestampUtc).Ticks / 2);
                estimatedEnergyCostPln += importedKwh
                    * pricing.ZoneRatePlnPerKwh(meter.Tariff, ResolveTariffZone(meter.Tariff, intervalMiddleUtc));
            }

            preceding = reading;
        }

        // Per-zone exceedance breakdown against contracted power. Costs are summed over the
        // contracted exceedance events falling in each zone, so the zone rows reconcile with
        // the overall contracted penalty.
        var zoneNames = ZoneDisplayNames(meter.Tariff);
        var contractedPenaltyByZone = contractedEvents
            .GroupBy(e => ResolveTariffZone(meter.Tariff, e.TimestampUtc))
            .ToDictionary(
                g => g.Key,
                g => g.Sum(e => Math.Max(0, e.PeakPowerKw - contractedPowerKw) * pricing.ContractedPowerExceedancePenaltyPlnPerKw));
        var zoneExceedances = readings
            .GroupBy(x => ResolveTariffZone(meter.Tariff, x.TimestampUtc))
            .Select(g =>
            {
                var zonePeak = g.Max(RegisterPower);
                var exceedance = Math.Max(0, zonePeak - contractedPowerKw);
                return new PmaxZoneExceedanceDto(
                    g.Key,
                    zoneNames.GetValueOrDefault(g.Key, g.Key),
                    contractedPowerKw,
                    Math.Round(zonePeak, 4),
                    Math.Round(exceedance, 4),
                    Math.Round(contractedPenaltyByZone.GetValueOrDefault(g.Key, 0), 2));
            })
            .OrderByDescending(x => x.ExceedanceKw)
            .ToArray();

        var contractedPenalty = contractedEvents.Sum(e =>
            Math.Max(0, e.PeakPowerKw - contractedPowerKw) * pricing.ContractedPowerExceedancePenaltyPlnPerKw);
        var connectionPenalty = connectionEvents.Sum(e =>
            Math.Max(0, e.PeakPowerKw - connectionPowerKw) * pricing.ConnectionPowerExceedancePenaltyPlnPerKw);
        var additionalCostPln = Math.Round(contractedPenalty + connectionPenalty, 2);
        var billImpactPercent = estimatedEnergyCostPln <= 0
            ? 0
            : Math.Round(additionalCostPln / estimatedEnergyCostPln * 100, 1);

        var exceedanceCost = new PmaxExceedanceCostDto(
            contractedEvents.Count,
            connectionEvents.Count,
            additionalCostPln,
            Math.Round(estimatedEnergyCostPln, 2),
            billImpactPercent,
            zoneExceedances);

        // Alerts (most recent events first).
        var registerLabel = normalizedRegister == "export" ? "oddawania" : "poboru";
        var alerts = new List<PmaxAlertDto>();
        foreach (var e in connectionEvents)
        {
            alerts.Add(new PmaxAlertDto(
                e.TimestampUtc,
                "danger",
                $"Przekroczono moc przyłącza {registerLabel}: {e.PeakPowerKw:0.0} kW (limit {connectionPowerKw:0.0} kW)"));
        }

        foreach (var e in contractedEvents)
        {
            alerts.Add(new PmaxAlertDto(
                e.TimestampUtc,
                "warning",
                $"Przekroczono moc umowną {registerLabel}: {e.PeakPowerKw:0.0} kW (limit {contractedPowerKw:0.0} kW)"));
        }

        var trimmedAlerts = alerts
            .OrderByDescending(x => x.TimestampUtc)
            .Take(12)
            .ToArray();

        // Recommendations derived from the distribution and utilisation.
        var recommendations = BuildRecommendations(
            distribution,
            thresholdEvents.Count,
            alertThresholdKw,
            utilizationPercent,
            peakPowerKw,
            connectionPowerKw,
            registerLabel);

        return Ok(new MeterInsightsDto(
            meter.Id,
            meter.SerialNumber,
            meter.Name,
            meter.Tariff,
            normalizedRegister,
            from,
            to,
            contractedPowerKw,
            connectionPowerKw,
            alertThresholdKw,
            Math.Round(currentPowerKw, 4),
            Math.Round(peakPowerKw, 4),
            peakReading?.TimestampUtc,
            Math.Round(averagePowerKw, 4),
            utilizationPercent,
            thresholdEvents.Count,
            dailyMaxima,
            distribution,
            trimmedAlerts,
            recommendations,
            exceedanceCost));
    }

    private sealed record ExceedanceEvent(DateTime TimestampUtc, double PeakPowerKw);

    private static List<ExceedanceEvent> FindExceedanceEvents(
        IReadOnlyList<MeterReading> readings,
        Func<MeterReading, double> powerSelector,
        double threshold)
    {
        var events = new List<ExceedanceEvent>();
        if (threshold <= 0)
        {
            return events;
        }

        var inEvent = false;
        DateTime eventStart = default;
        var eventPeak = 0d;
        foreach (var reading in readings)
        {
            var power = powerSelector(reading);
            if (power >= threshold)
            {
                if (!inEvent)
                {
                    inEvent = true;
                    eventStart = reading.TimestampUtc;
                    eventPeak = power;
                }
                else
                {
                    eventPeak = Math.Max(eventPeak, power);
                }
            }
            else if (inEvent)
            {
                events.Add(new ExceedanceEvent(eventStart, Math.Round(eventPeak, 4)));
                inEvent = false;
            }
        }

        if (inEvent)
        {
            events.Add(new ExceedanceEvent(eventStart, Math.Round(eventPeak, 4)));
        }

        return events;
    }

    private static IReadOnlyList<string> BuildRecommendations(
        IReadOnlyList<PmaxDistributionCellDto> distribution,
        int thresholdExceedanceCount,
        double alertThresholdKw,
        double utilizationPercent,
        double peakPowerKw,
        double connectionPowerKw,
        string registerLabel)
    {
        var recommendations = new List<string>();
        if (distribution.Count > 0)
        {
            var peakHourGroup = distribution
                .GroupBy(x => x.Hour)
                .Select(g => new { Hour = g.Key, Average = g.Average(x => x.AveragePowerKw) })
                .MaxBy(x => x.Average);
            if (peakHourGroup is not null)
            {
                recommendations.Add(
                    $"Najczęstsze szczyty {registerLabel} między {peakHourGroup.Hour:00}:00 a {(peakHourGroup.Hour + 1) % 24:00}:00 – rozważ przesunięcie pracy urządzeń poza ten czas.");
            }
        }

        if (thresholdExceedanceCount > 0)
        {
            recommendations.Add(
                $"W wybranym okresie {thresholdExceedanceCount}× przekroczono próg alertu {alertThresholdKw:0.0} kW.");
        }

        recommendations.Add(
            $"Średnie wykorzystanie mocy umownej: {utilizationPercent:0.#}% – {(utilizationPercent > 85 ? "warto rozważyć zwiększenie mocy umownej." : "moc umowna z zapasem pokrywa zapotrzebowanie.")}");

        if (peakPowerKw > connectionPowerKw)
        {
            recommendations.Add(
                $"Szczyt {peakPowerKw:0.0} kW przekroczył moc przyłącza {connectionPowerKw:0.0} kW – ryzyko zadziałania zabezpieczeń.");
        }

        return recommendations;
    }

    private static Dictionary<string, string> ZoneDisplayNames(string tariff) =>
        tariff.Trim().ToUpperInvariant() switch
        {
            "G11" or "C11" => new() { ["ALL_DAY"] = "Całodobowa" },
            "G12" => new() { ["DAY"] = "Dzienna", ["NIGHT"] = "Nocna" },
            _ => new() { ["PEAK"] = "Szczytowa", ["OFF_PEAK"] = "Pozaszczytowa i weekend" }
        };

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
        if (tariff is "G11" or "C11")
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

    /// <summary>
    /// Predicts the next bucket value with an ordinary least-squares fit over the most recent
    /// history and reports the trend as the per-step slope relative to the mean. Real data in,
    /// real projection out – no fixed factors.
    /// </summary>
    private static (double Next, double TrendPercent) ForecastNext(IReadOnlyList<double> values)
    {
        var count = values.Count;
        if (count == 0)
        {
            return (0, 0);
        }

        if (count == 1)
        {
            return (Math.Max(0, values[0]), 0);
        }

        var window = Math.Min(14, count);
        var series = values.Skip(count - window).ToArray();
        var length = series.Length;
        double sumX = 0, sumY = 0, sumXx = 0, sumXy = 0;
        for (var index = 0; index < length; index++)
        {
            sumX += index;
            sumY += series[index];
            sumXx += index * index;
            sumXy += index * series[index];
        }

        var denominator = length * sumXx - sumX * sumX;
        var slope = denominator == 0 ? 0 : (length * sumXy - sumX * sumY) / denominator;
        var intercept = (sumY - slope * sumX) / length;
        var next = Math.Max(0, intercept + slope * length);
        var average = sumY / length;
        var trendPercent = average > 0 ? slope / average * 100 : 0;
        return (next, trendPercent);
    }

    private sealed class AnalyticsAccumulator
    {
        private double powerSum;
        private double absolutePowerSum;

        public double ImportedKwh { get; set; }
        public double ExportedKwh { get; set; }
        public double GeneratedKwh { get; set; }
        public double SelfConsumedKwh { get; set; }
        public double NetCostPln { get; set; }
        public double LossKwh { get; set; }
        public double MaximumImportPowerKw { get; private set; }
        public double MaximumExportPowerKw { get; private set; }
        public double MaximumGenerationPowerKw { get; private set; }
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

        public void AddGenerationPower(double generationPowerKw) =>
            MaximumGenerationPowerKw = Math.Max(MaximumGenerationPowerKw, generationPowerKw);
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
