namespace ReactApp.Server.Configuration;

/// <summary>
/// Tunable monetary parameters used to turn measured energy and power registers into
/// złotówki. Zone energy rates fall back to <see cref="DefaultEnergyRatePlnPerKwh"/> when a
/// specific tariff/zone is not listed.
/// </summary>
public sealed class TariffPricingOptions
{
    public const string SectionName = "TariffPricing";

    /// <summary>All-in energy rate (energy + distribution variable component) used when a zone has no explicit rate.</summary>
    public double DefaultEnergyRatePlnPerKwh { get; set; } = 0.92;

    /// <summary>Compensation credited for every kWh exported to the grid (net-billing deposit value).</summary>
    public double ExportCompensationPlnPerKwh { get; set; } = 0.50;

    /// <summary>Penalty charged for each kW by which peak power exceeds the contracted power.</summary>
    public double ContractedPowerExceedancePenaltyPlnPerKw { get; set; } = 44.20;

    /// <summary>Penalty charged for each kW by which peak power exceeds the connection power.</summary>
    public double ConnectionPowerExceedancePenaltyPlnPerKw { get; set; } = 88.00;

    /// <summary>
    /// Optional per-tariff, per-zone rate overrides keyed by tariff code then zone code
    /// (ALL_DAY, DAY, NIGHT, PEAK, OFF_PEAK). Empty by default so the built-in defaults apply.
    /// </summary>
    public Dictionary<string, Dictionary<string, double>> ZoneRatesPlnPerKwh { get; set; } = new();
}
