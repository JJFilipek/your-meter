using ReactApp.Server.Contracts;
using ReactApp.Server.Models;

namespace ReactApp.Server.Services;

public static class MeterMapper
{
    public static MeterDto ToDto(Meter meter, DateTime utcNow) =>
        new(
            meter.Id,
            meter.SerialNumber,
            meter.Name,
            meter.Manufacturer,
            meter.Model,
            meter.FirmwareVersion,
            meter.Tariff,
            meter.SamplingIntervalSeconds,
            MeterStatusService.Resolve(meter, utcNow),
            meter.IsSimulated,
            new MeterLocationDto(meter.City, meter.Site, meter.Latitude, meter.Longitude),
            meter.LastSeenAtUtc,
            meter.LatestActiveImportKwh,
            meter.LatestActiveExportKwh,
            meter.LatestActivePowerKw);
}
