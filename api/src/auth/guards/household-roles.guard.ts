import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { apiError } from '../../common/errors/api-error';
import { HouseholdMembersService } from '../../household-members/household-members.service';
import { HouseholdRole } from '../../household-members/schemas/household-member.schema';
import { HOUSEHOLD_ROLES_KEY } from '../household-roles.decorator';

@Injectable()
export class HouseholdRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: HouseholdMembersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) throw apiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const roles = this.reflector.getAllAndOverride<HouseholdRole[]>(
      HOUSEHOLD_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const membership = await this.members.findByUser(user.sub);
    if (!roles?.length || !membership || !roles.includes(membership.role)) {
      throw apiError(
        403,
        'FORBIDDEN',
        'Your household role does not allow this action.',
      );
    }
    user.householdId = membership.householdId;
    return true;
  }
}
