import type { ReactNode } from 'react';

interface InputProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (inputProps: InputProps) => ReactNode;
}

// One field: label, the input itself, and either its error or its hint.
export default function FormField({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: FormFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="item-field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="item-optional"> (optional)</span>}
      </label>

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}

      {error ? (
        <p id={`${id}-error`} className="item-field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="item-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}