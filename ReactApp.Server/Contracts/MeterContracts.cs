using System.ComponentModel.DataAnnotations;
using ReactApp.Server.Models;

namespace ReactApp.Server.Contracts;

public sealed record MeterLocationDto(string City, string Site, double Lat, double Lng);

public sealed record MeterDto(
    Guid Id,
    string SerialNo,
    string Name,
    string Manufacturer,
    string Model,
    string Firmware,
    string Tariff,
    int Profile,
    string Status,
    bool IsSimulated,
    MeterLocationDto Location,
    DateTime? LastSeenAtUtc,
    double? LatestActiveImportKwh,
    double? LatestActiveExportKwh,
    double? LatestActivePowerKw,
    double? AlertThresholdKw);

public sealed class SetAlertThresholdRequest
{
    [Range(0, 100000)]
    public double? ThresholdKw { get; init; }
}

public sealed class MeterLocationRequest
{
    [Required, StringLength(120, MinimumLength = 2)]
    public required string City { get; init; }

    [Required, StringLength(160, MinimumLength = 2)]
    public required string Site { get; init; }

    [Range(-90, 90)]
    public double Lat { get; init; }

    [Range(-180, 180)]
    public double Lng { get; init; }
}

public sealed class UpsertMeterRequest
{
    [Required, StringLength(64, MinimumLength = 1)]
    public required string SerialNumber { get; init; }

    [Required, StringLength(160, MinimumLength = 2)]
    public required string Name { get; init; }

    [Required, StringLength(120, MinimumLength = 2)]
    public required string Manufacturer { get; init; }

    [Required, StringLength(120, MinimumLength = 2)]
    public required string Model { get; init; }

    [Required, StringLength(64, MinimumLength = 1)]
    public required string FirmwareVersion { get; init; }

    [Required, StringLength(32, MinimumLength = 1)]
    public required string Tariff { get; init; }

    [Range(1, 86400)]
    public int SamplingIntervalSeconds { get; init; }

    [Required]
    public required MeterLocationRequest Location { get; init; }
}

public sealed class ReadingSampleRequest
{
    public DateTime TimestampUtc { get; init; }

    [Range(0, double.MaxValue)]
    public double ActiveImportKwh { get; init; }

    [Range(0, double.MaxValue)]
    public double ActiveExportKwh { get; init; }

    [Range(0, double.MaxValue)]
    public double ActiveGenerationKwh { get; init; }

    public double ActivePowerKw { get; init; }

    [Range(0, double.MaxValue)]
    public double GenerationPowerKw { get; init; }

    public double? ReactivePowerKvar { get; init; }

    [Range(0, 1000)]
    public double? Voltage { get; init; }

    [Range(0, 100000)]
    public double? Current { get; init; }

    [Range(40, 70)]
    public double? FrequencyHz { get; init; }

    public ReadingQuality Quality { get; init; } = ReadingQuality.Valid;
}

public sealed class ReadingBatchRequest
{
    [Required, MinLength(1), MaxLength(10000)]
    public required IReadOnlyList<ReadingSampleRequest> Readings { get; init; }
}

public sealed record MeterReadingDto(
    DateTime TimestampUtc,
    double ActiveImportKwh,
    double ActiveExportKwh,
    double ActiveGenerationKwh,
    double ActivePowerKw,
    double GenerationPowerKw,
    double? ReactivePowerKvar,
    double? Voltage,
    double? Current,
    double? FrequencyHz,
    ReadingQuality Quality);

public sealed record MeterAnalyticsBucketDto(
    DateTime StartUtc,
    DateTime EndUtc,
    double ImportedKwh,
    double ExportedKwh,
    double GeneratedKwh,
    double SelfConsumedKwh,
    double AveragePowerKw,
    double AverageAbsolutePowerKw,
    double MaximumImportPowerKw,
    double MaximumExportPowerKw,
    double MaximumGenerationPowerKw,
    double NetCostPln,
    double LossKwh,
    int SampleCount);

public sealed record MeterAnalyticsDto(
    Guid MeterId,
    string SerialNo,
    string Name,
    string Tariff,
    double? ReferencePowerKw,
    double ContractedPowerKw,
    double ConnectionPowerKw,
    DateTime FromUtc,
    DateTime ToUtc,
    string Bucket,
    double ImportedKwh,
    double ExportedKwh,
    double GeneratedKwh,
    double SelfConsumedKwh,
    double SelfConsumptionRatio,
    double NetCostPln,
    double LossKwh,
    double GeneratedForecastKwh,
    double GeneratedTrendPercent,
    double? LatestPowerKw,
    double? LatestGenerationPowerKw,
    DateTime? LatestReadingAtUtc,
    double MaximumImportPowerKw,
    DateTime? MaximumImportPowerAtUtc,
    double MaximumExportPowerKw,
    DateTime? MaximumExportPowerAtUtc,
    double MaximumGenerationPowerKw,
    DateTime? MaximumGenerationPowerAtUtc,
    double AverageAbsolutePowerKw,
    IReadOnlyList<MeterAnalyticsBucketDto> Buckets);

