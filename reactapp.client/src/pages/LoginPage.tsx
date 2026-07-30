import { Alert, Card, Col, Container, Row } from 'react-bootstrap'
import { useState } from 'react'
import { useLocation } from 'wouter'
import { FaSignInAlt } from 'react-icons/fa'
import { type FormikHelpers } from 'formik'
import { useAuth } from '../auth'
import { LoginForm, type LoginValues } from '../components/auth/LoginForm'

const demoCredentials: LoginValues = {
  username: 'demo',
  password: 'LicznikDemo2026!',
}

export function LoginPage() {
  const [, navigate] = useLocation()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (
    values: LoginValues,
    { setSubmitting }: FormikHelpers<LoginValues>,
  ) => {
    setError(null)
    try {
      await login(values.username, values.password)
      navigate('/home', { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error
        ? loginError.message
        : 'Nie udało się zalogować.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <Row className="justify-content-center w-100">
        <Col md={8} lg={6} xl={5}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h3>
                  <FaSignInAlt className="me-2" />
                  Logowanie
                </h3>
                <p className="text-muted mb-0">Zaloguj się kontem zarządzanym przez backend.</p>
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              <Alert variant="info">
                <div className="fw-semibold mb-2">Konto testowe tylko do odczytu</div>
                <div>Login: <code>{demoCredentials.username}</code></div>
                <div>Hasło: <code>{demoCredentials.password}</code></div>
              </Alert>
              <LoginForm
                onSubmit={handleLogin}
                initialValues={demoCredentials}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
