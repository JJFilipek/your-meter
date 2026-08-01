import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, ButtonGroup, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap'
import { Bar } from 'react-chartjs-2'
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import {
    getMeterAnalytics,
    getMeters,
    getTariffSimulation,
    type MeterAnalytics,
    type TariffCode,
    type TariffSimulation,
} from '../api/meters'
import type { Meter } from '../types/infrastructure/meter'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const numberFormatter = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})
const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})

const ranges = [
    { label: '7 dni', days: 7, bucket: 'hour' as const },
    { label: '30 dni', days: 30, bucket: 'day' as const },
    { label: '180 dni', days: 180, bucket: 'day' as const },
]

export function ChartsPage() {
    const [meters, setMeters] = useState<Meter[]>([])
    const [selectedMeter, setSelectedMeter] = useState('')
    const [rangeDays, setRangeDays] = useState(30)
    const [analytics, setAnalytics] = useState<MeterAnalytics | null>(null)
    const [targetTariff, setTargetTariff] = useState<TariffCode>('G12')
    const [tariffSimulation, setTariffSimulation] = useState<TariffSimulation | null>(null)
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
        if (!selectedMeter) {
            setIsLoading(false)
            return
        }

        const controller = new AbortController()
        const selectedRange = ranges.find((item) => item.days === rangeDays) ?? ranges[1]
        const to = new Date()
        const from = new Date(to.getTime() - selectedRange.days * 24 * 60 * 60 * 1000)
        setIsLoading(true)
        setError(null)
        void getMeterAnalytics(
            selectedMeter,
            from.toISOString(),
            to.toISOString(),
            selectedRange.bucket,
            controller.signal,
        )
            .then(setAnalytics)
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych wykresu.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [rangeDays, selectedMeter])

    useEffect(() => {
        if (!selectedMeter) {
            setTariffSimulation(null)
            return
        }

        const controller = new AbortController()
        const selectedRange = ranges.find((item) => item.days === rangeDays) ?? ranges[1]
        const to = new Date()
        const from = new Date(to.getTime() - selectedRange.days * 24 * 60 * 60 * 1000)
        setTariffSimulation(null)
        void getTariffSimulation(
            selectedMeter,
            from.toISOString(),
            to.toISOString(),
            targetTariff,
            controller.signal,
        )
            .then(setTariffSimulation)
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się przeliczyć stref taryfowych.')
            })
        return () => controller.abort()
    }, [rangeDays, selectedMeter, targetTariff])

    const chartData = useMemo(() => ({
        labels: analytics?.buckets.map((bucket) => dateFormatter.format(new Date(bucket.startUtc))) ?? [],
        datasets: [
            {
                label: 'Energia pobrana A+ [kWh]',
                data: analytics?.buckets.map((bucket) => bucket.importedKwh) ?? [],
                backgroundColor: '#660032',
            },
            {
                label: 'Energia oddana A- [kWh]',
                data: analytics?.buckets.map((bucket) => bucket.exportedKwh) ?? [],
                backgroundColor: '#7ecb20',
            },
        ],
    }), [analytics])

    const bucketTotals = analytics?.buckets.map((bucket) => bucket.importedKwh + bucket.exportedKwh) ?? []
    const average = bucketTotals.length > 0
        ? bucketTotals.reduce((sum, value) => sum + value, 0) / bucketTotals.length
        : 0
    const maximum = bucketTotals.length > 0 ? Math.max(...bucketTotals) : 0
    const minimum = bucketTotals.length > 0 ? Math.min(...bucketTotals) : 0

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Wykresy</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-4 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaChartBar className="me-2 icon-accent" /> Wykresy energii</h3>
                    <div className="text-muted small mt-1">Dane agregowane bezpośrednio z rejestrów liczników na VPS-ie.</div>
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

            <ButtonGroup className="mb-3">
                {ranges.map((range) => (
                    <Button key={range.days} variant={rangeDays === range.days ? 'primary' : 'outline-secondary'} onClick={() => setRangeDays(range.days)}>
                        {range.label}
                    </Button>
                ))}
            </ButtonGroup>

            {error && <Alert variant="danger">{error}</Alert>}
            {isLoading ? (
                <div className="text-center py-5"><Spinner animation="border" /><div className="mt-2">Pobieranie pomiarów...</div></div>
            ) : !analytics || analytics.buckets.length === 0 ? (
                <Alert variant="info">Brak pomiarów w wybranym okresie.</Alert>
            ) : (
                <>
                    <Row className="g-3 mb-3">
                        {[
                            { label: 'Pobrano', value: analytics.importedKwh, icon: Fa.FaArrowDown },
                            { label: 'Oddano', value: analytics.exportedKwh, icon: Fa.FaArrowUp },
                            { label: 'Średnia na przedział', value: average, icon: Fa.FaChartLine },
                            { label: 'Maksimum przedziału', value: maximum, icon: Fa.FaBolt },
                        ].map((card) => (
                            <Col md={6} xl={3} key={card.label}>
                                <Card className="h-100 p-3">
                                    <div className="text-muted text-uppercase small">{card.label}</div>
                                    <div className="fs-4 mt-1"><card.icon className="me-2 icon-accent" />{numberFormatter.format(card.value)} kWh</div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                    <Row className="g-3">
                        <Col xl={9}>
                            <Card className="h-100"><Card.Body>
                                <div className="text-uppercase small fw-bold mb-2">Przyrosty rejestrów w czasie</div>
                                <div style={{ height: 500 }}>
                                    <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
                                </div>
                            </Card.Body></Card>
                        </Col>
                        <Col xl={3}>
                            <Card className="h-100"><Card.Body>
                                <div className="text-uppercase small fw-bold mb-3">Statystyki pomiarów</div>
                                <dl className="mb-0">
                                    <dt>Licznik</dt><dd>{analytics.serialNo}</dd>
                                    <dt>Taryfa</dt><dd>{analytics.tariff}</dd>
                                    <dt>Minimum przedziału</dt><dd>{numberFormatter.format(minimum)} kWh</dd>
                                    <dt>Średnie obciążenie</dt><dd>{numberFormatter.format(analytics.averageAbsolutePowerKw)} kW</dd>
                                    <dt>Maksymalny pobór mocy</dt><dd>{numberFormatter.format(analytics.maximumImportPowerKw)} kW</dd>
                                    <dt>Maksymalny eksport mocy</dt><dd>{numberFormatter.format(analytics.maximumExportPowerKw)} kW</dd>
                                    <dt>Liczba próbek</dt><dd>{analytics.buckets.reduce((sum, bucket) => sum + bucket.sampleCount, 0).toLocaleString('pl-PL')}</dd>
                                </dl>
                            </Card.Body></Card>
                        </Col>
                    </Row>
                    <Card className="mt-3"><Card.Body>
                        <Row className="align-items-center g-3 mb-3">
                            <Col>
                                <div className="text-uppercase small fw-bold">Przeliczenie stref taryfowych</div>
                                <div className="text-muted small mt-1">
                                    Rzeczywiste przyrosty rejestru A+ są przypisywane do godzin wybranej taryfy w polskiej strefie czasowej.
                                </div>
                            </Col>
                            <Col sm="auto">
                                <Form.Group className="d-flex align-items-center gap-2">
                                    <Form.Label className="mb-0 text-nowrap">Przelicz jako:</Form.Label>
                                    <Form.Select
                                        value={targetTariff}
                                        onChange={(event) => setTargetTariff(event.target.value as TariffCode)}
                                        aria-label="Taryfa do przeliczenia"
                                    >
                                        <option value="G11">G11</option>
                                        <option value="G12">G12</option>
                                        <option value="G12W">G12W</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        {tariffSimulation && (
                            <>
                                <div className="mb-3">
                                    <span className="text-muted">Taryfa licznika: </span>
                                    <strong>{tariffSimulation.sourceTariff}</strong>
                                    <span className="text-muted ms-3">Łączne pobranie: </span>
                                    <strong>{numberFormatter.format(tariffSimulation.totalImportedKwh)} kWh</strong>
                                </div>
                                <Row className="g-3">
                                    {tariffSimulation.zones.map((zone) => (
                                        <Col md={6} xl={4} key={zone.code}>
                                            <Card className="h-100 bg-light border-0"><Card.Body>
                                                <div className="text-muted small text-uppercase">{zone.name}</div>
                                                <div className="fs-4 mt-1">{numberFormatter.format(zone.energyKwh)} kWh</div>
                                                <div className="text-muted">{numberFormatter.format(zone.percentage)}% pobrania</div>
                                            </Card.Body></Card>
                                        </Col>
                                    ))}
                                </Row>
                            </>
                        )}
                    </Card.Body></Card>
                </>
            )}
        </Container>
    )
}
