namespace ReactApp.Server.Models;

public sealed class Meter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string SerialNumber { get; set; }
    public required string Name { get; set; }
    public required string Manufacturer { get; set; }
    public required string Model { get; set; }
    public required string FirmwareVersion { get; set; }
    public required string Tariff { get; set; }
    public int SamplingIntervalSeconds { get; set; }
    public required string City { get; set; }
    public required string Site { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsEnabled { get; set; } = true;
    public bool IsSimulated { get; set; }
    public double? SimulationBasePowerKw { get; set; }

    /// <summary>Optional user-defined power alert threshold in kW. Falls back to 90% of contracted power when null.</summary>
    public double? AlertThresholdKw { get; set; }
    public DateTime? LastSeenAtUtc { get; set; }
    public ReadingQuality? LastReadingQuality { get; set; }
    public double? LatestActiveImportKwh { get; set; }
    public double? LatestActiveExportKwh { get; set; }
    public double? LatestActiveGenerationKwh { get; set; }
    public double? LatestActivePowerKw { get; set; }
    public double? LatestGenerationPowerKw { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public ICollection<MeterReading> Readings { get; set; } = [];
}
