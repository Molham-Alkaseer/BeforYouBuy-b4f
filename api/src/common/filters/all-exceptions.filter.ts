import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const defaults: Record<number, string> = { 400: 'VALIDATION_ERROR', 403: 'INTERNAL_TOOL_FORBIDDEN', 404: 'NOT_FOUND' };
    // Never log request bodies, headers, database URIs or raw driver errors.
    if (statusCode >= 500) this.logger.error('An internal request failure occurred.');
    response.status(statusCode).json({
      statusCode,
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : body.code ?? defaults[statusCode] ?? 'HTTP_ERROR',
      message: statusCode >= 500 ? 'Internal server error' :
        typeof body.message === 'string' ? body.message : typeof raw === 'string' ? raw : 'Request failed.',
      fieldErrors: statusCode >= 500 ? {} : body.fieldErrors ?? {},
    });
  }
}
