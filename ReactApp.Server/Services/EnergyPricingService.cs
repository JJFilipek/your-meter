using Microsoft.Extensions.Options;
using ReactApp.Server.Configuration;
using ReactApp.Server.Models;

namespace ReactApp.Server.Services;

/// <summary>
/// Derives contractual power ratings and monetary values from a meter's tariff and its
/// measured base power. All numbers are reproducible from meter metadata plus the configured
/// <see cref="TariffPricingOptions"/>, so nothing is hard-coded in the frontend.
/// </summary>
public sealed class EnergyPricingService(IOptions<TariffPricingOptions> options)
{
    private readonly TariffPricingOptions pricing = options.Value;

    private static readonly Dictionary<string, Dictionary<string, double>> BuiltInZoneRates = new()
    {
        ["G11"] = new() { ["ALL_DAY"] = 0.92 },
        ["G12"] = new() { ["DAY"] = 1.05, ["NIGHT"] = 0.55 },
        ["G12W"] = new() { ["PEAK"] = 1.12, ["OFF_PEAK"] = 0.56 },
        ["C11"] = new() { ["ALL_DAY"] = 1.18 },
        ["A23"] = new() { ["PEAK"] = 1.24, ["OFF_PEAK"] = 0.62 }
    };

    public double ExportCompensationPlnPerKwh => pricing.ExportCompensationPlnPerKwh;

    public double ContractedPowerExceedancePenaltyPlnPerKw =>
        pricing.ContractedPowerExceedancePenaltyPlnPerKw;

    public double ConnectionPowerExceedancePenaltyPlnPerKw =>
        pricing.ConnectionPowerExceedancePenaltyPlnPerKw;

    /// <summary>Contracted power (moc umowna) rounded to a realistic step above the meter's base power.</summary>
    public static double ContractedPowerKw(double basePowerKw)
    {
        var raw = Math.Max(basePowerKw * 2.4, basePowerKw + 1);
        return basePowerKw >= 20
            ? Math.Ceiling(raw / 5) * 5
            : Math.Max(4, Math.Ceiling(raw));
    }

    /// <summary>Connection power (moc przyłączeniowa) sitting ~20% above the contracted power.</summary>
    public static double ConnectionPowerKw(double basePowerKw)
    {
        var contracted = ContractedPowerKw(basePowerKw);
        var raw = contracted * 1.2;
        return basePowerKw >= 20
            ? Math.Ceiling(raw / 5) * 5
            : Math.Ceiling(raw);
    }

    public double ResolveBasePowerKw(Meter meter) =>
        meter.SimulationBasePowerKw is > 0
            ? meter.SimulationBasePowerKw.Value
            : DefaultBasePowerForTariff(meter.Tariff);

    /// <summary>All-in energy rate for a given tariff/zone, honouring config overrides then built-in defaults.</summary>
    public double ZoneRatePlnPerKwh(string tariff, string zoneCode)
    {
        var normalizedTariff = tariff.Trim().ToUpperInvariant();
        var normalizedZone = zoneCode.Trim().ToUpperInvariant();

        if (pricing.ZoneRatesPlnPerKwh.TryGetValue(normalizedTariff, out var configured)
            && configured.TryGetValue(normalizedZone, out var configuredRate))
        {
            return configuredRate;
        }

        if (BuiltInZoneRates.TryGetValue(normalizedTariff, out var builtIn)
            && builtIn.TryGetValue(normalizedZone, out var builtInRate))
        {
            return builtInRate;
        }

        return pricing.DefaultEnergyRatePlnPerKwh;
    }

    private static double DefaultBasePowerForTariff(string tariff) =>
        tariff.Trim().ToUpperInvariant() switch
        {
            "G11" => 2.4,
            "G12" => 4.8,
            "G12W" => 3.6,
            "C11" => 9.5,
            "A23" => 72,
            _ => 2.4
        };
}
