import { useState } from 'react';
import { Container, Row, Col, Card, Tab, Alert } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSignInAlt, FaUserPlus, FaKey } from 'react-icons/fa';
import { useAuth } from '../auth';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const from = location.state?.from?.pathname || '/Your-Meter';
  const [activeTab, setActiveTab] = useState('login');
  const [loginStatus, setLoginStatus] = useState<{type?: string, message?: string}>({});

  const handleLogin = (values: any, { setSubmitting}: any) => {
    setTimeout(() => {
      console.log('Login attempt with:', values);
      
      login();
      setLoginStatus({ type: 'success', message: 'Zalogowano pomyślnie!' });
      setSubmitting(false);
      
      setTimeout(() => navigate(from, { replace: true }), 1000);
    }, 1000);
  };

  const handleRegisterSuccess = () => {
    setActiveTab('login');
    setLoginStatus({
      type: 'success',
      message: 'Konto zostało utworzone! Możesz się teraz zalogować.'
    });
  };


  const handleForgotPasswordSuccess = () => {
    setActiveTab('login');
    setLoginStatus({
      type: 'success',
      message: 'Instrukcje resetowania hasła zostały wysłane na podany adres email.'
    });
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <Row className="justify-content-center w-100">
        <Col md={8} lg={6} xl={5}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <Tab.Container activeKey={activeTab} defaultActiveKey="login">
                <div className="text-center mb-4">
                  <h3 className="mb-3">
                    {activeTab === 'login' && <><FaSignInAlt className="me-2" /> Logowanie</>}
                    {activeTab === 'register' && <><FaUserPlus className="me-2" /> Rejestracja</>}
                    {activeTab === 'forgot' && <><FaKey className="me-2" /> Odzyskiwanie hasła</>}
                  </h3>
                </div>

                <Tab.Content>
                  <Tab.Pane eventKey="login">
                    {loginStatus.type === 'success' && (
                      <Alert variant="success" className="mb-4">
                        {loginStatus.message}
                      </Alert>
                    )}
                    <LoginForm 
                      onSubmit={handleLogin} 
                      onForgotPassword={() => setActiveTab('forgot')}
                      onRegister={() => setActiveTab('register')}
                    />
                  </Tab.Pane>
                  
                  <Tab.Pane eventKey="register">

                    <RegisterForm
                      onSuccess={handleRegisterSuccess}
                      onSwitchToLogin={() => setActiveTab('login')}
                    />
                  </Tab.Pane>
                  
                  <Tab.Pane eventKey="forgot">
                    <ForgotPasswordForm 
                      onSuccess={handleForgotPasswordSuccess}
                      onBackToLogin={() => setActiveTab('login')}
                    />
                  </Tab.Pane>
                </Tab.Content>
              </Tab.Container>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
