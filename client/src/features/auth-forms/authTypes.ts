// Values typed in the forms. Everything is text until it is sent.
export interface RegisterValues {
  name: string;
  email: string;
  password: string;
}

export interface LoginValues {
  email: string;
  password: string;
}

// One message per wrong field. An empty object means everything is fine.
export type FieldErrors<T> = Partial<Record<keyof T, string>>;