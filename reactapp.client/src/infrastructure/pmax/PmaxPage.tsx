import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, Card, Col, Container, Form, Row, Table } from 'react-bootstrap'
import { Line } from 'react-chartjs-2'
import {
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import { getMeterAnalytics, getMeterInsights, type MeterAnalytics, type MeterInsights } from '../../api/meters'
import { useMeterSelection } from '../../root/app-context'
import { AnalyticsSkeleton } from '../../root/layout/AnalyticsSkeleton'
import { plTooltip } from '../../root/chart-format'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend)

const dateInput = (date: Date) => date.toISOString().slice(0, 10)
const kw = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' })

const weekdays = ['Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz']

const powerColor = (value: number, contracted: number, connection: number) => {
    if (value >= connection) return '#d90429'
    if (value >= contracted) return '#984040'
    if (value >= contracted * 0.9) return '#b08900'
    return '#357951'
}

export function PmaxPage() {
    const { meters, selectedMeterId: selectedMeter, setSelectedMeterId: setSelectedMeter } = useMeterSelection()
    const [register, setRegister] = useState<'import' | 'export'>('import')
    const [dateFrom, setDateFrom] = useState(dateInput(new Date(Date.now() - 7 * 864e5)))
    const [dateTo, setDateTo] = useState(dateInput(new Date()))
    const [analytics, setAnalytics] = useState<MeterAnalytics | null>(null)
    const [insights, setInsights] = useState<MeterInsights | null>(null)
    const [customThreshold, setCustomThreshold] = useState<number | null>(null)
    const [editingThreshold, setEditingThreshold] = useState(false)
    const [showCostDetails, setShowCostDetails] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [theme, setTheme] = useState(document.body.dataset.theme)

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(document.body.dataset.theme))
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
        return () => observer.disconnect()
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
        setCustomThreshold(null)
        void Promise.all([
            getMeterAnalytics(selectedMeter, from.toISOString(), to.toISOString(), 'hour', controller.signal),
            getMeterInsights(selectedMeter, from.toISOString(), to.toISOString(), register, controller.signal),
        ])
            .then(([analyticsResult, insightsResult]) => {
                setAnalytics(analyticsResult)
                setInsights(insightsResult)
            })
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych mocy.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [dateFrom, dateTo, selectedMeter, register])

    const alertThreshold = customThreshold ?? insights?.alertThresholdKw ?? 0
    const contracted = insights?.contractedPowerKw ?? 0
    const connection = insights?.connectionPowerKw ?? 0

    const powerSeries = useMemo(
        () => analytics?.buckets.map((bucket) => (register === 'export' ? bucket.maximumExportPowerKw : bucket.maximumImportPowerKw)) ?? [],
        [analytics, register],
    )
    const pmaxInPeriod = powerSeries.length > 0 ? Math.max(...powerSeries) : 0
    const customExceedances = powerSeries.filter((value) => value >= alertThreshold).length

    const chartData = useMemo(() => ({
        labels: analytics?.buckets.map((bucket) => dateTimeFormatter.format(new Date(bucket.startUtc))) ?? [],
        datasets: [
            { label: register === 'export' ? 'Moc oddawania [kW]' : 'Moc poboru [kW]', data: powerSeries, borderColor: '#660032', backgroundColor: 'rgba(102,0,50,0.1)', fill: true, tension: 0.35, pointRadius: 1 },
            { label: `Moc umowna (${kw.format(contracted)} kW)`, data: powerSeries.map(() => contracted), borderColor: '#b08900', borderDash: [5, 5], borderWidth: 2, pointRadius: 0 },
            { label: `Próg alertu (${kw.format(alertThreshold)} kW)`, data: powerSeries.map(() => alertThreshold), borderColor: '#357951', borderDash: [8, 4], borderWidth: 2, pointRadius: 0 },
            { label: `Moc przyłącza (${kw.format(connection)} kW)`, data: powerSeries.map(() => connection), borderColor: '#d90429', borderDash: [2, 2], borderWidth: 2, pointRadius: 0 },
        ],
    }), [analytics, powerSeries, register, contracted, connection, alertThreshold])

    // Hour x weekday distribution grid.
    const distributionGrid = useMemo(() => {
        const grid = new Map<string, number>()
        let max = 0
        for (const cell of insights?.distribution ?? []) {
            grid.set(`${cell.weekday}-${cell.hour}`, cell.averagePowerKw)
            max = Math.max(max, cell.averagePowerKw)
        }
        return { grid, max }
    }, [insights])

    const currentPercent = contracted > 0 ? Math.round((insights?.currentPowerKw ?? 0) / contracted * 100) : 0
    const cost = insights?.exceedanceCost

    const summaryCards = insights ? [
        { label: 'Aktualna moc chwilowa', value: `${kw.format(insights.currentPowerKw)} kW`, subtitle: `${currentPercent}% mocy umownej (${kw.format(contracted)} kW)`, icon: Fa.FaBolt },
        { label: 'Moc szczytowa (Pmax)', value: `${kw.format(insights.peakPowerKw)} kW`, subtitle: insights.peakPowerAtUtc ? `osiągnięto ${dateTimeFormatter.format(new Date(insights.peakPowerAtUtc))}` : '-', icon: Fa.FaTachometerAlt },
        { label: 'Przekroczenia progu alertu', value: `${insights.thresholdExceedanceCount} razy`, subtitle: `próg ${kw.format(insights.alertThresholdKw)} kW`, icon: Fa.FaExclamationTriangle },
        { label: 'Średnie obciążenie', value: `${kw.format(insights.averagePowerKw)} kW`, subtitle: `wykorzystanie mocy umownej ${insights.utilizationPercent}%`, icon: Fa.FaChartLine },
    ] : []

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Moc szczytowa (Pmax)</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-3 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaArrowUp className="me-2 icon-accent" /> Moc szczytowa (Pmax)</h3>
                    <div className="text-muted small mt-1">Limity, przekroczenia i rozkład mocy wyliczone z rzeczywistych próbek.</div>
                </Col>
                <Col xs="auto" className="d-flex gap-2 flex-wrap align-items-center">
                    <Form.Label className="mb-0">Rejestr:</Form.Label>
                    <Form.Select value={register} onChange={(event) => setRegister(event.target.value as 'import' | 'export')} style={{ minWidth: 170 }}>
                        <option value="import">Pmax+ pobór</option>
                        <option value="export">Pmax- oddawanie</option>
                    </Form.Select>
                    <Form.Label className="mb-0">Licznik:</Form.Label>
                    <Form.Select value={selectedMeter} onChange={(event) => setSelectedMeter(event.target.value)} style={{ minWidth: 240 }}>
                        {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name} ({meter.tariff})</option>)}
                    </Form.Select>
                </Col>
            </Row>

            {error && <Alert variant="danger">{error}</Alert>}
            {isLoading ? (
                <AnalyticsSkeleton />
            ) : !insights || !analytics || analytics.buckets.length === 0 ? (
                <Alert variant="info">Brak pomiarów w wybranym okresie.</Alert>
            ) : (
                <>
                    <Row className="g-4 mb-3">
                        {summaryCards.map((card) => (
                            <Col md={6} lg={3} key={card.label}>
                                <Card className="h-100 p-3">
                                    <div className="text-muted text-uppercase small">{card.label}</div>
                                    <div className="fs-4 d-flex align-items-center mt-1"><card.icon className="me-2 icon-accent" size={24} />{card.value}</div>
                                    <div className="text-muted small mt-1">{card.subtitle}</div>
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    <Row className="g-4 mb-4 align-items-stretch">
                        <Col lg={2}>
                            <Card className="h-100 p-3">
                                <Card.Title className="text-uppercase small fw-bold mb-2">Maksima dzienne</Card.Title>
                                <div className="text-muted small mb-2">Rejestr mocy szczytowej z ostatnich dni</div>
                                <table className="table table-sm table-hover mb-0 text-center align-middle">
                                    <thead><tr><th>Data</th><th>Pmax [kW]</th></tr></thead>
                                    <tbody>
                                        {insights.dailyMaxima.map((entry) => (
                                            <tr key={entry.date}>
                                                <td>{dayFormatter.format(new Date(`${entry.date}T12:00:00`))}</td>
                                                <td style={{ color: powerColor(entry.maximumPowerKw, contracted, connection) }}>{kw.format(entry.maximumPowerKw)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        </Col>
                        <Col lg={6}>
                            <Card className="h-100 p-3">
                                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <Form.Control type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} />
                                        <span style={{ fontSize: '1.5rem' }}>→</span>
                                        <Form.Control type="date" value={dateTo} min={dateFrom} max={dateInput(new Date())} onChange={(event) => setDateTo(event.target.value)} />
                                    </div>
                                    <Button variant="outline-secondary" onClick={() => setEditingThreshold((current) => !current)}>
                                        <Fa.FaWrench className="me-2" /> Zmień próg alertu
                                    </Button>
                                </div>
                                {editingThreshold && (
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <Form.Range min={1} max={Math.ceil(connection)} step={0.1} value={alertThreshold} onChange={(event) => setCustomThreshold(Number(event.target.value))} />
                                        <span className="text-nowrap small">{kw.format(alertThreshold)} kW → {customExceedances}× w oknie</span>
                                    </div>
                                )}
                                <Card.Title className="text-uppercase small fw-bold mb-2">Moc chwilowa względem limitów</Card.Title>
                                <div style={{ height: 460 }}><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: plTooltip }, scales: { y: { beginAtZero: true } } }} /></div>
                                <div className="mt-2 mb-0 text-end text-muted">Moc szczytowa (Pmax) we wskazanym okresie: <b>{kw.format(pmaxInPeriod)} kW</b></div>
                            </Card>
                        </Col>
                        <Col lg={4} className="d-flex flex-column">
                            <Card className="p-3 mb-3">
                                <Card.Title className="text-uppercase small fw-bold mb-3">Alerty i rekomendacje</Card.Title>
                                {insights.alerts.length === 0 && insights.recommendations.length === 0 ? (
                                    <div className="text-muted small">Brak przekroczeń w wybranym okresie.</div>
                                ) : (
                                    <ul className="ps-3 small mb-0">
                                        {insights.alerts.slice(0, 4).map((alert, index) => (
                                            <li key={`a-${index}`} className="mb-2">
                                                <Fa.FaExclamationTriangle className="me-2" style={{ color: alert.severity === 'danger' ? '#d90429' : '#b08900' }} />
                                                {dateTimeFormatter.format(new Date(alert.timestampUtc))} – {alert.message}
                                            </li>
                                        ))}
                                        {insights.recommendations.map((recommendation, index) => (
                                            <li key={`r-${index}`} className="mb-2"><Fa.FaChartLine className="me-2 icon-accent" />{recommendation}</li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                            <Card className="p-4 d-flex flex-column h-100 justify-content-between">
                                {!showCostDetails ? (
                                    <>
                                        <Card.Title className="text-uppercase small fw-bold mb-4">Koszta przekroczeń w podanym okresie</Card.Title>
                                        <div className="mb-4">
                                            <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                                                <span className="text-muted">Przekroczenia mocy umownej</span>
                                                <span className="fw-bold" style={{ fontSize: 22, color: '#b08900' }}>{cost?.contractedExceedanceCount ?? 0}</span>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                                                <span className="text-muted">Przekroczenia mocy przyłącza</span>
                                                <span className="fw-bold" style={{ fontSize: 22, color: '#d90429' }}>{cost?.connectionExceedanceCount ?? 0}</span>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between pt-2">
                                                <span className="text-muted">Dodatkowe koszty</span>
                                                <span className="fw-semibold" style={{ fontSize: 20 }}>{pln.format(cost?.additionalCostPln ?? 0)}</span>
                                            </div>
                                        </div>
                                        <div className="impact-card px-4 py-3 mb-3 rounded-3" style={{ border: '1.5px solid #b08900' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <div className="text-muted small">Wpływ na rachunek:</div>
                                                <Button variant="link" size="sm" style={{ textDecoration: 'none', fontWeight: 500, color: '#660032' }} onClick={() => setShowCostDetails(true)}>
                                                    <Fa.FaListUl className="me-1" /> Szczegóły
                                                </Button>
                                            </div>
                                            <span className="fw-bold" style={{ fontSize: 28, color: '#660032' }}>+{cost?.billImpactPercent ?? 0}%</span>
                                            <div className="text-muted small mt-1">szacowany wzrost kosztów w okresie</div>
                                        </div>
                                        <div className="mt-auto small text-muted pt-2">
                                            Koszty przekroczeń wynikają z opłat za ponadumowne zużycie energii.
                                            <br />
                                            <span style={{ color: '#d90429', fontWeight: 500 }}>Powtarzające się przekroczenia mogą skutkować wyższymi rachunkami.</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Card.Title className="text-uppercase small fw-bold mb-3">Szczegóły przekroczeń wg stref</Card.Title>
                                        <Table bordered responsive className="text-center align-middle mb-4">
                                            <thead className="table-light"><tr><th>Strefa</th><th>Moc umowna</th><th>Pmax</th><th>Przekroczenie</th><th>Koszt</th></tr></thead>
                                            <tbody>
                                                {(cost?.zones ?? []).map((zone) => (
                                                    <tr key={zone.code}>
                                                        <td>{zone.name}</td>
                                                        <td>{kw.format(zone.contractedPowerKw)} kW</td>
                                                        <td>{kw.format(zone.peakPowerKw)} kW</td>
                                                        <td style={{ color: zone.exceedanceKw > 0 ? '#b08900' : undefined, fontWeight: zone.exceedanceKw > 0 ? 600 : 400 }}>
                                                            {zone.exceedanceKw > 0 ? `${kw.format(zone.exceedanceKw)} kW` : '–'}
                                                        </td>
                                                        <td style={{ color: zone.costPln > 0 ? '#b08900' : undefined }}>{zone.costPln > 0 ? pln.format(zone.costPln) : '–'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot><tr><td colSpan={4} className="fw-bold text-end">Suma kosztów:</td><td className="fw-bold" style={{ fontSize: 18, color: '#660032' }}>{pln.format((cost?.zones ?? []).reduce((total, zone) => total + zone.costPln, 0))}</td></tr></tfoot>
                                        </Table>
                                        <Button variant="outline-secondary" className="align-self-center" onClick={() => setShowCostDetails(false)}><Fa.FaArrowLeft className="me-2" /> Wróć do podsumowania</Button>
                                    </>
                                )}
                            </Card>
                        </Col>
                    </Row>

                    <Row className="mb-4">
                        <Col>
                            <Card className="p-3">
                                <Card.Title className="text-uppercase small fw-bold mb-1">Rozkład mocy w ciągu dnia</Card.Title>
                                <div className="text-muted small mb-3">Średnia moc {register === 'export' ? 'oddawania' : 'poboru'} [kW] wg godziny i dnia tygodnia.</div>
                                <div className="table-responsive">
                                    <table className="table table-bordered table-sm text-center align-middle mb-0">
                                        <thead className="table-light">
                                            <tr><th>Godz.</th>{weekdays.map((day) => <th key={day}>{day}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({ length: 24 }, (_, hour) => (
                                                <tr key={hour}>
                                                    <td>{`${hour}:00`}</td>
                                                    {Array.from({ length: 7 }, (_, weekday) => {
                                                        const value = distributionGrid.grid.get(`${weekday}-${hour}`) ?? 0
                                                        const intensity = distributionGrid.max > 0 ? value / distributionGrid.max : 0
                                                        const isDark = theme === 'dark'
                                                        const color = isDark ? '#fff' : intensity > 0.6 ? '#fff' : '#000'
                                                        return (
                                                            <td key={weekday} style={{ backgroundColor: `rgba(102, 0, 50, ${intensity})`, color }}>
                                                                {value > 0 ? kw.format(value) : '–'}
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </Container>
    )
}
