import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Alert, Form as BootstrapForm } from 'react-bootstrap';
import * as Yup from 'yup';
import { FaUser, FaEnvelope, FaLock, FaArrowRight, FaUserPlus } from 'react-icons/fa';
import { emailValidation, passwordValidation, usernameValidation } from '../../validations/schemas';

const RegisterSchema = Yup.object().shape({
  username: usernameValidation,
  email: emailValidation,
  password: passwordValidation,
    confirmPassword: Yup.string()
        .oneOf([Yup.ref('password'), undefined], 'Hasła muszą być identyczne')
        .required('Potwierdzenie hasła jest wymagane'),
    acceptTerms: Yup.bool()
    .oneOf([true], 'Musisz zaakceptować regulamin')
});

type RegisterFormProps = {
    onSuccess: () => void;
    onSwitchToLogin: () => void;
};

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
    const handleSubmit = async (_values: any, { setSubmitting, resetForm }: any) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            onSuccess();
            resetForm();
        } catch (error) {
            console.error("Błąd rejestracji:", error);
        } finally {
            setSubmitting(false);
        }
    };

  return (
    <Formik
      initialValues={{
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        acceptTerms: false
      }}
      validationSchema={RegisterSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, status }) => (
        <Form noValidate>
          {status?.type === 'success' && (
            <Alert variant="success" className="mb-4">
              {status.message}
              {onSwitchToLogin && (
                <div className="mt-2">
                  <Button variant="link" onClick={onSwitchToLogin} className="p-0">
                    Przejdź do logowania <FaArrowRight className="ms-1" />
                  </Button>
                </div>
              )}
            </Alert>
          )}
          
          {status?.type === 'error' && (
            <Alert variant="danger" className="mb-4">
              {status.message}
            </Alert>
          )}

          <BootstrapForm.Group className="mb-3">
            <BootstrapForm.Label>
              <FaUser className="me-2" /> Nazwa użytkownika
            </BootstrapForm.Label>
            <Field 
              name="username" 
              type="text" 
              className="form-control" 
              placeholder="Wprowadź nazwę użytkownika" 
            />
            <ErrorMessage name="username" component="div" className="text-danger small mt-1" />
          </BootstrapForm.Group>

          <BootstrapForm.Group className="mb-3">
            <BootstrapForm.Label>
              <FaEnvelope className="me-2" /> Adres email
            </BootstrapForm.Label>
            <Field 
              name="email" 
              type="email" 
              className="form-control" 
              placeholder="Wprowadź adres email" 
            />
            <ErrorMessage name="email" component="div" className="text-danger small mt-1" />
          </BootstrapForm.Group>

          <BootstrapForm.Group className="mb-3">
            <BootstrapForm.Label>
              <FaLock className="me-2" /> Hasło
            </BootstrapForm.Label>
            <Field 
              name="password" 
              type="password" 
              className="form-control" 
              placeholder="Wprowadź hasło" 
            />
            <ErrorMessage name="password" component="div" className="text-danger small mt-1" />
          </BootstrapForm.Group>

          <BootstrapForm.Group className="mb-3">
            <BootstrapForm.Label>
              <FaLock className="me-2" /> Potwierdź hasło
            </BootstrapForm.Label>
            <Field 
              name="confirmPassword" 
              type="password" 
              className="form-control" 
              placeholder="Potwierdź hasło" 
            />
            <ErrorMessage name="confirmPassword" component="div" className="text-danger small mt-1" />
          </BootstrapForm.Group>

          <BootstrapForm.Group className="mb-4">
            <div className="form-check">
              <Field 
                name="acceptTerms" 
                type="checkbox" 
                className="form-check-input" 
                id="acceptTerms"
              />
              <BootstrapForm.Label className="form-check-label small ms-2" htmlFor="acceptTerms">
                Akceptuję <a href="/regulamin" target="_blank" rel="noopener noreferrer">regulamin</a> serwisu
              </BootstrapForm.Label>
            </div>
            <ErrorMessage name="acceptTerms" component="div" className="text-danger small mt-1" />
          </BootstrapForm.Group>

          <div className="d-grid">
            <Button 
              type="submit" 
              variant="primary" 
              disabled={isSubmitting}
              className="mb-3"
            >
              {isSubmitting ? 'Rejestrowanie...' : (
                <>
                  <FaUserPlus className="me-2" /> Zarejestruj się
                </>
              )}
            </Button>
          </div>

          {onSwitchToLogin && (
            <div className="text-center">
              <small className="text-muted">
                Masz już konto?{' '}
                <Button variant="link" onClick={onSwitchToLogin} className="p-0 align-baseline">
                  Zaloguj się
                </Button>
              </small>
            </div>
          )}
        </Form>
      )}
    </Formik>
  );
}
