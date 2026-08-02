import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, Card, Col, Container, Form, Row, Table } from 'react-bootstrap'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import { getMeterAnalytics, type MeterAnalytics } from '../../api/meters'
import { useMeterSelection } from '../../root/app-context'
import { AnalyticsSkeleton } from '../../root/layout/AnalyticsSkeleton'
import { plTooltip } from '../../root/chart-format'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, ArcElement, PointElement, Filler, Tooltip, Legend)

const kwh = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const kw = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const percent = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })
const monthFormatter = new Intl.DateTimeFormat('pl-PL', { month: 'short', year: 'numeric' })
const dayFormatter = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' })

const accent = '#660032'
const green = '#a9e34b'

const miniOptions = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    elements: { line: { borderWidth: 2 } },
    scales: { x: { display: false }, y: { display: false } },
    maintainAspectRatio: false,
}

const downloadCsv = (analytics: MeterAnalytics) => {
    const rows = [
        ['okres_start_utc', 'wytworzono_kwh', 'oddano_kwh', 'autokonsumpcja_kwh'],
        ...analytics.buckets.map((bucket) => [bucket.startUtc, bucket.generatedKwh, bucket.exportedKwh, bucket.selfConsumedKwh]),
    ]
    const csv = rows.map((row) => row.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${analytics.serialNo}-produkcja.csv`
    link.click()
    URL.revokeObjectURL(url)
}

export function ElectricityGeneratorPage() {
    const { meters, selectedMeterId: selectedMeter, setSelectedMeterId: setSelectedMeter } = useMeterSelection()
    const [daily, setDaily] = useState<MeterAnalytics | null>(null)
    const [monthly, setMonthly] = useState<MeterAnalytics | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!selectedMeter) {
            setIsLoading(false)
            return
        }
        const controller = new AbortController()
        const to = new Date()
        const dailyFrom = new Date(to.getTime() - 60 * 864e5)
        const monthlyFrom = new Date(to.getTime() - 365 * 864e5)
        setIsLoading(true)
        setError(null)
        void Promise.all([
            getMeterAnalytics(selectedMeter, dailyFrom.toISOString(), to.toISOString(), 'day', controller.signal),
            getMeterAnalytics(selectedMeter, monthlyFrom.toISOString(), to.toISOString(), 'month', controller.signal),
        ])
            .then(([dailyResult, monthlyResult]) => {
                setDaily(dailyResult)
                setMonthly(monthlyResult)
            })
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych wytwórcy.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [selectedMeter])

    const derived = useMemo(() => {
        if (!daily || daily.buckets.length === 0) return null
        const buckets = daily.buckets
        const generatedDaily = buckets.map((bucket) => bucket.generatedKwh)
        const exportedDaily = buckets.map((bucket) => bucket.exportedKwh)
        const todayGenerated = generatedDaily.at(-1) ?? 0
        const yesterdayGenerated = generatedDaily.at(-2) ?? 0
        // Forecast and trend come straight from the server's least-squares fit on real history.
        const forecastTomorrow = daily.generatedForecastKwh
        const trend = daily.generatedTrendPercent
        const currentGenerationPowerKw = Math.max(daily.latestGenerationPowerKw ?? 0, 0)
        const maxGenerationPowerKw = daily.maximumGenerationPowerKw || 1
        const selfConsumptionPercent = daily.selfConsumptionRatio * 100

        // Recent events derived from the measured series.
        const events: { icon: typeof Fa.FaSun; text: string }[] = []
        if (daily.maximumGenerationPowerAtUtc) {
            events.push({ icon: Fa.FaSun, text: `${dayFormatter.format(new Date(daily.maximumGenerationPowerAtUtc))}: szczyt mocy ${kw.format(daily.maximumGenerationPowerKw)} kW` })
        }
        let bestIndex = 0
        generatedDaily.forEach((value, index) => { if (value > generatedDaily[bestIndex]) bestIndex = index })
        if (buckets[bestIndex]) {
            events.push({ icon: Fa.FaSolarPanel, text: `${dayFormatter.format(new Date(buckets[bestIndex].startUtc))}: najlepszy dzień produkcji ${kwh.format(generatedDaily[bestIndex])} kWh` })
        }
        for (let index = generatedDaily.length - 1; index > 0 && events.length < 3; index -= 1) {
            const previousValue = generatedDaily[index - 1]
            if (previousValue > 0 && generatedDaily[index] < previousValue * 0.6) {
                events.push({ icon: Fa.FaExclamationTriangle, text: `${dayFormatter.format(new Date(buckets[index].startUtc))}: spadek produkcji o ${percent.format((1 - generatedDaily[index] / previousValue) * 100)}% względem poprzedniego dnia` })
                break
            }
        }

        return {
            generatedDaily,
            exportedDaily,
            todayGenerated,
            yesterdayGenerated,
            forecastTomorrow,
            trend,
            currentGenerationPowerKw,
            maxGenerationPowerKw,
            selfConsumptionPercent,
            selfConsumedTotal: daily.selfConsumedKwh,
            exportedTotal: daily.exportedKwh,
            todayExported: exportedDaily.at(-1) ?? 0,
            events,
        }
    }, [daily])

    const monthlyComparison = useMemo(() => {
        if (!monthly || monthly.buckets.length === 0) return null
        const generated = monthly.buckets.map((bucket) => bucket.generatedKwh)
        return {
            thisMonth: generated.at(-1) ?? 0,
            previousMonth: generated.at(-2) ?? 0,
        }
    }, [monthly])

    const productionChart = useMemo(() => {
        const buckets = monthly?.buckets ?? []
        return {
            labels: buckets.map((bucket) => monthFormatter.format(new Date(bucket.startUtc))),
            datasets: [
                { label: 'Energia wytworzona [kWh]', data: buckets.map((bucket) => bucket.generatedKwh), backgroundColor: accent },
                { label: 'Energia oddana do sieci [kWh]', data: buckets.map((bucket) => bucket.exportedKwh), backgroundColor: green },
            ],
        }
    }, [monthly])

    const noProduction = daily !== null && (daily.generatedKwh === 0 && daily.exportedKwh === 0)

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Wytwórca</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-4 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaSolarPanel className="me-2 icon-accent" /> Wytwórca</h3>
                    <div className="text-muted small mt-1">Produkcja, autokonsumpcja i eksport wyliczone z rejestrów licznika.</div>
                </Col>
                <Col xs="auto">
                    <Form.Group className="d-flex align-items-center gap-2">
                        <Form.Label className="mb-0">Licznik:</Form.Label>
                        <Form.Select value={selectedMeter} onChange={(event) => setSelectedMeter(event.target.value)} style={{ minWidth: 260 }}>
                            {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name} ({meter.tariff})</option>)}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            {error && <Alert variant="danger">{error}</Alert>}
            {isLoading ? (
                <AnalyticsSkeleton />
            ) : !daily || !derived ? (
                <Alert variant="info">Brak danych pomiarowych w wybranym okresie.</Alert>
            ) : (
                <>
                    {noProduction && <Alert variant="warning">Wybrany licznik nie zarejestrował produkcji. Wybierz licznik instalacji prosumenckiej.</Alert>}

                    <Row className="g-4 mb-3">
                        <Col md={6} lg={3}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-row justify-content-between align-items-start">
                                <div>
                                    <div className="text-muted text-uppercase small">Aktualna moc</div>
                                    <div className="fs-4 d-flex align-items-center mt-1"><Fa.FaBolt className="me-2 icon-accent" size={24} />{kw.format(derived.currentGenerationPowerKw)} kW</div>
                                    <div className="text-muted small mt-1">{percent.format(derived.currentGenerationPowerKw / derived.maxGenerationPowerKw * 100)}% mocy maksymalnej</div>
                                </div>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-row justify-content-between align-items-start">
                                <div>
                                    <div className="text-muted text-uppercase small">Wyprodukowano dziś</div>
                                    <div className="fs-4 d-flex align-items-center mt-1"><Fa.FaSun className="me-2 icon-accent" size={24} />{kwh.format(derived.todayGenerated)} kWh</div>
                                </div>
                                <div style={{ width: 90, height: 44 }}>
                                    <Line data={{ labels: derived.generatedDaily.slice(-12).map((_, index) => String(index)), datasets: [{ data: derived.generatedDaily.slice(-12), borderColor: '#cc3366', fill: false, tension: 0.5, pointRadius: 0 }] }} options={miniOptions} />
                                </div>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-row justify-content-between align-items-start">
                                <div>
                                    <div className="text-muted text-uppercase small">Autokonsumpcja</div>
                                    <div className="fs-4 d-flex align-items-center mt-1"><Fa.FaHome className="me-2 icon-accent" size={24} />{percent.format(derived.selfConsumptionPercent)}%</div>
                                    <div className="text-muted small mt-1">zużyto lokalnie</div>
                                </div>
                                <div style={{ width: 52, height: 52 }}>
                                    <Doughnut data={{ labels: ['Lokalnie', 'Oddano'], datasets: [{ data: [derived.selfConsumedTotal, derived.exportedTotal], backgroundColor: [accent, green], borderWidth: 0 }] }} options={{ cutout: '70%', plugins: { legend: { display: false } }, maintainAspectRatio: false }} />
                                </div>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-row justify-content-between align-items-start">
                                <div>
                                    <div className="text-muted text-uppercase small">Oddano dziś</div>
                                    <div className="fs-4 d-flex align-items-center mt-1"><Fa.FaExchangeAlt className="me-2 icon-accent" size={24} />{kwh.format(derived.todayExported)} kWh</div>
                                </div>
                                <div style={{ width: 90, height: 44 }}>
                                    <Line data={{ labels: derived.exportedDaily.slice(-12).map((_, index) => String(index)), datasets: [{ data: derived.exportedDaily.slice(-12), borderColor: green, fill: false, tension: 0.5, pointRadius: 0 }] }} options={miniOptions} />
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    <Row className="g-4 mb-4">
                        <Col md={4}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-column justify-content-between">
                                <div className="text-muted text-uppercase small">Prognoza produkcji</div>
                                <div className="fs-4 d-flex align-items-center mt-1"><Fa.FaChartLine className="me-2 icon-accent" size={20} />{kwh.format(derived.forecastTomorrow)} kWh</div>
                                <div className="small mt-1" style={{ color: derived.trend >= 0 ? '#357951' : '#984040' }}>
                                    {derived.trend >= 0 ? '+' : ''}{percent.format(derived.trend)}% trend dzienny &bull; prognoza na jutro
                                </div>
                            </Card>
                        </Col>
                        <Col md={4}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-column justify-content-between">
                                <div className="text-muted text-uppercase small">Porównanie produkcji</div>
                                <div className="mt-1 small">
                                    <span className="fw-semibold" style={{ color: '#357951' }}>Dziś:</span> {kwh.format(derived.todayGenerated)} kWh &nbsp;
                                    <span className="fw-semibold" style={{ color: '#984040' }}>Wczoraj:</span> {kwh.format(derived.yesterdayGenerated)} kWh
                                </div>
                                {monthlyComparison && (
                                    <div className="small">
                                        <span className="fw-semibold" style={{ color: '#357951' }}>Miesiąc:</span> {kwh.format(monthlyComparison.thisMonth)} kWh &nbsp;
                                        <span className="fw-semibold" style={{ color: '#984040' }}>Poprzedni:</span> {kwh.format(monthlyComparison.previousMonth)} kWh
                                    </div>
                                )}
                            </Card>
                        </Col>
                        <Col md={4}>
                            <Card className="metric-card h-100 px-3 py-2 d-flex flex-column">
                                <div className="text-muted text-uppercase small mb-1">Ostatnie zdarzenia</div>
                                {derived.events.length > 0 ? (
                                    <ul className="ps-3 mb-0 small">
                                        {derived.events.map((event, index) => (
                                            <li key={index} className="mb-1"><event.icon className="me-2 icon-accent" size={14} /> {event.text}</li>
                                        ))}
                                    </ul>
                                ) : <div className="text-muted small">Brak istotnych zdarzeń.</div>}
                            </Card>
                        </Col>
                    </Row>

                    <Row className="g-4">
                        <Col md={5} lg={4}>
                            <Card className="h-100"><Card.Body>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="text-uppercase small fw-bold">Produkcja energii</div>
                                    <Button variant="outline-secondary" size="sm" onClick={() => monthly && downloadCsv(monthly)}><Fa.FaFileCsv className="me-2" /> Eksport</Button>
                                </div>
                                <Table bordered hover size="sm" className="mb-0">
                                    <thead><tr><th>Miesiąc</th><th>Wytworzona [kWh]</th><th>Oddana [kWh]</th></tr></thead>
                                    <tbody>
                                        {(monthly?.buckets ?? []).map((bucket) => (
                                            <tr key={bucket.startUtc}>
                                                <td>{monthFormatter.format(new Date(bucket.startUtc))}</td>
                                                <td style={{ color: bucket.generatedKwh === 0 ? '#b08900' : '#357951' }}>{kwh.format(bucket.generatedKwh)}</td>
                                                <td style={{ color: bucket.exportedKwh === 0 ? '#b08900' : '#357951' }}>{kwh.format(bucket.exportedKwh)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card.Body></Card>
                        </Col>
                        <Col md={7} lg={8}>
                            <Card className="h-100"><Card.Body>
                                <div className="text-uppercase small fw-bold mb-2">Wykres produkcji</div>
                                <div style={{ height: 480, minHeight: 150 }}>
                                    <Bar data={productionChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: plTooltip }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }} />
                                </div>
                            </Card.Body></Card>
                        </Col>
                    </Row>
                </>
            )}
        </Container>
    )
}
