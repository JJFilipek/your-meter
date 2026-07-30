import { Modal, Form, Button } from "react-bootstrap"
import { Formik, Form as FormikForm, Field } from 'formik'
import { tabValidationSchema } from '../validations/schemas'

interface FormValues {
    name: string;
    columns: string[];
}

const allColumns = [
    { key: "activeImportKwh", label: "Energia pobrana (kWh)" },
    { key: "activeExportKwh", label: "Energia oddana (kWh)" },
    { key: "activePowerKw", label: "Moc czynna (kW)" },
    { key: "reactivePowerKvar", label: "Moc bierna (kvar)" },
    { key: "voltage", label: "Napięcie (V)" },
    { key: "current", label: "Prąd (A)" },
    { key: "frequencyHz", label: "Częstotliwość (Hz)" },
    { key: "quality", label: "Jakość" }
]

type Props = {
    show: boolean
    onClose: () => void
    initialName?: string
    initialColumns?: string[]
    onSave?: (newName: string, visibleCols: string[]) => void
}

export function ColumnSelectorModal({
    show,
    onClose,
    initialName = "",
    initialColumns = [],
    onSave
}: Props) {
    const initialValues: FormValues = {
        name: initialName,
        columns: [...initialColumns]
    }

    const handleSubmit = (values: FormValues, { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void }) => {
        onSave?.(values.name.trim(), values.columns)
        setSubmitting(false)
        onClose()
    }

    return (
        <Modal show={show} onHide={onClose} centered>
            <Formik
                initialValues={initialValues}
                validationSchema={tabValidationSchema}
                onSubmit={handleSubmit}
                enableReinitialize
            >
                {({ values, errors, touched, isSubmitting, setFieldValue }) => (
                    <FormikForm>
                        <Modal.Header closeButton>
                            <Modal.Title>Edycja zakładki</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <Form.Group className="mb-3">
                                <Form.Label>Nazwa zakładki</Form.Label>
                                <Field
                                    as={Form.Control}
                                    type="text"
                                    name="name"
                                    isInvalid={touched.name && !!errors.name}
                                />
                                {touched.name && errors.name && (
                                    <div className="text-danger small mt-1">
                                        {errors.name}
                                    </div>
                                )}
                            </Form.Group>

                            <div className="mb-2 text-muted small">Widoczne kolumny</div>
                            <Form.Group>
                                {allColumns.map(col => (
                                    <div key={col.key} className="mb-2">
                                        <Field
                                            type="checkbox"
                                            name="columns"
                                            value={col.key}
                                            id={`col-${col.key}`}
                                            className="me-2"
                                            checked={values.columns.includes(col.key)}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const newColumns = e.target.checked
                                                    ? [...values.columns, col.key]
                                                    : values.columns.filter(k => k !== col.key)
                                                setFieldValue('columns', newColumns)
                                            }}
                                        />
                                        <label htmlFor={`col-${col.key}`} className="form-check-label">
                                            {col.label}
                                        </label>
                                    </div>
                                ))}
                                {errors.columns && touched.columns && (
                                    <div className="text-danger small mt-1">
                                        {errors.columns}
                                    </div>
                                )}
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="secondary"
                                onClick={onClose}
                                type="button"
                            >
                                Anuluj
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
                            </Button>
                        </Modal.Footer>
                    </FormikForm>
                )}
            </Formik>
        </Modal>
    )
}
