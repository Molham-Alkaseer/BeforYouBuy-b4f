import { ApiProperty } from '@nestjs/swagger';
import {
  HOUSEHOLD_ROLES,
  HouseholdRole,
} from '../../household-members/schemas/household-member.schema';

export class SafeUserDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ enum: HOUSEHOLD_ROLES }) householdRole: HouseholdRole;
  @ApiProperty() householdId: number;
}
export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: SafeUserDto }) user: SafeUserDto;
}
