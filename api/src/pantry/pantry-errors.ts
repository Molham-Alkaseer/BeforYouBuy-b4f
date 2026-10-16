import {
  HttpException,
  Injectable,
  PipeTransform,
  ValidationError,
  ValidationPipe,
} from "@nestjs/common";

export function pantryError(
  statusCode: number,
  code: string,
  message: string,
  fieldErrors: Record<string, string[]> = {},
): HttpException {
  return new HttpException(
    { statusCode, code, message, fieldErrors },
    statusCode,
  );
}

export function validationError(errors: ValidationError[]): HttpException {
  const fieldErrors = Object.fromEntries(
    errors.map((error) => [
      error.property,
      Object.values(error.constraints ?? { invalid: "Invalid value" }),
    ]),
  );
  return pantryError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed.",
    fieldErrors,
  );
}

// Also works in isolated feature modules before the common global pipe is ready.
export const pantryValidation = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: validationError,
});

@Injectable()
export class PantryIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw pantryError(
        400,
        "VALIDATION_ERROR",
        "id must be a positive safe integer.",
        { id: ["Enter a positive safe integer ID."] },
      );
    }
    return Number(value);
  }
}

export class EmptyPantryDto {}
