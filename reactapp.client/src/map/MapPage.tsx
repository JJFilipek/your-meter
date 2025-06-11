import { useMemo, useRef, useState } from 'react'
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { meterList } from '../data/meters'
import { Container, Row, Col, Card, Form, Breadcrumb } from 'react-bootstrap'
import * as Fa from "react-icons/fa"


const statusColors: Record<string, string> = {
    'Sprawny': '#357951',
    'Z problemami': '#b08900',
    'Brak komunikacji': '#984040',
    'Nieaktywny powyżej 7 dni': '#5c636a'
}
function createDotIcon(status: string) {
    return L.divIcon({
        className: '',
        html: `<div style="
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: ${statusColors[status] ?? '#999'};
            border: 2px solid white;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    })
}
function FlyToMeter({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap()
    map.flyTo([lat, lng], 16)
    return null
}
export default function isAuthenticatedMapPage() {
    const [query, setQuery] = useState('')
    const [activeMeter, setActiveMeter] = useState<string | null>(null)
    const markerRefs = useRef<Record<string, L.Marker>>({})

    const filtered = useMemo(() => {
        return meterList.filter((m) =>
            m.name.toLowerCase().includes(query.toLowerCase())
        )
    }, [query])

    return (
        <Container fluid>
            <Breadcrumb className="mb-3">
                <Breadcrumb.Item active>Mapa</Breadcrumb.Item>
            </Breadcrumb>
            <Row className="mb-3">
                <Col>
                    <h3 className="fw-semibold mb-0">
                        <Fa.FaMap className="me-2 icon-accent" /> Mapa liczników
                    </h3>
                </Col>
            </Row>

            <Row>
                <Col md={4}>
                    <Card className="h-100 shadow-sm">
                        <Card.Body>
                            <Form.Control
                                type="text"
                                placeholder="Szukaj licznika..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="mb-3"
                            />
                            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                                {filtered.map((meter) => (
                                    <div
                                        key={meter.serialNo}
                                        className="mb-2 p-2 border rounded small"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setActiveMeter(String(meter.serialNo))
                                            const marker = markerRefs.current[meter.serialNo]
                                            if (marker) marker.openPopup()
                                        }}
                                    >
                                        <div className="fw-semibold">{meter.name}</div>
                                        <div className="text-muted">{meter.location.city}, {meter.location.site}</div>
                                    </div>
                                ))}
                                {filtered.length === 0 && (
                                    <div className="text-muted">Brak wyników</div>
                                )}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={8}>
                    <Card className="shadow-sm">
                        <Card.Body style={{ padding: 0 }}>
                            <MapContainer
                                center={[52.23, 21.01]}
                                zoom={13}
                                scrollWheelZoom
                                style={{ height: '75vh', width: '100%' }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {filtered.map((meter) => (
                                    <Marker
                                        key={meter.serialNo}
                                        position={[meter.location.lat, meter.location.lng]}
                                        icon={createDotIcon(meter.status)}
                                        ref={(ref) => {
                                            if (ref) markerRefs.current[meter.serialNo] = ref
                                        }}
                                    >
                                        {activeMeter === String(meter.serialNo) && (
                                            <FlyToMeter lat={meter.location.lat} lng={meter.location.lng} />
                                        )}
                                        <Popup>
                                            <strong>{meter.name}</strong><br />
                                            {meter.location.site}<br />
                                            {meter.location.city}<br />
                                            <button
                                                onClick={() => alert(`Otwórz szczegóły licznika ${meter.serialNo}`)}
                                                className="btn btn-sm btn-outline-brand mt-2"
                                            >
                                                Szczegóły
                                            </button>

                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </Card.Body>
                        <div className="mt-3">
                            <Card className="shadow-sm">
                                <Card.Body>
                                    <div className="text-uppercase small fw-bold mb-2">Legenda statusów</div>
                                    <div className="d-flex flex-wrap gap-3 small">
                                        {Object.entries(statusColors).map(([status, color]) => (
                                            <div key={status} className="d-flex align-items-center gap-2">
                                                <div style={{
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: '50%',
                                                    backgroundColor: color,
                                                    border: '2px solid white',
                                                    boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                                                }} />
                                                <span>{status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card.Body>
                            </Card>
                        </div>

                    </Card>
                </Col>
            </Row>
        </Container>
    )
}
