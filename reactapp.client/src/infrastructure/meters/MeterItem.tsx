import { Meter } from '../../types/infrastructure/meter'

type MeterProps = {
    meter: Meter
    statusColors: Record<string, string>
}

export const MeterItem = ({ meter, statusColors }: MeterProps) => (
    <tr>
        <td>{meter.serialNo}</td>
        <td>{meter.name}</td>
        <td>{meter.model}</td>
        <td>{meter.firmware}</td>
        <td>{meter.tariff}</td>
        <td>{meter.profile}</td>
        <td>
            <span 
                className="status-badge"
                style={{ background: statusColors[meter.status] ?? '#ccc' }}
            >
                {meter.status}
            </span>
        </td>
    </tr>
)
