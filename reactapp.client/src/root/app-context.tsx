import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'
import { getMeterInsights, getMeters } from '../api/meters'
import type { Meter } from '../types/infrastructure/meter'
import { useAuth } from '../auth'

const STORAGE_KEY = 'selectedMeterId'

// ---- Shared meter selection (persists across tabs) ----

type MeterSelectionValue = {
    meters: Meter[]
    selectedMeterId: string
    setSelectedMeterId: (id: string) => void
    isLoading: boolean
    error: string | null
}

const MeterSelectionContext = createContext<MeterSelectionValue | null>(null)

export function useMeterSelection(): MeterSelectionValue {
    const context = useContext(MeterSelectionContext)
    if (!context) throw new Error('useMeterSelection must be used within AppStateProvider')
    return context
}

// ---- Aggregated notifications (recent power exceedances across meters) ----

export type AppAlert = {
    meterId: string
    meterName: string
    timestampUtc: string
    severity: 'danger' | 'warning' | 'info'
    message: string
}

type NotificationsValue = {
    alerts: AppAlert[]
    isLoading: boolean
    refresh: () => void
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function useNotifications(): NotificationsValue {
    const context = useContext(NotificationsContext)
    if (!context) throw new Error('useNotifications must be used within AppStateProvider')
    return context
}

const dayMs = 24 * 60 * 60 * 1000

export function AppStateProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth()

    const [meters, setMeters] = useState<Meter[]>([])
    const [selectedMeterId, setSelectedMeterIdState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [alerts, setAlerts] = useState<AppAlert[]>([])
    const [alertsLoading, setAlertsLoading] = useState(false)

    const setSelectedMeterId = useCallback((id: string) => {
        setSelectedMeterIdState(id)
        localStorage.setItem(STORAGE_KEY, id)
    }, [])

    useEffect(() => {
        if (!isAuthenticated) {
            setMeters([])
            setIsLoading(false)
            return
        }
        const controller = new AbortController()
        setIsLoading(true)
        void getMeters(controller.signal)
            .then((items) => {
                setMeters(items)
                setSelectedMeterIdState((current) => {
                    const next = current && items.some((m) => m.id === current) ? current : items[0]?.id ?? ''
                    if (next) localStorage.setItem(STORAGE_KEY, next)
                    return next
                })
            })
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać liczników.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [isAuthenticated])

    const refresh = useCallback(() => {
        if (!isAuthenticated || meters.length === 0) return
        const to = new Date()
        const from = new Date(to.getTime() - 7 * dayMs)
        setAlertsLoading(true)
        void Promise.allSettled(
            meters.map((meter) =>
                getMeterInsights(meter.id, from.toISOString(), to.toISOString(), 'import').then((insights) => ({ meter, insights })),
            ),
        )
            .then((results) => {
                const collected: AppAlert[] = []
                for (const result of results) {
                    if (result.status !== 'fulfilled') continue
                    const { meter, insights } = result.value
                    for (const alert of insights.alerts) {
                        collected.push({
                            meterId: meter.id,
                            meterName: meter.name,
                            timestampUtc: alert.timestampUtc,
                            severity: alert.severity,
                            message: alert.message,
                        })
                    }
                }
                collected.sort((left, right) => right.timestampUtc.localeCompare(left.timestampUtc))
                setAlerts(collected.slice(0, 30))
            })
            .finally(() => setAlertsLoading(false))
    }, [isAuthenticated, meters])

    useEffect(() => {
        refresh()
    }, [refresh])

    return (
        <MeterSelectionContext.Provider value={{ meters, selectedMeterId, setSelectedMeterId, isLoading, error }}>
            <NotificationsContext.Provider value={{ alerts, isLoading: alertsLoading, refresh }}>
                {children}
            </NotificationsContext.Provider>
        </MeterSelectionContext.Provider>
    )
}
