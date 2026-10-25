import { NoFieldsPipe } from '../common/pipes/no-fields.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdRolesGuard } from '../auth/guards/household-roles.guard';
import { HouseholdRoles } from '../auth/household-roles.decorator';
import { PantryBodyGuard } from './pantry-body.guard';
import { PantryHttpFilter } from './pantry-http.filter';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PantryService } from './pantry.service';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto';
import { UsePantryItemDto } from './dto/use-pantry-item.dto';
import { FindPantryQueryDto } from './dto/find-pantry-query.dto';
import { PantryIdPipe, pantryValidation } from './pantry-errors';
import { PantryItemResponse, PantryListResponse } from './pantry-response';

@ApiTags('pantry')
@Controller('pantry')
@UsePipes(pantryValidation)
@UseFilters(PantryHttpFilter)
@UseGuards(PantryBodyGuard)
export class PantryController {
  constructor(private readonly service: PantryService) {}

  @Get()
  @ApiOperation({
    summary:
      'List pantry items using combined name, category and current status filters',
  })
  @ApiOkResponse({ type: PantryListResponse })
  findAll(
    @Query() query: FindPantryQueryDto,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an item with current statuses and reasons' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: PantryItemResponse })
  findOne(
    @Param('id', PantryIdPipe) id: string,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.service.findOne(Number(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin', 'member')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Household membership required.' })
  @ApiOperation({ summary: 'Create a pantry item in an existing category' })
  @ApiCreatedResponse({ type: PantryItemResponse })
  create(
    @CurrentUser() user: RequestUser,
    @Body() body: CreatePantryItemDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.service.create(body, user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin', 'member')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Household membership required.' })
  @ApiOperation({
    summary:
      'Edit an item; omitted fields are preserved and null clears expiry',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: PantryItemResponse })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', PantryIdPipe) id: string,
    @Body() body: UpdatePantryItemDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.service.update(Number(id), body, user.sub);
  }

  @Post(':id/use')
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin', 'member')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Household membership required.' })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Consume a positive amount without exceeding available stock',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: PantryItemResponse })
  use(
    @CurrentUser() user: RequestUser,
    @Param('id', PantryIdPipe) id: string,
    @Body() body: UsePantryItemDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.service.use(Number(id), body.quantity, user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, HouseholdRolesGuard)
  @HouseholdRoles('owner', 'admin')
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sign in required.' })
  @ApiResponse({ status: 403, description: 'Owner or admin role required.' })
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete an item unless it has a Pending shopping entry',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', PantryIdPipe) id: string,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.service.remove(Number(id), user.sub);
  }
}
