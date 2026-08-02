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
    activeGenerationKwh: number
    activePowerKw: number
    generationPowerKw: number
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
    generatedKwh: number
    selfConsumedKwh: number
    averagePowerKw: number
    averageAbsolutePowerKw: number
    maximumImportPowerKw: number
    maximumExportPowerKw: number
    maximumGenerationPowerKw: number
    netCostPln: number
    sampleCount: number
}

export type MeterAnalytics = {
    meterId: string
    serialNo: string
    name: string
    tariff: string
    referencePowerKw: number | null
    contractedPowerKw: number
    connectionPowerKw: number
    fromUtc: string
    toUtc: string
    bucket: 'hour' | 'day' | 'month'
    importedKwh: number
    exportedKwh: number
    generatedKwh: number
    selfConsumedKwh: number
    selfConsumptionRatio: number
    netCostPln: number
    latestPowerKw: number | null
    latestGenerationPowerKw: number | null
    latestReadingAtUtc: string | null
    maximumImportPowerKw: number
    maximumImportPowerAtUtc: string | null
    maximumExportPowerKw: number
    maximumExportPowerAtUtc: string | null
    maximumGenerationPowerKw: number
    maximumGenerationPowerAtUtc: string | null
    averageAbsolutePowerKw: number
    buckets: AnalyticsBucket[]
}

export type TariffCode = 'G11' | 'G12' | 'G12W'

export type TariffZone = {
    code: string
    name: string
    energyKwh: number
    percentage: number
    ratePlnPerKwh: number
    costPln: number
}

export type TariffSimulation = {
    meterId: string
    sourceTariff: string
    targetTariff: TariffCode
    fromUtc: string
    toUtc: string
    totalImportedKwh: number
    totalExportedKwh: number
    energyCostPln: number
    exportCompensationPln: number
    netCostPln: number
    zones: TariffZone[]
}

export type PmaxDistributionCell = {
    weekday: number
    hour: number
    averagePowerKw: number
    maximumPowerKw: number
    sampleCount: number
}

export type PmaxDailyMaximum = {
    date: string
    maximumPowerKw: number
}

export type PmaxAlert = {
    timestampUtc: string
    severity: 'danger' | 'warning' | 'info'
    message: string
}

export type PmaxZoneExceedance = {
    code: string
    name: string
    contractedPowerKw: number
    peakPowerKw: number
    exceedanceKw: number
    costPln: number
}

export type PmaxExceedanceCost = {
    contractedExceedanceCount: number
    connectionExceedanceCount: number
    additionalCostPln: number
    estimatedEnergyCostPln: number
    billImpactPercent: number
    zones: PmaxZoneExceedance[]
}

export type MeterInsights = {
    meterId: string
    serialNo: string
    name: string
    tariff: string
    register: 'import' | 'export'
    fromUtc: string
    toUtc: string
    contractedPowerKw: number
    connectionPowerKw: number
    alertThresholdKw: number
    currentPowerKw: number
    peakPowerKw: number
    peakPowerAtUtc: string | null
    averagePowerKw: number
    utilizationPercent: number
    thresholdExceedanceCount: number
    dailyMaxima: PmaxDailyMaximum[]
    distribution: PmaxDistributionCell[]
    alerts: PmaxAlert[]
    recommendations: string[]
    exceedanceCost: PmaxExceedanceCost
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

export const getMeterInsights = (
    meterId: string,
    fromUtc: string,
    toUtc: string,
    register: 'import' | 'export',
    signal?: AbortSignal,
) => {
    const query = new URLSearchParams({ fromUtc, toUtc, register })
    return apiRequest<MeterInsights>(`/api/meters/${meterId}/insights?${query}`, { signal })
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
