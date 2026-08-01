import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, ButtonGroup, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap'
import { Bar, Line } from 'react-chartjs-2'
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import { getMeterAnalytics, getMeters, type MeterAnalytics } from '../../api/meters'
import type { Meter } from '../../types/infrastructure/meter'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const numberFormatter = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat('pl-PL', { month: 'short', year: 'numeric' })

const periods = [
    { label: '30 dni', days: 30, bucket: 'day' as const },
    { label: '180 dni', days: 180, bucket: 'month' as const },
    { label: '365 dni', days: 365, bucket: 'month' as const },
]

const downloadCsv = (analytics: MeterAnalytics) => {
    const rows = [
        ['poczatek_utc', 'koniec_utc', 'pobrano_kwh', 'oddano_kwh', 'srednia_moc_kw', 'maks_eksport_kw'],
        ...analytics.buckets.map((bucket) => [
            bucket.startUtc,
            bucket.endUtc,
            bucket.importedKwh,
            bucket.exportedKwh,
            bucket.averagePowerKw,
            bucket.maximumExportPowerKw,
        ]),
    ]
    const csv = rows.map((row) => row.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${analytics.serialNo}-energia.csv`
    link.click()
    URL.revokeObjectURL(url)
}

export function ElectricityGeneratorPage() {
    const [meters, setMeters] = useState<Meter[]>([])
    const [selectedMeter, setSelectedMeter] = useState('')
    const [periodDays, setPeriodDays] = useState(180)
    const [analytics, setAnalytics] = useState<MeterAnalytics | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        void getMeters(controller.signal)
            .then((items) => {
                setMeters(items)
                const producer = [...items].sort(
                    (left, right) => (right.latestActiveExportKwh ?? 0) - (left.latestActiveExportKwh ?? 0),
                )[0]
                setSelectedMeter((current) => current || producer?.id || '')
            })
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać liczników.')
            })
        return () => controller.abort()
    }, [])

    useEffect(() => {
        if (!selectedMeter) {
            setIsLoading(false)
            return
        }
        const controller = new AbortController()
        const period = periods.find((item) => item.days === periodDays) ?? periods[1]
        const to = new Date()
        const from = new Date(to.getTime() - period.days * 24 * 60 * 60 * 1000)
        setIsLoading(true)
        setError(null)
        void getMeterAnalytics(selectedMeter, from.toISOString(), to.toISOString(), period.bucket, controller.signal)
            .then(setAnalytics)
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych wytwórcy.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [periodDays, selectedMeter])

    const labels = useMemo(
        () => analytics?.buckets.map((bucket) => dateFormatter.format(new Date(bucket.startUtc))) ?? [],
        [analytics],
    )
    const energyChart = useMemo(() => ({
        labels,
        datasets: [
            { label: 'Oddano do sieci A- [kWh]', data: analytics?.buckets.map((bucket) => bucket.exportedKwh) ?? [], backgroundColor: '#7ecb20' },
            { label: 'Pobrano z sieci A+ [kWh]', data: analytics?.buckets.map((bucket) => bucket.importedKwh) ?? [], backgroundColor: '#660032' },
        ],
    }), [analytics, labels])
    const powerChart = useMemo(() => ({
        labels,
        datasets: [{
            label: 'Maksymalna moc oddawana [kW]',
            data: analytics?.buckets.map((bucket) => bucket.maximumExportPowerKw) ?? [],
            borderColor: '#7ecb20',
            backgroundColor: 'rgba(126,203,32,0.15)',
            fill: true,
            tension: 0.3,
        }],
    }), [analytics, labels])

    const currentPower = Math.max(0, -(analytics?.latestPowerKw ?? 0))
    const balance = (analytics?.exportedKwh ?? 0) - (analytics?.importedKwh ?? 0)

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Wytwórca</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-4 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaSolarPanel className="me-2 icon-accent" /> Wytwórca</h3>
                    <div className="text-muted small mt-1">Eksport i bilans energii obliczone z rejestrów A- i A+.</div>
                </Col>
                <Col xs="auto">
                    <Form.Group className="d-flex align-items-center gap-2">
                        <Form.Label className="mb-0">Licznik:</Form.Label>
                        <Form.Select value={selectedMeter} onChange={(event) => setSelectedMeter(event.target.value)} style={{ minWidth: 270 }}>
                            {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name} ({meter.tariff})</option>)}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <ButtonGroup className="mb-3">
                {periods.map((period) => (
                    <Button key={period.days} variant={periodDays === period.days ? 'primary' : 'outline-secondary'} onClick={() => setPeriodDays(period.days)}>
                        {period.label}
                    </Button>
                ))}
            </ButtonGroup>

            {error && <Alert variant="danger">{error}</Alert>}
            {isLoading ? (
                <div className="text-center py-5"><Spinner animation="border" /><div className="mt-2">Agregowanie pomiarów...</div></div>
            ) : !analytics || analytics.buckets.length === 0 ? (
                <Alert variant="info">Brak danych pomiarowych w wybranym okresie.</Alert>
            ) : (
                <>
                    {analytics.exportedKwh === 0 && (
                        <Alert variant="warning">Wybrany licznik nie zarejestrował energii oddanej. Wybierz licznik instalacji prosumenckiej.</Alert>
                    )}
                    <Row className="g-3 mb-3">
                        {[
                            { label: 'Aktualna moc oddawana', value: currentPower, unit: 'kW', icon: Fa.FaBolt },
                            { label: 'Oddano w okresie', value: analytics.exportedKwh, unit: 'kWh', icon: Fa.FaArrowUp },
                            { label: 'Pobrano w okresie', value: analytics.importedKwh, unit: 'kWh', icon: Fa.FaArrowDown },
                            { label: 'Bilans sieciowy', value: balance, unit: 'kWh', icon: Fa.FaExchangeAlt },
                        ].map((card) => (
                            <Col md={6} xl={3} key={card.label}>
                                <Card className="h-100 p-3">
                                    <div className="text-muted text-uppercase small">{card.label}</div>
                                    <div className="fs-4 mt-1"><card.icon className="me-2 icon-accent" />{numberFormatter.format(card.value)} {card.unit}</div>
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    <Row className="g-3 mb-3">
                        <Col xl={8}><Card className="h-100"><Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Energia wymieniona z siecią</div>
                            <div style={{ height: 420 }}><Bar data={energyChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} /></div>
                        </Card.Body></Card></Col>
                        <Col xl={4}><Card className="h-100"><Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Szczyt mocy oddawanej</div>
                            <div style={{ height: 420 }}><Line data={powerChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} /></div>
                        </Card.Body></Card></Col>
                    </Row>

                    <Card><Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div className="text-uppercase small fw-bold">Historia rozliczeniowa</div>
                            <Button size="sm" variant="outline-secondary" onClick={() => downloadCsv(analytics)}><Fa.FaFileCsv className="me-2" />Eksport CSV</Button>
                        </div>
                        <Table responsive hover size="sm" className="mb-0">
                            <thead><tr><th>Okres</th><th>Pobrano [kWh]</th><th>Oddano [kWh]</th><th>Maks. eksport [kW]</th><th>Próbki</th></tr></thead>
                            <tbody>{analytics.buckets.map((bucket) => (
                                <tr key={bucket.startUtc}>
                                    <td>{dateFormatter.format(new Date(bucket.startUtc))}</td>
                                    <td>{numberFormatter.format(bucket.importedKwh)}</td>
                                    <td>{numberFormatter.format(bucket.exportedKwh)}</td>
                                    <td>{numberFormatter.format(bucket.maximumExportPowerKw)}</td>
                                    <td>{bucket.sampleCount.toLocaleString('pl-PL')}</td>
                                </tr>
                            ))}</tbody>
                        </Table>
                    </Card.Body></Card>
                </>
            )}
        </Container>
    )
}
