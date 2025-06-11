import { useState } from "react"
import { Container, Row, Col, Card, Breadcrumb, Form, Table, Button } from "react-bootstrap"
import { Bar, Doughnut, Line } from "react-chartjs-2"
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
} from "chart.js"
import * as Fa from "react-icons/fa"

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

const meters = [
    { id: 1, name: "Farma PV 938 (A23)" },
    { id: 2, name: "PV – licznik falownika (A22)" },
    { id: 3, name: "Podlicznik – Piętro 1 (G11)" },
]

const productionData = [
    { month: "2024-07", generated: 11420, exported: 10380 },
    { month: "2024-08", generated: 10890, exported: 9100 },
    { month: "2024-09", generated: 7130, exported: 5020 },
    { month: "2024-10", generated: 4290, exported: 2380 },
    { month: "2024-11", generated: 1810, exported: 420 },
    { month: "2024-12", generated: 510, exported: 30 },
    { month: "2025-01", generated: 340, exported: 10 },
    { month: "2025-02", generated: 590, exported: 40 },
    { month: "2025-03", generated: 2060, exported: 580 },
    { month: "2025-04", generated: 6290, exported: 4600 },
    { month: "2025-05", generated: 9280, exported: 7900 },
    { month: "2025-06", generated: 1920, exported: 1350 }
]





const miniData = {
    labels: Array.from({ length: 12 }, (_, i) => `${70 - i * 5} min`),
    datasets: [{
        data: [0.3, 0.4, 0.5, 0.7, 1.6, 3.7, 3.8, 4.4, 3.2, 1.3, 1.2, 1.3],
        borderColor: "#cc3366",
        fill: false,
        tension: 0.5,
        pointRadius: 0
    }]
}
const miniOptions = {
    plugins: { legend: { display: false } },
    elements: { line: { borderWidth: 2 } },
    scales: { x: { display: false }, y: { display: false } }
}

const summaryCards = [
    {
        label: "Aktualna moc",
        value: "5,2 kW",
        subtitle: "87% mocy maksymalnej",
        icon: Fa.FaBolt,
        mini: null
    },
    {
        label: "Wyprodukowano dziś",
        value: "34,6 kWh",
        subtitle: "",
        icon: Fa.FaSun,
        mini: <Line data={miniData} options={miniOptions} height={28} />
    },
    {
        label: "Autokonsumpcja",
        value: "52%",
        subtitle: "zużyto lokalnie",
        icon: Fa.FaHome,
        mini: <Doughnut
            data={{
                labels: ["Lokalnie", "Oddano"],
                datasets: [{
                    data: [52, 48],
                    backgroundColor: ["#660032", "#a9e34b"],
                    borderWidth: 0
                }]
            }}
            options={{
                cutout: "70%",
                plugins: { legend: { display: false } }
            }}
            height={32}
        />
    },
    {
        label: "Oddano do sieci",
        value: "68,1 kWh",
        subtitle: "",
        icon: Fa.FaExchangeAlt,
        mini: <Line
            data={{
                labels: Array.from({ length: 12 }, (_, i) => `${60 - i * 5} min`),
                datasets: [{
                    data: [0, 0.1, 0.1, 0.3, 0.4, 0.35, 0, 0.4, 0.5, 0.6, 0.82, 1],
                    borderColor: "#a9e34b",
                    fill: false,
                    tension: 0.5,
                    pointRadius: 0
                }]
            }}
            options={miniOptions}
            height={28}
        />
    }
]

const chartData = {
    labels: productionData.map(d => d.month),
    datasets: [
        {
            label: "Energia wytworzona [kWh]",
            data: productionData.map(d => d.generated),
            backgroundColor: "#660032"
        },
        {
            label: "Energia oddana do sieci [kWh]",
            data: productionData.map(d => d.exported),
            backgroundColor: "#a9e34b"
        }
    ]
}
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" as const } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
}

const forecast = {
    tomorrow: 39.7,
    trend: "+15%",
    comparedToYesterday: "+4,5 kWh"
}

const notifications = [
    { icon: Fa.FaTools, text: "2025-05-22: Serwis falownika zaplanowany 16:00–17:00" },
    { icon: Fa.FaSun, text: "2025-05-22: Maksymalna moc 6,8 kW osiągnięta o 12:34" },
    { icon: Fa.FaExclamationTriangle, text: "2025-05-21: Spadek produkcji o 20% w stosunku do normy" }
]

function exportCsv() {
    alert("Eksport danych do CSV")
}

