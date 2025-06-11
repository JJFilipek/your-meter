import { useState } from 'react';
import { Card, Form, Button, Alert, Tab, Tabs } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaLock, FaKey } from 'react-icons/fa';
import { Formik, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../auth';
import { usernameValidation, emailValidation, passwordValidation } from '../validations/schemas';

const ProfileSchema = Yup.object().shape({
  username: usernameValidation,
  email: emailValidation,
});

const PasswordSchema = Yup.object().shape({
  currentPassword: Yup.string().required('Aktualne hasło jest wymagane'),
  newPassword: passwordValidation,
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), undefined], 'Hasła muszą być identyczne')
    .required('Potwierdzenie hasła jest wymagane'),
});

export function AccountSettingsPage() {
  const { user, updateUser } = useAuth();
  const [message, setMessage] = useState<{type: 'success' | 'danger', text: string} | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  const handleProfileSubmit = async (values: any, { setSubmitting, resetForm }: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateUser(values);
      setMessage({ type: 'success', text: 'Dane zostały zaktualizowane!' });
      resetForm({ values });
    } catch (error) {
      setMessage({ type: 'danger', text: 'Wystąpił błąd podczas aktualizacji danych.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (_values: any, { setSubmitting, resetForm }: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage({ type: 'success', text: 'Hasło zostało zmienione!' });
      resetForm();
    } catch (error) {
      setMessage({ type: 'danger', text: 'Wystąpił błąd podczas zmiany hasła.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <Card>
            <Card.Header as="h5" className="bg-light">
              Ustawienia konta
            </Card.Header>
            <Card.Body>
              {message && (
                <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
                  {message.text}
                </Alert>
              )}

              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k || 'profile')}
                className="mb-4"
              >
                <Tab eventKey="profile" title="Profil">
                  <Formik
                    initialValues={{
                      username: user?.username || '',
                      email: user?.email || ''
                    }}
                    validationSchema={ProfileSchema}
                    onSubmit={handleProfileSubmit}
                    enableReinitialize
                  >
                    {({ isSubmitting, dirty }) => (
                      <Form className="mt-3">
                        <div className="mb-3">
                          <label htmlFor="username" className="form-label">
                            <FaUser className="me-2" /> Nazwa użytkownika
                          </label>
                          <Field
                            type="text"
                            name="username"
                            id="username"
                            className="form-control"
                            placeholder="Wprowadź nazwę użytkownika"
                          />
                          <ErrorMessage name="username" component="div" className="text-danger small mt-1" />
                        </div>

                        <div className="mb-3">
                          <label htmlFor="email" className="form-label">
                            <FaEnvelope className="me-2" /> Adres email
                          </label>
                          <Field
                            type="email"
                            name="email"
                            id="email"
                            className="form-control"
                            placeholder="Wprowadź adres email"
                          />
                          <ErrorMessage name="email" component="div" className="text-danger small mt-1" />
                        </div>

                        <div className="d-flex justify-content-end">
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting || !dirty}
                          >
                            {isSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
                          </Button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                </Tab>

                <Tab eventKey="password" title="Zmień hasło">
                  <Formik
                    initialValues={{
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    }}
                    validationSchema={PasswordSchema}
                    onSubmit={handlePasswordSubmit}
                  >
                    {({ isSubmitting }) => (
                      <Form className="mt-3">
                        <div className="mb-3">
                          <label htmlFor="currentPassword" className="form-label">
                            <FaLock className="me-2" /> Aktualne hasło
                          </label>
                          <Field
                            type="password"
                            name="currentPassword"
                            id="currentPassword"
                            className="form-control"
                            placeholder="Wprowadź aktualne hasło"
                          />
                          <ErrorMessage name="currentPassword" component="div" className="text-danger small mt-1" />
                        </div>

                        <div className="mb-3">
                          <label htmlFor="newPassword" className="form-label">
                            <FaKey className="me-2" /> Nowe hasło
                          </label>
                          <Field
                            type="password"
                            name="newPassword"
                            id="newPassword"
                            className="form-control"
                            placeholder="Wprowadź nowe hasło"
                          />
                          <div className="form-text small">
                            Hasło musi zawierać co najmniej 8 znaków, w tym wielką literę, małą literę i cyfrę.
                          </div>
                          <ErrorMessage name="newPassword" component="div" className="text-danger small mt-1" />
                        </div>

                        <div className="mb-3">
                          <label htmlFor="confirmPassword" className="form-label">
                            <FaKey className="me-2" /> Powtórz nowe hasło
                          </label>
                          <Field
                            type="password"
                            name="confirmPassword"
                            id="confirmPassword"
                            className="form-control"
                            placeholder="Powtórz nowe hasło"
                          />
                          <ErrorMessage name="confirmPassword" component="div" className="text-danger small mt-1" />
                        </div>

                        <div className="d-flex justify-content-end">
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Zapisywanie...' : 'Zmień hasło'}
                          </Button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
