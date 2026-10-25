import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { apiError } from '../errors/api-error';

@Injectable()
export class InternalToolGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-internal-tool-key'];
    const expectedKey = this.config.get<string>('INTERNAL_TOOL_KEY');

    if (!providedKey || providedKey !== expectedKey) {
      throw apiError(
        403,
        'INTERNAL_TOOL_FORBIDDEN',
        "This operation is restricted to Before You Buy's own internal tooling.",
      );
    }

    return true;
  }
}