export function ElectricityGeneratorPage() {
    const [selectedMeter, setSelectedMeter] = useState(meters[0].id)

    return (
        <Container fluid>
            <Breadcrumb className="mb-3">
                <Breadcrumb.Item active>Wytwórca</Breadcrumb.Item>
            </Breadcrumb>

            <Row className="align-items-center mb-4">
                <Col>
                    <h3 className="fw-semibold mb-0">
                        <Fa.FaSolarPanel className="me-2 icon-accent" /> Wytwórca
                    </h3>
                </Col>
                <Col xs="auto">
                    <Form.Group className="d-flex align-items-center gap-2">
                        <Form.Label className="mb-0">Licznik:</Form.Label>
                        <Form.Select style={{ minWidth: 220 }} value={selectedMeter} onChange={e => setSelectedMeter(Number(e.target.value))}>
                            {meters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <Row className="g-4 mb-3">
                {summaryCards.map((c, i) => (
                    <Col md={6} lg={3} key={i}>
                        <Card className="metric-card h-100 px-3 py-2 d-flex flex-row justify-content-between align-items-start">
                            <div className="d-flex flex-column align-items-start">
                                <div className="text-muted text-uppercase small">{c.label}</div>
                                <div className="fs-4 d-flex align-items-center mt-1">
                                    <c.icon className="me-2 icon-accent" size={24} />
                                    {c.value}
                                </div>
                                {c.subtitle && <div className="text-muted small mt-1">{c.subtitle}</div>}
                            </div>
                            {c.mini && (
                                <div className="mini-chart-container d-flex align-items-end">
                                    {c.mini}
                                </div>
                            )}
                        </Card>

                    </Col>
                ))}
            </Row>


            <Row className="g-4 mb-4">
                <Col md={4}>
                    <Card className="metric-card h-100 px-3 py-2 d-flex flex-column align-items-start justify-content-between">
                        <div className="text-muted text-uppercase small">Prognoza produkcji</div>
                        <div className="fs-4 d-flex align-items-center mt-1">
                            <Fa.FaChartLine className="me-2 icon-accent" size={20} />
                            {forecast.tomorrow} kWh
                        </div>
                        <div className="small mt-1" style={{ color: forecast.trend.startsWith('+') ? "#357951" : "#984040" }}>
                            {forecast.trend} względem dziś &bull; {forecast.comparedToYesterday} od wczoraj
                        </div>
                    </Card>
                </Col>

                <Col md={4}>
                    <Card className="metric-card h-100 px-3 py-2 d-flex flex-column align-items-start justify-content-between">
                        <div className="text-muted text-uppercase small">Porównanie produkcji</div>
                        <div className="mt-1 small">
                            <span className="fw-semibold" style={{ color: "#357951" }}>Dziś:</span> 34,6 kWh &nbsp;
                            <span className="fw-semibold" style={{ color: "#984040" }}>Wczoraj:</span> 30,1 kWh
                        </div>
                        <div className="small">
                            <span className="fw-semibold" style={{ color: "#357951" }}>Miesiąc:</span> 1250 kWh &nbsp;
                            <span className="fw-semibold" style={{ color: "#984040" }}>Poprzedni miesiąc :</span> 1140 kWh
                        </div>
                    </Card>
                </Col>

                <Col md={4}>
                    <Card className="metric-card h-100 px-3 py-2 d-flex flex-column align-items-start justify-content-between">
                        <div className="text-muted text-uppercase small mb-1">Ostatnie zdarzenia</div>
                        <ul className="ps-3 mb-0 small">
                            {notifications.map((n, i) => (
                                <li key={i} className="mb-1">
                                    <n.icon className="me-2 icon-accent" size={14} /> {n.text}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </Col>
            </Row>



            <Row className="g-4">
                <Col md={5} lg={4}>
                    <Card className="h-100">
                        <Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Produkcja energii</div>
                            <Table bordered hover size="sm">
                                <thead>
                                    <tr>
                                        <th>Miesiąc</th>
                                        <th>Wytworzona [kWh]</th>
                                        <th>Oddana [kWh]</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productionData.map((row, i) => (
                                        <tr key={i}>
                                            <td>{row.month}</td>
                                            <td style={{ color: row.generated === 0 ? "#b08900" : "#357951" }}>
                                                {row.generated === null ? "" : row.generated.toFixed(1)}
                                            </td>
                                            <td style={{ color: row.exported === 0 ? "#b08900" : "#357951" }}>
                                                {row.exported === null ? "" : row.exported.toFixed(1)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                            <Button variant="outline-secondary" size="sm" className="mt-2" onClick={exportCsv}>
                                <Fa.FaFileCsv className="me-2" /> Eksport danych
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={7} lg={8}>
                    <Card className="h-100">
                        <Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Wykres produkcji</div>
                            <div style={{ height: 480, minHeight: 150 }}>
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    )
}
