namespace ReactApp.Server.Models;

public sealed class MeterReading
{
    public long Id { get; set; }
    public Guid MeterId { get; set; }
    public Meter Meter { get; set; } = null!;
    public DateTime TimestampUtc { get; set; }
    public double ActiveImportKwh { get; set; }
    public double ActiveExportKwh { get; set; }
    public double ActivePowerKw { get; set; }
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
