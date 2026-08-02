import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Alert, Container, Nav, Navbar, Image, NavDropdown } from 'react-bootstrap'
import * as Fa from 'react-icons/fa'
import { useAuth } from '../../auth'
import { NotificationsMenu } from './NotificationsMenu'
import { NotificationToasts } from './NotificationToasts'

const navItems = [
    { href: '/home', icon: Fa.FaHome, label: 'Strona główna' },
    { href: '/infrastructure/meter/list', icon: Fa.FaBolt, label: 'Liczniki' },
    { href: '/simulators', icon: Fa.FaCogs, label: 'Symulatory' },
    { href: '/charts', icon: Fa.FaChartBar, label: 'Wykresy' },
    { href: '/infrastructure/electricityGenerator', icon: Fa.FaSolarPanel, label: 'Wytwórca' },
    { href: '/infrastructure/pmax', icon: Fa.FaArrowUp, label: 'Moc szczytowa' },
    { href: '/readings/meterReadingsPage', icon: Fa.FaTachometerAlt, label: 'Wskazania' },
    { href: '/map', icon: Fa.FaMap, label: 'Mapa' },
]

export function Layout({ children }: { children: ReactNode }) {
    const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')
    const { logout, user } = useAuth()
    const [location, navigate] = useLocation()

    useEffect(() => {
        document.body.dataset.theme = dark ? 'dark' : 'light'
        localStorage.setItem('theme', dark ? 'dark' : 'light')
    }, [dark])

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', String(collapsed))
    }, [collapsed])

    useEffect(() => {
        setSidebarOpen(false)
    }, [location])

    const handleLogout = async () => {
        await logout()
        navigate('/login', { replace: true })
    }

    return (
        <div className={`app-shell min-vh-100${collapsed ? ' is-collapsed' : ''}`}>
            <aside id="main-sidebar" className={`sidebar d-flex flex-column p-3 ${sidebarOpen ? 'is-open' : ''}`}>
                <button
                    type="button"
                    className="sidebar-close"
                    aria-label="Zamknij menu"
                    onClick={() => setSidebarOpen(false)}
                >
                    <Fa.FaTimes />
                </button>

                <div className="text-center mb-4">
                    <Image src="/electricMeter.png" alt="Logo" className="logo mb-2" />
                    <h4 className="text-white brand-title">Twój licznik</h4>
                </div>

                <Nav className="flex-column">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}
                        >
                            <item.icon className="me-2" /> <span className="nav-label">{item.label}</span>
                        </Link>
                    ))}
                </Nav>
            </aside>

            {sidebarOpen && (
                <button
                    type="button"
                    className="sidebar-backdrop"
                    aria-label="Zamknij menu"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="app-content d-flex flex-column">
                <NotificationToasts />
                <Navbar className="top-navbar px-3">
                    <Container fluid className="justify-content-between px-0">
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="menu-toggle"
                                aria-label="Otwórz menu"
                                aria-controls="main-sidebar"
                                aria-expanded={sidebarOpen}
                                onClick={() => setSidebarOpen(true)}
                            >
                                <Fa.FaBars />
                            </button>
                            <button
                                type="button"
                                className="collapse-toggle"
                                aria-label={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
                                aria-pressed={collapsed}
                                onClick={() => setCollapsed((current) => !current)}
                            >
                                {collapsed ? <Fa.FaAngleDoubleRight /> : <Fa.FaAngleDoubleLeft />}
                            </button>
                            <span className="mobile-brand">Twój licznik</span>
                        </div>

                        <Nav className="d-flex align-items-center flex-row">
                            <NotificationsMenu />
                            <Nav.Link
                                as="button"
                                type="button"
                                onClick={() => setDark((current) => !current)}
                                className="top-nav-action px-3 py-2"
                                aria-label={dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
                            >
                                {dark ? <Fa.FaSun className="me-2" /> : <Fa.FaMoon className="me-2" />}
                                <span className="top-nav-label">Motyw</span>
                            </Nav.Link>
                            <Link
                                href="/help"
                                className="top-nav-action px-3 py-2"
                                aria-label="Pomoc i FAQ"
                            >
                                <Fa.FaQuestionCircle className="me-2" />
                                <span className="top-nav-label">FAQ</span>
                            </Link>
                            <NavDropdown
                                title={<span><Fa.FaUserCircle className="me-2" /><span className="top-nav-label">{user?.username ?? 'Użytkownik'}</span></span>}
                                align="end"
                                className="user-menu"
                                aria-label="Menu użytkownika"
                            >
                                {!user?.isReadOnly && (
                                    <>
                                        <NavDropdown.Item onClick={() => navigate('/account')}>
                                            <Fa.FaCog className="me-2" /> Ustawienia konta
                                        </NavDropdown.Item>
                                        <NavDropdown.Divider />
                                    </>
                                )}
                                <NavDropdown.Item onClick={() => void handleLogout()} className="text-danger">
                                    <Fa.FaSignOutAlt className="me-2" /> Wyloguj się
                                </NavDropdown.Item>
                            </NavDropdown>
                        </Nav>
                    </Container>
                </Navbar>

                <Container fluid className="page-content px-4 pt-3">
                    {user?.isReadOnly && (
                        <Alert variant="info" className="mb-3">
                            Konto demonstracyjne działa tylko w trybie odczytu.
                        </Alert>
                    )}
                    {children}
                </Container>

                <footer className="mt-auto py-3">
                    <div className="d-flex justify-content-center align-items-center gap-3 mb-2">
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="p-2" aria-label="Facebook">
                            <Fa.FaFacebook size={20} />
                        </a>
                        <a href="https://github.com/JJFilipek" target="_blank" rel="noopener noreferrer" className="p-2" aria-label="GitHub">
                            <Fa.FaGithub size={20} />
                        </a>
                        <a href="https://www.linkedin.com/in/jakub-filipek-check-it/" target="_blank" rel="noopener noreferrer" className="p-2" aria-label="LinkedIn">
                            <Fa.FaLinkedin size={20} />
                        </a>
                    </div>
                    <small>&copy; {new Date().getFullYear()} Twój licznik – wszystkie prawa zastrzeżone</small>
                </footer>
            </div>
        </div>
    )
}
