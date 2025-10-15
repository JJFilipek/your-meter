import { useState } from "react"
import { Container, Row, Col, Card, Breadcrumb, Form, ButtonGroup, Button } from "react-bootstrap"
import { Bar } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend
} from "chart.js"
import * as Fa from "react-icons/fa"

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const meters = [
    { id: 1, name: "Farma PV 938 (A23)" },
    { id: 2, name: "PV – licznik falownika (A22)" },
    { id: 3, name: "Podlicznik – Piętro 1 (G11)" },
]

const years = ["2025", "2024", "2023", "2022", "2021", "2020"]

const months = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"]

const dummyData = {
    labels: months,
    datasets: [
        {
            label: "Strefa 1",
            data: [1600, 1500, 2300, 3300, 4700, 5200, 5800, 5600, 3700, 2200, 900, 300],
            backgroundColor: "#c0f090"
        },
        {
            label: "Strefa 2",
            data: [1400, 1300, 1900, 2600, 3500, 4000, 5620, 5290, 3430, 2090, 910, 210],
            backgroundColor: "#7ecb20"
        }
    ]
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: "top" as const }
    },
    scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
    }
}

const stats = {
    tariff: "13.447 kWh",
    user: "44.410 kWh",
    max: "58.127 kWh",
    min: "20.117 kWh",
    totalEnergy: "120.050 kWh"
}

