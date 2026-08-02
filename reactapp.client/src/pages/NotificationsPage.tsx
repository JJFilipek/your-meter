import { useMemo, useState } from 'react'
import { Alert, Badge, Breadcrumb, Button, Card, Col, Container, Form, Row } from 'react-bootstrap'
import { useLocation } from 'wouter'
import * as Fa from 'react-icons/fa'
import { useMeterSelection, useNotifications } from '../root/app-context'
import { alertTypeLabels, relativeTime, type AlertType } from '../root/notifications'

const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
const alertTypes = Object.keys(alertTypeLabels) as AlertType[]

export function NotificationsPage() {
    const { alerts, unreadCount, refresh, isRead, markRead, markAllRead, dismiss } = useNotifications()
    const { meters, setSelectedMeterId } = useMeterSelection()
    const [, navigate] = useLocation()

    const [meterFilter, setMeterFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState<'' | AlertType>('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all')

    const filtered = useMemo(() => alerts.filter((alert) => {
        if (meterFilter && alert.meterId !== meterFilter) return false
        if (typeFilter && alert.type !== typeFilter) return false
        if (statusFilter === 'unread' && isRead(alert)) return false
        if (statusFilter === 'read' && !isRead(alert)) return false
        return true
    }), [alerts, meterFilter, typeFilter, statusFilter, isRead])

    const open = (meterId: string) => {
        setSelectedMeterId(meterId)
        navigate('/infrastructure/pmax')
    }

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Powiadomienia</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-3 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaBell className="me-2 icon-accent" /> Powiadomienia</h3>
                    <div className="text-muted small mt-1">Przekroczenia mocy, komunikacja i produkcja z ostatnich 7 dni.</div>
                </Col>
                <Col xs="auto" className="d-flex gap-2">
                    <Button variant="outline-secondary" onClick={() => refresh()}><Fa.FaSyncAlt className="me-2" /> Odśwież</Button>
                    <Button variant="outline-secondary" disabled={unreadCount === 0} onClick={() => markAllRead()}><Fa.FaCheckDouble className="me-2" /> Oznacz wszystkie</Button>
                </Col>
            </Row>

            <Card className="mb-3"><Card.Body className="d-flex flex-wrap gap-3 align-items-end">
                <Form.Group>
                    <Form.Label className="small mb-1">Licznik</Form.Label>
                    <Form.Select size="sm" style={{ minWidth: 200 }} value={meterFilter} onChange={(event) => setMeterFilter(event.target.value)}>
                        <option value="">Wszystkie liczniki</option>
                        {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name}</option>)}
                    </Form.Select>
                </Form.Group>
                <Form.Group>
                    <Form.Label className="small mb-1">Typ</Form.Label>
                    <Form.Select size="sm" style={{ minWidth: 170 }} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as '' | AlertType)}>
                        <option value="">Wszystkie typy</option>
                        {alertTypes.map((type) => <option key={type} value={type}>{alertTypeLabels[type]}</option>)}
                    </Form.Select>
                </Form.Group>
                <Form.Group>
                    <Form.Label className="small mb-1">Status</Form.Label>
                    <Form.Select size="sm" style={{ minWidth: 150 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'unread' | 'read')}>
                        <option value="all">Wszystkie</option>
                        <option value="unread">Nieprzeczytane</option>
                        <option value="read">Przeczytane</option>
                    </Form.Select>
                </Form.Group>
                <div className="text-muted small ms-auto">{filtered.length} z {alerts.length}</div>
            </Card.Body></Card>

            {filtered.length === 0 ? (
                <Alert variant="info">Brak powiadomień spełniających kryteria.</Alert>
            ) : (
                <Card><Card.Body className="p-0">
                    {filtered.map((alert) => {
                        const read = isRead(alert)
                        return (
                            <div key={alert.id} className={`notif-row d-flex align-items-start gap-2 px-3 py-3 border-bottom${read ? ' notif-read' : ''}`} role="button" onClick={() => { markRead(alert); open(alert.meterId) }}>
                                <span className={`notif-dot${read ? ' is-read' : ''}`} aria-hidden="true" />
                                <Fa.FaExclamationTriangle className="mt-1 flex-shrink-0" style={{ color: alert.severity === 'danger' ? '#d90429' : '#b08900' }} />
                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <span className={read ? '' : 'fw-semibold'}>{alert.meterName}</span>
                                        <Badge bg="light" text="dark" className="notif-type">{alertTypeLabels[alert.type]}</Badge>
                                    </div>
                                    <div className="text-muted small">{alert.message}</div>
                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{relativeTime(alert.timestampUtc)} &bull; {dateTimeFormatter.format(new Date(alert.timestampUtc))}</div>
                                </div>
                                <button type="button" className="notif-dismiss" aria-label="Odrzuć" onClick={(event) => { event.stopPropagation(); dismiss(alert) }}><Fa.FaTimes /></button>
                            </div>
                        )
                    })}
                </Card.Body></Card>
            )}
        </Container>
    )
}
