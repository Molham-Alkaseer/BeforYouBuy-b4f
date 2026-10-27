import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdRolesGuard } from '../auth/guards/household-roles.guard';
import { HouseholdRoles } from '../auth/household-roles.decorator';
import { NoFieldsPipe } from '../common/pipes/no-fields.pipe';
import { PantryBodyGuard } from '../pantry/pantry-body.guard';
import { PantryHttpFilter } from '../pantry/pantry-http.filter';
import {
  Body,
  Controller,
  Get,
  Query,
  UsePipes,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { pantryValidation } from '../pantry/pantry-errors';
import { DashboardResponse } from './dashboard-response';
@ApiTags('dashboard')
@Controller('dashboard')
@UsePipes(pantryValidation)
@UseFilters(PantryHttpFilter)
@UseGuards(JwtAuthGuard, HouseholdRolesGuard, PantryBodyGuard)
@HouseholdRoles('owner', 'admin', 'member')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get()
  @ApiOperation({
    summary:
      'Calculate pantry statuses, urgent items, category counts and Pending shopping totals',
  })
  @ApiOkResponse({ type: DashboardResponse })
  summary(
    @CurrentUser() user: RequestUser,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.service.summary(user.householdId);
  }
}
