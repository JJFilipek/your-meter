export type Meter = {
    serialNo: number;
    name: string;
    model: string;
    firmware: string;
    tariff: string;
    profile: number;
    status: string;
    location: {
        city: string;
        site: string;
        lat: number;
        lng: number;
    };
};
