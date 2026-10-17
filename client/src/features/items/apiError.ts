import type { ApiErrorBody } from './itemTypes';

// Builds an Error that carries the same extra fields as the real adapter:
// statusCode, code and fieldErrors (see apicontract.md, section 5).
export function createApiError(body: ApiErrorBody): Error {
  return Object.assign(new Error(body.message), {
    statusCode: body.statusCode,
    code: body.code,
    fieldErrors: body.fieldErrors,
  });
}

// Reads any thrown value and always gives back the same shape,
// so the pages never have to guess.
export function readApiError(error: unknown): ApiErrorBody {
  if (error instanceof Error) {
    const withDetails = error as Error & Partial<ApiErrorBody>;
    return {
      statusCode: withDetails.statusCode ?? 0,
      code: withDetails.code ?? 'UNKNOWN',
      message: error.message,
      fieldErrors: withDetails.fieldErrors ?? {},
    };
  }
  return {
    statusCode: 0,
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
    fieldErrors: {},
  };
}