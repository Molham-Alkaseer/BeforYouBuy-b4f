import type { PantryInput, PantryItem } from './itemTypes';

// Everything the user types is kept as text. Numbers are made at submit time.
export interface FormValues {
  name: string;
  categoryId: string;
  quantity: string;
  unit: string;
  minimumQuantity: string;
  expiryDate: string;
}

export type FieldName = keyof FormValues;
export type FieldErrors = Partial<Record<FieldName, string>>;

export const emptyValues: FormValues = {
  name: '',
  categoryId: '',
  quantity: '',
  unit: '',
  minimumQuantity: '',
  expiryDate: '',
};

// Fills the form from an existing item (edit mode).
export function valuesFromItem(item: PantryItem): FormValues {
  return {
    name: item.name,
    categoryId: String(item.categoryId),
    quantity: String(item.quantity),
    unit: item.unit,
    minimumQuantity: String(item.minimumQuantity),
    expiryDate: item.expiryDate ?? '',
  };
}

// Reads a decimal typed by the user: "2", "0.5" or "0,5".
// Returns null when the text is not a plain number.
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function checkAmount(text: string, noun: string): string | undefined {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  if (text.trim() === '') {
    return `Enter the ${noun}.`;
  }

  const value = parseDecimal(text);
  if (value === null) {
    return `${Noun} must be a number. Decimals such as 0.5 are fine.`;
  }
  if (value < 0) {
    return `${Noun} must be 0 or more. Decimals such as 0.5 are fine.`;
  }
  return undefined;
}

// Returns one message per wrong field. An empty object means everything is fine.
export function validateValues(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (values.name.trim() === '') {
    errors.name = 'Enter a name for the item.';
  }

  if (values.categoryId === '') {
    errors.categoryId = 'Choose a category.';
  }

  const quantityError = checkAmount(values.quantity, 'quantity');
  if (quantityError) {
    errors.quantity = quantityError;
  }

  if (values.unit.trim() === '') {
    errors.unit = 'Enter a unit, such as litres or kg.';
  }

  const minimumError = checkAmount(values.minimumQuantity, 'minimum quantity');
  if (minimumError) {
    errors.minimumQuantity = minimumError;
  }

  return errors;
}

// Turns the typed text into the numbers the API expects.
// A blank expiry date becomes null (on edit, null clears the saved date).
export function toPantryInput(values: FormValues): PantryInput | null {
  const quantity = parseDecimal(values.quantity);
  const minimumQuantity = parseDecimal(values.minimumQuantity);
  const categoryId = Number(values.categoryId);

  if (
    quantity === null ||
    minimumQuantity === null ||
    !Number.isInteger(categoryId)
  ) {
    return null;
  }

  return {
    name: values.name.trim(),
    categoryId,
    quantity,
    unit: values.unit.trim(),
    minimumQuantity,
    expiryDate: values.expiryDate === '' ? null : values.expiryDate,
  };
}

const FIELD_NAMES: FieldName[] = [
  'name',
  'categoryId',
  'quantity',
  'unit',
  'minimumQuantity',
  'expiryDate',
];

// Takes the API's fieldErrors and keeps only the fields our form has.
export function fieldErrorsFromApi(
  apiFieldErrors: Record<string, string[]>,
): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of FIELD_NAMES) {
    const messages = apiFieldErrors[field];
    if (messages && messages.length > 0) {
      errors[field] = messages.join(' ');
    }
  }

  return errors;
}