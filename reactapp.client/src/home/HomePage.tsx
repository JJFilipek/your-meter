import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Card, Col, Container, Row, Spinner } from 'react-bootstrap'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
    type ChartOptions,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import { getDashboardSummary, type DashboardSummary } from '../api/meters'
import './HomePage.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const numberFormatter = new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
})

const usageChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true } },
}

const typeChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
}

export default function HomePage(): React.JSX.Element {
    const [summary, setSummary] = useState<DashboardSummary | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        getDashboardSummary(controller.signal)
            .then(setSummary)
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setLoadError(error instanceof Error ? error.message : 'Nie udało się pobrać danych pulpitu.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })

        return () => controller.abort()
    }, [])

    const metrics = useMemo(() => {
        if (!summary) return []
        const activeMeters = summary.onlineMeters + summary.warningMeters
        const activePercent = summary.totalMeters === 0
            ? 0
            : Math.round(activeMeters / summary.totalMeters * 100)

        return [
            { title: 'Liczników ogółem', value: numberFormatter.format(summary.totalMeters) },
            { title: 'Aktywne liczniki', value: `${activeMeters} (${activePercent}%)` },
            { title: 'Średnie dzienne zużycie', value: `${numberFormatter.format(summary.averageDailyConsumptionKwh)} kWh` },
            { title: 'Zużycie w tym miesiącu', value: `${numberFormatter.format(summary.consumptionThisMonthKwh)} kWh` },
        ]
    }, [summary])

    const weeklyChartData = useMemo(() => ({
        labels: summary?.weeklyConsumption.map(point => dateFormatter.format(new Date(`${point.date}T00:00:00`))) ?? [],
        datasets: [{
            label: 'Zużycie (kWh)',
            data: summary?.weeklyConsumption.map(point => point.valueKwh) ?? [],
            backgroundColor: '#660032',
        }],
    }), [summary])

    const siteChartData = useMemo(() => ({
        labels: summary?.consumptionBySite.map(item => item.name) ?? [],
        datasets: [{
            data: summary?.consumptionBySite.map(item => item.valueKwh) ?? [],
            backgroundColor: ['#330018', '#550029', '#7d003c', '#aa004f', '#cc3366', '#e07098'],
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.15)',
        }],
    }), [summary])

    const statusCards = summary ? [
        { title: 'Sprawne', value: summary.onlineMeters, color: '#357951' },
        { title: 'Z problemami', value: summary.warningMeters, color: '#b08900' },
        { title: 'Brak komunikacji', value: summary.offlineMeters, color: '#984040' },
        { title: 'Nieaktywne', value: summary.inactiveMeters, color: '#5c636a' },
    ] : []

    return (
        <Container fluid>
            <Breadcrumb>
                <Breadcrumb.Item active>Strona główna</Breadcrumb.Item>
            </Breadcrumb>

            <h3 className="fw-semibold mb-3">
                <Fa.FaChartLine className="me-2 icon-accent" /> Stan systemu
            </h3>

            {isLoading && (
                <div className="py-5 text-center text-muted">
                    <Spinner className="me-2" size="sm" />
                    Pobieranie danych systemu
                </div>
            )}
            {loadError && <Alert variant="danger">{loadError}</Alert>}

            {summary && (
                <>
                    <Row className="g-4 mb-5">
                        <Col lg={8}>
                            <Row className="g-4">
                                {metrics.map(metric => (
                                    <Col md={6} key={metric.title}>
                                        <Card className="metric-card h-100">
                                            <Card.Body className="d-flex flex-column align-items-start">
                                                <Card.Title className="text-muted small text-uppercase">
                                                    {metric.title}
                                                </Card.Title>
                                                <Card.Text className="fs-4 mt-2">{metric.value}</Card.Text>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </Col>
                        <Col lg={4}>
                            <Card className="metric-card h-100">
                                <Card.Body className="h-100 d-flex flex-column">
                                    <h5 className="mb-3">
                                        <Fa.FaInfoCircle className="me-2 icon-accent" /> Dane systemu
                                    </h5>
                                    <dl className="mb-0 small">
                                        <dt>Ostatnie przeliczenie</dt>
                                        <dd>{dateTimeFormatter.format(new Date(summary.generatedAtUtc))}</dd>
                                        <dt>Liczników raportujących poprawnie</dt>
                                        <dd>{summary.onlineMeters} z {summary.totalMeters}</dd>
                                    </dl>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <Row className="g-5 justify-content-center mb-5">
                        <Col md={6}>
                            <Card className="h-100">
                                <Card.Body className="h-100 d-flex flex-column">
                                    <div className="text-uppercase small fw-bold mb-2">Zużycie z ostatnich 7 dni</div>
                                    <div style={{ height: 450, minHeight: 150 }}>
                                        <Bar data={weeklyChartData} options={usageChartOptions} />
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="h-100">
                                <Card.Body className="h-100 d-flex flex-column">
                                    <div className="text-uppercase small fw-bold mb-2">Zużycie według obiektu</div>
                                    <div style={{ height: 450, minHeight: 150 }}>
                                        {summary.consumptionBySite.length > 0
                                            ? <Doughnut data={siteChartData} options={typeChartOptions} />
                                            : (
                                                <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                                                    Brak pomiarów zużycia w bieżącym miesiącu.
                                                </div>
                                            )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <h3 className="fw-semibold mb-3">
                        <Fa.FaPlug className="me-2 icon-accent" /> Stan liczników
                    </h3>
                    <Row className="g-4 mb-5">
                        {statusCards.map(status => (
                            <Col sm={6} xl={3} key={status.title}>
                                <Card
                                    className="shadow border-0 text-white h-100"
                                    style={{ backgroundColor: status.color }}
                                >
                                    <Card.Body className="text-center py-4">
                                        <Card.Title className="fs-6">{status.title}</Card.Title>
                                        <div className="display-6 fw-bold">{status.value}</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </>
            )}
        </Container>
    )
}
