import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { apiError } from '../errors/api-error';

@Injectable()
export class JsonObjectGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const body: unknown = context.switchToHttp().getRequest().body;
    if (
      body !== undefined &&
      (body === null || typeof body !== 'object' || Array.isArray(body))
    ) {
      throw apiError(
        400,
        'VALIDATION_ERROR',
        'The request body must be a JSON object.',
      );
    }
    return true;
  }
}
