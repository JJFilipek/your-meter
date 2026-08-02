import type { MeterAnalytics, MeterInsights } from '../api/meters'
import type { Meter } from '../types/infrastructure/meter'

export type AlertType =
    | 'power-contracted'
    | 'power-connection'
    | 'power-export'
    | 'offline'
    | 'production-drop'

export type AppAlert = {
    id: string
    meterId: string
    meterName: string
    type: AlertType
    severity: 'danger' | 'warning' | 'info'
    message: string
    timestampUtc: string
}

export const alertKey = (alert: AppAlert) => alert.id

export const alertTypeLabels: Record<AlertType, string> = {
    'power-contracted': 'Moc umowna',
    'power-connection': 'Moc przyłącza',
    'power-export': 'Oddawanie',
    offline: 'Komunikacja',
    'production-drop': 'Produkcja',
}

export function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.round(diffMs / 60000)
    if (minutes < 1) return 'przed chwilą'
    if (minutes < 60) return `${minutes} min temu`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} godz. temu`
    const days = Math.round(hours / 24)
    return `${days} dni temu`
}

const percent = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })

// Power exceedances reported by the insights endpoint, split into contracted vs connection by severity.
export function powerAlertsFromInsights(meter: Meter, insights: MeterInsights, isExport: boolean): AppAlert[] {
    return insights.alerts.map((alert) => {
        const type: AlertType = isExport
            ? 'power-export'
            : alert.severity === 'danger'
                ? 'power-connection'
                : 'power-contracted'
        return {
            id: `${meter.id}|${type}|${alert.timestampUtc}`,
            meterId: meter.id,
            meterName: meter.name,
            type,
            severity: alert.severity,
            message: alert.message,
            timestampUtc: alert.timestampUtc,
        }
    })
}

// Communication problems derived from the meter's reported status.
export function offlineAlert(meter: Meter): AppAlert | null {
    if (meter.status !== 'Offline' && meter.status !== 'Warning') return null
    const timestampUtc = meter.lastSeenAtUtc ?? new Date().toISOString()
    return {
        id: `${meter.id}|offline|${timestampUtc}`,
        meterId: meter.id,
        meterName: meter.name,
        type: 'offline',
        severity: meter.status === 'Offline' ? 'danger' : 'warning',
        message: meter.status === 'Offline'
            ? 'Brak komunikacji z licznikiem'
            : 'Opóźniona komunikacja z licznikiem',
        timestampUtc,
    }
}

// Sudden production drop for a prosumer, comparing the last two completed days.
export function productionDropAlert(meter: Meter, analytics: MeterAnalytics): AppAlert | null {
    const complete = analytics.buckets.filter((bucket) => new Date(bucket.endUtc) <= new Date(analytics.toUtc))
    if (complete.length < 2) return null
    const previous = complete[complete.length - 2]
    const last = complete[complete.length - 1]
    if (previous.generatedKwh <= 0 || last.generatedKwh >= previous.generatedKwh * 0.6) return null
    const drop = (1 - last.generatedKwh / previous.generatedKwh) * 100
    return {
        id: `${meter.id}|production-drop|${last.startUtc}`,
        meterId: meter.id,
        meterName: meter.name,
        type: 'production-drop',
        severity: 'warning',
        message: `Spadek produkcji o ${percent.format(drop)}% względem poprzedniego dnia`,
        timestampUtc: last.startUtc,
    }
}
