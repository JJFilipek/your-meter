import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Container, Nav, Navbar, Image, NavDropdown } from 'react-bootstrap'
import * as Fa from "react-icons/fa"
import { useAuth } from '../../auth'


export function Layout() {
    const [dark, setDark] = useState(false)
    const {logout } = useAuth()
    const navigate = useNavigate()

    const toggleTheme = () => {
        document.body.dataset.theme = dark ? 'light' : 'dark'
        setDark(!dark)
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div className="d-flex flex-column min-vh-100">
            <div className="d-flex flex-grow-1">
                <div className="sidebar d-flex flex-column p-3">
                    <div className="text-center mb-4">
                        <Image src="/Your-Meter/electricMeter.png" alt="Logo" className="logo mb-2" />
                        <h4 className="text-white">Twój licznik</h4>
                    </div>
                    <Nav className="flex-column">
                        <Nav.Link as={NavLink} to="/Your-Meter" className="navbar-item px-3 py-2 mb-2">
                            <Fa.FaHome className="me-2" /> Strona główna
                        </Nav.Link>
                        <Nav.Link as={NavLink} to="/infrastructure/meter/list" className="navbar-item px-3 py-2 mb-2">
                            <Fa.FaBolt className="me-2" /> Liczniki
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
                </div>

                <div className="flex-grow-1 d-flex flex-column">
                    <Navbar className="top-navbar px-3">
                        <Container fluid className="justify-content-end">
                            <Nav className="d-flex align-items-center">
                                <Nav.Link href="#" className="px-3 py-2 me-2">
                                    <Fa.FaBell className="me-2" /> Powiadomienia
                                </Nav.Link>
                                <Nav.Link href="#" className="px-3 py-2 me-2">
                                    <Fa.FaCog className="me-2" /> Ustawienia
                                </Nav.Link>
                                <Nav.Link onClick={toggleTheme} className="px-3 py-2 me-2">
                                    {dark ? <Fa.FaSun className="me-2" /> : <Fa.FaMoon className="me-2" />} Motyw
                                </Nav.Link>
                                <Nav.Link as={NavLink} to="/help" className="px-3 py-2 me-2">
                                    <Fa.FaQuestionCircle className="me-2" /> FAQ
                                </Nav.Link>
                                <NavDropdown
                                    title={<span className="px-3 py-2"><Fa.FaUserCircle className="me-2" />Jakub Filipek</span>}
                                    align="end"
                                    className="me-2"
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

                    <Container fluid className="px-4 pt-2">



                        <Outlet />
                    </Container>

                    <footer className="mt-auto py-3">
                        <div className="d-flex justify-content-center align-items-center gap-3 mb-2">
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="p-2">
                                <Fa.FaFacebook size={20} />
                            </a>
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2">
                                <Fa.FaInstagram size={20} />
                            </a>
                            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="p-2">
                                <Fa.FaTiktok size={20} />
                            </a>
                        </div>
                        <small>&copy; 2025 Twój licznik – wszystkie prawa zastrzeżone</small>
                    </footer>
                </div>
            </div>
        </div>
    )
}
