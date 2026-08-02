import { useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, ButtonGroup, Card, Col, Container, Form, Row } from 'react-bootstrap'
import { Bar, Line } from 'react-chartjs-2'
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from 'chart.js'
import * as Fa from 'react-icons/fa'
import {
    getMeterAnalytics,
    getTariffSimulation,
    type MeterAnalytics,
    type TariffCode,
    type TariffSimulation,
} from '../api/meters'
import { useMeterSelection } from '../root/app-context'
import { AnalyticsSkeleton } from '../root/layout/AnalyticsSkeleton'
import { plTooltip } from '../root/chart-format'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend)

const kwh = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

type RangeKey = 'day' | 'week' | 'month' | 'year'

const ranges: Record<RangeKey, { label: string; days: number; bucket: MeterAnalytics['bucket']; unit: Intl.DateTimeFormatOptions }> = {
    day: { label: 'Dzień', days: 1, bucket: 'hour', unit: { hour: '2-digit', minute: '2-digit' } },
    week: { label: 'Tydzień', days: 7, bucket: 'hour', unit: { weekday: 'short', hour: '2-digit' } },
    month: { label: 'Miesiąc', days: 30, bucket: 'day', unit: { day: '2-digit', month: '2-digit' } },
    year: { label: 'Rok', days: 365, bucket: 'month', unit: { month: 'short', year: '2-digit' } },
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 6 }, (_, index) => String(currentYear - index))

const chartTypes = [
    'Wykres energii',
    'Wykres generacji',
    'Wykres eksportu',
    'Wykres autokonsumpcji',
    'Wykres bilansu energetycznego',
    'Wykres mocy szczytowej',
    'Wykres strat przesyłowych',
    'Wykres kosztów energii',
] as const
type ChartType = (typeof chartTypes)[number]

const accent = '#660032'
const green = '#7ecb20'
const greenLight = '#c0f090'
const amber = '#b08900'
const red = '#d90429'

const standardDeviation = (values: number[]) => {
    if (values.length < 2) return 0
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
}

