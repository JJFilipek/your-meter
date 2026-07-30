import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    Col,
    Form,
    Modal,
    Row,
    Spinner,
    Table,
} from 'react-bootstrap'
import * as Fa from 'react-icons/fa'
import {
    createSimulator,
    deleteSimulator,
    getSimulators,
    setSimulatorState,
    type CreateSimulatorRequest,
    type Simulator,
} from '../api/meters'

const tariffDefaults: Record<Simulator['tariff'], number> = {
    G11: 2.4,
    G12: 4.8,
    G12W: 3.6,
    C11: 9.5,
    A23: 72,
}

const toLocalDateTimeInput = (date: Date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return localDate.toISOString().slice(0, 16)
}

const defaultStartDate = new Date()
defaultStartDate.setDate(defaultStartDate.getDate() - 30)

const initialForm: CreateSimulatorRequest = {
    name: '',
    tariff: 'G11',
    basePowerKw: tariffDefaults.G11,
    samplingIntervalSeconds: 30,
    city: 'Warszawa',
    site: 'Obiekt testowy',
    lat: 52.2297,
    lng: 21.0122,
    initialImportKwh: 0,
    initialExportKwh: 0,
    startAtUtc: toLocalDateTimeInput(defaultStartDate),
    historicalIntervalMinutes: 15,
}

const numberFormatter = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
})

