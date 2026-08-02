import { Card, Col, Placeholder, Row } from 'react-bootstrap'

// Lightweight loading placeholder mirroring the analytics layout (metric cards + chart)
// so the page keeps its shape while data loads instead of collapsing to a spinner.
export function AnalyticsSkeleton({ cards = 4 }: { cards?: number }) {
    return (
        <div aria-hidden="true">
            <Row className="g-3 mb-3">
                {Array.from({ length: cards }, (_, index) => (
                    <Col md={6} xl={3} key={index}>
                        <Card className="h-100 p-3">
                            <Placeholder as="div" animation="glow"><Placeholder xs={7} /></Placeholder>
                            <Placeholder as="div" animation="glow" className="mt-2"><Placeholder xs={5} size="lg" /></Placeholder>
                        </Card>
                    </Col>
                ))}
            </Row>
            <Card>
                <Card.Body>
                    <Placeholder as="div" animation="glow" className="mb-3"><Placeholder xs={4} /></Placeholder>
                    <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{ height: 320 }} /></Placeholder>
                </Card.Body>
            </Card>
        </div>
    )
}
