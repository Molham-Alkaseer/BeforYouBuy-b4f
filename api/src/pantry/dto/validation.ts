import { Transform } from "class-transformer";
import { registerDecorator, ValidationOptions } from "class-validator";

export const Trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
export const QueryInteger = () =>
  Transform(({ value }) =>
    typeof value === "string" && /^[1-9]\d*$/.test(value)
      ? Number(value)
      : value,
  );

export function isDateOnly(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) =>
    registerDecorator({
      name: "isDateOnly",
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: isDateOnly,
        defaultMessage: () =>
          "expiryDate must be a real calendar date in YYYY-MM-DD format",
      },
    });
}
