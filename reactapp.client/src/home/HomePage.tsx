import { Container, Row, Col, Card, Breadcrumb } from 'react-bootstrap'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    ArcElement,
    PointElement,
    Tooltip,
    Legend,
    Title
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import './HomePage.css'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    ArcElement,
    PointElement,
    Tooltip,
    Legend,
    Title
)

const metrics = [
    { title: 'Liczników ogółem', value: '42' },
    { title: 'Aktywne liczniki', value: '39 (93%)' },
    { title: 'Średnie zużycie', value: '153.1 kWh' },
    { title: 'Zużycie (miesiąc)', value: '6 430 kWh' }
] as const

const infos = [
    { icon: Fa.FaTools, text: '2025-04-10: Prace konserwacyjne 22:00–02:00' },
    { icon: Fa.FaPlus, text: '2025-04-13: Dodano licznik „SIPO-12”' },
    { icon: Fa.FaExclamationTriangle, text: '2025-04-14: Licznik „DOM-1” nie raportuje od 2 dni' }
] as const

const statusCards = [
    { title: 'Sprawne', value: 36, color: '#357951' },
    { title: 'Z problemami', value: 4, color: '#b08900' },
    { title: 'Brak komunikacji', value: 2, color: '#984040' },
    { title: 'Nieaktywne powyżej 7 dni', value: 1, color: '#5c636a' }
] as const

const usageChartData = {
    labels: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'],
    datasets: [
        { type: 'bar' as const, label: 'Zużycie (kWh)', data: [130, 150, 125, 160, 140, 170, 180], backgroundColor: '#660032', barThickness: 40 },
        { type: 'line' as const, label: 'Trend', data: [130, 140, 135, 145, 142, 155, 160], borderColor: '#cc3366', borderWidth: 2, fill: false, pointRadius: 0, tension: 0.4 }
    ]
} as any

const usageChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true } }
} as any

const typeChartData = {
    labels: ['Biuro handlowe', 'Utrzymanie Ruchu', 'Hala Storczyk', 'Hala Róża'],
    datasets: [{ data: [8, 22, 30, 40], backgroundColor: ['#330018', '#550029', '#7d003c', '#aa004f'], borderWidth: 1,  borderColor: 'rgba(255, 255, 255, 0.15)' }]
} as any
const typeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'bottom' },
    }
} as any

export default function App(): React.JSX.Element {
    return (
        <Container fluid>
            <Breadcrumb>
                <Breadcrumb.Item active>Strona główna</Breadcrumb.Item>
            </Breadcrumb>

            <h3 className="fw-semibold mb-3">
                <Fa.FaChartLine className="me-2 icon-accent" /> Stan systemu
            </h3>

            <Row className="g-4 mb-5">
                <Col lg={8}>
                    <Row className="g-4">
                        {metrics.map((m, i) => (
                            <Col md={6} key={i}>
                                <Card className="metric-card h-100">
                                    <Card.Body
                                        className="d-flex flex-column align-items-start"
                                    >
                                        <Card.Title className="text-muted small text-uppercase">
                                            {m.title}
                                        </Card.Title>
                                        <Card.Text className="fs-4 mt-2">{m.value}</Card.Text>
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
                                <Fa.FaInfoCircle className="me-2 icon-accent" /> Informacje
                            </h5>
                            <ul className="mb-0 ps-3 small">
                                {infos.map((info, j) => (
                                    <li key={j}>
                                        <info.icon className="me-2 text-muted" /> {info.text}
                                    </li>
                                ))}
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="g-5 justify-content-center mb-5">
                <Col md={6}>
                    <Card className="h-100">
                        <Card.Body className="h-100 d-flex flex-column">
                            <div className="text-uppercase small fw-bold mb-2">Zużycie tygodniowe</div>
                            <div style={{ height: 450, minHeight: 150 }}>
                                <Bar data={usageChartData} options={usageChartOptions} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="h-100">
                        <Card.Body className="h-100 d-flex flex-column">
                            <div className="text-uppercase small fw-bold mb-2">Podział zużycia</div>
                            <div style={{ height: 450, minHeight: 150 }}>
                                <Doughnut data={typeChartData} options={typeChartOptions} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

            </Row>

            <h3 className="fw-semibold mb-3">
                <Fa.FaPlug className="me-2 icon-accent" /> Stan liczników
            </h3>
            <Row className="g-4 mb-5">
                {statusCards.map((s, k) => (
                    <Col md={3} key={k}>
                        <Card
                            className="shadow border-0 text-white h-100"
                            style={{ backgroundColor: s.color }}
                        >
                            <Card.Body className="text-center py-4">
                                <Card.Title className="fs-6">{s.title}</Card.Title>
                                <div className="display-6 fw-bold">{s.value}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
    )
}
