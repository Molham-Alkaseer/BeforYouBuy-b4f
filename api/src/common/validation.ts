import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { apiError } from './errors/api-error';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const fields: Record<string, string[]> = {};
      const visit = (error: ValidationError, prefix = '') => {
        const path = prefix ? `${prefix}.${error.property}` : error.property;
        if (error.constraints) fields[path] = Object.values(error.constraints);
        error.children?.forEach((child) => visit(child, path));
      };
      errors.forEach((error) => visit(error));
      return apiError(400, 'VALIDATION_ERROR', 'Please correct the invalid fields.', fields);
    },
  });
}
