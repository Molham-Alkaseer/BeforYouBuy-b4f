import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/** Keeps feature errors contractual even with the starter global ValidationPipe. */
@Catch(HttpException)
export class PantryHttpFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost) {
    const statusCode = error.getStatus();
    const response = error.getResponse();
    if (typeof response === 'object' && 'code' in response) {
      host
        .switchToHttp()
        .getResponse<Response>()
        .status(statusCode)
        .json(response);
      return;
    }
    const message =
      typeof response === 'string'
        ? response
        : (response as { message?: string | string[] }).message;
    const fieldErrors: Record<string, string[]> = {};
    if (Array.isArray(message)) {
      for (const entry of message) {
        const field =
          entry.match(/^property (\S+) should not exist$/)?.[1] ??
          entry.split(' ')[0];
        (fieldErrors[field] ??= []).push(entry);
      }
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({
        statusCode,
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
        message: Array.isArray(message)
          ? 'Request validation failed.'
          : (message ?? error.message),
        fieldErrors,
      });
  }
}
