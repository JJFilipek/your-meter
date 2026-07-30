import { Formik, Form, Field, ErrorMessage, type FormikHelpers } from 'formik';
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

export type LoginValues = {
  username: string;
  password: string;
};

interface LoginFormProps {
  onSubmit: (values: LoginValues, actions: FormikHelpers<LoginValues>) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
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
            <label htmlFor="password" className="form-label">
              <FaLock className="me-2" /> Hasło
            </label>
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
        </Form>
      )}
    </Formik>
  );
}
