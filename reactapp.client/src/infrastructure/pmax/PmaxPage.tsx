import {useEffect, useState} from "react";
import { Container, Row, Col, Breadcrumb, Form, Card, Button, Table } from "react-bootstrap";
import * as Fa from "react-icons/fa";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

const meters = [
    { id: 1, name: "Farma PV 938 (A23)" },
    { id: 2, name: "PV – licznik falownika (A22)" },
    { id: 3, name: "Podlicznik Piętro 1 (G11)" }
];

const registers = [
    { id: 1, name: "Pmax+ (1.6.0)" },
    { id: 2, name: "Pmax- (2.6.0)" }
]


const CONNECTION_POWER = 12;
const ALERT_THRESHOLD_PCT = 0.9;

export function PmaxPage() {
    const [selectedMeter, setSelectedMeter] = useState(meters[2].id);
    const [selectedRegister, setSelectedRegister] = useState(registers[0].id)
    const [contractedPower] = useState(10);
    const [dateFrom, setDateFrom] = useState("2025-05-30");
    const [dateTo, setDateTo] = useState("2025-05-31");
    const [alertThreshold] = useState(Math.round(10 * ALERT_THRESHOLD_PCT * 10) / 10);


    const powerValues = [8.2, 10.5, 8.0, 6.2, 5.0, 5.5, 8.0, 12.3, 9.2, 6.4, 5.0, 4.2, 3.7, 3.5, 4.1, 5, 7.3, 11.0, 9.8, 8.0, 6.5, 4.8, 4.0, 3.6];

    const [theme, setTheme] = useState(document.body.dataset.theme);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setTheme(document.body.dataset.theme);
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["data-theme"]
        });
        return () => observer.disconnect();
    }, []);

    const chartData = {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [
            {
                label: "Moc chwilowa [kW]",
                data: powerValues,
                borderColor: "#660032",
                backgroundColor: "rgba(102,0,50,0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 2
            },
            {
                label: `Moc umowna (${contractedPower} kW)`,
                data: Array(24).fill(contractedPower),
                borderColor: "#b08900",
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0
            },
            {
                label: `Próg alertu (${alertThreshold} kW)`,
                data: Array(24).fill(alertThreshold),
                borderColor: "#357951",
                borderDash: [8, 4],
                borderWidth: 2,
                pointRadius: 0
            },
            {
                label: `Moc przyłącza (${CONNECTION_POWER} kW)`,
                data: Array(24).fill(CONNECTION_POWER),
                borderColor: "#d90429",
                borderDash: [2, 2],
                borderWidth: 2,
                pointRadius: 0
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" as const }
        },
        scales: {
            y: { beginAtZero: true }
        }
    };

    const powerCards = [
        {
            label: "Aktualna moc chwilowa",
            value: "5,8 kW",
            subtitle: `83% mocy umownej (${contractedPower} kW)`,
            icon: Fa.FaBolt
        },
        {
            label: "Moc szczytowa (Pmax) w maju",
            value: "9,1 kW",
            subtitle: "osiągnięto 22.05 o 14:34",
            icon: Fa.FaTachometerAlt
        },
        {
            label: "Przekroczenia 90% mocy umownej",
            value: "2 razy",
            subtitle: "w tym miesiącu",
            icon: Fa.FaExclamationTriangle
        },
        {
            label: "Średnie obciążenie",
            value: "4,3 kW",
            subtitle: "dla ostatnich 7 dni",
            icon: Fa.FaChartLine
        }
    ];

    const pmaxInPeriod = Math.max(...powerValues);
    const [details, setDetails] = useState(false);

    return (
        <Container fluid>
            <Breadcrumb className="mb-3">
                <Breadcrumb.Item active>Moc szczytowa (Pmax)</Breadcrumb.Item>
            </Breadcrumb>

            <Row className="align-items-center mb-3">
                <Col>
                    <h3 className="fw-semibold mb-0">
                        <Fa.FaArrowUp className="me-2 icon-accent" /> Moc szczytowa (Pmax)
                    </h3>
                </Col>
                <Col xs="auto">
                    <Form.Group className="d-flex align-items-center gap-2">
                        <Form.Label className="mb-0">Rejestr:</Form.Label>
                        <Form.Select style={{ minWidth: 120 }} value={selectedRegister} onChange={e => setSelectedRegister(Number(e.target.value))}>
                            {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Form.Select>
                        <Form.Label className="mb-0">Licznik:</Form.Label>
                        <Form.Select style={{ minWidth: 220 }} value={selectedMeter} onChange={e => setSelectedMeter(Number(e.target.value))}>
                            {meters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <Row className="g-4 mb-3">
                {powerCards.map((card, i) => (
                    <Col md={6} lg={3} key={i}>
                        <Card className="h-100 p-3">
                            <div className="text-muted text-uppercase small">{card.label}</div>
                            <div className="fs-4 d-flex align-items-center mt-1">
                                <card.icon className="me-2 icon-accent" size={24} />
                                {card.value}
                            </div>
                            {card.subtitle && <div className="text-muted small mt-1">{card.subtitle}</div>}
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row className="g-4 mb-4 align-items-stretch">
                <Col lg={2}>
                    <Card className="h-100 p-3">
                        <Card.Title className="text-uppercase small fw-bold mb-2">Moc szczytowa (Pmax)</Card.Title>
                        <div className="text-muted small mb-2">Rejestr mocy szczytowej z ostatnich dni</div>
                        <table className="table table-sm table-hover mb-0 text-center align-middle">
                            <thead>
                                <tr><th>Data</th><th>Moc szczytowa [kW]</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>30.05</td><td style={{ color: "#984040" }}>12,2</td></tr>
                                <tr><td>29.05</td><td style={{ color: "#984040" }}>10,4</td></tr>
                                <tr><td>28.05</td><td style={{ color: "#357951" }}>7,8</td></tr>
                                <tr><td>27.05</td><td style={{ color: "#984040" }}>10,1</td></tr>
                                <tr><td>26.05</td><td style={{ color: "#b08900" }}>9,6</td></tr>
                                <tr><td>25.05</td><td style={{ color: "#b08900" }}>8,9</td></tr>
                                <tr><td>24.05</td><td style={{ color: "#357951" }}>8,0</td></tr>
                                <tr><td>23.05</td><td style={{ color: "#357951" }}>7,8</td></tr>
                                <tr><td>22.05</td><td style={{ color: "#357951" }}>7,2</td></tr>
                                <tr><td>21.05</td><td style={{ color: "#b08900" }}>9,6</td></tr>
                                <tr><td>20.05</td><td style={{ color: "#984040" }}>12,2</td></tr>
                                <tr><td>19.05</td><td style={{ color: "#357951" }}>7,8</td></tr>
                                <tr><td>18.05</td><td style={{ color: "#357951" }}>7,8</td></tr>
                                <tr><td>17.05</td><td style={{ color: "#b08900" }}>8,9</td></tr>
                                <tr><td>16.05</td><td style={{ color: "#357951" }}>8,0</td></tr>
                            </tbody>
                        </table>
                    </Card>
                </Col>
                <Col lg={6}>
                    <Card className="h-100 p-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div className="d-flex align-items-center gap-2">
                                <Form.Control type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                <span style={{ fontSize: '1.5rem' }}>→</span>
                                <Form.Control type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                            </div>
                            <Button variant="outline-secondary" onClick={() => alert("Zmień próg alertu")}>
                                <Fa.FaWrench className="me-2" /> Zmień próg alertu
                            </Button>
                        </div>
                        <Card.Title className="text-uppercase small fw-bold mb-2">Moc chwilowa względem limitów</Card.Title>
                        <div style={{ height: 500 }}>
                            <Line data={chartData} options={chartOptions} />
                        </div>
                        <div className="mt-2 mb-0 text-end text-muted">
                            <span>
                                Moc szczytowa (Pmax) we wskazanym okresie: <b>{pmaxInPeriod.toFixed(1)} kW</b>
                            </span>
                        </div>
                    </Card>
                </Col>
                <Col lg={4} className="d-flex flex-column">
                    <Card className="p-3 mb-3">
                        <Card.Title className="text-uppercase small fw-bold mb-3">Alerty i rekomendacje</Card.Title>
                        <ul className="ps-3 small mb-0">
                            <li className="mb-2">
                                <Fa.FaExclamationTriangle className="me-2 icon-accent" />
                                22.05 14:30 – przekroczono próg alertu: 10,7 kW (próg: 9 kW)
                            </li>
                            <li className="mb-2">
                                <Fa.FaExclamationCircle className="me-2 icon-accent" />
                                W maju zanotowano 3 przekroczenia 90% mocy umownej
                            </li>
                            <li className="mb-2">
                                <Fa.FaChartLine className="me-2 icon-accent" />
                                Najczęstsze szczyty między 13:00 a 15:00 – zalecane ograniczenie pracy urządzeń w tym czasie
                            </li>
                            <li className="mb-2">
                                <Fa.FaBatteryThreeQuarters className="me-2 icon-accent" />
                                Średnie wykorzystanie mocy umownej w ostatnim miesiącu: 68%
                            </li>
                        </ul>
                    </Card>
                    <Card className="p-4 d-flex flex-column h-100 justify-content-between">
                        {!details ? (
                            <>
                                <Card.Title className="text-uppercase small fw-bold mb-4">
                                    <span className="d-flex align-items-center gap-2">
                                        Koszta przekroczeń w podanym okresie
                                    </span>
                                </Card.Title>
                                <div className="mb-4">
                                    <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                                        <span className="text-muted">Przekroczenia mocy umownej</span>
                                        <span className="fw-bold" style={{ fontSize: 22, color: "#b08900" }}>2</span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                                        <span className="text-muted">Przekroczenia mocy przyłącza</span>
                                        <span className="fw-bold" style={{ fontSize: 22, color: "#d90429" }}>1</span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between pt-2">
                                        <span className="text-muted">Dodatkowe koszty</span>
                                        <span className="fw-semibold" style={{ fontSize: 20 }}>60,45 zł</span>
                                    </div>
                                </div>
                                <div className="impact-card px-4 py-3 mb-3 rounded-3" style={{ border: "1.5px solid #b08900" }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1" >
                                        <div className="text-muted small">Wpływ na rachunek:</div>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            style={{ textDecoration: "none", fontWeight: 500, color: "#660032" }}
                                            onClick={() => setDetails(true)}
                                        >
                                            <Fa.FaListUl className="me-1" /> Szczegóły
                                        </Button>
                                    </div>
                                    <span className="fw-bold" style={{ fontSize: 28, color: "#660032" }}>+18%</span>
                                    <div className="text-muted small mt-1">szacowany wzrost kosztów w maju</div>
                                </div>


                                <div className="mt-auto small text-muted pt-4">
                                    Koszty przekroczeń wynikają z opłat za ponadumowne zużycie energii.
                                    <br />
                                    <span style={{ color: "#d90429", fontWeight: 500 }}>
                                        Powtarzające się przekroczenia mogą skutkować jeszcze wyższymi rachunkami w przyszłości.
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <Card.Title className="text-uppercase small fw-bold mb-3">
                                    Szczegóły przekroczeń wg stref w maju
                                </Card.Title>
                                <Table bordered responsive className="text-center align-middle mb-4">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Strefa</th>
                                            <th>Moc umowna</th>
                                            <th>Pmax</th>
                                            <th>Przekroczenie</th>
                                            <th>Koszt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>A+T1</td>
                                            <td>10 kW</td>
                                            <td>12,2 kW</td>
                                            <td style={{ color: "#b08900", fontWeight: 600 }}>2,2 kW</td>
                                            <td style={{ color: "#b08900" }}>88,00 zł</td>
                                        </tr>
                                        <tr>
                                            <td>A+T2</td>
                                            <td>8 kW</td>
                                            <td>8,5 kW</td>
                                            <td style={{ color: "#357951", fontWeight: 600 }}>0,5 kW</td>
                                            <td style={{ color: "#357951" }}>20,00 zł</td>
                                        </tr>
                                        <tr>
                                            <td>A+T3</td>
                                            <td>6 kW</td>
                                            <td>5,9 kW</td>
                                            <td className="text-muted">–</td>
                                            <td className="text-muted">–</td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={4} className="fw-bold text-end">Suma kosztów:</td>
                                            <td className="fw-bold" style={{ fontSize: 20, color: "#660032" }}>108,00 zł</td>
                                        </tr>
                                    </tfoot>
                                </Table>
                                <Button
                                    variant="outline-secondary"
                                    className="align-self-center"
                                    onClick={() => setDetails(false)}
                                >
                                    <Fa.FaArrowLeft className="me-2" /> Wróć do podsumowania
                                </Button>
                            </>
                        )}
                    </Card>
                </Col>
            </Row>
            <Row className="mb-4">
                <Col>
                    <Card className="p-3">
                        <Card.Title className="text-uppercase small fw-bold mb-3">
                            Rozkład mocy w ciągu dnia
                        </Card.Title>
                        <div className="table-responsive">
                            <table className="table table-bordered table-sm text-center align-middle mb-0">
                                <thead className="table-light">
                                <tr>
                                    <th>Godz.</th>
                                    {["Pn", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((d, i) => (
                                        <th key={i}>{d}</th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {Array.from({ length: 24 }, (_, hour) => (
                                    <tr key={hour}>
                                        <td>{`${hour}:00`}</td>
                                        {Array.from({ length: 7 }, (_, d) => {
                                            const v = Math.random() * 10 + 1;
                                            const transparency = v / 10;
                                            const bg = `rgba(102, 0, 50, ${transparency})`;
                                            const isDark = theme === "dark";

                                            const color = isDark
                                                ? "#fff"
                                                : (v > 7 ? "#fff" : "#000");

                                            return (
                                                <td key={d} style={{ backgroundColor: bg, color }}>
                                                    {v.toFixed(1)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </Col>
            </Row>

        </Container>
    );
}
