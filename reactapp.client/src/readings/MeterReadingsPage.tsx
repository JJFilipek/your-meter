import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'wouter'
import { Alert, Breadcrumb, Button, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap'
import * as Fa from 'react-icons/fa'
import { getMeterReadings, getMeters, type MeterReading } from '../api/meters'
import type { Meter } from '../types/infrastructure/meter'
import { ColumnSelectorModal } from './ColumnSelectorModal'
import { ColumnViewBar } from './ColumnViewBar'
import './ColumnViewBar.css'

const readingColumns = [
    { key: 'activeImportKwh', label: 'Energia pobrana (kWh)' },
    { key: 'activeExportKwh', label: 'Energia oddana (kWh)' },
    { key: 'activeGenerationKwh', label: 'Energia wytworzona (kWh)' },
    { key: 'activePowerKw', label: 'Moc czynna (kW)' },
    { key: 'generationPowerKw', label: 'Moc generacji (kW)' },
    { key: 'reactivePowerKvar', label: 'Moc bierna (kvar)' },
    { key: 'voltage', label: 'Napięcie (V)' },
    { key: 'current', label: 'Prąd (A)' },
    { key: 'frequencyHz', label: 'Częstotliwość (Hz)' },
    { key: 'quality', label: 'Jakość' },
] as const

type ReadingColumnKey = typeof readingColumns[number]['key']

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)
const initialDateTo = formatDateInput(new Date())
const initialDateFrom = formatDateInput(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))

const numberFormatter = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
})

const timestampFormatter = new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'medium',
})

const qualityLabels: Record<MeterReading['quality'], string> = {
    Valid: 'Poprawny',
    Estimated: 'Szacowany',
    Invalid: 'Nieprawidłowy',
}

const renderValue = (reading: MeterReading, column: ReadingColumnKey) => {
    const value = reading[column]
    if (column === 'quality') return qualityLabels[value as MeterReading['quality']]
    return typeof value === 'number' ? numberFormatter.format(value) : '-'
}

