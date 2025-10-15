import { useEffect, useState } from "react"
import { Button } from "react-bootstrap"
import "./ColumnViewBar.css"

export function ColumnViewBar({
    groups,
    onAdd,
    active,
    onSetActive,
    onEdit
}: {
    groups: string[]
    onAdd: () => void
    active: string
    onSetActive: (g: string) => void
    onEdit: (g: string) => void
}) {
    const [offset, setOffset] = useState(0)

    useEffect(() => {
        const handler = () => {
            const footer = document.querySelector("footer")
            if (!footer) return
            const diff = window.innerHeight - footer.getBoundingClientRect().top
            setOffset(diff > 0 ? diff : 0)
        }
        window.addEventListener("scroll", handler)
        handler()
        return () => window.removeEventListener("scroll", handler)
    }, [])

    return (
        <div className="group-bar" style={{ bottom: offset }}>
            <div className="group-bar-content">
                {groups.map(g => (
                    <span key={g} className={`group-badge ${g === active ? "active" : ""}`}>
                        <span onClick={() => onSetActive(g)}>{g}</span>
                        {g === active && (
                            <span className="dots" onClick={() => onEdit(g)}>⋮</span>
                        )}
                    </span>
                ))}
                <Button variant="outline-light" size="sm" onClick={onAdd}>+</Button>
            </div>
        </div>
    )
}
