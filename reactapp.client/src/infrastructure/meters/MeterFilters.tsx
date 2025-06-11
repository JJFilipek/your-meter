import { useState } from 'react'
import { Form, Button } from 'react-bootstrap'
import './MeterFilters.css'

type Header = {
    key: string
    label: string
}

type Props = {
    headers: Header[]
    onChange: (filters: Record<string, string>) => void
}

export function MeterFilters({ headers, onChange }: Props) {
    const [available, setAvailable] = useState<string[]>(headers.map(h => h.key))
    const [filters, setFilters] = useState<Record<string, string>>({})

    const handleRemove = (key: string) => {
        setAvailable(prev => [...prev, key])
        setFilters(prev => {
            const copy = { ...prev }
            delete copy[key]
            return copy
        })
    }

    const handleChange = (key: string, value: string) => {
        setFilters(prev => {
            const updated = { ...prev, [key]: value }
            onChange(updated)
            return updated
        })
    }

    const handleAdd = (key: string) => {
        if (!key) return
        setFilters(prev => ({ ...prev, [key]: '' }))
        setAvailable(prev => prev.filter(k => k !== key))
    }

    return (
        <div className="filter-bar">
            <div className="filter-chip d-flex align-items-center gap-2">
                <span className="filter-label">Dodaj filtr</span>
                <Form.Select
                    value=""
                    onChange={(e) => handleAdd(e.target.value)}
                >
                    <option value="">Wybierz...</option>
                    {available.map(key => (
                        <option key={key} value={key}>
                            {headers.find(h => h.key === key)?.label}
                        </option>
                    ))}
                </Form.Select>
            </div>

            {Object.entries(filters).map(([key, value]) => (
                <div key={key} className="filter-chip d-flex align-items-center gap-2 filter-row">
                    <span className="filter-label">{headers.find(h => h.key === key)?.label}</span>
                    <Form.Control
                        type="text"
                        value={value}
                        onChange={e => handleChange(key, e.target.value)}
                        placeholder="Wpisz wartość"
                    />
                    <Button variant="outline-danger" onClick={() => handleRemove(key)}>
                        &times;
                    </Button>
                </div>
            ))}
        </div>
    )
}
