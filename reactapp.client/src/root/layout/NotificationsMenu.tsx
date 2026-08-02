import { useMemo } from 'react'
import { Badge, Button, NavDropdown, Spinner } from 'react-bootstrap'
import { useLocation } from 'wouter'
import * as Fa from 'react-icons/fa'
import { useMeterSelection, useNotifications } from '../app-context'
import { alertTypeLabels, relativeTime, type AppAlert } from '../notifications'

export function NotificationsMenu() {
    const { alerts, isLoading, unreadCount, refresh, isRead, markRead, markAllRead, dismiss } = useNotifications()
    const { setSelectedMeterId } = useMeterSelection()
    const [, navigate] = useLocation()

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

    const openAlert = (alert: AppAlert) => {
        markRead(alert)
        setSelectedMeterId(alert.meterId)
        navigate('/infrastructure/pmax')
    }

    return (
        <NavDropdown title={title} align="end" className="notif-menu" aria-label="Powiadomienia">
            <div className="notif-header d-flex justify-content-between align-items-center px-3 py-2">
                <span className="fw-semibold">Powiadomienia</span>
                <span className="d-flex align-items-center gap-2">
                    {isLoading && <Spinner size="sm" animation="border" />}
                    <Button variant="link" size="sm" className="p-0 text-decoration-none" aria-label="Odśwież" onClick={(event) => { event.stopPropagation(); refresh() }}>
                        <Fa.FaSyncAlt />
                    </Button>
                </span>
            </div>
            {unreadCount > 0 && (
                <div className="px-3 pb-2 text-end">
                    <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={(event) => { event.stopPropagation(); markAllRead() }}>
                        <Fa.FaCheckDouble className="me-1" /> Oznacz wszystkie jako przeczytane
                    </Button>
                </div>
            )}
            <NavDropdown.Divider className="my-0" />
            {ordered.length === 0 ? (
                <div className="text-muted small px-3 py-3">Brak powiadomień z ostatnich 7 dni.</div>
            ) : (
                ordered.slice(0, 8).map((alert) => {
                    const read = isRead(alert)
                    return (
                        <NavDropdown.Item key={alert.id} onClick={() => openAlert(alert)} className={`notif-item${read ? ' notif-read' : ''}`}>
                            <div className="d-flex align-items-start">
                                <span className={`notif-dot${read ? ' is-read' : ''}`} aria-hidden="true" />
                                <Fa.FaExclamationTriangle className="me-2 mt-1 flex-shrink-0" style={{ color: alert.severity === 'danger' ? '#d90429' : '#b08900' }} />
                                <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between align-items-start gap-2">
                                        <span className={`small ${read ? '' : 'fw-semibold'}`}>{alert.meterName}</span>
                                        <Badge bg="light" text="dark" className="notif-type">{alertTypeLabels[alert.type]}</Badge>
                                    </div>
                                    <div className="text-muted small text-wrap">{alert.message}</div>
                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>{relativeTime(alert.timestampUtc)}</div>
                                </div>
                                <button type="button" className="notif-dismiss" aria-label="Odrzuć" onClick={(event) => { event.stopPropagation(); event.preventDefault(); dismiss(alert) }}>
                                    <Fa.FaTimes />
                                </button>
                            </div>
                        </NavDropdown.Item>
                    )
                })
            )}
            <NavDropdown.Divider className="my-0" />
            <NavDropdown.Item onClick={() => navigate('/notifications')} className="text-center small fw-semibold">
                Zobacz wszystkie
            </NavDropdown.Item>
        </NavDropdown>
    )
}
