using Microsoft.Extensions.Options;
using ReactApp.Server.Configuration;
using ReactApp.Server.Models;
using ReactApp.Server.Services;

namespace ReactApp.Server.Tests.Services;

/// <summary>
/// Pure-function tests for the power-rating and pricing math that underpins every analytics
/// view. These formulas are hand-computed in the assertions (not re-derived by calling the
/// method under test with different inputs), so a regression in the formula itself is caught.
/// </summary>
public sealed class EnergyPricingServiceTests
{
    private static EnergyPricingService CreateService(TariffPricingOptions? options = null) =>
        new(Options.Create(options ?? new TariffPricingOptions()));

    [Theory]
    // basePowerKw, expectedContractedKw, expectedConnectionKw
    [InlineData(2.4, 3, 4)]     // G11 residential default: raw = max(2.64, 2.9) = 2.9 -> ceil = 3; connection = ceil(3*1.3=3.9) = 4
    [InlineData(9.5, 11, 15)]   // C11 business default: raw = max(10.45, 10.0) = 10.45 -> ceil = 11; connection = ceil(11*1.3=14.3) = 15
    [InlineData(72, 80, 105)]   // A23 industrial default (>=20 -> rounds to nearest 5 kW step)
    public void ContractedAndConnectionPower_MatchHandComputedFormula(
        double basePowerKw, double expectedContractedKw, double expectedConnectionKw)
    {
        var contracted = EnergyPricingService.ContractedPowerKw(basePowerKw);
        var connection = EnergyPricingService.ConnectionPowerKw(basePowerKw);

        Assert.Equal(expectedContractedKw, contracted);
        Assert.Equal(expectedConnectionKw, connection);
        Assert.True(connection > contracted, "Connection power must always exceed contracted power.");
    }

    [Fact]
    public void ContractedPower_IsAlwaysAtLeastOneKilowatt()
    {
        // A near-zero base power must not round down to a useless or negative contract.
        Assert.Equal(1, EnergyPricingService.ContractedPowerKw(0.05));
    }

    [Fact]
    public void ZoneRate_UsesBuiltInTableWhenNoOverrideConfigured()
    {
        // Default rate is set far from the built-in G11 rate so a fallback bug would be visible.
        var service = CreateService(new TariffPricingOptions { DefaultEnergyRatePlnPerKwh = 5.0 });

        Assert.Equal(0.92, service.ZoneRatePlnPerKwh("G11", "ALL_DAY"));
        Assert.Equal(1.05, service.ZoneRatePlnPerKwh("G12", "DAY"));
        Assert.Equal(0.55, service.ZoneRatePlnPerKwh("G12", "NIGHT"));
    }

    [Fact]
    public void ZoneRate_IsCaseInsensitiveForTariffAndZoneCode()
    {
        var service = CreateService();

        Assert.Equal(
            service.ZoneRatePlnPerKwh("G11", "ALL_DAY"),
            service.ZoneRatePlnPerKwh("g11", "all_day"));
    }

    [Fact]
    public void ZoneRate_FallsBackToConfiguredDefaultForUnknownTariff()
    {
        var service = CreateService(new TariffPricingOptions { DefaultEnergyRatePlnPerKwh = 1.5 });

        Assert.Equal(1.5, service.ZoneRatePlnPerKwh("UNKNOWN_TARIFF", "ALL_DAY"));
    }

    [Fact]
    public void ZoneRate_ConfiguredOverrideWinsOverBuiltInTable()
    {
        var service = CreateService(new TariffPricingOptions
        {
            ZoneRatesPlnPerKwh = new Dictionary<string, Dictionary<string, double>>
            {
                ["G11"] = new() { ["ALL_DAY"] = 2.0 },
            },
        });

        Assert.Equal(2.0, service.ZoneRatePlnPerKwh("G11", "ALL_DAY"));
    }

    [Fact]
    public void ResolveBasePower_PrefersMeterSimulationBasePowerOverTariffDefault()
    {
        var service = CreateService();
        var meter = BuildMeter(tariff: "A23", simulationBasePowerKw: 5.0);

        Assert.Equal(5.0, service.ResolveBasePowerKw(meter));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0.0)]
    public void ResolveBasePower_FallsBackToTariffDefaultWhenMeterValueIsMissingOrZero(double? simulationBasePowerKw)
    {
        var service = CreateService();
        var meter = BuildMeter(tariff: "A23", simulationBasePowerKw: simulationBasePowerKw);

        Assert.Equal(72, service.ResolveBasePowerKw(meter));
    }

    private static Meter BuildMeter(string tariff, double? simulationBasePowerKw) => new()
    {
        SerialNumber = "UNIT-TEST",
        Name = "Unit test meter",
        Manufacturer = "Test",
        Model = "Test",
        FirmwareVersion = "1.0.0",
        Tariff = tariff,
        City = "Warszawa",
        Site = "Test",
        SimulationBasePowerKw = simulationBasePowerKw,
    };
}
