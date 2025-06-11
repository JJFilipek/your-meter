import * as Yup from 'yup';

export const emailValidation = Yup.string()
  .required('Email jest wymagany')
  .matches(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
    'Nieprawidłowy format adresu email (przykład: przyklad@domena.pl)'
  )
  .max(254, 'Email może mieć maksymalnie 254 znaki');

export const passwordValidation = Yup.string()
  .min(8, 'Hasło musi mieć przynajmniej 8 znaków')
  .matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Hasło musi zawierać co najmniej jedną wielką literę, jedną małą literę i jedną cyfrę'
  )
  .required('Hasło jest wymagane');

export const usernameValidation = Yup.string()
  .min(3, 'Nazwa użytkownika musi mieć przynajmniej 3 znaki')
  .max(50, 'Nazwa użytkownika może mieć maksymalnie 50 znaków')
  .required('Nazwa użytkownika jest wymagana');

export const meterValidationSchema = Yup.object().shape({
  name: Yup.string()
    .trim()
    .required('Nazwa jest wymagana')
    .min(2, 'Nazwa musi mieć co najmniej 2 znaki')
    .max(50, 'Nazwa może mieć maksymalnie 50 znaków')
    .matches(/^[\p{L}0-9\s-]+$/u, 'Nazwa może zawierać tylko litery, cyfry, spacje i myślniki'),
  model: Yup.string()
    .required('Model jest wymagany')
    .min(2, 'Model musi mieć co najmniej 2 znaki')
    .max(20, 'Model może mieć maksymalnie 20 znaków')
    .test(
      'not-only-special-chars',
      'Model nie może składać się tylko z myślników',
      value => !/^-*$/.test(value || '')
    )
    .test(
      'not-only-numbers',
      'Model nie może składać się tylko z cyfr',
      value => !/^\d+$/.test(value || '')
    )
  .matches(/^[A-Z][A-Z0-9-]*[A-Z0-9]$/, 'Model musi zaczynać się od litery, zawierać tylko wielkie litery, ' +
      'może zawierać cyfry i myślniki, i musi kończyć się literą lub cyfrą'),

  tariff: Yup.string()
    .required('Wybierz taryfę')
    .oneOf(['G11', 'G12', 'C11', 'C12'], 'Nieprawidłowa taryfa'),
  firmware: Yup.string()
    .matches(/^\d+\.\d+\.\d+$/, 'Wersja powinna mieć format X.Y.Z')
    .required('Wersja firmware jest wymagana'),
});

export const tabValidationSchema = Yup.object().shape({
  name: Yup.string()
    .trim()
    .required('Pole jest wymagane')
    .max(50, 'Maksymalnie 50 znaków'),
  columns: Yup.array()
    .min(1, 'Wybierz przynajmniej jedną kolumnę')
    .required('Wybierz przynajmniej jedną kolumnę')
});
