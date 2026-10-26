import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { readApiError } from "../items/apiError";
import AuthField from "./AuthField";
import { validateLogin } from "./authValidation";
import type { FieldErrors, LoginValues } from "./authTypes";
import "./auth-forms.css";

interface LoginFormProps {
  // Signs the user in. The real shared login(input) is plugged in later.
  onLogin: (input: LoginValues) => Promise<void>;
  // Called after a successful login. The page decides where to go next.
  onSuccess: () => void;
  // Where the Register link goes. The page decides it, including a safe returnTo.
  registerPath: string;
  // Email handed over from the register page. Never a password.
  initialEmail?: string;
}

// One message for an unknown email and for a wrong password.
const INVALID_CREDENTIALS_MESSAGE = "The email or password is incorrect.";

export default function LoginForm({
  onLogin,
  onSuccess,
  registerPath,
  initialEmail = "",
}: LoginFormProps) {
  const [values, setValues] = useState<LoginValues>({
    email: initialEmail,
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({});
  const [summary, setSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const field = event.target.name as keyof LoginValues;
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

    setSummary("");

    const found = validateLogin(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      // The email is trimmed. The password is sent exactly as typed.
      await onLogin({ email: values.email.trim(), password: values.password });
      if (!isMounted.current) {
        return;
      }
      setValues((current) => ({ ...current, password: "" }));
      onSuccess();
    } catch (caught) {
      if (!isMounted.current) {
        return;
      }
      // The typed values stay in the form.
      const apiError = readApiError(caught);
      setSummary(
        apiError.code === "INVALID_CREDENTIALS"
          ? INVALID_CREDENTIALS_MESSAGE
          : apiError.message,
      );
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {summary !== "" && (
        <p role="alert" className="auth-error-summary">
          {summary}
        </p>
      )}

      {summary === "" && problems > 0 && (
        <p role="alert" className="auth-error-summary">
          <strong>You could not be signed in.</strong> Please fix the {problems}{" "}
          {problems === 1 ? "problem" : "problems"} marked below.
        </p>
      )}

      <AuthField id="login-email" label="Email" error={errors.email}>
        {(inputProps) => (
          <input
            {...inputProps}
            name="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
          />
        )}
      </AuthField>

      <AuthField id="login-password" label="Password" error={errors.password}>
        {(inputProps) => (
          <input
            {...inputProps}
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange}
          />
        )}
      </AuthField>

      <button type="submit" className="auth-submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="auth-links">
        <Link to={registerPath}>Create an account</Link>
      </p>
    </form>
  );
}
