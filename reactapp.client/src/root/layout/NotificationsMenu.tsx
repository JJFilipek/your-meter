import { useMemo } from 'react'
import { Badge, Button, NavDropdown, Spinner } from 'react-bootstrap'
import { useLocation } from 'wouter'
import * as Fa from 'react-icons/fa'
import { alertKey, useMeterSelection, useNotifications } from '../app-context'

const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})

export function NotificationsMenu() {
    const { alerts, isLoading, unreadCount, refresh, isRead, markRead, markAllRead } = useNotifications()
    const { setSelectedMeterId } = useMeterSelection()
    const [, navigate] = useLocation()

    // Unread first, otherwise keep the newest-first order the context already provides.
    const ordered = useMemo(
        () => [...alerts].sort((left, right) => Number(isRead(left)) - Number(isRead(right))),
        [alerts, isRead],
    )

    const title = (
        <span className="notif-toggle">
            <Fa.FaBell className="me-2" />
            <span className="top-nav-label">Powiadomienia</span>
            {unreadCount > 0 && <Badge bg="danger" pill className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</Badge>}
        </span>
    )

    const openAlert = (meterId: string, alert: (typeof alerts)[number]) => {
        markRead(alert)
        setSelectedMeterId(meterId)
        navigate('/infrastructure/pmax')
    }

    return (
        <NavDropdown title={title} align="end" className="notif-menu" onClick={() => refresh()} aria-label="Powiadomienia">
            <div className="notif-header d-flex justify-content-between align-items-center px-3 py-2">
                <span className="fw-semibold">Przekroczenia mocy (7 dni)</span>
                {isLoading && <Spinner size="sm" animation="border" />}
            </div>
            {unreadCount > 0 && (
                <div className="px-3 pb-2 text-end">
                    <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none"
                        onClick={(event) => { event.stopPropagation(); markAllRead() }}
                    >
                        <Fa.FaCheckDouble className="me-1" /> Oznacz wszystkie jako przeczytane
                    </Button>
                </div>
            )}
            <NavDropdown.Divider className="my-0" />
            {ordered.length === 0 ? (
                <div className="text-muted small px-3 py-3">Brak przekroczeń w ostatnich 7 dniach.</div>
            ) : (
                ordered.slice(0, 10).map((alert) => {
                    const read = isRead(alert)
                    return (
                        <NavDropdown.Item
                            key={alertKey(alert)}
                            onClick={() => openAlert(alert.meterId, alert)}
                            className={`notif-item${read ? ' notif-read' : ''}`}
                        >
                            <div className="d-flex align-items-start">
                                <span className={`notif-dot${read ? ' is-read' : ''}`} aria-hidden="true" />
                                <Fa.FaExclamationTriangle
                                    className="me-2 mt-1 flex-shrink-0"
                                    style={{ color: alert.severity === 'danger' ? '#d90429' : '#b08900' }}
                                />
                                <div>
                                    <div className={`small ${read ? '' : 'fw-semibold'}`}>{alert.meterName}</div>
                                    <div className="text-muted small text-wrap">{alert.message}</div>
                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>{timeFormatter.format(new Date(alert.timestampUtc))}</div>
                                </div>
                            </div>
                        </NavDropdown.Item>
                    )
                })
            )}
        </NavDropdown>
    )
}
