using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Contracts;
using ReactApp.Server.Data;
using ReactApp.Server.Models;
using ReactApp.Server.Services;

namespace ReactApp.Server.Controllers;

[ApiController]
[Route("api/simulators")]
public sealed class SimulatorsController(
    AppDbContext dbContext,
    SimulationWriteLock simulationWriteLock) : ControllerBase
{
    private static readonly HashSet<string> SupportedTariffs =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "G11",
            "G12",
            "G12W",
            "C11",
            "A23"
        };

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<SimulatorDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SimulatorDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var simulators = await dbContext.Meters
            .AsNoTracking()
            .Where(meter => meter.IsSimulated)
            .OrderBy(meter => meter.Name)
            .Select(meter => new SimulatorDto(
                meter.Id,
                meter.SerialNumber,
                meter.Name,
                meter.Tariff,
                meter.SimulationBasePowerKw ?? 0,
                meter.IsEnabled,
                meter.SamplingIntervalSeconds,
                meter.City,
                meter.Site,
                meter.CreatedAtUtc,
                meter.Readings
                    .Select(reading => (DateTime?)reading.TimestampUtc)
                    .Min(),
                meter.LastSeenAtUtc,
                meter.Readings.LongCount(),
                meter.LatestActiveImportKwh,
                meter.LatestActiveExportKwh,
                meter.LatestActivePowerKw))
            .ToListAsync(cancellationToken);

        return Ok(simulators);
    }

    [HttpPost]
    [ProducesResponseType<SimulatorDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SimulatorDto>> Create(
        CreateSimulatorRequest request,
        CancellationToken cancellationToken)
    {
        var tariff = request.Tariff.Trim().ToUpperInvariant();
        var utcNow = DateTime.UtcNow;
        var startAtUtc = NormalizeUtc(request.StartAtUtc ?? utcNow);
        if (!SupportedTariffs.Contains(tariff))
        {
            ModelState.AddModelError(
                nameof(request.Tariff),
                "Obsługiwane taryfy to G11, G12, G12W, C11 i A23.");
        }

        if (tariff is not "A23" && request.BasePowerKw > 40)
        {
            ModelState.AddModelError(
                nameof(request.BasePowerKw),
                "Dla taryf G11, G12, G12W i C11 moc bazowa nie może przekraczać 40 kW.");
        }

        if (startAtUtc > utcNow)
        {
            ModelState.AddModelError(
                nameof(request.StartAtUtc),
                "Data rozpoczęcia nie może być późniejsza niż aktualny czas.");
        }

        if (startAtUtc < utcNow.AddDays(-365))
        {
            ModelState.AddModelError(
                nameof(request.StartAtUtc),
                "Data rozpoczęcia nie może być starsza niż 365 dni.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        await simulationWriteLock.Gate.WaitAsync(cancellationToken);
        try
        {
            var serialNumber = string.IsNullOrWhiteSpace(request.SerialNumber)
                ? await GenerateSerialNumberAsync(tariff, cancellationToken)
                : request.SerialNumber.Trim().ToUpperInvariant();

            if (await dbContext.Meters.AnyAsync(
                    meter => meter.SerialNumber == serialNumber,
                    cancellationToken))
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
                Manufacturer = "Symulator Twoj Licznik",
                Model = $"Profil {tariff}",
                FirmwareVersion = "1.0.0",
                Tariff = tariff,
                SamplingIntervalSeconds = request.SamplingIntervalSeconds,
                City = request.City.Trim(),
                Site = request.Site.Trim(),
                Latitude = request.Lat,
                Longitude = request.Lng,
                IsSimulated = true,
                SimulationBasePowerKw = request.BasePowerKw,
                LastSeenAtUtc = startAtUtc,
                LastReadingQuality = ReadingQuality.Valid,
                LatestActiveImportKwh = request.InitialImportKwh,
                LatestActiveExportKwh = request.InitialExportKwh,
                LatestActivePowerKw = 0
            };
            var firstReading = CreateBaselineReading(
                meter,
                startAtUtc,
                request.InitialImportKwh,
                request.InitialExportKwh);
            var readings = GenerateHistoricalReadings(
                meter,
                firstReading,
                utcNow,
                request.HistoricalIntervalMinutes);

            dbContext.Meters.Add(meter);
            dbContext.MeterReadings.AddRange(readings);
            ApplyLatestReading(meter, readings[^1]);
            await dbContext.SaveChangesAsync(cancellationToken);

            var dto = ToDto(meter, readings.Count, startAtUtc);
            return Created($"/api/simulators/{meter.Id}", dto);
        }
        finally
        {
            simulationWriteLock.Gate.Release();
        }
    }

    [HttpPut("{id:guid}/state")]
    [ProducesResponseType<SimulatorDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SimulatorDto>> SetState(
        Guid id,
        SetSimulatorStateRequest request,
        CancellationToken cancellationToken)
    {
        await simulationWriteLock.Gate.WaitAsync(cancellationToken);
        try
        {
            var meter = await dbContext.Meters
                .SingleOrDefaultAsync(
                    item => item.Id == id && item.IsSimulated,
                    cancellationToken);
            if (meter is null)
            {
                return NotFound();
            }

            if (request.IsEnabled && !meter.IsEnabled)
            {
                var utcNow = DateTime.UtcNow;
                dbContext.MeterReadings.Add(CreateBaselineReading(
                    meter,
                    utcNow,
                    meter.LatestActiveImportKwh ?? 0,
                    meter.LatestActiveExportKwh ?? 0));
                meter.LastSeenAtUtc = utcNow;
                meter.LatestActivePowerKw = 0;
            }

            meter.IsEnabled = request.IsEnabled;
            meter.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);

            var readingCount = await dbContext.MeterReadings.LongCountAsync(
                reading => reading.MeterId == id,
                cancellationToken);
            var startedAtUtc = await dbContext.MeterReadings
                .Where(reading => reading.MeterId == id)
                .MinAsync(reading => (DateTime?)reading.TimestampUtc, cancellationToken);
            return Ok(ToDto(meter, readingCount, startedAtUtc));
        }
        finally
        {
            simulationWriteLock.Gate.Release();
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType<DeleteSimulatorResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeleteSimulatorResult>> Delete(
        Guid id,
        [FromQuery] string confirmSerial,
        CancellationToken cancellationToken)
    {
        await simulationWriteLock.Gate.WaitAsync(cancellationToken);
        try
        {
            var meter = await dbContext.Meters
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    item => item.Id == id && item.IsSimulated,
                    cancellationToken);
            if (meter is null)
            {
                return NotFound();
            }

            if (!string.Equals(
                    meter.SerialNumber,
                    confirmSerial?.Trim(),
                    StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Potwierdzenie numeru seryjnego jest nieprawidłowe.",
                    Detail = "Aby trwale usunąć symulator, podaj jego pełny numer seryjny.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            await using var transaction =
                await dbContext.Database.BeginTransactionAsync(cancellationToken);
            var deletedReadings = await dbContext.MeterReadings
                .Where(reading => reading.MeterId == id)
                .ExecuteDeleteAsync(cancellationToken);
            var deletedMeters = await dbContext.Meters
                .Where(item => item.Id == id && item.IsSimulated)
                .ExecuteDeleteAsync(cancellationToken);

            if (deletedMeters != 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                return NotFound();
            }

            await transaction.CommitAsync(cancellationToken);
            return Ok(new DeleteSimulatorResult(
                id,
                meter.SerialNumber,
                deletedReadings));
        }
        finally
        {
            simulationWriteLock.Gate.Release();
        }
    }

    private async Task<string> GenerateSerialNumberAsync(
        string tariff,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            var serialNumber = $"SIM-{tariff}-{suffix}";
            if (!await dbContext.Meters.AnyAsync(
                    meter => meter.SerialNumber == serialNumber,
                    cancellationToken))
            {
                return serialNumber;
            }
        }

        throw new InvalidOperationException("Nie udało się wygenerować unikalnego numeru seryjnego.");
    }

    private static MeterReading CreateBaselineReading(
        Meter meter,
        DateTime timestampUtc,
        double importKwh,
        double exportKwh) =>
        new()
        {
            MeterId = meter.Id,
            TimestampUtc = timestampUtc,
            ActiveImportKwh = importKwh,
            ActiveExportKwh = exportKwh,
            ActivePowerKw = 0,
            ReactivePowerKvar = 0,
            Voltage = 230,
            Current = 0,
            FrequencyHz = 50,
            Quality = ReadingQuality.Valid
        };

    private static List<MeterReading> GenerateHistoricalReadings(
        Meter meter,
        MeterReading firstReading,
        DateTime endAtUtc,
        int historicalIntervalMinutes)
    {
        var readings = new List<MeterReading> { firstReading };
        var interval = TimeSpan.FromMinutes(
            Math.Clamp(historicalIntervalMinutes, 5, 60));
        var timestamp = firstReading.TimestampUtc.Add(interval);
        var previous = firstReading;

        while (timestamp < endAtUtc)
        {
            previous = MeterSimulationWorker.CreateReading(
                meter,
                timestamp,
                interval,
                previous.ActiveImportKwh,
                previous.ActiveExportKwh);
            readings.Add(previous);
            timestamp = timestamp.Add(interval);
        }

        if (previous.TimestampUtc < endAtUtc)
        {
            readings.Add(MeterSimulationWorker.CreateReading(
                meter,
                endAtUtc,
                endAtUtc - previous.TimestampUtc,
                previous.ActiveImportKwh,
                previous.ActiveExportKwh));
        }

        return readings;
    }

    private static void ApplyLatestReading(Meter meter, MeterReading reading)
    {
        meter.LastSeenAtUtc = reading.TimestampUtc;
        meter.LastReadingQuality = reading.Quality;
        meter.LatestActiveImportKwh = reading.ActiveImportKwh;
        meter.LatestActiveExportKwh = reading.ActiveExportKwh;
        meter.LatestActivePowerKw = reading.ActivePowerKw;
        meter.UpdatedAtUtc = DateTime.UtcNow;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    private static SimulatorDto ToDto(
        Meter meter,
        long readingCount,
        DateTime? startedAtUtc) =>
        new(
            meter.Id,
            meter.SerialNumber,
            meter.Name,
            meter.Tariff,
            meter.SimulationBasePowerKw ?? 0,
            meter.IsEnabled,
            meter.SamplingIntervalSeconds,
            meter.City,
            meter.Site,
            meter.CreatedAtUtc,
            startedAtUtc,
            meter.LastSeenAtUtc,
            readingCount,
            meter.LatestActiveImportKwh,
            meter.LatestActiveExportKwh,
            meter.LatestActivePowerKw);
}
