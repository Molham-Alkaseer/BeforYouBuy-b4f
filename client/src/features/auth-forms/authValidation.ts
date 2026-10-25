import type { FieldErrors, LoginValues, RegisterValues } from './authTypes';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

// Passwords are measured in UTF-8 bytes because that is what the server limits.
function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

// The password is never trimmed or lowercased. The server stays the final judge.
export function validateRegister(
  values: RegisterValues,
): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {};

  if (values.name.trim() === '') {
    errors.name = 'Enter your name.';
  }

  const email = values.email.trim();
  if (email === '') {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address, such as name@example.com.';
  }

  if (values.password === '') {
    errors.password = 'Enter a password.';
  } else if (Array.from(values.password).length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (utf8Length(values.password) > MAX_PASSWORD_BYTES) {
    errors.password = `Password is too long. Use at most ${MAX_PASSWORD_BYTES} bytes.`;
  }

  return errors;
}

// Login only checks that something was typed. It never explains password rules.
export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {};

  if (values.email.trim() === '') {
    errors.email = 'Enter your email address.';
  }
  if (values.password === '') {
    errors.password = 'Enter your password.';
  }

  return errors;
}

// Keeps only the server messages that belong to a field on the register form.
export function registerErrorsFromApi(
  apiFieldErrors: Record<string, string[]>,
): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {};

  for (const field of ['name', 'email', 'password'] as const) {
    const messages = apiFieldErrors[field];
    if (messages && messages.length > 0) {
      errors[field] = messages.join(' ');
    }
  }

  return errors;
}