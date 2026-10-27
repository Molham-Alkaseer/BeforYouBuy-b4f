import { SetMetadata } from '@nestjs/common';
import { HouseholdRole } from '../household-members/schemas/household-member.schema';

export const HOUSEHOLD_ROLES_KEY = 'byb:household-roles';
export const HouseholdRoles = (...roles: HouseholdRole[]) =>
  SetMetadata(HOUSEHOLD_ROLES_KEY, roles);
