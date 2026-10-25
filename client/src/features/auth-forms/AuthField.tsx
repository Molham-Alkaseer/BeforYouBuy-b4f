import type { ReactNode } from 'react';

interface InputProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface AuthFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (inputProps: InputProps) => ReactNode;
}

// One field: label, the input itself, and either its error or its hint.
export default function AuthField({
  id,
  label,
  hint,
  error,
  children,
}: AuthFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}

      {error ? (
        <p id={`${id}-error`} className="auth-field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="auth-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}