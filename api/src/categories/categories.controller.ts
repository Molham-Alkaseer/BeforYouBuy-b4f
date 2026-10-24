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
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InternalToolGuard } from '../common/guards/internal-tool.guard';
import { PositiveIdPipe } from '../common/pipes/positive-id.pipe';
import { NoFieldsPipe } from '../common/pipes/no-fields.pipe';
import { JsonObjectGuard } from '../common/guards/json-object.guard';

const INTERNAL_HEADER = {
  name: 'x-internal-tool-key',
  required: true,
  description: 'Internal tooling key. Never include it in the frontend.',
};

@ApiTags('categories')
@Controller('categories')
@UseGuards(JsonObjectGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories ordered by ID' })
  @ApiResponse({
    status: 200,
    description: 'An object containing an items array of categories.',
  })
  findAll(
    @Query(new NoFieldsPipe('query')) _query: Record<string, unknown>,
    @Body(new NoFieldsPipe('body')) _body: Record<string, unknown>,
  ) {
    return this.categoriesService.findAll();
  }

  @Post()
  @UseGuards(InternalToolGuard)
  @ApiHeader(INTERNAL_HEADER)
  @ApiOperation({ summary: 'Create a category' })
  @ApiResponse({ status: 201, description: 'Created category: id and name.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid name or unexpected fields.',
  })
  @ApiResponse({ status: 403, description: 'Missing or invalid internal key.' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate normalized category name.',
  })
  create(
    @Body() dto: CreateCategoryDto,
    @Query(new NoFieldsPipe('query')) _query: Record<string, unknown>,
  ) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(InternalToolGuard)
  @ApiHeader(INTERNAL_HEADER)
  @ApiOperation({ summary: 'Rename a category' })
  @ApiResponse({ status: 200, description: 'Updated category: id and name.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid ID/name or unexpected fields.',
  })
  @ApiResponse({ status: 403, description: 'Missing or invalid internal key.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate normalized category name.',
  })
  update(
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @Query(new NoFieldsPipe('query')) _query: Record<string, unknown>,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(InternalToolGuard)
  @ApiHeader(INTERNAL_HEADER)
  @ApiOperation({ summary: 'Delete an unused category' })
  @ApiResponse({
    status: 204,
    description: 'Category deleted. No response body.',
  })
  @ApiResponse({ status: 400, description: 'Invalid ID or unexpected fields.' })
  @ApiResponse({ status: 403, description: 'Missing or invalid internal key.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  @ApiResponse({
    status: 409,
    description: 'Category is used by a pantry item.',
  })
  remove(
    @Param('id', PositiveIdPipe) id: number,
    @Query(new NoFieldsPipe('query')) _query: Record<string, unknown>,
    @Body(new NoFieldsPipe('body')) _body: Record<string, unknown>,
  ) {
    return this.categoriesService.remove(id);
  }
}
