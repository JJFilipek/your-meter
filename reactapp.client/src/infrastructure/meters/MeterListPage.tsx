import { Container, Table, Breadcrumb, Button, Modal, Form, Row, Col } from 'react-bootstrap'
import { useMemo, useState, useEffect } from 'react'
import { Meter } from '../../types/infrastructure/meter'
import { MeterFilters } from './MeterFilters'
import { MeterItem } from './MeterItem'
import { meterList } from '../../data/meters'
import * as Fa from "react-icons/fa"
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import { Formik, Form as FormikForm, Field, ErrorMessage, FormikHelpers } from 'formik'
import * as Yup from 'yup'
import { meterValidationSchema } from '../../validations/schemas'

const statusColors: Record<string, string> = {
    'Sprawny': '#357951',
    'Z problemami': '#b08900',
    'Brak komunikacji': '#984040',
    'Nieaktywny powyżej 7 dni': '#5c636a'
}

const headers = [
    { key: 'serialNo', label: 'Numer seryjny' },
    { key: 'name', label: 'Nazwa' },
    { key: 'model', label: 'Model' },
    { key: 'firmware', label: 'Firmware' },
    { key: 'tariff', label: 'Taryfa' },
    { key: 'profile', label: 'Profil' },
    { key: 'status', label: 'Status' }
]