export function ChartsPage() {
    const [selectedMeter, setSelectedMeter] = useState(meters[0].id)
    const [selectedYearFrom, setSelectedYearFrom] = useState("2024")
    const [selectedYearTo, setSelectedYearTo] = useState("2025")
    const [selectedEnergyType, setSelectedEnergyType] = useState("Oddana A-")
    const [selectedTariffSim, setSelectedTariffSim] = useState("")
    const [selectedRange, setSelectedRange] = useState("Rok")
    const [selectedChart, setSelectedChart] = useState("Wykres energii")

    return (
        <Container fluid>
            <Breadcrumb className="mb-3">
                <Breadcrumb.Item active>Wykresy</Breadcrumb.Item>
            </Breadcrumb>

            <Row className="align-items-center mb-4">
                <Col>
                    <h3 className="fw-semibold mb-0">
                        <Fa.FaChartBar className="me-2 icon-accent" /> Wykresy
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

            <ButtonGroup className="mb-3">
                {[
                    "Wykres energii",
                    "Wykres generacji",
                    "Wykres eksportu",
                    "Wykres autokonsumpcji",
                    "Wykres bilansu energetycznego",
                    "Wykres mocy szczytowej",
                    "Wykres strat przesyłowych",
                    "Wykres kosztów energii",
                ].map((name) => (
                    <Button
                        key={name}
                        variant={selectedChart === name ? "primary" : "outline-secondary"}
                        onClick={() => setSelectedChart(name)}
                    >
                        {name}
                    </Button>
                ))}
            </ButtonGroup>

            <div className="border rounded px-3 py-2 d-flex align-items-center justify-content-between flex-wrap gap-3 mb-2">
                <ButtonGroup size="sm">
                    {["Dzień", "Tydzień", "Miesiąc", "Rok"].map(label => (
                        <Button
                            key={label}
                            variant={selectedRange === label ? "primary" : "outline-secondary"}
                            onClick={() => setSelectedRange(label)}
                        >
                            {label}
                        </Button>
                    ))}
                </ButtonGroup>

                <div className="d-flex align-items-center gap-1">
                    <span className="text-muted small">Rok</span>
                    <Form.Select
                        size="sm"
                        style={{ minWidth: 90 }}
                        value={selectedYearFrom}
                        onChange={e => setSelectedYearFrom(e.target.value)}
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </Form.Select>
                    <span className="mx-1">→</span>
                    <Form.Select
                        size="sm"
                        style={{ minWidth: 90 }}
                        value={selectedYearTo}
                        onChange={e => setSelectedYearTo(e.target.value)}
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </Form.Select>
                </div>
            </div>
            <Row className="g-4">
                <Col md={9}>
                    <Card className="h-100">
                        <Card.Body className="h-100 d-flex flex-column">
                            <div className="text-uppercase small fw-bold mb-2">Wykres energii</div>
                            <div style={{ height: 520, minHeight: 150 }}>
                                <Bar data={dummyData} options={chartOptions} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3} className="d-flex flex-column">
                    <div className="d-flex mb-2">
                        <div className="d-flex align-items-center gap-2">
                            <span className="text-muted small">Energia</span>
                            <Form.Select
                                size="sm"
                                style={{ minWidth: 140 }}
                                value={selectedEnergyType}
                                onChange={(e) => setSelectedEnergyType(e.target.value)}
                            >
                                <option>Pobrana A+</option>
                                <option>Oddana A-</option>
                            </Form.Select>
                        </div>
                    </div>

                    <Card className="h-100">
                        <Card.Body className="d-flex flex-column justify-content-between h-100">
                            <div className="d-flex flex-column justify-content-between flex-grow-1">
                                <div className="text-uppercase small fw-bold mb-3">Statystyki</div>
                                <div className="d-flex alsgn-items-center mb-4">
                                    <Fa.FaChartBar className="me-3" size={28} color="#911a52" />
                                    <div>
                                        <div className="fw-semibold" style={{ fontSize: "1rem" }}>Średnia dla taryfy</div>
                                        <div className="fw-bold">{stats.tariff}</div>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center mb-4">
                                    <Fa.FaChartBar className="me-3" size={28} color="#69b322" />
                                    <div>
                                        <div className="fw-semibold" style={{ fontSize: "1rem" }}>Twoja średnia</div>
                                        <div className="fw-bold">{stats.user}</div>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center mb-4">
                                    <Fa.FaArrowUp className="me-3" size={28} color="#888" />
                                    <div>
                                        <div className="fw-semibold" style={{ fontSize: "1rem" }}>Maksimum</div>
                                        <div className="fw-bold">{stats.max}</div>
                                        <div className="text-muted small">2024-07-01 00:00:00</div>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center mb-4">
                                    <Fa.FaArrowDown className="me-3" size={28} color="#b6cc8e" />
                                    <div>
                                        <div className="fw-semibold" style={{ fontSize: "1rem" }}>Minimum</div>
                                        <div className="fw-bold">{stats.min}</div>
                                        <div className="text-muted small">2024-12-01 00:00:00</div>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center mb-5">
                                    <Fa.FaWaveSquare className="me-3" size={28} color="#17a2b8" />
                                    <div>
                                        <div className="fw-semibold" style={{ fontSize: "1rem" }}>Zmienność zużycia</div>
                                        <div className="fw-bold">±12.5%</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto text-center border-top pt-3">
                                <span className="fw-semibold" style={{ fontSize: "1rem" }}>Energia całkowita:</span>{" "}
                                <span className="text-success fw-bold">{stats.totalEnergy}</span>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

            </Row>



            <Row className="g-4 mt-3">
                <Col md={9}>
                    <Card>
                        <Card.Body>
                            <div className="text-uppercase small fw-bold mb-2">Podział na strefy</div>

                            <div className="d-flex justify-content-center gap-4 mb-2">
                                <div className="d-flex align-items-center gap-1">
                                    <div style={{ width: 20, height: 10, backgroundColor: "#c0f090" }}></div>
                                    <span className="small text-muted">Strefa 1</span>
                                </div>
                                <div className="d-flex align-items-center gap-1">
                                    <div style={{ width: 20, height: 10, backgroundColor: "#7ecb20" }}></div>
                                    <span className="small text-muted">Strefa 2</span>
                                </div>
                            </div>

                            <div className="d-flex align-items-center" style={{ height: 40, background: "#dff5c0", borderRadius: 6 }}>
                                <div style={{ width: "40%", height: "100%", background: "#c0f090" }}></div>
                                <div style={{ width: "60%", height: "100%", background: "#7ecb20" }}></div>
                            </div>

                            <div className="d-flex justify-content-between small text-muted mt-2">
                                <span>0</span>
                                <span>20</span>
                                <span>40</span>
                                <span>60</span>
                                <span>80</span>
                                <span>100%</span>
                            </div>

                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card style={{ height: "100%" }}>
                        <Card.Body className="d-flex flex-column justify-content-between h-100">
                            <div>
                                <div className="text-uppercase small fw-bold mb-2">Symulacja taryfy</div>
                                <Form.Select
                                    value={selectedTariffSim}
                                    onChange={e => setSelectedTariffSim(e.target.value)}
                                >
                                    <option value="">Wybierz taryfę</option>
                                    <option>G11</option>
                                    <option>G12</option>
                                    <option>G12W</option>
                                    <option>C11</option>
                                    <option>C12</option>
                                    <option>A23</option>
                                </Form.Select>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    )
}
