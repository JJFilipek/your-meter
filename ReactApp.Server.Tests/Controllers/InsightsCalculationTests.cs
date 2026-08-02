using System.Net;
using System.Net.Http.Json;
using ReactApp.Server.Contracts;
using ReactApp.Server.Tests.Infrastructure;

namespace ReactApp.Server.Tests.Controllers;

/// <summary>
/// Verifies GET /api/meters/{id}/insights: exceedance-event detection against the contracted,
/// connection and alert thresholds, and that the per-zone cost breakdown reconciles exactly with
/// the reported total penalty (regression coverage for a bug fixed earlier: the breakdown used
/// to report a single representative peak instead of summing the actual exceedance events).
/// </summary>
public sealed class InsightsCalculationTests(TestApiFactory factory) : IClassFixture<TestApiFactory>
{
    private static string Iso(DateTime value) => Uri.EscapeDataString(value.ToString("O"));

    [Fact]
    public async Task Insights_DetectsExceedanceEvents_AndReconcilesZoneCostsWithTheTotal()
    {
        // G11 base power 2.4 kW -> contracted 3 kW, connection 4 kW, default alert threshold
        // 90% of contracted = 2.7 kW (all derived by EnergyPricingServiceTests separately).
        // Power profile has two isolated spikes surrounded by sub-threshold readings, so each
        // spike must be counted as its own exceedance event rather than merged into one.
        var day = new DateTime(2026, 1, 6, 8, 0, 0, DateTimeKind.Utc); // Warsaw local 09:00, same calendar day throughout
        var builder = new MeterSeedBuilder(tariff: "G11", simulationBasePowerKw: 2.4, serialNumber: "INSIGHTS-01")
            .AddReading(day.AddHours(0), activeImportKwh: 0, activePowerKw: 1.0)
            .AddReading(day.AddHours(1), activeImportKwh: 0, activePowerKw: 3.5) // >= contracted (3.0) and alert threshold (2.7)
            .AddReading(day.AddHours(2), activeImportKwh: 0, activePowerKw: 1.0)
            .AddReading(day.AddHours(3), activeImportKwh: 0, activePowerKw: 5.0) // >= connection (4.0) too
            .AddReading(day.AddHours(4), activeImportKwh: 0, activePowerKw: 1.0);

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var url = $"/api/meters/{builder.Meter.Id}/insights" +
                   $"?fromUtc={Iso(day)}&toUtc={Iso(day.AddHours(4))}&register=import";
        var dto = await client.GetFromJsonAsync<MeterInsightsDto>(url, ApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal(3, dto!.ContractedPowerKw);
        Assert.Equal(4, dto.ConnectionPowerKw);
        Assert.Equal(2.7, dto.AlertThresholdKw, precision: 4);

        Assert.Equal(5.0, dto.PeakPowerKw, precision: 4);
        Assert.Equal(day.AddHours(3), dto.PeakPowerAtUtc);
        Assert.Equal(2.3, dto.AveragePowerKw, precision: 4);
        Assert.Equal(1.0, dto.CurrentPowerKw, precision: 4); // last reading in the window

        Assert.Equal(2, dto.ThresholdExceedanceCount); // two isolated spikes above 2.7 kW
        Assert.Equal(2, dto.ExceedanceCost.ContractedExceedanceCount);
        Assert.Equal(1, dto.ExceedanceCost.ConnectionExceedanceCount);

        // contracted penalty: (3.5-3.0)*10 + (5.0-3.0)*10 = 5 + 20 = 25; connection: (5.0-4.0)*20 = 20.
        Assert.Equal(45.0, dto.ExceedanceCost.AdditionalCostPln, precision: 2);

        // Single ALL_DAY zone for G11 -> its cost must equal the full contracted penalty (25),
        // not the combined contracted+connection total (45).
        var zone = Assert.Single(dto.ExceedanceCost.Zones);
        Assert.Equal("ALL_DAY", zone.Code);
        Assert.Equal(5.0, zone.PeakPowerKw, precision: 4);
        Assert.Equal(2.0, zone.ExceedanceKw, precision: 4);
        Assert.Equal(25.0, zone.CostPln, precision: 2);
        Assert.Equal(dto.ExceedanceCost.Zones.Sum(z => z.CostPln), zone.CostPln, precision: 2);

        // One daily maximum entry, equal to the period's peak.
        var daily = Assert.Single(dto.DailyMaxima);
        Assert.Equal(5.0, daily.MaximumPowerKw, precision: 4);

        // No import deltas were seeded, so there is no estimated energy cost to weigh the
        // exceedance cost against — bill impact must degrade to 0 rather than divide by zero.
        Assert.Equal(0, dto.ExceedanceCost.EstimatedEnergyCostPln, precision: 6);
        Assert.Equal(0, dto.ExceedanceCost.BillImpactPercent, precision: 6);

        // One "danger" alert (connection) and two "warning" alerts (contracted).
        Assert.Equal(3, dto.Alerts.Count);
        Assert.Single(dto.Alerts, a => a.Severity == "danger");
        Assert.Equal(2, dto.Alerts.Count(a => a.Severity == "warning"));

        Assert.Contains(dto.Recommendations, r => r.Contains("2× przekroczono próg alertu"));
    }

    [Fact]
    public async Task Insights_UsesNinetyPercentOfContractedPower_AsTheDefaultAlertThreshold()
    {
        var builder = new MeterSeedBuilder(tariff: "G11", simulationBasePowerKw: 2.4, serialNumber: "INSIGHTS-DEFAULT-THRESHOLD")
            .AddReading(new DateTime(2026, 1, 6, 8, 0, 0, DateTimeKind.Utc), activeImportKwh: 0, activePowerKw: 1.0);

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var from = new DateTime(2026, 1, 6, 7, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 1, 6, 9, 0, 0, DateTimeKind.Utc);
        var dto = await client.GetFromJsonAsync<MeterInsightsDto>(
            $"/api/meters/{builder.Meter.Id}/insights?fromUtc={Iso(from)}&toUtc={Iso(to)}&register=import",
            ApiJson.Options);

        // Contracted power for 2.4 kW base is 3 kW (see EnergyPricingServiceTests), so the
        // default threshold with no override must be exactly 90% of that.
        Assert.Equal(2.7, dto!.AlertThresholdKw, precision: 4);
    }

    [Fact]
    public async Task AlertThreshold_CustomValueOverridesTheDefault_AndCanBeReset()
    {
        var builder = new MeterSeedBuilder(tariff: "G11", simulationBasePowerKw: 2.4, serialNumber: "INSIGHTS-CUSTOM-THRESHOLD")
            .AddReading(new DateTime(2026, 1, 6, 8, 0, 0, DateTimeKind.Utc), activeImportKwh: 0, activePowerKw: 1.0);

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var from = new DateTime(2026, 1, 6, 7, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 1, 6, 9, 0, 0, DateTimeKind.Utc);
        var insightsUrl = $"/api/meters/{builder.Meter.Id}/insights?fromUtc={Iso(from)}&toUtc={Iso(to)}&register=import";

        var putResponse = await client.PutAsJsonAsync(
            $"/api/meters/{builder.Meter.Id}/alert-threshold", new { thresholdKw = 1.5 });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var afterSet = await client.GetFromJsonAsync<MeterInsightsDto>(insightsUrl, ApiJson.Options);
        Assert.Equal(1.5, afterSet!.AlertThresholdKw, precision: 4);

        var resetResponse = await client.PutAsJsonAsync(
            $"/api/meters/{builder.Meter.Id}/alert-threshold", new { thresholdKw = (double?)null });
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);

        var afterReset = await client.GetFromJsonAsync<MeterInsightsDto>(insightsUrl, ApiJson.Options);
        Assert.Equal(2.7, afterReset!.AlertThresholdKw, precision: 4); // back to 90% of contracted (3 kW)
    }

    [Fact]
    public async Task AlertThreshold_IsRejectedForReadOnlyAccounts()
    {
        var builder = new MeterSeedBuilder(serialNumber: "INSIGHTS-READONLY-GUARD");
        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            return Task.CompletedTask;
        });

        factory.SetReadOnly(true);
        try
        {
            using var client = factory.CreateApiClient();
            var response = await client.PutAsJsonAsync(
                $"/api/meters/{builder.Meter.Id}/alert-threshold", new { thresholdKw = 2.0 });

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
        finally
        {
            factory.SetReadOnly(false);
        }
    }
}
