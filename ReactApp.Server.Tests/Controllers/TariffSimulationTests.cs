using System.Net.Http.Json;
using ReactApp.Server.Contracts;
using ReactApp.Server.Tests.Infrastructure;

namespace ReactApp.Server.Tests.Controllers;

/// <summary>
/// Verifies GET /api/meters/{id}/tariff-simulation: energy attributed to the correct time-of-use
/// zone, and that the per-zone costs reconcile exactly with the reported total (the same
/// reconciliation bug class fixed for the peak-power exceedance breakdown).
/// </summary>
public sealed class TariffSimulationTests(TestApiFactory factory) : IClassFixture<TestApiFactory>
{
    private static string Iso(DateTime value) => Uri.EscapeDataString(value.ToString("O"));

    [Fact]
    public async Task TariffSimulation_SplitsImportByTimeOfUseZone_ForG12()
    {
        // Warsaw is UTC+1 in January (no DST), which keeps the UTC <-> local mapping simple.
        // G12's off-peak window is local hour < 6, so a delta whose interval midpoint falls at
        // local 03:00 must land entirely in NIGHT, and one at local 08:00 entirely in DAY.
        var anchorUtc = new DateTime(2026, 1, 5, 1, 0, 0, DateTimeKind.Utc);  // local 02:00
        var nightEndUtc = new DateTime(2026, 1, 5, 3, 0, 0, DateTimeKind.Utc); // local 04:00 (midpoint local 03:00 -> NIGHT)
        var dayEndUtc = new DateTime(2026, 1, 5, 11, 0, 0, DateTimeKind.Utc);  // local 12:00 (midpoint local 08:00 -> DAY)

        var builder = new MeterSeedBuilder(tariff: "G12", serialNumber: "TARIFF-SIM-01")
            .AddReading(anchorUtc, activeImportKwh: 100)
            .AddReading(nightEndUtc, activeImportKwh: 106)  // +6 kWh, NIGHT
            .AddReading(dayEndUtc, activeImportKwh: 120);   // +14 kWh, DAY

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var url = $"/api/meters/{builder.Meter.Id}/tariff-simulation" +
                   $"?fromUtc={Iso(anchorUtc)}&toUtc={Iso(dayEndUtc)}&tariff=G12";
        var dto = await client.GetFromJsonAsync<TariffSimulationDto>(url, ApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal(20, dto!.TotalImportedKwh, precision: 6);
        Assert.Equal(0, dto.TotalExportedKwh, precision: 6);

        var night = Assert.Single(dto.Zones, z => z.Code == "NIGHT");
        var day = Assert.Single(dto.Zones, z => z.Code == "DAY");
        Assert.Equal(6, night.EnergyKwh, precision: 6);
        Assert.Equal(14, day.EnergyKwh, precision: 6);
        Assert.Equal(0.55, night.RatePlnPerKwh);
        Assert.Equal(1.05, day.RatePlnPerKwh);
        Assert.Equal(3.30, night.CostPln, precision: 2);
        Assert.Equal(14.70, day.CostPln, precision: 2);

        // The headline cost must equal the sum of the per-zone costs shown to the user.
        Assert.Equal(dto.Zones.Sum(z => z.CostPln), dto.EnergyCostPln, precision: 2);
        Assert.Equal(18.00, dto.EnergyCostPln, precision: 2);
        Assert.Equal(0, dto.ExportCompensationPln, precision: 6);
        Assert.Equal(dto.EnergyCostPln, dto.NetCostPln, precision: 2);

        // Percentages must add up to 100 regardless of how many zones the tariff has.
        Assert.Equal(100.0, dto.Zones.Sum(z => z.Percentage), precision: 1);
    }

    [Fact]
    public async Task TariffSimulation_CreditsExportAtTheConfiguredCompensationRate()
    {
        var from = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
        var to = from.AddHours(1);
        var builder = new MeterSeedBuilder(tariff: "G11", serialNumber: "TARIFF-SIM-EXPORT")
            .AddReading(from, activeImportKwh: 0, activeExportKwh: 0)
            .AddReading(to, activeImportKwh: 0, activeExportKwh: 10); // 10 kWh exported, no import

        await factory.SeedAsync(db =>
        {
            db.Meters.Add(builder.Meter);
            db.MeterReadings.AddRange(builder.Readings);
            return Task.CompletedTask;
        });

        using var client = factory.CreateApiClient();
        var url = $"/api/meters/{builder.Meter.Id}/tariff-simulation?fromUtc={Iso(from)}&toUtc={Iso(to)}&tariff=G11";
        var dto = await client.GetFromJsonAsync<TariffSimulationDto>(url, ApiJson.Options);

        Assert.NotNull(dto);
        Assert.Equal(0, dto!.EnergyCostPln, precision: 6);
        // appsettings.json default export compensation is 0.50 PLN/kWh.
        Assert.Equal(5.00, dto.ExportCompensationPln, precision: 2);
        Assert.Equal(-5.00, dto.NetCostPln, precision: 2);
    }
}
