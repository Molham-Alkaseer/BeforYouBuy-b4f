import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { readApiError } from '../items/apiError';
import AuthField from './AuthField';
import { registerErrorsFromApi, validateRegister } from './authValidation';
import type { FieldErrors, RegisterValues } from './authTypes';
import './auth-forms.css';

interface RegisterFormProps {
  // Uses the shared auth adapter; registration does not create a session.
  onRegister: (input: RegisterValues) => Promise<unknown>;
  // Where the "Sign in" links go. The page decides it, including a safe returnTo.
  loginPath: string;
}

const emptyValues: RegisterValues = { name: '', email: '', password: '' };

export default function RegisterForm({
  onRegister,
  loginPath,
}: RegisterFormProps) {
  const [values, setValues] = useState<RegisterValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors<RegisterValues>>({});
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // Stops a late answer from changing the screen after the user left it.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const problems = Object.keys(errors).length;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as keyof RegisterValues;
    const value = event.target.value;

    setValues((current) => ({ ...current, [field]: value }));

    // Typing in a field removes that field's error message.
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return; // a request is already running
    }

    setSummary('');

    const found = validateRegister(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    // Name and email are trimmed. The password is sent exactly as typed.
    const input: RegisterValues = {
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    };

    setIsSubmitting(true);

    try {
      await onRegister(input);
      if (!isMounted.current) {
        return;
      }
      setRegisteredEmail(input.email);
      setValues(emptyValues); // clears the password too
    } catch (caught) {
      if (!isMounted.current) {
        return;
      }
      // Name and email stay in the form so they can be corrected.
      const apiError = readApiError(caught);
      const fieldErrors = registerErrorsFromApi(apiError.fieldErrors);

      if (apiError.code === 'EMAIL_ALREADY_EXISTS' && !fieldErrors.email) {
        fieldErrors.email =
          'An account with this email already exists. Sign in, or use a different email.';
      }

      setErrors(fieldErrors);
      // With no field to blame, show the server message above the form.
      setSummary(Object.keys(fieldErrors).length > 0 ? '' : apiError.message);
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }

  if (registeredEmail !== null) {
    return (
      <div className="auth-form">
        <p role="status" className="auth-success">
          Your account was created. Please sign in to continue.
        </p>
        <p className="auth-links">
          <Link to={loginPath} state={{ email: registeredEmail }}>
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {summary !== '' && (
        <p role="alert" className="auth-error-summary">
          {summary}
        </p>
      )}

      {summary === '' && problems > 0 && (
        <p role="alert" className="auth-error-summary">
          <strong>This account could not be created.</strong> Please fix the{' '}
          {problems} {problems === 1 ? 'problem' : 'problems'} marked below.
        </p>
      )}

      <AuthField id="register-name" label="Name" error={errors.name}>
        {(inputProps) => (
          <input
            {...inputProps}
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={handleChange}
          />
        )}
      </AuthField>

      <AuthField id="register-email" label="Email" error={errors.email}>
        {(inputProps) => (
          <input
            {...inputProps}
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
          />
        )}
      </AuthField>

      <AuthField
        id="register-password"
        label="Password"
        hint="At least 8 characters; at most 72 UTF-8 bytes."
        error={errors.password}
      >
        {(inputProps) => (
          <input
            {...inputProps}
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={handleChange}
          />
        )}
      </AuthField>

      <button type="submit" className="auth-submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>

      <p className="auth-links">
        <Link to={loginPath}>Already have an account? Sign in</Link>
      </p>
    </form>
  );
}