public sealed record TariffZoneDto(
    string Code,
    string Name,
    double EnergyKwh,
    double Percentage,
    double RatePlnPerKwh,
    double CostPln);

public sealed record TariffSimulationDto(
    Guid MeterId,
    string SourceTariff,
    string TargetTariff,
    DateTime FromUtc,
    DateTime ToUtc,
    double TotalImportedKwh,
    double TotalExportedKwh,
    double EnergyCostPln,
    double ExportCompensationPln,
    double NetCostPln,
    IReadOnlyList<TariffZoneDto> Zones);

public sealed record PmaxDistributionCellDto(
    int Weekday,
    int Hour,
    double AveragePowerKw,
    double MaximumPowerKw,
    int SampleCount);

public sealed record PmaxDailyMaximumDto(DateOnly Date, double MaximumPowerKw);

public sealed record PmaxAlertDto(DateTime TimestampUtc, string Severity, string Message);

public sealed record PmaxZoneExceedanceDto(
    string Code,
    string Name,
    double ContractedPowerKw,
    double PeakPowerKw,
    double ExceedanceKw,
    double CostPln);

public sealed record PmaxExceedanceCostDto(
    int ContractedExceedanceCount,
    int ConnectionExceedanceCount,
    double AdditionalCostPln,
    double EstimatedEnergyCostPln,
    double BillImpactPercent,
    IReadOnlyList<PmaxZoneExceedanceDto> Zones);

public sealed record MeterInsightsDto(
    Guid MeterId,
    string SerialNo,
    string Name,
    string Tariff,
    string Register,
    DateTime FromUtc,
    DateTime ToUtc,
    double ContractedPowerKw,
    double ConnectionPowerKw,
    double AlertThresholdKw,
    double CurrentPowerKw,
    double PeakPowerKw,
    DateTime? PeakPowerAtUtc,
    double AveragePowerKw,
    double UtilizationPercent,
    int ThresholdExceedanceCount,
    IReadOnlyList<PmaxDailyMaximumDto> DailyMaxima,
    IReadOnlyList<PmaxDistributionCellDto> Distribution,
    IReadOnlyList<PmaxAlertDto> Alerts,
    IReadOnlyList<string> Recommendations,
    PmaxExceedanceCostDto ExceedanceCost);

public sealed record ReadingIngestionResult(int Accepted, int Duplicates, DateTime? LastSeenAtUtc);

public sealed record SimulatorDto(
    Guid Id,
    string SerialNo,
    string Name,
    string Tariff,
    double BasePowerKw,
    bool IsEnabled,
    int SamplingIntervalSeconds,
    string City,
    string Site,
    DateTime CreatedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? LastSeenAtUtc,
    long ReadingCount,
    double? LatestActiveImportKwh,
    double? LatestActiveExportKwh,
    double? LatestActivePowerKw);

public sealed class CreateSimulatorRequest
{
    [StringLength(64, MinimumLength = 1)]
    [RegularExpression("^[A-Z0-9-]+$")]
    public string? SerialNumber { get; init; }

    [Required, StringLength(160, MinimumLength = 2)]
    public required string Name { get; init; }

    [Required, StringLength(32)]
    public required string Tariff { get; init; }

    [Range(0.1, 1000)]
    public double BasePowerKw { get; init; }

    [Range(5, 3600)]
    public int SamplingIntervalSeconds { get; init; } = 30;

    [Required, StringLength(120, MinimumLength = 2)]
    public required string City { get; init; }

    [Required, StringLength(160, MinimumLength = 2)]
    public required string Site { get; init; }

    [Range(-90, 90)]
    public double Lat { get; init; } = 52.2297;

    [Range(-180, 180)]
    public double Lng { get; init; } = 21.0122;

    [Range(0, double.MaxValue)]
    public double InitialImportKwh { get; init; }

    [Range(0, double.MaxValue)]
    public double InitialExportKwh { get; init; }

    public DateTime? StartAtUtc { get; init; }

    [Range(5, 60)]
    public int HistoricalIntervalMinutes { get; init; } = 15;
}

public sealed class SetSimulatorStateRequest
{
    public bool IsEnabled { get; init; }
}

public sealed record DeleteSimulatorResult(
    Guid Id,
    string SerialNo,
    long DeletedReadings);
