import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Alert, Form as BootstrapForm } from 'react-bootstrap';
import * as Yup from 'yup';
import { FaEnvelope, FaArrowLeft } from 'react-icons/fa';
import { emailValidation } from '../../validations/schemas';

const ForgotPasswordSchema = Yup.object().shape({
  email: emailValidation
});

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onBackToLogin?: () => void;
}

export function ForgotPasswordForm({ onSuccess, onBackToLogin }: ForgotPasswordFormProps) {
  const handleSubmit = async (values: any, { setSubmitting, setStatus }: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStatus({ type: 'success', message: `Instrukcje resetowania hasła zostały wysłane na adres ${values.email}. Sprawdź swoją skrzynkę pocztową.` });
      if (onSuccess) onSuccess();
    } catch (error) {
      setStatus({ type: 'error', message: 'Wystąpił błąd podczas wysyłania instrukcji resetowania hasła. Spróbuj ponownie.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{
        email: ''
      }}
      validationSchema={ForgotPasswordSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, status }) => (
        <div>
          <div className="mb-4">
            <h5>Odzyskiwanie hasła</h5>
            <p className="text-muted small">
              Wprowadź adres email powiązany z Twoim kontem, a wyślemy Ci instrukcje resetowania hasła.
            </p>
          </div>

          <Form noValidate>
            {status?.type === 'success' && (
              <Alert variant="success" className="mb-4">
                {status.message}
                {onBackToLogin && (
                  <div className="mt-2">
                    <Button variant="link" onClick={onBackToLogin} className="p-0">
                      <FaArrowLeft className="me-1" /> Powrót do logowania
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

            <BootstrapForm.Group className="mb-4">
              <BootstrapForm.Label>
                <FaEnvelope className="me-2" /> Adres email
              </BootstrapForm.Label>
              <Field 
                name="email" 
                type="email" 
                className="form-control" 
                placeholder="Wprowadź swój adres email" 
              />
              <ErrorMessage name="email" component="div" className="text-danger small mt-1" />
            </BootstrapForm.Group>

            <div className="d-grid">
              <Button 
                type="submit" 
                variant="primary" 
                disabled={isSubmitting}
                className="mb-3"
              >
                {isSubmitting ? 'Wysyłanie...' : 'Wyślij link resetujący'}
              </Button>
            </div>

            {onBackToLogin && (
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={onBackToLogin} 
                  className="p-0 text-decoration-none"
                >
                  <FaArrowLeft className="me-1" /> Powrót do logowania
                </Button>
              </div>
            )}
          </Form>
        </div>
      )}
    </Formik>
  );
}
