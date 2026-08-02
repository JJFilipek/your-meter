using System.Net.Http.Json;
using ReactApp.Server.Contracts;
using ReactApp.Server.Tests.Infrastructure;

namespace ReactApp.Server.Tests.Controllers;

/// <summary>
/// Verifies GET /api/meters/{id}/analytics against hand-computed expectations. Every reading in
/// these tests uses round numbers chosen so the expected imported/exported/generated energy,
/// resistive loss and cost figures can be checked by arithmetic, not by re-running the algorithm.
/// </summary>
public sealed class AnalyticsCalculationTests(TestApiFactory factory) : IClassFixture<TestApiFactory>
{
    private static string Iso(DateTime value) => Uri.EscapeDataString(value.ToString("O"));

    [Fact]
    public async Task Analytics_ComputesEnergyLossAndCost_FromRegisterDeltasAndCurrent()
    {
        // A+ / A- / generation are cumulative registers; deltas between consecutive readings are
        // what the endpoint should report as imported/exported/generated energy per bucket.
        var from = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var builder = new MeterSeedBuilder(tariff: "G11", simulationBasePowerKw: 2.4, serialNumber: "ANALYTICS-01")
            .AddReading(from.AddHours(-1), activeImportKwh: 100, activeExportKwh: 10, activeGenerationKwh: 0, current: 0)   // anchor, before the query window
            .AddReading(from.AddHours(0), activeImportKwh: 104, activeExportKwh: 11, activeGenerationKwh: 2, current: 20)  // +4 / +1 / +2
            .AddReading(from.AddHours(1), activeImportKwh: 110, activeExportKwh: 13, activeGenerationKwh: 5, current: 20)  // +6 / +2 / +3
            .AddReading(from.AddHours(2), activeImportKwh: 113, activeExportKwh: 13, activeGenerationKwh: 5, current: 10)  // +3 / +0 / +0
            .AddReading(from.AddHours(3), activeImportKwh: 113, activeExportKwh: 13, activeGenerationKwh: 5, current: 10)  // +0 / +0 / +0
            .AddReading(from.AddHours(4), activeImportKwh: 115, activeExportKwh: 14, activeGenerationKwh: 6, current: 30); // +2 / +1 / +1

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var to = from.AddHours(4);
        var url = $"/api/meters/{builder.Meter.Id}/analytics?fromUtc={Iso(from)}&toUtc={Iso(to)}&bucket=hour";
        var dto = await client.GetFromJsonAsync<MeterAnalyticsDto>(url, ApiJson.Options);

        Assert.NotNull(dto);
        // Sum of deltas: import 4+6+3+0+2=15, export 1+2+0+0+1=4, generation 2+3+0+0+1=6, self-consumed 1+1+0+0+0=2.
        Assert.Equal(15, dto!.ImportedKwh, precision: 6);
        Assert.Equal(4, dto.ExportedKwh, precision: 6);
        Assert.Equal(6, dto.GeneratedKwh, precision: 6);
        Assert.Equal(2, dto.SelfConsumedKwh, precision: 6);
        Assert.Equal(2.0 / 6.0, dto.SelfConsumptionRatio, precision: 4);
        Assert.Equal(5, dto.Buckets.Count);

        // Contracted/connection power for a 2.4 kW base: raw = max(2.4*1.1, 2.9) = 2.9 -> ceil = 3; connection = ceil(3*1.3) = 4.
        Assert.Equal(3, dto.ContractedPowerKw);
        Assert.Equal(4, dto.ConnectionPowerKw);

        // Net cost per bucket = imported * built-in G11 rate (0.92) - exported * export compensation (0.50):
        // b0: 4*0.92-1*0.50=3.18, b1: 6*0.92-2*0.50=4.52, b2: 3*0.92=2.76, b3: 0, b4: 2*0.92-1*0.50=1.34 -> 11.80 total.
        Assert.Equal(11.80, dto.NetCostPln, precision: 2);
    }

    [Fact]
    public async Task Analytics_ComputesResistiveLoss_FromMeasuredCurrentAndConfiguredResistance()
    {
        var from = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc);
        // TestApiFactory configures a 1 ohm line resistance so the I^2 * R * t formula lands on clean numbers.
        var builder = new MeterSeedBuilder(tariff: "G11", serialNumber: "ANALYTICS-LOSS")
            .AddReading(from.AddHours(-1), activeImportKwh: 0, current: 0)
            .AddReading(from.AddHours(0), activeImportKwh: 1, current: 20)  // 20^2 * 1 ohm * 1h / 1000 = 0.4 kWh
            .AddReading(from.AddHours(1), activeImportKwh: 2, current: 30); // 30^2 * 1 ohm * 1h / 1000 = 0.9 kWh

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var to = from.AddHours(1);
        var url = $"/api/meters/{builder.Meter.Id}/analytics?fromUtc={Iso(from)}&toUtc={Iso(to)}&bucket=hour";
        var dto = await client.GetFromJsonAsync<MeterAnalyticsDto>(url, ApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal(2, dto!.Buckets.Count);
        Assert.Equal(0.4, dto.Buckets[0].LossKwh, precision: 6);
        Assert.Equal(0.9, dto.Buckets[1].LossKwh, precision: 6);
    }

    [Fact]
    public async Task Analytics_ForecastsNextBucket_UsingLeastSquaresOverCompletedBuckets()
    {
        // Five complete daily generation buckets forming a perfect line (slope 2, intercept 10):
        // 10, 12, 14, 16, 18. An ordinary-least-squares fit over an exact line must reproduce it
        // exactly, so the forecast for the next (6th) point is unambiguous: 2*5 + 10 = 20.
        var day0 = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var builder = new MeterSeedBuilder(tariff: "G12W", serialNumber: "ANALYTICS-FORECAST")
            .AddReading(day0.AddDays(-1), activeImportKwh: 0, activeGenerationKwh: 0)
            .AddReading(day0.AddDays(0), activeImportKwh: 0, activeGenerationKwh: 10)
            .AddReading(day0.AddDays(1), activeImportKwh: 0, activeGenerationKwh: 22)
            .AddReading(day0.AddDays(2), activeImportKwh: 0, activeGenerationKwh: 36)
            .AddReading(day0.AddDays(3), activeImportKwh: 0, activeGenerationKwh: 52)
            .AddReading(day0.AddDays(4), activeImportKwh: 0, activeGenerationKwh: 70);

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var to = day0.AddDays(5);
        var url = $"/api/meters/{builder.Meter.Id}/analytics?fromUtc={Iso(day0)}&toUtc={Iso(to)}&bucket=day";
        var dto = await client.GetFromJsonAsync<MeterAnalyticsDto>(url, ApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal(5, dto!.Buckets.Count);
        Assert.Equal(new[] { 10, 12, 14, 16, 18 }, dto.Buckets.Select(b => (int)Math.Round(b.GeneratedKwh)));
        Assert.Equal(20.0, dto.GeneratedForecastKwh, precision: 2);
        Assert.Equal(14.29, dto.GeneratedTrendPercent, precision: 1); // slope 2 / average 14 * 100
    }

    [Fact]
    public async Task Analytics_ReturnsBadRequest_WhenRangeIsInverted()
    {
        var builder = new MeterSeedBuilder(serialNumber: "ANALYTICS-INVALID-RANGE");
        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var from = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc); // before 'from'
        var response = await client.GetAsync(
            $"/api/meters/{builder.Meter.Id}/analytics?fromUtc={Iso(from)}&toUtc={Iso(to)}&bucket=day");

        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }
}