const greenDotIcon = divIcon({
    className: '',
    html: `<div style="D
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #28a745;
        border: 2px solid white;
        box-shadow: 0 0 4px rgba(0,0,0,0.2);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
})

export const Meters = () => {
    const [filters, setFilters] = useState<Record<string, string>>({})
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
    const [showModal, setShowModal] = useState(false)
    const rowsPerPage = 20
    const [currentPage, setCurrentPage] = useState(1)

    const filteredAndSorted = useMemo(() => {
        let result = meterList.filter(meter =>
            headers.every(({ key }) => {
                if (!filters[key]) return true
                return String(meter[key as keyof Meter])
                    .toLowerCase()
                    .includes(filters[key].toLowerCase())
            })
        )
        if (sortKey && sortDirection) {
            result = [...result].sort((a, b) => {
                const valA = a[sortKey as keyof Meter]
                const valB = b[sortKey as keyof Meter]
                if (sortKey === 'status') {
                    return sortDirection === 'asc'
                        ? String(valA).localeCompare(String(valB))
                        : String(valB).localeCompare(String(valA))
                }
                if (valA < valB) return sortDirection === 'asc' ? -1 : 1
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
        }
        return result
    }, [filters, sortKey, sortDirection])

    const totalPages = Math.ceil(filteredAndSorted.length / rowsPerPage)
    const pagedMeters = filteredAndSorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

    const toggleSort = (key: string) => {
        if (sortKey !== key) {
            setSortKey(key)
            setSortDirection('asc')
        } else if (sortDirection === 'asc') {
            setSortDirection('desc')
        } else {
            setSortKey(null)
            setSortDirection(null)
        }
    }

    return (
        <Container fluid>
            <Breadcrumb>
                <Breadcrumb.Item active>Liczniki / Lista</Breadcrumb.Item>
            </Breadcrumb>
            <h3 className="fw-semibold mb-4">
                <Fa.FaBolt className="me-2 icon-accent" /> Liczniki
            </h3>
            <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
                <div style={{ flex: 1 }}>
                    <MeterFilters
                        headers={headers.filter(h => h.key !== 'status')}
                        onChange={setFilters}
                    />
                </div>
                <Button
                    variant="success"
                    style={{ height: '40px', whiteSpace: 'nowrap' }}
                    onClick={() => setShowModal(true)}
                >
                    Dodaj licznik
                </Button>
            </div>
            <Table striped bordered hover>
                <thead>
                    <tr>
                        {headers.map(({ key, label }) => (
                            <th
                                key={key}
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleSort(key)}
                            >
                                {label}{' '}
                                {sortKey === key
                                    ? sortDirection === 'asc'
                                        ? '↑'
                                        : sortDirection === 'desc'
                                            ? '↓'
                                            : ''
                                    : ''}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {pagedMeters.map((meter, index) => (
                        <MeterItem 
                            key={index} 
                            meter={meter} 
                            statusColors={statusColors} 
                        />
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
            <AddMeterModal show={showModal} onClose={() => setShowModal(false)} />
        </Container>
    )
}

const initialFormData = {
    serialNumber: '1053',
    name: '',
    model: '',
    firmware: '',
    tariff: '',
    profile: '',
    city: '',
    place: ''
}

const validationSchema = meterValidationSchema.shape({
    serialNumber: Yup.string()
        .required('Numer seryjny jest wymagany')
        .matches(/^[A-Z0-9-]+$/, 'Nieprawidłowy format numeru seryjnego'),
        
    profile: Yup.string()
        .required('Profil jest wymagany')
        .oneOf(['3600', '900', '600'], 'Nieprawidłowa wartość profilu')
        .when('tariff', {
            is: (tariff: string) => ['G12', 'G12W', 'G12r'].includes(tariff),
            then: (schema) => schema.test(
                'profile-for-tariff',
                'Dla wybranej taryfy wymagany jest profil 900',
                value => value === '900'
            )
        }),
        
    city: Yup.string()
        .required('Miasto jest wymagane')
        .matches(/^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]*$/, 'Nazwa miasta musi zaczynać się z dużej litery i zawierać tylko litery, spacje i myślniki')
        .min(2, 'Nazwa miasta musi mieć co najmniej 2 znaki')
        .max(50, 'Nazwa miasta może mieć maksymalnie 50 znaków'),
        
    place: Yup.string()
        .required('Lokalizacja/Obiekt jest wymagany')
        .min(2, 'Lokalizacja musi mieć co najmniej 2 znaki')
        .max(100, 'Lokalizacja może mieć maksymalnie 100 znaków')
        .test(
            'unique-location',
            'Taka lokalizacja już istnieje',
            async function(value) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const existingLocations = ['Hala A', 'Budynek B'];
                return !existingLocations.includes(value as string);
            }
        ),
});

export function AddMeterModal({ show, onClose }: { show: boolean, onClose: () => void }) {
    const [location, setLocation] = useState({ lat: 52.23, lng: 21.01 });
    
    const handleClose = () => {
        onClose();
    };

    const handleSubmit = async (values: typeof initialFormData, { setSubmitting }: FormikHelpers<typeof initialFormData>) => {
        try {
            console.log('Form submitted:', {
                ...values, 
                location: {
                    lat: location.lat,
                    lng: location.lng
                } 
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            alert('Licznik został dodany!');
            onClose();
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Wystąpił błąd podczas dodawania licznika');
        } finally {
            setSubmitting(false);
        }
    };
    function LocationPicker() {
        const map = useMapEvents({
            click(e) {
                setLocation({ lat: e.latlng.lat, lng: e.latlng.lng })
            }
        });

        useEffect(() => {
            map.flyTo([location.lat, location.lng], map.getZoom());
        }, [location, map]);

        return location ? <Marker position={[location.lat, location.lng]} icon={greenDotIcon} /> : null;
    }
    return (
        <Modal show={show} onHide={handleClose} size="xl" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>Dodaj licznik</Modal.Title>
            </Modal.Header>
            <Formik
                initialValues={initialFormData}
                validationSchema={validationSchema}
                validateOnMount={true}
                validateOnBlur={true}
                validateOnChange={true}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting }) => (
                    <FormikForm>
                        <Modal.Body>
                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Numer seryjny</Form.Label>
                                <Field 
                                    as={Form.Control} 
                                    type="text" 
                                    name="serialNumber" 
                                    disabled
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Nazwa</Form.Label>
                                <Field 
                                    as={Form.Control}
                                    name="name"
                                    type="text"
                                    placeholder="np. DOM-1"
                                    isInvalid={false}
                                />
                                <ErrorMessage name="name" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Model</Form.Label>
                                <Field 
                                    as={Form.Control}
                                    name="model"
                                    type="text"
                                    placeholder="np. ELM-3000"
                                />
                                <ErrorMessage name="model" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Firmware</Form.Label>
                                <Field 
                                    as={Form.Control}
                                    name="firmware"
                                    type="text"
                                    placeholder="np. 1.0.2"
                                />
                                <ErrorMessage name="firmware" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Taryfa</Form.Label>
                                <Field 
                                    as={Form.Select}
                                    name="tariff"
                                >
                                    <option value="">Wybierz taryfę</option>
                                    <option value="G11">G11</option>
                                    <option value="G12">G12</option>
                                    <option value="G12W">G12W</option>
                                    <option value="G12r">C11</option>
                                    <option value="G13">C12</option>
                                    <option value="G11p">A23</option>
                                </Field>
                                <ErrorMessage name="tariff" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Profil</Form.Label>
                                <Field 
                                    as={Form.Select}
                                    name="profile"
                                >
                                    <option value="">Wybierz profil</option>
                                    <option value="3600">3600</option>
                                    <option value="900">900</option>
                                    <option value="600">600</option>
                                </Field>
                                <ErrorMessage name="profile" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Label className="mb-2">Lokalizacja (kliknij na mapę)</Form.Label>
                            <div style={{ height: 250, borderRadius: '0.5rem', overflow: 'hidden' }}>
                                <MapContainer
                                    center={[location.lat, location.lng]}
                                    zoom={13}
                                    scrollWheelZoom
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        attribution='&copy; OpenStreetMap'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <LocationPicker />
                                </MapContainer>
                            </div>
                            <div className="small mt-2 text-muted">Kliknij na mapie, aby ustawić lokalizację.</div>
                            <Form.Group className="mb-3 mt-3">
                                <Form.Label>Miasto</Form.Label>
                                <Field 
                                    as={Form.Control}
                                    name="city"
                                    type="text"
                                    placeholder="np. Warszawa"
                                />
                                <ErrorMessage name="city" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Lokalizacja/Obiekt</Form.Label>
                                <Field 
                                    as={Form.Control}
                                    name="place"
                                    type="text"
                                    placeholder="np. Hala A"
                                />
                                <ErrorMessage name="place" component="div" className="invalid-feedback d-block" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Szerokość geograficzna (lat)</Form.Label>
                                <Form.Control
                                    type="number"
                                    value={location.lat}
                                    onChange={(e) => setLocation({ ...location, lat: parseFloat(e.target.value) })}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Długość geograficzna (lng)</Form.Label>
                                <Form.Control
                                    type="number"
                                    value={location.lng}
                                    onChange={(e) => setLocation({ ...location, lng: parseFloat(e.target.value) })}
                                />
                            </Form.Group>
                            <Field type="hidden" name="latitude" value={location.lat} />
                            <Field type="hidden" name="longitude" value={location.lng} />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose} type="button">Anuluj</Button>
                    <Button variant="primary" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Zapisywanie...' : 'Zapisz licznik'}
                    </Button>
                </Modal.Footer>
                    </FormikForm>
                )}
            </Formik>
        </Modal>
    )
}