export function MeterReadingsPage() {
    const [searchParams] = useSearchParams()
    const requestedMeterId = searchParams.get('meterId')
    const [meters, setMeters] = useState<Meter[]>([])
    const [selectedMeter, setSelectedMeter] = useState('')
    const [readings, setReadings] = useState<MeterReading[]>([])
    const [isLoadingMeters, setIsLoadingMeters] = useState(true)
    const [isLoadingReadings, setIsLoadingReadings] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [dateFrom, setDateFrom] = useState(initialDateFrom)
    const [dateTo, setDateTo] = useState(initialDateTo)
    const [reloadToken, setReloadToken] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [tabs, setTabs] = useState(['Podstawowe', 'Parametry sieci', 'Wszystkie'])
    const [activeTab, setActiveTab] = useState('Podstawowe')
    const [editingTab, setEditingTab] = useState<string | null>(null)
    const [creatingTab, setCreatingTab] = useState(false)
    const [tabColumns, setTabColumns] = useState<Record<string, string[]>>({
        Podstawowe: ['activeImportKwh', 'activeExportKwh', 'activePowerKw', 'quality'],
        'Parametry sieci': ['voltage', 'current', 'frequencyHz', 'reactivePowerKvar'],
        Wszystkie: readingColumns.map(column => column.key),
    })

    useEffect(() => {
        const controller = new AbortController()
        getMeters(controller.signal)
            .then(items => {
                setMeters(items)
                const requestedExists = items.some(item => item.id === requestedMeterId)
                setSelectedMeter(requestedExists ? requestedMeterId! : items[0]?.id ?? '')
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setLoadError(error instanceof Error ? error.message : 'Nie udało się pobrać liczników.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoadingMeters(false)
            })

        return () => controller.abort()
    }, [requestedMeterId])

    useEffect(() => {
        if (!selectedMeter) {
            setReadings([])
            return
        }

        const controller = new AbortController()
        setIsLoadingReadings(true)
        setLoadError(null)
        const fromUtc = new Date(`${dateFrom}T00:00:00`).toISOString()
        const toUtc = new Date(`${dateTo}T23:59:59.999`).toISOString()

        getMeterReadings(selectedMeter, fromUtc, toUtc, controller.signal)
            .then(items => {
                setReadings(items)
                setCurrentPage(1)
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setLoadError(error instanceof Error ? error.message : 'Nie udało się pobrać odczytów.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoadingReadings(false)
            })

        return () => controller.abort()
    }, [dateFrom, dateTo, reloadToken, selectedMeter])

    const visibleColumns = (tabColumns[activeTab] ?? [])
        .filter((key): key is ReadingColumnKey => readingColumns.some(column => column.key === key))
    const rowsPerPage = 40
    const totalPages = Math.max(1, Math.ceil(readings.length / rowsPerPage))
    const pagedRows = useMemo(
        () => readings.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
        [currentPage, readings],
    )

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
                        <Form.Select
                            style={{ minWidth: 260 }}
                            value={selectedMeter}
                            disabled={isLoadingMeters || meters.length === 0}
                            onChange={event => setSelectedMeter(event.target.value)}
                        >
                            {meters.length === 0 && <option value="">Brak zarejestrowanych liczników</option>}
                            {meters.map(meter => (
                                <option key={meter.id} value={meter.id}>
                                    {meter.name} ({meter.serialNo})
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <div className="d-flex justify-content-start align-items-center flex-wrap mb-3 gap-3">
                <Form.Control
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={event => setDateFrom(event.target.value)}
                    style={{ width: '160px' }}
                />
                <span>do</span>
                <Form.Control
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={event => setDateTo(event.target.value)}
                    style={{ width: '160px' }}
                />
                <Button
                    variant="primary"
                    disabled={!selectedMeter || isLoadingReadings}
                    onClick={() => setReloadToken(token => token + 1)}
                >
                    <Fa.FaSync className="me-1" /> Wczytaj
                </Button>
            </div>

            {loadError && <Alert variant="danger">{loadError}</Alert>}

            <Card className="mb-4">
                <Card.Body>
                    <Table striped bordered hover size="sm" responsive>
                        <thead>
                            <tr>
                                <th>Czas odczytu</th>
                                {visibleColumns.map(column => (
                                    <th key={column}>
                                        {readingColumns.find(item => item.key === column)?.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingReadings && (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="text-center py-4">
                                        <Spinner size="sm" className="me-2" />
                                        Pobieranie odczytów
                                    </td>
                                </tr>
                            )}
                            {!isLoadingReadings && pagedRows.map(reading => (
                                <tr key={reading.timestampUtc}>
                                    <td>{timestampFormatter.format(new Date(reading.timestampUtc))}</td>
                                    {visibleColumns.map(column => (
                                        <td key={column}>{renderValue(reading, column)}</td>
                                    ))}
                                </tr>
                            ))}
                            {!isLoadingReadings && readings.length === 0 && (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="text-center text-muted py-4">
                                        Brak odczytów w wybranym zakresie.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                    <div className="d-flex justify-content-end align-items-center gap-2">
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                        >
                            Poprzednia
                        </Button>
                        <span style={{ minWidth: 60, textAlign: 'center' }}>{currentPage} / {totalPages}</span>
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                        >
                            Następna
                        </Button>
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
                    show
                    initialName={editingTab}
                    initialColumns={tabColumns[editingTab] ?? []}
                    onClose={() => setEditingTab(null)}
                    onSave={(newName, columns) => {
                        if (!tabs.includes(newName)) {
                            setTabs(items => items.map(item => item === editingTab ? newName : item))
                            const nextColumns = { ...tabColumns }
                            delete nextColumns[editingTab]
                            nextColumns[newName] = columns
                            setTabColumns(nextColumns)
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
                    show
                    initialName=""
                    initialColumns={['activeImportKwh', 'activeExportKwh', 'activePowerKw']}
                    onClose={() => setCreatingTab(false)}
                    onSave={(newName, columns) => {
                        if (newName && !tabs.includes(newName)) {
                            setTabs(items => [...items, newName])
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
