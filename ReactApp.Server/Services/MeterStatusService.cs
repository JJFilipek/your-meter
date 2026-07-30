using ReactApp.Server.Models;

namespace ReactApp.Server.Services;

public static class MeterStatusService
{
    public const string Online = "Sprawny";
    public const string Warning = "Z problemami";
    public const string Offline = "Brak komunikacji";
    public const string Inactive = "Nieaktywny";

    public static string Resolve(Meter meter, DateTime utcNow)
    {
        if (!meter.IsEnabled)
        {
            return Inactive;
        }

        if (meter.LastSeenAtUtc is null)
        {
            return Offline;
        }

        var offlineAfter = TimeSpan.FromSeconds(Math.Max(900, meter.SamplingIntervalSeconds * 3));
        if (utcNow - meter.LastSeenAtUtc.Value > offlineAfter)
        {
            return Offline;
        }

        return meter.LastReadingQuality is ReadingQuality.Valid
            ? Online
            : Warning;
    }
}
