import { 
  Controller, Get, Post, Body, Param, Delete, Query, HttpCode, HttpStatus, ParseIntPipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ShoppingListService } from './shopping-list.service';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { PurchaseEntryDto } from './dto/purchase-entry.dto';
import { FindShoppingListQueryDto } from './dto/find-shopping-list-query.dto';

@ApiTags('Shopping List')
@Controller('shopping-list')
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Get()
  @ApiOperation({ summary: 'Get shopping list entries (Pending or Purchased) with optional filters' })
  @ApiResponse({ status: 200, description: 'Returns the filtered list of entries and a summary.' })
  findAll(@Query() query: FindShoppingListQueryDto) {
    return this.shoppingListService.findAll(query.status, query.pantryItemId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate or update pending shopping list from pantry data' })
  @ApiResponse({ status: 201, description: 'List generated successfully. Returns updated pending entries.' })
  generateShoppingList() {
    return this.shoppingListService.generateShoppingList();
  }

  @Post('manual')
  @ApiOperation({ summary: 'Add a manual entry to the shopping list' })
  @ApiResponse({ status: 201, description: 'Manual entry successfully added.' })
  @ApiResponse({ status: 409, description: 'An entry with this name already exists in the pending list.' })
  addManualEntry(@Body() addManualEntryDto: CreateManualEntryDto) {
    return this.shoppingListService.addManualEntry(addManualEntryDto);
  }

  @Post(':id/purchase')
  @ApiOperation({ summary: 'Mark an entry as purchased and restock the linked pantry item' })
  @ApiParam({ name: 'id', description: 'The ID of the shopping list entry', type: 'number' })
  @ApiResponse({ status: 201, description: 'Entry successfully purchased.' })
  @ApiResponse({ status: 404, description: 'Entry not found.' })
  @ApiResponse({ status: 409, description: 'Entry already purchased, or missing new expiry date for expired item.' })
  purchaseEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() purchaseEntryDto: PurchaseEntryDto,
  ) {
    return this.shoppingListService.purchaseEntry(id, purchaseEntryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // يضمن إرجاع 204 حسب التعليمات
  @ApiOperation({ summary: 'Delete a pending shopping list entry' })
  @ApiParam({ name: 'id', description: 'The ID of the shopping list entry', type: 'number' })
  @ApiResponse({ status: 204, description: 'Entry successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Entry not found.' })
  @ApiResponse({ status: 409, description: 'Cannot delete an entry that has already been purchased.' })
  deleteEntry(@Param('id', ParseIntPipe) id: number) {
    this.shoppingListService.deleteEntry(id);
  }
}