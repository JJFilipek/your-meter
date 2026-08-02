const plNumber = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type TooltipLike = {
    dataset: { label?: string }
    parsed: { y?: number | null }
}

// Formats tooltip values in the Polish locale. The unit already lives in each dataset label
// (e.g. "Pobrano A+ [kWh]"), so we only need to localise the number itself.
export function plTooltipLabel(item: TooltipLike): string {
    const label = item.dataset.label ?? ''
    const value = item.parsed.y
    const formatted = typeof value === 'number' ? plNumber.format(value) : '—'
    return label ? `${label}: ${formatted}` : formatted
}

export const plTooltip = { callbacks: { label: plTooltipLabel } }
