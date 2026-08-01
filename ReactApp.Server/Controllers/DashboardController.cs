using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Contracts;
using ReactApp.Server.Data;
using ReactApp.Server.Services;

namespace ReactApp.Server.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("summary")]
    [ProducesResponseType<DashboardSummaryDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(
        CancellationToken cancellationToken)
    {
        var utcNow = DateTime.UtcNow;
        var monthStart = new DateTime(utcNow.Year, utcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var weekStart = utcNow.Date.AddDays(-6);
        var dataStart = monthStart < weekStart ? monthStart : weekStart;

        var meters = await dbContext.Meters
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var readings = await dbContext.MeterReadings
            .AsNoTracking()
            .Where(x => x.TimestampUtc >= dataStart.AddDays(-1))
            .Select(x => new
            {
                x.MeterId,
                x.TimestampUtc,
                x.ActiveImportKwh
            })
            .ToListAsync(cancellationToken);

        var statuses = meters
            .Select(x => MeterStatusService.Resolve(x, utcNow))
            .ToArray();
        var consumptionIntervals = readings
            .GroupBy(x => x.MeterId)
            .SelectMany(group => group
                .OrderBy(x => x.TimestampUtc)
                .Zip(
                    group.OrderBy(x => x.TimestampUtc).Skip(1),
                    (previous, current) => new
                    {
                        current.MeterId,
                        TimestampUtc = previous.TimestampUtc.AddTicks(
                            (current.TimestampUtc - previous.TimestampUtc).Ticks / 2),
                        ValueKwh = Math.Max(
                            0,
                            current.ActiveImportKwh - previous.ActiveImportKwh)
                    }))
            .Where(x => x.TimestampUtc >= dataStart)
            .ToArray();
        var consumptionByMeter = consumptionIntervals
            .Where(x => x.TimestampUtc >= monthStart)
            .GroupBy(x => x.MeterId)
            .ToDictionary(x => x.Key, x => x.Sum(y => y.ValueKwh));
        var monthConsumption = consumptionByMeter.Values.Sum();
        var elapsedDays = Math.Max(1, utcNow.Day);

        var weeklyConsumption = Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var date = weekStart.AddDays(offset);
                var nextDate = date.AddDays(1);
                var value = consumptionIntervals
                    .Where(x => x.TimestampUtc >= date && x.TimestampUtc < nextDate)
                    .Sum(x => x.ValueKwh);

                return new TimeSeriesPointDto(DateOnly.FromDateTime(date), Math.Round(value, 3));
            })
            .ToArray();

        var sitesByMeter = meters.ToDictionary(x => x.Id, x => x.Site);
        var consumptionBySite = consumptionByMeter
            .Where(x => sitesByMeter.ContainsKey(x.Key))
            .GroupBy(x => sitesByMeter[x.Key])
            .Select(x => new CategoryValueDto(x.Key, Math.Round(x.Sum(y => y.Value), 3)))
            .OrderByDescending(x => x.ValueKwh)
            .ToArray();

        return Ok(new DashboardSummaryDto(
            utcNow,
            meters.Count,
            statuses.Count(x => x == MeterStatusService.Online),
            statuses.Count(x => x == MeterStatusService.Warning),
            statuses.Count(x => x == MeterStatusService.Offline),
            statuses.Count(x => x == MeterStatusService.Inactive),
            Math.Round(monthConsumption, 3),
            Math.Round(monthConsumption / elapsedDays, 3),
            weeklyConsumption,
            consumptionBySite));
    }
}
