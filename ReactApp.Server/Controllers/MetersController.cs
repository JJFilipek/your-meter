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

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
