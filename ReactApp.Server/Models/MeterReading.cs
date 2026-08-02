namespace ReactApp.Server.Models;

public sealed class MeterReading
{
    public long Id { get; set; }
    public Guid MeterId { get; set; }
    public Meter Meter { get; set; } = null!;
    public DateTime TimestampUtc { get; set; }
    public double ActiveImportKwh { get; set; }
    public double ActiveExportKwh { get; set; }

    /// <summary>
    /// Monotonic register of energy produced on-site (e.g. by a PV installation),
    /// covering both self-consumed and exported production. Zero for consumption-only meters.
    /// </summary>
    public double ActiveGenerationKwh { get; set; }

    public double ActivePowerKw { get; set; }

    /// <summary>Instantaneous on-site generation power in kW (non-negative). Zero for consumption-only meters.</summary>
    public double GenerationPowerKw { get; set; }
    public double? ReactivePowerKvar { get; set; }
    public double? Voltage { get; set; }
    public double? Current { get; set; }
    public double? FrequencyHz { get; set; }
    public ReadingQuality Quality { get; set; } = ReadingQuality.Valid;
    public DateTime ReceivedAtUtc { get; set; } = DateTime.UtcNow;
}

public enum ReadingQuality
{
    Valid,
    Estimated,
    Invalid
}
