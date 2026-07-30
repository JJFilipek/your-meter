import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Container, Nav, Navbar, Image, NavDropdown } from 'react-bootstrap'
import * as Fa from 'react-icons/fa'
import { useAuth } from '../../auth'

export function Layout() {
    const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { logout, user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        document.body.dataset.theme = dark ? 'dark' : 'light'
        localStorage.setItem('theme', dark ? 'dark' : 'light')
    }, [dark])

    useEffect(() => {
        setSidebarOpen(false)
    }, [location.pathname])

    const handleLogout = () => {
        logout()
        navigate('/login')
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
                    <Nav.Link as={NavLink} to="/home" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaHome className="me-2" /> Strona główna
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/infrastructure/meter/list" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaBolt className="me-2" /> Liczniki
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/simulators" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaCogs className="me-2" /> Symulatory
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/charts" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaChartBar className="me-2" /> Wykresy
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/infrastructure/electricityGenerator" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaSolarPanel className="me-2" /> Wytwórca
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/infrastructure/pmax" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaArrowUp className="me-2" /> Moc szczytowa
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/readings/meterReadingsPage" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaTachometerAlt className="me-2" /> Wskazania
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/map" className="navbar-item px-3 py-2 mb-2">
                        <Fa.FaMap className="me-2" /> Mapa
                    </Nav.Link>
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
                            <Nav.Link
                                as={NavLink}
                                to="/help"
                                className="top-nav-action px-3 py-2"
                                aria-label="FAQ"
                            >
                                <Fa.FaQuestionCircle className="me-2" />
                                <span className="top-nav-label">FAQ</span>
                            </Nav.Link>
                            <NavDropdown
                                title={<span><Fa.FaUserCircle className="me-2" /><span className="top-nav-label">{user?.username ?? 'Użytkownik'}</span></span>}
                                align="end"
                                className="user-menu"
                                aria-label="Menu użytkownika"
                            >
                                <NavDropdown.Item as={NavLink} to="/account">
                                    <Fa.FaCog className="me-2" /> Ustawienia konta
                                </NavDropdown.Item>
                                <NavDropdown.Divider />
                                <NavDropdown.Item onClick={handleLogout} className="text-danger">
                                    <Fa.FaSignOutAlt className="me-2" /> Wyloguj się
                                </NavDropdown.Item>
                            </NavDropdown>
                        </Nav>
                    </Container>
                </Navbar>

                <Container fluid className="page-content px-4 pt-3">
                    <Outlet />
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
