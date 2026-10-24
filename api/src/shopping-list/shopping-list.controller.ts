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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List entries and current Pending counts' })
  findAll(
    @Query() query: FindShoppingListQueryDto,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.shoppingListService.findAll(query);
  }

  @Post('generate')
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
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.shoppingListService.generateShoppingList();
  }

  @Post()
  @ApiOperation({ summary: 'Add a manual shopping entry' })
  addManualEntry(
    @Body() dto: CreateManualEntryDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.shoppingListService.addManualEntry(dto);
  }

  @Post(':id/purchase')
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
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: PurchaseEntryDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.shoppingListService.purchaseEntry(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a Pending entry; history is read-only' })
  deleteEntry(
    @Param('id', PositiveIdPipe) id: number,
    @Query(new NoFieldsPipe('query')) _query: object,
    @Body(new NoFieldsPipe('body')) _body: object,
  ) {
    return this.shoppingListService.deleteEntry(id);
  }
}
