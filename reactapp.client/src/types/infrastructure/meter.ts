export type Meter = {
    id: string;
    serialNo: string;
    name: string;
    manufacturer: string;
    model: string;
    firmware: string;
    tariff: string;
    profile: number;
    status: string;
    isSimulated: boolean;
    location: {
        city: string;
        site: string;
        lat: number;
        lng: number;
    };
    lastSeenAtUtc: string | null;
    latestActiveImportKwh: number | null;
    latestActiveExportKwh: number | null;
    latestActivePowerKw: number | null;
    alertThresholdKw: number | null;
};
