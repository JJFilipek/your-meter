import { Accordion, Breadcrumb, Card, Col, Container, Row, Table } from 'react-bootstrap'
import * as Fa from 'react-icons/fa'

const tabs = [
    { icon: Fa.FaHome, name: 'Strona główna', text: 'Przegląd stanu systemu: liczba i status liczników, zużycie w tym miesiącu, średnie dzienne oraz podział zużycia na obiekty.' },
    { icon: Fa.FaBolt, name: 'Liczniki', text: 'Rejestr wszystkich liczników z filtrowaniem, statusem komunikacji i danymi technicznymi.' },
    { icon: Fa.FaCogs, name: 'Symulatory', text: 'Tworzenie i zarządzanie licznikami symulowanymi, które na bieżąco generują odczyty.' },
    { icon: Fa.FaChartBar, name: 'Wykresy', text: 'Osiem widoków energii (m.in. energia, generacja, eksport, autokonsumpcja, koszty) w zakresach dzień–rok, podział na strefy i symulacja taryfy.' },
    { icon: Fa.FaSolarPanel, name: 'Wytwórca', text: 'Dane instalacji prosumenckiej: bieżąca moc, produkcja, autokonsumpcja, prognoza i historia oddania do sieci.' },
    { icon: Fa.FaArrowUp, name: 'Moc szczytowa', text: 'Profil mocy względem limitów, przekroczenia, koszty przekroczeń oraz rozkład mocy w ciągu dnia.' },
    { icon: Fa.FaTachometerAlt, name: 'Wskazania', text: 'Surowe odczyty pomiarowe z wyborem kolumn i eksportem zakresu.' },
    { icon: Fa.FaMap, name: 'Mapa', text: 'Lokalizacje liczników na mapie z szybkim wyszukiwaniem.' },
]

const terms = [
    { term: 'A+ (energia pobrana)', desc: 'Energia czynna pobrana z sieci, w kWh. Rośnie, gdy odbierasz prąd z sieci.' },
    { term: 'A− (energia oddana)', desc: 'Energia czynna oddana do sieci, w kWh. Rośnie u prosumenta, gdy instalacja produkuje nadwyżkę.' },
    { term: 'Generacja', desc: 'Cała energia wyprodukowana lokalnie (autokonsumpcja + eksport). Autokonsumpcja = generacja − oddano.' },
    { term: 'Moc szczytowa (Pmax)', desc: 'Maksymalna chwilowa moc w wybranym okresie, wyznaczana z rzeczywistych próbek.' },
    { term: 'Moc umowna', desc: 'Zakontraktowana moc; jej przekroczenie wiąże się z opłatami ponadumownymi.' },
    { term: 'Moc przyłącza', desc: 'Techniczny limit przyłącza; jego przekroczenie grozi zadziałaniem zabezpieczeń.' },
]

const tariffs = [
    { code: 'G11', desc: 'Gospodarstwo domowe, jedna stawka całodobowa.' },
    { code: 'G12', desc: 'Gospodarstwo domowe, taryfa dwustrefowa (dzień/noc).' },
    { code: 'G12W', desc: 'Dwustrefowa z tańszymi weekendami, typowa dla prosumentów.' },
    { code: 'C11', desc: 'Odbiorca biznesowy, jedna stawka całodobowa.' },
    { code: 'A23', desc: 'Odbiorca przemysłowy, taryfa strefowa (szczyt/pozaszczyt).' },
]

export function HelpPage() {
    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Pomoc</Breadcrumb.Item></Breadcrumb>
            <h3 className="fw-semibold mb-1"><Fa.FaQuestionCircle className="me-2 icon-accent" /> Pomoc i FAQ</h3>
            <div className="text-muted mb-4">Krótki przewodnik po zakładkach oraz słownik pojęć używanych w aplikacji.</div>

            <Row className="g-4">
                <Col lg={7}>
                    <Card className="h-100"><Card.Body>
                        <div className="text-uppercase small fw-bold mb-3">Zakładki</div>
                        <div className="d-flex flex-column gap-3">
                            {tabs.map((tab) => (
                                <div key={tab.name} className="d-flex">
                                    <tab.icon className="me-3 mt-1 icon-accent flex-shrink-0" size={20} />
                                    <div>
                                        <div className="fw-semibold">{tab.name}</div>
                                        <div className="text-muted small">{tab.text}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card.Body></Card>
                </Col>
                <Col lg={5}>
                    <Card className="mb-4"><Card.Body>
                        <div className="text-uppercase small fw-bold mb-3">Słownik pojęć</div>
                        <Accordion flush alwaysOpen>
                            {terms.map((entry, index) => (
                                <Accordion.Item eventKey={String(index)} key={entry.term}>
                                    <Accordion.Header>{entry.term}</Accordion.Header>
                                    <Accordion.Body className="text-muted small">{entry.desc}</Accordion.Body>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    </Card.Body></Card>
                    <Card><Card.Body>
                        <div className="text-uppercase small fw-bold mb-3">Taryfy</div>
                        <Table size="sm" className="mb-0">
                            <tbody>
                                {tariffs.map((tariff) => (
                                    <tr key={tariff.code}>
                                        <td className="fw-semibold" style={{ width: 70 }}>{tariff.code}</td>
                                        <td className="text-muted small">{tariff.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card.Body></Card>
                </Col>
            </Row>
        </Container>
    )
}
