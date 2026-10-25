import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { apiError } from '../../common/errors/api-error';
import { UsersService } from '../../users/users.service';
import { RequestUser } from '../request-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = /^Bearer ([^\s]+)$/.exec(
      request.headers.authorization ?? '',
    )?.[1];
    const denied = () =>
      apiError(
        401,
        'UNAUTHENTICATED',
        'Invalid or missing authentication token.',
      );
    if (!token) throw denied();
    let claims: RequestUser & { exp: number };
    try {
      claims = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
      if (
        !Number.isSafeInteger(claims.sub) ||
        claims.sub < 1 ||
        typeof claims.email !== 'string' ||
        !Number.isFinite(claims.exp)
      )
        throw denied();
    } catch {
      throw denied();
    }
    // Read current identity so a deleted account cannot keep writing until token expiry.
    const user = await this.users.findById(claims.sub);
    if (!user) throw denied();
    request.user = { sub: user.id, email: user.email };
    return true;
  }
}