export default function MeterLabPage() {
    const [simulators, setSimulators] = useState<Simulator[]>([])
    const [form, setForm] = useState<CreateSimulatorRequest>(initialForm)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Simulator | null>(null)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')

    const loadSimulators = useCallback(async (signal?: AbortSignal) => {
        setIsLoading(true)
        setError(null)
        try {
            setSimulators(await getSimulators(signal))
        } catch (loadError) {
            if (loadError instanceof DOMException && loadError.name === 'AbortError') return
            setError(loadError instanceof Error
                ? loadError.message
                : 'Nie udało się pobrać symulatorów.')
        } finally {
            if (!signal?.aborted) setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        void loadSimulators(controller.signal)
        return () => controller.abort()
    }, [loadSimulators])

    const totalReadings = useMemo(
        () => simulators.reduce((sum, simulator) => sum + simulator.readingCount, 0),
        [simulators],
    )
    const activeCount = simulators.filter((simulator) => simulator.isEnabled).length

    const updateField = <K extends keyof CreateSimulatorRequest>(
        key: K,
        value: CreateSimulatorRequest[K],
    ) => {
        setForm((current) => ({ ...current, [key]: value }))
    }

    const handleTariffChange = (tariff: Simulator['tariff']) => {
        setForm((current) => ({
            ...current,
            tariff,
            basePowerKw: tariffDefaults[tariff],
        }))
    }

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault()
        const submittedForm = new FormData(event.currentTarget as HTMLFormElement)
        const submittedStartAt = String(
            submittedForm.get('startAtUtc') ?? form.startAtUtc,
        )
        setIsSubmitting(true)
        setError(null)
        setSuccess(null)
        try {
            const created = await createSimulator({
                ...form,
                serialNumber: form.serialNumber?.trim() || undefined,
                startAtUtc: new Date(submittedStartAt).toISOString(),
            })
            setSimulators((current) => [...current, created]
                .sort((left, right) => left.name.localeCompare(right.name, 'pl')))
            setForm({
                ...initialForm,
                tariff: form.tariff,
                basePowerKw: tariffDefaults[form.tariff],
                city: form.city,
            })
            setSuccess(`Utworzono symulator ${created.serialNo}. Pierwszy odczyt został zapisany.`)
        } catch (createError) {
            setError(createError instanceof Error
                ? createError.message
                : 'Nie udało się utworzyć symulatora.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleStateChange = async (simulator: Simulator) => {
        setBusyId(simulator.id)
        setError(null)
        setSuccess(null)
        try {
            const updated = await setSimulatorState(simulator.id, !simulator.isEnabled)
            setSimulators((current) => current.map((item) =>
                item.id === updated.id ? updated : item))
            setSuccess(updated.isEnabled
                ? `Wznowiono symulator ${updated.serialNo}.`
                : `Wstrzymano symulator ${updated.serialNo}.`)
        } catch (stateError) {
            setError(stateError instanceof Error
                ? stateError.message
                : 'Nie udało się zmienić stanu symulatora.')
        } finally {
            setBusyId(null)
        }
    }

    const openDeleteModal = (simulator: Simulator) => {
        setDeleteTarget(simulator)
        setDeleteConfirmation('')
        setError(null)
        setSuccess(null)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return

        setBusyId(deleteTarget.id)
        setError(null)
        try {
            const result = await deleteSimulator(deleteTarget.id, deleteConfirmation)
            setSimulators((current) => current.filter((item) => item.id !== result.id))
            setDeleteTarget(null)
            setDeleteConfirmation('')
            setSuccess(
                `Usunięto ${result.serialNo} oraz ${result.deletedReadings.toLocaleString('pl-PL')} odczytów.`,
            )
        } catch (deleteError) {
            setError(deleteError instanceof Error
                ? deleteError.message
                : 'Nie udało się usunąć symulatora.')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <>
            <Breadcrumb>
                <Breadcrumb.Item active>Symulatory / Zarządzanie</Breadcrumb.Item>
            </Breadcrumb>
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
                <div>
                    <h3 className="fw-semibold mb-1">
                        <Fa.FaCogs className="me-2 icon-accent" />
                        Zarządzanie symulatorami
                    </h3>
                    <p className="text-muted mb-0">
                        Twórz profile taryfowe, wstrzymuj generowanie i trwale usuwaj dane testowe.
                    </p>
                </div>
                <Button variant="outline-primary" onClick={() => void loadSimulators()}>
                    <Fa.FaSyncAlt className="me-2" />
                    Odśwież
                </Button>
            </div>

            {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

            <Row className="g-3 mb-4">
                <Col md={4}>
                    <Card className="h-100 shadow-sm">
                        <Card.Body>
                            <div className="text-muted small">Wszystkie symulatory</div>
                            <div className="fs-2 fw-semibold">{simulators.length}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="h-100 shadow-sm">
                        <Card.Body>
                            <div className="text-muted small">Aktywne</div>
                            <div className="fs-2 fw-semibold">{activeCount}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="h-100 shadow-sm">
                        <Card.Body>
                            <div className="text-muted small">Zapisane odczyty</div>
                            <div className="fs-2 fw-semibold">{totalReadings.toLocaleString('pl-PL')}</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="shadow-sm mb-4">
                <Card.Header className="fw-semibold">Nowy symulator</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleCreate}>
                        <Row className="g-3">
                            <Col lg={4} md={6}>
                                <Form.Group>
                                    <Form.Label>Nazwa</Form.Label>
                                    <Form.Control
                                        required
                                        minLength={2}
                                        maxLength={160}
                                        value={form.name}
                                        onChange={(event) => updateField('name', event.target.value)}
                                        placeholder="np. Biuro testowe"
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={2} md={3}>
                                <Form.Group>
                                    <Form.Label>Taryfa</Form.Label>
                                    <Form.Select
                                        value={form.tariff}
                                        onChange={(event) =>
                                            handleTariffChange(event.target.value as Simulator['tariff'])}
                                    >
                                        {Object.keys(tariffDefaults).map((tariff) => (
                                            <option key={tariff} value={tariff}>{tariff}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={3}>
                                <Form.Group>
                                    <Form.Label>Moc bazowa [kW]</Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="0.1"
                                        max={form.tariff === 'A23' ? 1000 : 40}
                                        step="0.1"
                                        value={form.basePowerKw}
                                        onChange={(event) =>
                                            updateField('basePowerKw', Number(event.target.value))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6}>
                                <Form.Group>
                                    <Form.Label>Numer seryjny, opcjonalnie</Form.Label>
                                    <Form.Control
                                        pattern="[A-Z0-9-]+"
                                        maxLength={64}
                                        value={form.serialNumber ?? ''}
                                        onChange={(event) =>
                                            updateField('serialNumber', event.target.value.toUpperCase())}
                                        placeholder="Generowany automatycznie"
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6}>
                                <Form.Group>
                                    <Form.Label>Miasto</Form.Label>
                                    <Form.Control
                                        required
                                        minLength={2}
                                        value={form.city}
                                        onChange={(event) => updateField('city', event.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6}>
                                <Form.Group>
                                    <Form.Label>Obiekt</Form.Label>
                                    <Form.Control
                                        required
                                        minLength={2}
                                        value={form.site}
                                        onChange={(event) => updateField('site', event.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={2} md={4}>
                                <Form.Group>
                                    <Form.Label>Interwał [s]</Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="5"
                                        max="3600"
                                        value={form.samplingIntervalSeconds}
                                        onChange={(event) =>
                                            updateField('samplingIntervalSeconds', Number(event.target.value))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={2} md={4}>
                                <Form.Group>
                                    <Form.Label>Początkowy import [kWh]</Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={form.initialImportKwh}
                                        onChange={(event) =>
                                            updateField('initialImportKwh', Number(event.target.value))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={2} md={4}>
                                <Form.Group>
                                    <Form.Label>Początkowy eksport [kWh]</Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={form.initialExportKwh}
                                        onChange={(event) =>
                                            updateField('initialExportKwh', Number(event.target.value))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6}>
                                <Form.Group>
                                    <Form.Label>Data rozpoczęcia pomiarów</Form.Label>
                                    <Form.Control
                                        required
                                        name="startAtUtc"
                                        type="datetime-local"
                                        min={toLocalDateTimeInput(
                                            new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                                        )}
                                        max={toLocalDateTimeInput(new Date())}
                                        value={form.startAtUtc}
                                        onChange={(event) =>
                                            updateField('startAtUtc', event.target.value)}
                                    />
                                    <Form.Text className="text-muted">
                                        Backend uzupełni pomiary od tej daty do teraz.
                                    </Form.Text>
                                </Form.Group>
                            </Col>
                            <Col lg={3} md={6}>
                                <Form.Group>
                                    <Form.Label>Interwał historii [min]</Form.Label>
                                    <Form.Select
                                        value={form.historicalIntervalMinutes}
                                        onChange={(event) =>
                                            updateField(
                                                'historicalIntervalMinutes',
                                                Number(event.target.value),
                                            )}
                                    >
                                        <option value={5}>5 minut</option>
                                        <option value={10}>10 minut</option>
                                        <option value={15}>15 minut</option>
                                        <option value={30}>30 minut</option>
                                        <option value={60}>60 minut</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <div className="d-flex justify-content-end mt-3">
                            <Button type="submit" variant="success" disabled={isSubmitting}>
                                {isSubmitting
                                    ? <><Spinner size="sm" className="me-2" />Tworzenie</>
                                    : <><Fa.FaPlus className="me-2" />Utwórz symulator</>}
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>

            <Card className="shadow-sm mb-4">
                <Card.Header className="fw-semibold">Uruchomione profile</Card.Header>
                <div className="table-responsive">
                    <Table hover className="mb-0 align-middle">
                        <thead>
                            <tr>
                                <th>Numer seryjny</th>
                                <th>Nazwa</th>
                                <th>Taryfa</th>
                                <th>Moc</th>
                                <th>Stan</th>
                                <th>Odczyty</th>
                                <th>Dane od</th>
                                <th>Ostatnia moc</th>
                                <th className="text-end">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={9} className="text-center py-4">
                                        <Spinner size="sm" className="me-2" />
                                        Pobieranie symulatorów
                                    </td>
                                </tr>
                            )}
                            {!isLoading && simulators.map((simulator) => (
                                <tr key={simulator.id}>
                                    <td className="fw-semibold">{simulator.serialNo}</td>
                                    <td>
                                        <div>{simulator.name}</div>
                                        <small className="text-muted">{simulator.city}, {simulator.site}</small>
                                    </td>
                                    <td><Badge bg="secondary">{simulator.tariff}</Badge></td>
                                    <td>{numberFormatter.format(simulator.basePowerKw)} kW</td>
                                    <td>
                                        <Badge bg={simulator.isEnabled ? 'success' : 'warning'}>
                                            {simulator.isEnabled ? 'Aktywny' : 'Wstrzymany'}
                                        </Badge>
                                    </td>
                                    <td>{simulator.readingCount.toLocaleString('pl-PL')}</td>
                                    <td>
                                        {simulator.startedAtUtc
                                            ? new Date(simulator.startedAtUtc).toLocaleString('pl-PL')
                                            : 'Brak'}
                                    </td>
                                    <td>
                                        {simulator.latestActivePowerKw === null
                                            ? 'Brak'
                                            : `${numberFormatter.format(simulator.latestActivePowerKw)} kW`}
                                    </td>
                                    <td className="text-end text-nowrap">
                                        <Button
                                            size="sm"
                                            variant={simulator.isEnabled ? 'outline-warning' : 'outline-success'}
                                            className="me-2"
                                            disabled={busyId === simulator.id}
                                            onClick={() => void handleStateChange(simulator)}
                                        >
                                            {simulator.isEnabled ? 'Wstrzymaj' : 'Wznów'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline-danger"
                                            disabled={busyId === simulator.id}
                                            onClick={() => openDeleteModal(simulator)}
                                        >
                                            Usuń trwale
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && simulators.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center text-muted py-4">
                                        Brak symulatorów. Utwórz pierwszy profil formularzem powyżej.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card>

            <Modal show={deleteTarget !== null} onHide={() => setDeleteTarget(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Trwałe usunięcie symulatora</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="warning">
                        Zostanie usunięty licznik oraz wszystkie jego odczyty. Tej operacji nie można cofnąć.
                    </Alert>
                    <p>
                        Aby potwierdzić, wpisz numer seryjny:
                        <strong className="d-block mt-1">{deleteTarget?.serialNo}</strong>
                    </p>
                    <Form.Control
                        autoFocus
                        value={deleteConfirmation}
                        onChange={(event) => setDeleteConfirmation(event.target.value)}
                        placeholder="Numer seryjny"
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                        Anuluj
                    </Button>
                    <Button
                        variant="danger"
                        disabled={
                            !deleteTarget
                            || deleteConfirmation !== deleteTarget.serialNo
                            || busyId === deleteTarget.id
                        }
                        onClick={() => void handleDelete()}
                    >
                        {busyId === deleteTarget?.id
                            ? <><Spinner size="sm" className="me-2" />Usuwanie</>
                            : 'Usuń licznik i odczyty'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    )
}
