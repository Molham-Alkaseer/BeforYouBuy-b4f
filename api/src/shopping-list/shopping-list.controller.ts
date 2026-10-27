import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdRolesGuard } from '../auth/guards/household-roles.guard';
import { HouseholdRoles } from '../auth/household-roles.decorator';
import { ShoppingListService } from './shopping-list.service';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { PurchaseEntryDto } from './dto/purchase-entry.dto';
import { FindShoppingListQueryDto } from './dto/find-shopping-list-query.dto';
import { PositiveIdPipe } from '../common/pipes/positive-id.pipe';
import { NoFieldsPipe } from '../common/pipes/no-fields.pipe';
import { JsonObjectGuard } from '../common/guards/json-object.guard';

@ApiTags('shopping-list')
@Controller('shopping-list')
@UseGuards(JsonObjectGuard)
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Get()
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin', 'member')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List entries and current Pending counts' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: FindShoppingListQueryDto,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.shoppingListService.findAll(query, user.householdId);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Household membership required.' })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate suggestions from current low or expired stock',
  })
  @ApiResponse({
    status: 409,
    description:
      'A Pending entry already uses a generated name; no changes saved.',
  })
  generateShoppingList(
    @CurrentUser() user: RequestUser,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.shoppingListService.generateShoppingList(
      user.sub,
      user.householdId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Household membership required.' })
  @ApiOperation({ summary: 'Add a manual shopping entry' })
  addManualEntry(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateManualEntryDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.shoppingListService.addManualEntry(
      dto,
      user.sub,
      user.householdId,
    );
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Household membership required.' })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Purchase once, atomically updating stock and history',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid quantity/date or expiry required for expired stock.',
  })
  @ApiResponse({ status: 409, description: 'Entry already purchased.' })
  purchaseEntry(
    @CurrentUser() user: RequestUser,
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: PurchaseEntryDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.shoppingListService.purchaseEntry(
      id,
      dto,
      user.sub,
      user.householdId,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Owner or admin role required.' })
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a Pending entry; history is read-only' })
  deleteEntry(
    @CurrentUser() user: RequestUser,
    @Param('id', PositiveIdPipe) id: number,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.shoppingListService.deleteEntry(id, user.sub, user.householdId);
  }
}
