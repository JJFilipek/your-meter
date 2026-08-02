import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import { getMeterAnalytics, getMeterInsights, getMeters } from '../api/meters'
import type { Meter } from '../types/infrastructure/meter'
import { useAuth } from '../auth'
import {
    offlineAlert,
    powerAlertsFromInsights,
    productionDropAlert,
    type AppAlert,
} from './notifications'

const SELECTED_METER_KEY = 'selectedMeterId'
const READ_STORAGE_KEY = 'readAlertKeys'
const DISMISSED_STORAGE_KEY = 'dismissedAlertKeys'
const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const dayMs = 24 * 60 * 60 * 1000

// ---- Shared meter selection (persists across tabs) ----

type MeterSelectionValue = {
    meters: Meter[]
    selectedMeterId: string
    setSelectedMeterId: (id: string) => void
    reloadMeters: () => void
    isLoading: boolean
    error: string | null
}

const MeterSelectionContext = createContext<MeterSelectionValue | null>(null)

export function useMeterSelection(): MeterSelectionValue {
    const context = useContext(MeterSelectionContext)
    if (!context) throw new Error('useMeterSelection must be used within AppStateProvider')
    return context
}

// ---- Aggregated notifications ----

type NotificationsValue = {
    alerts: AppAlert[]
    isLoading: boolean
    unreadCount: number
    newAlerts: AppAlert[]
    refresh: () => void
    isRead: (alert: AppAlert) => boolean
    markRead: (alert: AppAlert) => void
    markAllRead: () => void
    dismiss: (alert: AppAlert) => void
    clearNew: () => void
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function useNotifications(): NotificationsValue {
    const context = useContext(NotificationsContext)
    if (!context) throw new Error('useNotifications must be used within AppStateProvider')
    return context
}

const loadKeys = (storageKey: string): Set<string> => {
    try {
        return new Set<string>(JSON.parse(localStorage.getItem(storageKey) ?? '[]'))
    } catch {
        return new Set<string>()
    }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth()

    const [meters, setMeters] = useState<Meter[]>([])
    const [selectedMeterId, setSelectedMeterIdState] = useState(() => localStorage.getItem(SELECTED_METER_KEY) ?? '')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [metersToken, setMetersToken] = useState(0)

    const [alertsAll, setAlertsAll] = useState<AppAlert[]>([])
    const [alertsLoading, setAlertsLoading] = useState(false)
    const [newAlerts, setNewAlerts] = useState<AppAlert[]>([])
    const [readKeys, setReadKeys] = useState<Set<string>>(() => loadKeys(READ_STORAGE_KEY))
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => loadKeys(DISMISSED_STORAGE_KEY))
    const knownIdsRef = useRef<Set<string>>(new Set())
    const initialLoadRef = useRef(true)

    const setSelectedMeterId = useCallback((id: string) => {
        setSelectedMeterIdState(id)
        localStorage.setItem(SELECTED_METER_KEY, id)
    }, [])

    const reloadMeters = useCallback(() => setMetersToken((token) => token + 1), [])

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
                    if (next) localStorage.setItem(SELECTED_METER_KEY, next)
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
    }, [isAuthenticated, metersToken])

    const persist = useCallback((storageKey: string, setter: (value: Set<string>) => void, next: Set<string>) => {
        setter(next)
        localStorage.setItem(storageKey, JSON.stringify([...next]))
    }, [])

    const refresh = useCallback(() => {
        if (!isAuthenticated || meters.length === 0) return
        const to = new Date()
        const weekAgo = new Date(to.getTime() - 7 * dayMs)
        const twoMonths = new Date(to.getTime() - 60 * dayMs)
        const producers = meters.filter((meter) => (meter.latestActiveExportKwh ?? 0) > 0)
        setAlertsLoading(true)

        type Task =
            | { kind: 'import'; meter: Meter; data: Awaited<ReturnType<typeof getMeterInsights>> }
            | { kind: 'export'; meter: Meter; data: Awaited<ReturnType<typeof getMeterInsights>> }
            | { kind: 'daily'; meter: Meter; data: Awaited<ReturnType<typeof getMeterAnalytics>> }

        const tasks: Promise<Task>[] = [
            ...meters.map((meter) => getMeterInsights(meter.id, weekAgo.toISOString(), to.toISOString(), 'import').then((data) => ({ kind: 'import', meter, data } as Task))),
            ...producers.map((meter) => getMeterInsights(meter.id, weekAgo.toISOString(), to.toISOString(), 'export').then((data) => ({ kind: 'export', meter, data } as Task))),
            ...producers.map((meter) => getMeterAnalytics(meter.id, twoMonths.toISOString(), to.toISOString(), 'day').then((data) => ({ kind: 'daily', meter, data } as Task))),
        ]

        void Promise.allSettled(tasks)
            .then((results) => {
                const built: AppAlert[] = []
                for (const result of results) {
                    if (result.status !== 'fulfilled') continue
                    const task = result.value
                    if (task.kind === 'import') built.push(...powerAlertsFromInsights(task.meter, task.data, false))
                    else if (task.kind === 'export') built.push(...powerAlertsFromInsights(task.meter, task.data, true))
                    else {
                        const alert = productionDropAlert(task.meter, task.data)
                        if (alert) built.push(alert)
                    }
                }
                for (const meter of meters) {
                    const alert = offlineAlert(meter)
                    if (alert) built.push(alert)
                }

                const seen = new Set<string>()
                const unique = built
                    .filter((alert) => (seen.has(alert.id) ? false : (seen.add(alert.id), true)))
                    .sort((left, right) => right.timestampUtc.localeCompare(left.timestampUtc))
                    .slice(0, 60)

                if (!initialLoadRef.current) {
                    const fresh = unique.filter((alert) => !knownIdsRef.current.has(alert.id))
                    if (fresh.length > 0) setNewAlerts(fresh.slice(0, 3))
                }
                knownIdsRef.current = new Set(unique.map((alert) => alert.id))
                initialLoadRef.current = false
                setAlertsAll(unique)
            })
            .finally(() => setAlertsLoading(false))
    }, [isAuthenticated, meters])

    useEffect(() => {
        refresh()
    }, [refresh])

    // Periodic background refresh so new exceedances surface without a manual reload.
    useEffect(() => {
        if (!isAuthenticated) return
        const timer = window.setInterval(() => refresh(), REFRESH_INTERVAL_MS)
        return () => window.clearInterval(timer)
    }, [isAuthenticated, refresh])

    const alerts = useMemo(() => alertsAll.filter((alert) => !dismissedKeys.has(alert.id)), [alertsAll, dismissedKeys])

    // Keep read/dismissed stores bounded to alerts still in the current window.
    useEffect(() => {
        if (alertsAll.length === 0) return
        const valid = new Set(alertsAll.map((alert) => alert.id))
        setReadKeys((previous) => {
            const filtered = [...previous].filter((key) => valid.has(key))
            if (filtered.length === previous.size) return previous
            localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(filtered))
            return new Set(filtered)
        })
        setDismissedKeys((previous) => {
            const filtered = [...previous].filter((key) => valid.has(key))
            if (filtered.length === previous.size) return previous
            localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(filtered))
            return new Set(filtered)
        })
    }, [alertsAll])

    const isRead = useCallback((alert: AppAlert) => readKeys.has(alert.id), [readKeys])

    const markRead = useCallback((alert: AppAlert) => {
        if (readKeys.has(alert.id)) return
        persist(READ_STORAGE_KEY, setReadKeys, new Set(readKeys).add(alert.id))
    }, [readKeys, persist])

    const markAllRead = useCallback(() => {
        const next = new Set(readKeys)
        for (const alert of alerts) next.add(alert.id)
        persist(READ_STORAGE_KEY, setReadKeys, next)
    }, [alerts, readKeys, persist])

    const dismiss = useCallback((alert: AppAlert) => {
        persist(DISMISSED_STORAGE_KEY, setDismissedKeys, new Set(dismissedKeys).add(alert.id))
    }, [dismissedKeys, persist])

    const clearNew = useCallback(() => setNewAlerts([]), [])

    const unreadCount = useMemo(
        () => alerts.reduce((count, alert) => (readKeys.has(alert.id) ? count : count + 1), 0),
        [alerts, readKeys],
    )

    return (
        <MeterSelectionContext.Provider value={{ meters, selectedMeterId, setSelectedMeterId, reloadMeters, isLoading, error }}>
            <NotificationsContext.Provider value={{ alerts, isLoading: alertsLoading, unreadCount, newAlerts, refresh, isRead, markRead, markAllRead, dismiss, clearNew }}>
                {children}
            </NotificationsContext.Provider>
        </MeterSelectionContext.Provider>
    )
}