export function ChartsPage() {
    const { meters, selectedMeterId: selectedMeter, setSelectedMeterId: setSelectedMeter } = useMeterSelection()
    const [range, setRange] = useState<RangeKey>('year')
    const [useYearRange, setUseYearRange] = useState(false)
    const [yearFrom, setYearFrom] = useState(String(currentYear - 1))
    const [yearTo, setYearTo] = useState(String(currentYear))
    const [selectedChart, setSelectedChart] = useState<ChartType>('Wykres energii')
    const [energyType, setEnergyType] = useState<'import' | 'export'>('import')
    const [targetTariff, setTargetTariff] = useState<TariffCode | ''>('')
    const [analytics, setAnalytics] = useState<MeterAnalytics | null>(null)
    const [tariffSimulation, setTariffSimulation] = useState<TariffSimulation | null>(null)
    const [ownTariffCost, setOwnTariffCost] = useState<TariffSimulation | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const { fromIso, toIso, bucket } = useMemo(() => {
        if (useYearRange) {
            const [low, high] = [Number(yearFrom), Number(yearTo)].sort((a, b) => a - b)
            const from = new Date(Date.UTC(low, 0, 1))
            const now = new Date()
            const yearEnd = new Date(Date.UTC(high + 1, 0, 1))
            const to = yearEnd < now ? yearEnd : now
            return { fromIso: from.toISOString(), toIso: to.toISOString(), bucket: 'month' as const }
        }
        const config = ranges[range]
        const to = new Date()
        const from = new Date(to.getTime() - config.days * 24 * 60 * 60 * 1000)
        return { fromIso: from.toISOString(), toIso: to.toISOString(), bucket: config.bucket }
    }, [range, useYearRange, yearFrom, yearTo])

    useEffect(() => {
        if (!selectedMeter) {
            setIsLoading(false)
            return
        }
        const controller = new AbortController()
        setIsLoading(true)
        setError(null)
        void getMeterAnalytics(selectedMeter, fromIso, toIso, bucket, controller.signal)
            .then(setAnalytics)
            .catch((loadError) => {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return
                setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych wykresu.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [selectedMeter, fromIso, toIso, bucket])

    // The meter's own tariff cost drives the zone split; the picked target tariff simulates alternatives.
    useEffect(() => {
        if (!selectedMeter || !analytics) return
        const controller = new AbortController()
        const source = (['G11', 'G12', 'G12W'] as const).includes(analytics.tariff as TariffCode)
            ? (analytics.tariff as TariffCode)
            : 'G11'
        void getTariffSimulation(selectedMeter, fromIso, toIso, source, controller.signal)
            .then(setOwnTariffCost)
            .catch(() => setOwnTariffCost(null))
        return () => controller.abort()
    }, [selectedMeter, fromIso, toIso, analytics])

    useEffect(() => {
        if (!selectedMeter || !targetTariff) {
            setTariffSimulation(null)
            return
        }
        const controller = new AbortController()
        void getTariffSimulation(selectedMeter, fromIso, toIso, targetTariff, controller.signal)
            .then(setTariffSimulation)
            .catch(() => setTariffSimulation(null))
        return () => controller.abort()
    }, [selectedMeter, fromIso, toIso, targetTariff])

    const labels = useMemo(() => {
        const unit = useYearRange ? { month: 'short', year: '2-digit' } as const : ranges[range].unit
        const formatter = new Intl.DateTimeFormat('pl-PL', unit)
        return analytics?.buckets.map((b) => formatter.format(new Date(b.startUtc))) ?? []
    }, [analytics, range, useYearRange])

    const { chartNode, chartCaption, seriesForStats, statsUnit } = useMemo(() => {
        const buckets = analytics?.buckets ?? []
        const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const }, tooltip: plTooltip }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
        const plainBar = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const }, tooltip: plTooltip }, scales: { y: { beginAtZero: true } } }
        const lineOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const }, tooltip: plTooltip }, scales: { y: { beginAtZero: true } } }

        switch (selectedChart) {
            case 'Wykres generacji': {
                const data = buckets.map((b) => b.generatedKwh)
                return {
                    chartNode: <Bar data={{ labels, datasets: [{ label: 'Energia wytworzona [kWh]', data, backgroundColor: amber }] }} options={plainBar} />,
                    chartCaption: 'Energia wyprodukowana lokalnie (rejestr generacji).',
                    seriesForStats: data,
                    statsUnit: 'kWh',
                }
            }
            case 'Wykres eksportu': {
                const data = buckets.map((b) => b.exportedKwh)
                return {
                    chartNode: <Bar data={{ labels, datasets: [{ label: 'Energia oddana A- [kWh]', data, backgroundColor: green }] }} options={plainBar} />,
                    chartCaption: 'Energia oddana do sieci (rejestr A-).',
                    seriesForStats: data,
                    statsUnit: 'kWh',
                }
            }
            case 'Wykres autokonsumpcji': {
                const self = buckets.map((b) => b.selfConsumedKwh)
                const exported = buckets.map((b) => b.exportedKwh)
                return {
                    chartNode: <Bar data={{ labels, datasets: [
                        { label: 'Autokonsumpcja [kWh]', data: self, backgroundColor: accent },
                        { label: 'Oddano do sieci [kWh]', data: exported, backgroundColor: greenLight },
                    ] }} options={barOptions} />,
                    chartCaption: 'Podział produkcji na energię zużytą lokalnie i oddaną do sieci.',
                    seriesForStats: self,
                    statsUnit: 'kWh',
                }
            }
            case 'Wykres bilansu energetycznego': {
                const data = buckets.map((b) => b.exportedKwh - b.importedKwh)
                return {
                    chartNode: <Bar data={{ labels, datasets: [{
                        label: 'Bilans (oddano − pobrano) [kWh]',
                        data,
                        backgroundColor: data.map((value) => (value >= 0 ? green : accent)),
                    }] }} options={plainBar} />,
                    chartCaption: 'Dodatni bilans oznacza nadwyżkę energii oddanej nad pobraną.',
                    seriesForStats: data,
                    statsUnit: 'kWh',
                }
            }
            case 'Wykres mocy szczytowej': {
                const data = buckets.map((b) => b.maximumImportPowerKw)
                return {
                    chartNode: <Line data={{ labels, datasets: [{ label: 'Maks. moc poboru [kW]', data, borderColor: accent, backgroundColor: 'rgba(102,0,50,0.12)', fill: true, tension: 0.3, pointRadius: 1 }] }} options={lineOptions} />,
                    chartCaption: 'Maksymalna chwilowa moc poboru w każdym przedziale.',
                    seriesForStats: data,
                    statsUnit: 'kW',
                }
            }
            case 'Wykres strat przesyłowych': {
                const data = buckets.map((b) => b.lossKwh)
                return {
                    chartNode: <Bar data={{ labels, datasets: [{ label: 'Straty rezystancyjne I²R [kWh]', data, backgroundColor: red }] }} options={plainBar} />,
                    chartCaption: 'Straty mocy na przewodach wyliczone z mierzonego prądu (I²·R).',
                    seriesForStats: data,
                    statsUnit: 'kWh',
                }
            }
            case 'Wykres kosztów energii': {
                const data = buckets.map((b) => b.netCostPln)
                return {
                    chartNode: <Bar data={{ labels, datasets: [{ label: 'Koszt netto [zł]', data, backgroundColor: data.map((value) => (value >= 0 ? accent : green)) }] }} options={plainBar} />,
                    chartCaption: 'Koszt energii pobranej pomniejszony o wartość energii oddanej.',
                    seriesForStats: data,
                    statsUnit: 'zł',
                }
            }
            default: {
                const imported = buckets.map((b) => b.importedKwh)
                const exported = buckets.map((b) => b.exportedKwh)
                return {
                    chartNode: <Bar data={{ labels, datasets: [
                        { label: 'Pobrano A+ [kWh]', data: imported, backgroundColor: accent },
                        { label: 'Oddano A- [kWh]', data: exported, backgroundColor: green },
                    ] }} options={barOptions} />,
                    chartCaption: 'Energia pobrana i oddana w każdym przedziale.',
                    seriesForStats: energyType === 'export' ? exported : imported,
                    statsUnit: 'kWh',
                }
            }
        }
    }, [analytics, labels, selectedChart, energyType])

    const stats = useMemo(() => {
        if (seriesForStats.length === 0 || !analytics) return null
        const total = seriesForStats.reduce((sum, value) => sum + value, 0)
        const average = total / seriesForStats.length
        let maxIndex = 0
        let minIndex = 0
        seriesForStats.forEach((value, index) => {
            if (value > seriesForStats[maxIndex]) maxIndex = index
            if (value < seriesForStats[minIndex]) minIndex = index
        })
        const variability = average !== 0 ? (standardDeviation(seriesForStats) / Math.abs(average)) * 100 : 0
        const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' })
        return {
            total,
            average,
            max: seriesForStats[maxIndex],
            maxAt: analytics.buckets[maxIndex] ? dateFormatter.format(new Date(analytics.buckets[maxIndex].startUtc)) : '',
            min: seriesForStats[minIndex],
            minAt: analytics.buckets[minIndex] ? dateFormatter.format(new Date(analytics.buckets[minIndex].startUtc)) : '',
            variability,
        }
    }, [seriesForStats, analytics])

    const zoneSplit = ownTariffCost?.zones ?? []
    const zoneColors = [accent, green, amber, greenLight, red]
    const formatStat = (value: number) => (statsUnit === 'zł' ? pln.format(value) : `${kwh.format(value)} ${statsUnit}`)

    return (
        <Container fluid>
            <Breadcrumb className="mb-3"><Breadcrumb.Item active>Wykresy</Breadcrumb.Item></Breadcrumb>
            <Row className="align-items-center mb-4 g-3">
                <Col>
                    <h3 className="fw-semibold mb-0"><Fa.FaChartBar className="me-2 icon-accent" /> Wykresy</h3>
                    <div className="text-muted small mt-1">Wszystkie serie liczone po stronie serwera z rejestrów liczników.</div>
                </Col>
                <Col xs="auto">
                    <Form.Group className="d-flex align-items-center gap-2">
                        <Form.Label className="mb-0">Licznik:</Form.Label>
                        <Form.Select value={selectedMeter} onChange={(event) => setSelectedMeter(event.target.value)} style={{ minWidth: 260 }}>
                            {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name} ({meter.tariff})</option>)}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <ButtonGroup className="mb-3 flex-wrap">
                {chartTypes.map((name) => (
                    <Button key={name} variant={selectedChart === name ? 'primary' : 'outline-secondary'} onClick={() => setSelectedChart(name)}>
                        {name.replace('Wykres ', '')}
                    </Button>
                ))}
            </ButtonGroup>

            <div className="border rounded px-3 py-2 d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <ButtonGroup size="sm">
                    {(Object.keys(ranges) as RangeKey[]).map((key) => (
                        <Button key={key} variant={!useYearRange && range === key ? 'primary' : 'outline-secondary'} onClick={() => { setUseYearRange(false); setRange(key) }}>
                            {ranges[key].label}
                        </Button>
                    ))}
                </ButtonGroup>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                    <div className="d-flex align-items-center gap-1">
                        <span className="text-muted small">Rok</span>
                        <Form.Select size="sm" style={{ minWidth: 90 }} value={yearFrom} onChange={(event) => { setUseYearRange(true); setYearFrom(event.target.value) }}>
                            {years.map((year) => <option key={year} value={year}>{year}</option>)}
                        </Form.Select>
                        <span className="mx-1">→</span>
                        <Form.Select size="sm" style={{ minWidth: 90 }} value={yearTo} onChange={(event) => { setUseYearRange(true); setYearTo(event.target.value) }}>
                            {years.map((year) => <option key={year} value={year}>{year}</option>)}
                        </Form.Select>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted small">Energia</span>
                        <Form.Select size="sm" style={{ minWidth: 150 }} value={energyType} onChange={(event) => setEnergyType(event.target.value as 'import' | 'export')}>
                            <option value="import">Pobrana A+</option>
                            <option value="export">Oddana A-</option>
                        </Form.Select>
                    </div>
                </div>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {isLoading ? (
                <AnalyticsSkeleton />
            ) : !analytics || analytics.buckets.length === 0 ? (
                <Alert variant="info">Brak pomiarów w wybranym okresie.</Alert>
            ) : (
                <>
                    <Row className="g-4">
                        <Col lg={9}>
                            <Card className="h-100"><Card.Body className="d-flex flex-column">
                                <div className="text-uppercase small fw-bold mb-1">{selectedChart}</div>
                                <div className="text-muted small mb-2">{chartCaption}</div>
                                <div style={{ height: 520, minHeight: 150 }}>{chartNode}</div>
                            </Card.Body></Card>
                        </Col>
                        <Col lg={3}>
                            <Card className="h-100"><Card.Body className="d-flex flex-column">
                                <div className="text-uppercase small fw-bold mb-3">Statystyki</div>
                                {stats && (
                                    <div className="d-flex flex-column gap-3 flex-grow-1">
                                        <StatRow icon={<Fa.FaChartBar color={accent} />} label="Twoja średnia" value={formatStat(stats.average)} />
                                        <StatRow icon={<Fa.FaLayerGroup color={green} />} label="Liczba przedziałów" value={String(seriesForStats.length)} />
                                        <StatRow icon={<Fa.FaArrowUp color="#888" />} label="Maksimum" value={formatStat(stats.max)} sub={stats.maxAt} />
                                        <StatRow icon={<Fa.FaArrowDown color={greenLight} />} label="Minimum" value={formatStat(stats.min)} sub={stats.minAt} />
                                        <StatRow icon={<Fa.FaWaveSquare color="#17a2b8" />} label="Zmienność zużycia" value={`±${stats.variability.toFixed(1)}%`} />
                                    </div>
                                )}
                                <div className="mt-auto text-center border-top pt-3">
                                    <span className="fw-semibold">{statsUnit === 'kWh' ? 'Energia całkowita:' : 'Suma w okresie:'}</span>{' '}
                                    <span className="text-success fw-bold">{stats ? formatStat(stats.total) : '-'}</span>
                                </div>
                            </Card.Body></Card>
                        </Col>
                    </Row>

                    <Row className="g-4 mt-1">
                        <Col lg={9}>
                            <Card className="h-100"><Card.Body>
                                <div className="text-uppercase small fw-bold mb-2">Podział na strefy taryfowe</div>
                                {zoneSplit.length > 0 ? (
                                    <>
                                        <div className="d-flex justify-content-center gap-4 mb-2 flex-wrap">
                                            {zoneSplit.map((zone, index) => (
                                                <div key={zone.code} className="d-flex align-items-center gap-1">
                                                    <span style={{ width: 20, height: 10, backgroundColor: zoneColors[index % zoneColors.length], display: 'inline-block' }} />
                                                    <span className="small text-muted">{zone.name} ({kwh.format(zone.percentage)}%)</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="d-flex" style={{ height: 40, borderRadius: 6, overflow: 'hidden' }}>
                                            {zoneSplit.map((zone, index) => (
                                                <div key={zone.code} title={`${zone.name}: ${kwh.format(zone.energyKwh)} kWh`} style={{ width: `${zone.percentage}%`, background: zoneColors[index % zoneColors.length] }} />
                                            ))}
                                        </div>
                                        <div className="d-flex justify-content-between small text-muted mt-2">
                                            <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100%</span>
                                        </div>
                                    </>
                                ) : <div className="text-muted small">Brak danych o podziale na strefy.</div>}
                            </Card.Body></Card>
                        </Col>
                        <Col lg={3}>
                            <Card className="h-100"><Card.Body className="d-flex flex-column">
                                <div className="text-uppercase small fw-bold mb-2">Symulacja taryfy</div>
                                <Form.Select value={targetTariff} onChange={(event) => setTargetTariff(event.target.value as TariffCode | '')} className="mb-3">
                                    <option value="">Wybierz taryfę</option>
                                    <option value="G11">G11</option>
                                    <option value="G12">G12</option>
                                    <option value="G12W">G12W</option>
                                </Form.Select>
                                {ownTariffCost && (
                                    <div className="small text-muted mb-2">
                                        Obecny koszt netto ({ownTariffCost.sourceTariff}): <strong className="text-body">{pln.format(ownTariffCost.netCostPln)}</strong>
                                    </div>
                                )}
                                {tariffSimulation ? (
                                    <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between"><span className="text-muted">Koszt energii</span><strong>{pln.format(tariffSimulation.energyCostPln)}</strong></div>
                                        <div className="d-flex justify-content-between"><span className="text-muted">Wartość oddanej</span><strong className="text-success">−{pln.format(tariffSimulation.exportCompensationPln)}</strong></div>
                                        <div className="d-flex justify-content-between border-top pt-2 mt-2"><span className="fw-semibold">Koszt netto</span><strong style={{ color: accent }}>{pln.format(tariffSimulation.netCostPln)}</strong></div>
                                        {ownTariffCost && (
                                            <div className="mt-3 small" style={{ color: tariffSimulation.netCostPln <= ownTariffCost.netCostPln ? '#357951' : red }}>
                                                {tariffSimulation.netCostPln <= ownTariffCost.netCostPln
                                                    ? `Oszczędność ${pln.format(ownTariffCost.netCostPln - tariffSimulation.netCostPln)} względem obecnej taryfy.`
                                                    : `Droższe o ${pln.format(tariffSimulation.netCostPln - ownTariffCost.netCostPln)} względem obecnej taryfy.`}
                                            </div>
                                        )}
                                    </div>
                                ) : <div className="text-muted small">Wybierz taryfę, aby porównać koszty.</div>}
                            </Card.Body></Card>
                        </Col>
                    </Row>
                </>
            )}
        </Container>
    )
}

function StatRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
    return (
        <div className="d-flex align-items-center">
            <span className="me-3 fs-5">{icon}</span>
            <div>
                <div className="fw-semibold">{label}</div>
                <div className="fw-bold">{value}</div>
                {sub && <div className="text-muted small">{sub}</div>}
            </div>
        </div>
    )
}
