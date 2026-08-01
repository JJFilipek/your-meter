using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Contracts;
using ReactApp.Server.Data;
using ReactApp.Server.Models;

namespace ReactApp.Server.Controllers;

[ApiController]
[Route("api/ingestion/meters")]
public sealed class IngestionController(AppDbContext dbContext) : ControllerBase
{
    [HttpPost("{serialNumber}/readings")]
    [ProducesResponseType<ReadingIngestionResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReadingIngestionResult>> Ingest(
        string serialNumber,
        ReadingBatchRequest request,
        CancellationToken cancellationToken)
    {
        var meter = await dbContext.Meters
            .SingleOrDefaultAsync(x => x.SerialNumber == serialNumber, cancellationToken);
        if (meter is null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Nie znaleziono licznika o podanym numerze seryjnym.",
                Status = StatusCodes.Status404NotFound
            });
        }

        var futureLimit = DateTime.UtcNow.AddMinutes(5);
        var normalized = new List<ReadingSampleRequest>(request.Readings.Count);
        foreach (var sample in request.Readings)
        {
            var timestamp = NormalizeUtc(sample.TimestampUtc);
            if (timestamp == default || timestamp > futureLimit)
            {
                ModelState.AddModelError(
                    nameof(request.Readings),
                    "Znacznik czasu odczytu jest nieprawidłowy lub znajduje się zbyt daleko w przyszłości.");
                return ValidationProblem(ModelState);
            }

            normalized.Add(new ReadingSampleRequest
            {
                TimestampUtc = timestamp,
                ActiveImportKwh = sample.ActiveImportKwh,
                ActiveExportKwh = sample.ActiveExportKwh,
                ActivePowerKw = sample.ActivePowerKw,
                ReactivePowerKvar = sample.ReactivePowerKvar,
                Voltage = sample.Voltage,
                Current = sample.Current,
                FrequencyHz = sample.FrequencyHz,
                Quality = sample.Quality
            });
        }

        var uniqueSamples = normalized
            .GroupBy(x => x.TimestampUtc)
            .Select(x => x.Last())
            .OrderBy(x => x.TimestampUtc)
            .ToArray();
        var minimumTimestamp = uniqueSamples[0].TimestampUtc;
        var maximumTimestamp = uniqueSamples[^1].TimestampUtc;
        var existingReadings = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x =>
                x.MeterId == meter.Id &&
                x.TimestampUtc >= minimumTimestamp &&
                x.TimestampUtc <= maximumTimestamp)
            .Select(x => new RegisterPoint(
                x.TimestampUtc,
                x.ActiveImportKwh,
                x.ActiveExportKwh))
            .ToListAsync(cancellationToken);
        var existingTimestamps = existingReadings
            .Select(x => x.TimestampUtc)
            .ToHashSet();

        var acceptedSamples = uniqueSamples
            .Where(x => !existingTimestamps.Contains(x.TimestampUtc))
            .ToArray();

        var previousReading = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == meter.Id && x.TimestampUtc < minimumTimestamp)
            .OrderByDescending(x => x.TimestampUtc)
            .Select(x => new RegisterPoint(
                x.TimestampUtc,
                x.ActiveImportKwh,
                x.ActiveExportKwh))
            .FirstOrDefaultAsync(cancellationToken);
        var nextReading = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.MeterId == meter.Id && x.TimestampUtc > maximumTimestamp)
            .OrderBy(x => x.TimestampUtc)
            .Select(x => new RegisterPoint(
                x.TimestampUtc,
                x.ActiveImportKwh,
                x.ActiveExportKwh))
            .FirstOrDefaultAsync(cancellationToken);
        var sequence = existingReadings
            .Concat(acceptedSamples.Select(x => new RegisterPoint(
                x.TimestampUtc,
                x.ActiveImportKwh,
                x.ActiveExportKwh)))
            .Append(previousReading)
            .Append(nextReading)
            .Where(x => x is not null)
            .OrderBy(x => x!.TimestampUtc)
            .ToArray();

        for (var index = 1; index < sequence.Length; index++)
        {
            var previous = sequence[index - 1]!;
            var current = sequence[index]!;
            if (current.ActiveImportKwh < previous.ActiveImportKwh
                || current.ActiveExportKwh < previous.ActiveExportKwh)
            {
                ModelState.AddModelError(
                    nameof(request.Readings),
                    $"Rejestry A+ i A- nie mogą maleć. Naruszenie pomiędzy {previous.TimestampUtc:O} a {current.TimestampUtc:O}.");
                return ValidationProblem(ModelState);
            }
        }

        foreach (var sample in acceptedSamples)
        {
            dbContext.MeterReadings.Add(new MeterReading
            {
                MeterId = meter.Id,
                TimestampUtc = sample.TimestampUtc,
                ActiveImportKwh = sample.ActiveImportKwh,
                ActiveExportKwh = sample.ActiveExportKwh,
                ActivePowerKw = sample.ActivePowerKw,
                ReactivePowerKvar = sample.ReactivePowerKvar,
                Voltage = sample.Voltage,
                Current = sample.Current,
                FrequencyHz = sample.FrequencyHz,
                Quality = sample.Quality
            });
        }

        var latest = acceptedSamples.LastOrDefault();
        if (latest is not null
            && (meter.LastSeenAtUtc is null || latest.TimestampUtc >= meter.LastSeenAtUtc))
        {
            meter.LastSeenAtUtc = latest.TimestampUtc;
            meter.LastReadingQuality = latest.Quality;
            meter.LatestActiveImportKwh = latest.ActiveImportKwh;
            meter.LatestActiveExportKwh = latest.ActiveExportKwh;
            meter.LatestActivePowerKw = latest.ActivePowerKw;
            meter.UpdatedAtUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var duplicateCount = normalized.Count - acceptedSamples.Length;

        return Ok(new ReadingIngestionResult(
            acceptedSamples.Length,
            duplicateCount,
            meter.LastSeenAtUtc));
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    private sealed record RegisterPoint(
        DateTime TimestampUtc,
        double ActiveImportKwh,
        double ActiveExportKwh);
}
