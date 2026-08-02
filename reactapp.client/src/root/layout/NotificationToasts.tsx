import { useEffect } from 'react'
import { Toast, ToastContainer } from 'react-bootstrap'
import * as Fa from 'react-icons/fa'
import { useNotifications } from '../app-context'
import { alertTypeLabels } from '../notifications'

// Surfaces alerts that appeared since the last background refresh as transient toasts.
export function NotificationToasts() {
    const { newAlerts, clearNew } = useNotifications()

    useEffect(() => {
        if (newAlerts.length === 0) return
        const timer = window.setTimeout(clearNew, 8000)
        return () => window.clearTimeout(timer)
    }, [newAlerts, clearNew])

    if (newAlerts.length === 0) return null

    return (
        <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1080, position: 'fixed' }}>
            {newAlerts.map((alert) => (
                <Toast key={alert.id} onClose={clearNew} bg={alert.severity === 'danger' ? 'danger' : 'warning'}>
                    <Toast.Header closeButton>
                        <Fa.FaBell className="me-2" />
                        <strong className="me-auto">{alert.meterName}</strong>
                        <small>{alertTypeLabels[alert.type]}</small>
                    </Toast.Header>
                    <Toast.Body className={alert.severity === 'danger' ? 'text-white' : ''}>{alert.message}</Toast.Body>
                </Toast>
            ))}
        </ToastContainer>
    )
}
