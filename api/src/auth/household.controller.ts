import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { RequestUser } from './request-user.interface';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HouseholdRolesGuard } from './guards/household-roles.guard';
import { HouseholdRoles } from './household-roles.decorator';
import { JsonObjectGuard } from '../common/guards/json-object.guard';
import { NoFieldsPipe } from '../common/pipes/no-fields.pipe';

@ApiTags('household')
@Controller('household/members')
@UseGuards(JwtAuthGuard, HouseholdRolesGuard, JsonObjectGuard)
@HouseholdRoles('owner', 'admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Sign in required.' })
@ApiResponse({
  status: 403,
  description: 'Only household admins can manage members.',
})
export class HouseholdController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'List accounts in your household' })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.auth.listMembers(user);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a read-only family account in your household',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered; existing accounts are never moved.',
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body() body: RegisterDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.auth.addMember(body, user);
  }
}
