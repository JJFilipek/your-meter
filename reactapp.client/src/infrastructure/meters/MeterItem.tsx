import { Meter } from '../../types/infrastructure/meter'

type MeterProps = {
    meter: Meter
}

export const MeterItem = ({ meter }: MeterProps) => (
    <tr>
        <td>{meter.serialNo}</td>
        <td>{meter.name}</td>
        <td>{meter.model}</td>
        <td>{meter.firmware}</td>
        <td>{meter.profile}</td>
    </tr>
)
