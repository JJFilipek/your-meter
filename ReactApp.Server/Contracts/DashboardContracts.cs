namespace ReactApp.Server.Contracts;

public sealed record DashboardSummaryDto(
    DateTime GeneratedAtUtc,
    int TotalMeters,
    int OnlineMeters,
    int WarningMeters,
    int OfflineMeters,
    int InactiveMeters,
    double ConsumptionThisMonthKwh,
    double AverageDailyConsumptionKwh,
    IReadOnlyList<TimeSeriesPointDto> WeeklyConsumption,
    IReadOnlyList<CategoryValueDto> ConsumptionBySite);

public sealed record TimeSeriesPointDto(DateOnly Date, double ValueKwh);
public sealed record CategoryValueDto(string Name, double ValueKwh);
