import { apiRequest } from './client'
import type { Meter } from '../types/infrastructure/meter'

export type CreateMeterRequest = {
    serialNumber: string
    name: string
    manufacturer: string
    model: string
    firmwareVersion: string
    tariff: string
    samplingIntervalSeconds: number
    location: {
        city: string
        site: string
        lat: number
        lng: number
    }
}

export type DashboardSummary = {
    generatedAtUtc: string
    totalMeters: number
    onlineMeters: number
    warningMeters: number
    offlineMeters: number
    inactiveMeters: number
    consumptionThisMonthKwh: number
    averageDailyConsumptionKwh: number
    weeklyConsumption: Array<{
        date: string
        valueKwh: number
    }>
    consumptionBySite: Array<{
        name: string
        valueKwh: number
    }>
}

export type MeterReading = {
    timestampUtc: string
    activeImportKwh: number
    activeExportKwh: number
    activePowerKw: number
    reactivePowerKvar: number | null
    voltage: number | null
    current: number | null
    frequencyHz: number | null
    quality: 'Valid' | 'Estimated' | 'Invalid'
}

export type AnalyticsBucket = {
    startUtc: string
    endUtc: string
    importedKwh: number
    exportedKwh: number
    averagePowerKw: number
    averageAbsolutePowerKw: number
    maximumImportPowerKw: number
    maximumExportPowerKw: number
    sampleCount: number
}

export type MeterAnalytics = {
    meterId: string
    serialNo: string
    name: string
    tariff: string
    referencePowerKw: number | null
    fromUtc: string
    toUtc: string
    bucket: 'hour' | 'day' | 'month'
    importedKwh: number
    exportedKwh: number
    latestPowerKw: number | null
    latestReadingAtUtc: string | null
    maximumImportPowerKw: number
    maximumImportPowerAtUtc: string | null
    maximumExportPowerKw: number
    maximumExportPowerAtUtc: string | null
    averageAbsolutePowerKw: number
    buckets: AnalyticsBucket[]
}

export type TariffCode = 'G11' | 'G12' | 'G12W'

export type TariffZone = {
    code: string
    name: string
    energyKwh: number
    percentage: number
}

export type TariffSimulation = {
    meterId: string
    sourceTariff: string
    targetTariff: TariffCode
    fromUtc: string
    toUtc: string
    totalImportedKwh: number
    zones: TariffZone[]
}

export type Simulator = {
    id: string
    serialNo: string
    name: string
    tariff: 'G11' | 'G12' | 'G12W' | 'C11' | 'A23'
    basePowerKw: number
    isEnabled: boolean
    samplingIntervalSeconds: number
    city: string
    site: string
    createdAtUtc: string
    startedAtUtc: string | null
    lastSeenAtUtc: string | null
    readingCount: number
    latestActiveImportKwh: number | null
    latestActiveExportKwh: number | null
    latestActivePowerKw: number | null
}

export type CreateSimulatorRequest = {
    serialNumber?: string
    name: string
    tariff: Simulator['tariff']
    basePowerKw: number
    samplingIntervalSeconds: number
    city: string
    site: string
    lat: number
    lng: number
    initialImportKwh: number
    initialExportKwh: number
    startAtUtc: string
    historicalIntervalMinutes: number
}

export type DeleteSimulatorResult = {
    id: string
    serialNo: string
    deletedReadings: number
}

export const getMeters = (signal?: AbortSignal) =>
    apiRequest<Meter[]>('/api/meters', { signal })

export const createMeter = (request: CreateMeterRequest) =>
    apiRequest<Meter>('/api/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

export const getDashboardSummary = (signal?: AbortSignal) =>
    apiRequest<DashboardSummary>('/api/dashboard/summary', { signal })

export const getMeterReadings = (
    meterId: string,
    fromUtc: string,
    toUtc: string,
    signal?: AbortSignal,
) => {
    const query = new URLSearchParams({
        fromUtc,
        toUtc,
        limit: '10000',
    })
    return apiRequest<MeterReading[]>(`/api/meters/${meterId}/readings?${query}`, { signal })
}

export const getMeterAnalytics = (
    meterId: string,
    fromUtc: string,
    toUtc: string,
    bucket: MeterAnalytics['bucket'],
    signal?: AbortSignal,
) => {
    const query = new URLSearchParams({ fromUtc, toUtc, bucket })
    return apiRequest<MeterAnalytics>(`/api/meters/${meterId}/analytics?${query}`, { signal })
}

export const getTariffSimulation = (
    meterId: string,
    fromUtc: string,
    toUtc: string,
    tariff: TariffCode,
    signal?: AbortSignal,
) => {
    const query = new URLSearchParams({ fromUtc, toUtc, tariff })
    return apiRequest<TariffSimulation>(`/api/meters/${meterId}/tariff-simulation?${query}`, { signal })
}

export const getSimulators = (signal?: AbortSignal) =>
    apiRequest<Simulator[]>('/api/simulators', { signal })

export const createSimulator = (request: CreateSimulatorRequest) =>
    apiRequest<Simulator>('/api/simulators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

export const setSimulatorState = (id: string, isEnabled: boolean) =>
    apiRequest<Simulator>(`/api/simulators/${id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
    })

export const deleteSimulator = (id: string, confirmSerial: string) => {
    const query = new URLSearchParams({ confirmSerial })
    return apiRequest<DeleteSimulatorResult>(`/api/simulators/${id}?${query}`, {
        method: 'DELETE',
    })
}
