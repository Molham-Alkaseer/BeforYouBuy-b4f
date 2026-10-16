import { HttpException } from '@nestjs/common';

export function apiError(
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
