import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Alert, Container, Nav, Navbar, Image, NavDropdown } from 'react-bootstrap'
import * as Fa from 'react-icons/fa'
import { useAuth } from '../../auth'

export function Layout({ children }: { children: ReactNode }) {
    const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { logout, user } = useAuth()
    const [location, navigate] = useLocation()

    useEffect(() => {
        document.body.dataset.theme = dark ? 'dark' : 'light'
        localStorage.setItem('theme', dark ? 'dark' : 'light')
    }, [dark])

    useEffect(() => {
        setSidebarOpen(false)
    }, [location])

    const handleLogout = async () => {
        await logout()
        navigate('/login', { replace: true })
    }

    return (
        <div className="app-shell min-vh-100">
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
                    <h4 className="text-white">Twój licznik</h4>
                </div>

                <Nav className="flex-column">
                    <Link href="/home" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaHome className="me-2" /> Strona główna
                    </Link>
                    <Link href="/infrastructure/meter/list" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaBolt className="me-2" /> Liczniki
                    </Link>
                    <Link href="/simulators" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaCogs className="me-2" /> Symulatory
                    </Link>
                    <Link href="/charts" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaChartBar className="me-2" /> Wykresy
                    </Link>
                    <Link href="/infrastructure/electricityGenerator" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaSolarPanel className="me-2" /> Wytwórca
                    </Link>
                    <Link href="/infrastructure/pmax" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaArrowUp className="me-2" /> Moc szczytowa
                    </Link>
                    <Link href="/readings/meterReadingsPage" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaTachometerAlt className="me-2" /> Wskazania
                    </Link>
                    <Link href="/map" className={(active) => `nav-link navbar-item px-3 py-2 mb-2${active ? ' active' : ''}`}>
                        <Fa.FaMap className="me-2" /> Mapa
                    </Link>
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
                            <span className="mobile-brand">Twój licznik</span>
                        </div>

                        <Nav className="d-flex align-items-center flex-row">
                            <Nav.Link
                                as="button"
                                type="button"
                                className="top-nav-action px-3 py-2"
                                aria-label="Powiadomienia"
                            >
                                <Fa.FaBell className="me-2" />
                                <span className="top-nav-label">Powiadomienia</span>
                            </Nav.Link>
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
                                aria-label="FAQ"
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
