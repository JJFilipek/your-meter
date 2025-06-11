import { useState } from "react"
import { Container, Row, Col, Breadcrumb, Form, Button, Card, Table } from "react-bootstrap"
import * as Fa from "react-icons/fa"
import { ColumnSelectorModal } from "./ColumnSelectorModal"
import { ColumnViewBar } from "./ColumnViewBar"
import "./ColumnViewBar.css"

const meters = [
    { id: 1, name: "Farma PV 938 (A23)" },
    { id: 2, name: "PV – licznik falownika (A22)" },
    { id: 3, name: "Podlicznik – Piętro 1 (G11)" },
]

const allColumns = [
    { key: "aPlus", label: "1.8.0 (A+)" },
    { key: "aPlusT1", label: "1.8.1 (A+ T1)" },
    { key: "aPlusT2", label: "1.8.2 (A+ T2)" },
    { key: "aMinus", label: "2.8.0 (A-)" },
    { key: "aMinusT1", label: "2.8.1 (A- T1)" },
    { key: "aMinusT2", label: "2.8.2 (A- T2)" }
]

const dummyRows = Array.from({ length: 5 * 24 }, (_, i) => {
    const day = Math.floor(i / 24)
    const hour = i % 24
    const baseDate = new Date(2025, 4, 25 + day)
    baseDate.setHours(hour, 0, 0)
    const timestamp = baseDate.toISOString().slice(0, 16).replace("T", " ")
    const aPlus = 1000 + i * 0.3
    const aMinus = 200 + i * 1.2
    const row: any = {
        timestamp,
        aPlus: aPlus.toFixed(5),
        aMinus: aMinus.toFixed(5)
    }
    if (hour === 0) {
        row.aPlusT1 = (aPlus * 0.7).toFixed(5)
        row.aPlusT2 = (aPlus * 0.3).toFixed(5)
        row.aMinusT1 = (aMinus * 0.6).toFixed(5)
        row.aMinusT2 = (aMinus * 0.4).toFixed(5)
    }
    return row
})

export function MeterReadingsPage() {
    const [selectedMeter, setSelectedMeter] = useState(1)
    const [tabs, setTabs] = useState([
        "Domyślny",
        "tylko plusy",
        "tylko minusy",
        "plusy strefy",
        "minusy strefy",
        "Energie bierne indukcyjne",
        "Energie bierne pojemnościowe"
    ])
    const [activeTab, setActiveTab] = useState("Domyślny")
    const [editingTab, setEditingTab] = useState<string | null>(null)
    const [creatingTab, setCreatingTab] = useState(false)
    const [dateFrom, setDateFrom] = useState("2025-05-30")
    const [dateTo, setDateTo] = useState("2025-05-31")

    const [tabColumns, setTabColumns] = useState<Record<string, string[]>>({
        "Domyślny": ["aPlus", "aPlusT1", "aPlusT2", "aMinus", "aMinusT1", "aMinusT2"],
        "tylko plusy": ["aPlus", "aPlusT1", "aPlusT2"],
        "tylko minusy": ["aMinus", "aMinusT1", "aMinusT2"],
        "plusy strefy": ["aPlusT1", "aPlusT2"],
        "minusy strefy": ["aPlus", "aMinus"],
        "profilplusminus": ["aPlus", "aMinus"],
        "ip": ["aPlus", "aPlusT1", "aMinus", "aMinusT1"]
    })

    const visibleColumns = tabColumns[activeTab] || []

    const rowsPerPage = 40
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.ceil(dummyRows.length / rowsPerPage)
    const pagedRows = dummyRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

    return (
        <Container fluid className="pb-5">
            <Breadcrumb>
                <Breadcrumb.Item active>Wskazania</Breadcrumb.Item>
            </Breadcrumb>

            <Row className="align-items-center justify-content-between mb-3">
                <Col>
                    <h3 className="fw-semibold">
                        <Fa.FaTachometerAlt className="me-2 icon-accent" /> Wskazania pomiarowe
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

            <div className="d-flex justify-content-start align-items-center flex-wrap mb-3" style={{ gap: '0.75rem' }}>
                <Form.Control type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '160px' }} />
                <span style={{ fontSize: '1.5rem' }}>→</span>
                <Form.Control type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '160px' }} />
                <div style={{ marginLeft: '0.5rem' }}>
                    <Button variant="primary"><Fa.FaSync className="me-1" /> Wczytaj</Button>
                </div>
            </div>

            <Card className="mb-4">
                <Card.Body>
                    <Table striped bordered hover size="sm" responsive>
                        <thead>
                            <tr>
                                <th>Czas zatrzaśnięcia</th>
                                {visibleColumns.map(col =>
                                    <th key={col}>{allColumns.find(c => c.key === col)?.label}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedRows.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.timestamp}</td>
                                    {visibleColumns.map(col => (
                                        <td key={col}>{r[col]}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    <div className="d-flex justify-content-end align-items-center" style={{ gap: "0.5rem" }}>
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >←</Button>
                        <span style={{ minWidth: 40, textAlign: "center" }}>{currentPage} / {totalPages}</span>
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >→</Button>
                    </div>
                </Card.Body>
            </Card>

            <Row className="mt-4">
                <Col>
                    <ColumnViewBar
                        groups={tabs}
                        active={activeTab}
                        onSetActive={setActiveTab}
                        onEdit={setEditingTab}
                        onAdd={() => setCreatingTab(true)}
                    />
                </Col>
            </Row>

            {editingTab && (
                <ColumnSelectorModal
                    show={true}
                    initialName={editingTab}
                    initialColumns={tabColumns[editingTab] || []}
                    onClose={() => setEditingTab(null)}
                    onSave={(newName, columns) => {
                        if (!tabs.includes(newName)) {
                            setTabs(tabs.map(t => t === editingTab ? newName : t))
                            const newTabColumns = { ...tabColumns }
                            delete newTabColumns[editingTab!]
                            newTabColumns[newName] = columns
                            setTabColumns(newTabColumns)
                            setActiveTab(newName)
                        } else {
                            setTabColumns({ ...tabColumns, [newName]: columns })
                        }
                        setEditingTab(null)
                    }}
                />
            )}

            {creatingTab && (
                <ColumnSelectorModal
                    show={true}
                    initialName=""
                    initialColumns={["aPlus", "aPlusT1", "aPlusT2"]}
                    onClose={() => setCreatingTab(false)}
                    onSave={(newName, columns) => {
                        if (newName && !tabs.includes(newName)) {
                            setTabs([...tabs, newName])
                            setTabColumns({ ...tabColumns, [newName]: columns })
                            setActiveTab(newName)
                        }
                        setCreatingTab(false)
                    }}
                />
            )}
        </Container>
    )
}
