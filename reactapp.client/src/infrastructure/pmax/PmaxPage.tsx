import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap'
import { Line } from 'react-chartjs-2'
import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import { getMeterAnalytics, getMeters, type MeterAnalytics } from '../../api/meters'
import type { Meter } from '../../types/infrastructure/meter'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend)

const dateInput = (date: Date) => date.toISOString().slice(0, 10)
const today = new Date()
const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
const numberFormatter = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})
const dayFormatter = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function PmaxPage() {
    const [meters, setMeters] = useState<Meter[]>([])
    const [selectedMeter, setSelectedMeter] = useState('')
    const [register, setRegister] = useState<'import' | 'export'>('import')
    const [dateFrom, setDateFrom] = useState(dateInput(weekAgo))
    const [dateTo, setDateTo] = useState(dateInput(today))
    const [analytics, setAnalytics] = useState<MeterAnalytics | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        void getMeters(controller.signal)
            .then((items) => {
                setMeters(items)
                setSelectedMeter((current) => current || items[0]?.id || '')
            })
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać liczników.')
            })
        return () => controller.abort()
    }, [])

    useEffect(() => {
        if (!selectedMeter || !dateFrom || !dateTo) {
            setIsLoading(false)
            return
        }
        const from = new Date(`${dateFrom}T00:00:00`)
        const to = new Date(`${dateTo}T23:59:59`)
        if (from >= to) {
            setError('Data początkowa musi być wcześniejsza od końcowej.')
            setIsLoading(false)
            return
        }

        const controller = new AbortController()
        setIsLoading(true)
        setError(null)
        void getMeterAnalytics(selectedMeter, from.toISOString(), to.toISOString(), 'hour', controller.signal)
            .then(setAnalytics)
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych mocy.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [dateFrom, dateTo, selectedMeter])

    const referencePower = analytics?.referencePowerKw ?? Math.max(analytics?.maximumImportPowerKw ?? 0, 1)
    const alertThreshold = referencePower * 0.9
    const selectedMaximum = register === 'import'
        ? analytics?.maximumImportPowerKw ?? 0
        : analytics?.maximumExportPowerKw ?? 0
    const selectedMaximumAt = register === 'import'
        ? analytics?.maximumImportPowerAtUtc
        : analytics?.maximumExportPowerAtUtc
    const currentPower = register === 'import'
        ? Math.max(0, analytics?.latestPowerKw ?? 0)
        : Math.max(0, -(analytics?.latestPowerKw ?? 0))
    const exceedances = analytics?.buckets.filter((bucket) => (
        register === 'import' ? bucket.maximumImportPowerKw : bucket.maximumExportPowerKw
    ) >= alertThreshold).length ?? 0

    const dailyMaximums = useMemo(() => {
        const values = new Map<string, number>()
        for (const bucket of analytics?.buckets ?? []) {
            const day = bucket.startUtc.slice(0, 10)
            const value = register === 'import' ? bucket.maximumImportPowerKw : bucket.maximumExportPowerKw
            values.set(day, Math.max(values.get(day) ?? 0, value))
        }
        return [...values.entries()].sort(([left], [right]) => right.localeCompare(left))
    }, [analytics, register])

    const chartData = useMemo(() => ({
        labels: analytics?.buckets.map((bucket) => dateTimeFormatter.format(new Date(bucket.startUtc))) ?? [],
        datasets: [
            {
                label: register === 'import' ? 'Pmax poboru [kW]' : 'Pmax oddawania [kW]',
                data: analytics?.buckets.map((bucket) => register === 'import'
                    ? bucket.maximumImportPowerKw
                    : bucket.maximumExportPowerKw) ?? [],
                borderColor: '#660032',
                backgroundColor: 'rgba(102,0,50,0.12)',
                fill: true,
                tension: 0.25,
                pointRadius: 1,
            },
            {
                label: `Próg 90% mocy referencyjnej (${numberFormatter.format(alertThreshold)} kW)`,
                data: analytics?.buckets.map(() => alertThreshold) ?? [],
                borderColor: '#b08900',
                borderDash: [6, 4],
                pointRadius: 0,
            },
        ],
    }), [alertThreshold, analytics, register])

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Moc szczytowa</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-4 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaArrowUp className="me-2 icon-accent" /> Moc szczytowa (Pmax)</h3>
                    <div className="text-muted small mt-1">Maksima godzinowe wyznaczone z rzeczywistych próbek mocy.</div>
                </Col>
                <Col xs="auto" className="d-flex gap-2 flex-wrap">
                    <Form.Select value={register} onChange={(event) => setRegister(event.target.value as 'import' | 'export')} style={{ minWidth: 180 }}>
                        <option value="import">Pmax+ pobór</option>
                        <option value="export">Pmax- oddawanie</option>
                    </Form.Select>
                    <Form.Select value={selectedMeter} onChange={(event) => setSelectedMeter(event.target.value)} style={{ minWidth: 260 }}>
                        {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name} ({meter.tariff})</option>)}
                    </Form.Select>
                </Col>
            </Row>

            <Row className="g-2 mb-3">
                <Col sm="auto"><Form.Control type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></Col>
                <Col sm="auto"><Form.Control type="date" value={dateTo} min={dateFrom} max={dateInput(new Date())} onChange={(event) => setDateTo(event.target.value)} /></Col>
            </Row>

            {error && <Alert variant="danger">{error}</Alert>}
            {isLoading ? (
                <div className="text-center py-5"><Spinner animation="border" /><div className="mt-2">Analiza profilu mocy...</div></div>
            ) : !analytics || analytics.buckets.length === 0 ? (
                <Alert variant="info">Brak pomiarów w wybranym okresie.</Alert>
            ) : (
                <>
                    <Row className="g-3 mb-3">
                        {[
                            { label: 'Aktualna moc', value: currentPower, subtitle: analytics.latestReadingAtUtc ? dateTimeFormatter.format(new Date(analytics.latestReadingAtUtc)) : '-', icon: Fa.FaBolt },
                            { label: 'Moc szczytowa', value: selectedMaximum, subtitle: selectedMaximumAt ? dateTimeFormatter.format(new Date(selectedMaximumAt)) : '-', icon: Fa.FaTachometerAlt },
                            { label: 'Średnie obciążenie', value: analytics.averageAbsolutePowerKw, subtitle: 'średnia wartości bezwzględnej', icon: Fa.FaChartLine },
                            { label: 'Przekroczenia progu', value: exceedances, subtitle: `próg ${numberFormatter.format(alertThreshold)} kW`, icon: Fa.FaExclamationTriangle, unit: '' },
                        ].map((card) => (
                            <Col md={6} xl={3} key={card.label}><Card className="h-100 p-3">
                                <div className="text-muted text-uppercase small">{card.label}</div>
                                <div className="fs-4 mt-1"><card.icon className="me-2 icon-accent" />{numberFormatter.format(card.value)}{card.unit === '' ? '' : ' kW'}</div>
                                <div className="text-muted small mt-1">{card.subtitle}</div>
                            </Card></Col>
                        ))}
                    </Row>

                    <Row className="g-3">
                        <Col xl={9}><Card className="h-100"><Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Profil mocy szczytowej</div>
                            <div style={{ height: 520 }}><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} /></div>
                        </Card.Body></Card></Col>
                        <Col xl={3}><Card className="h-100"><Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Maksima dzienne</div>
                            <Table responsive hover size="sm" className="mb-0">
                                <thead><tr><th>Data</th><th>Pmax [kW]</th></tr></thead>
                                <tbody>{dailyMaximums.map(([day, value]) => (
                                    <tr key={day}><td>{dayFormatter.format(new Date(`${day}T12:00:00Z`))}</td><td>{numberFormatter.format(value)}</td></tr>
                                ))}</tbody>
                            </Table>
                        </Card.Body></Card></Col>
                    </Row>
                </>
            )}
        </Container>
    )
}
