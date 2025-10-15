import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Alert } from 'react-bootstrap';
import * as Yup from 'yup';
import { FaUser, FaLock } from 'react-icons/fa';
import { usernameValidation } from '../../validations/schemas';

const LoginSchema = Yup.object().shape({
  username: usernameValidation,
  password: Yup.string()
    .required('Hasło jest wymagane')
    .min(6, 'Hasło musi mieć przynajmniej 6 znaków'),
});

interface LoginFormProps {
  onSubmit: (values: any, actions: any) => void;
  onForgotPassword: () => void;
  onRegister: () => void;
}

export function LoginForm({ onSubmit, onForgotPassword, onRegister }: LoginFormProps) {
  return (
    <Formik
      initialValues={{ username: '', password: '' }}
      validationSchema={LoginSchema}
      onSubmit={onSubmit}
    >
      {({ isSubmitting, status }) => (
        <Form noValidate>
          {status?.type === 'success' && (
            <Alert variant="success" className="mb-4">
              {status.message}
            </Alert>
          )}
          
          {status?.type === 'error' && (
            <Alert variant="danger" className="mb-4">
              {status.message}
            </Alert>
          )}
          
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
            <div className="d-flex justify-content-between align-items-center">
              <label htmlFor="password" className="form-label">
                <FaLock className="me-2" /> Hasło
              </label>
              <Button 
                variant="link" 
                className="p-0 text-decoration-none small"
                onClick={onForgotPassword}
              >
                Zapomniałeś hasła?
              </Button>
            </div>
            <Field
              type="password"
              name="password"
              id="password"
              className="form-control"
              placeholder="Wprowadź hasło"
            />
            <ErrorMessage name="password" component="div" className="text-danger small mt-1" />
          </div>
          
          <div className="d-grid">
            <Button 
              type="submit" 
              variant="primary" 
              disabled={isSubmitting}
              className="mb-3"
            >
              {isSubmitting ? 'Logowanie...' : 'Zaloguj się'}
            </Button>
          </div>
          
          <div className="text-center">
            <small className="text-muted">
              Nie masz jeszcze konta?{' '}
              <Button 
                variant="link" 
                onClick={onRegister} 
                className="p-0 align-baseline text-decoration-none"
              >
                Zarejestruj się
              </Button>
            </small>
          </div>

        </Form>
      )}
    </Formik>
  );
}
