import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { IdsService } from '../database/ids.service';
import { WriteService } from '../database/write.service';
import { apiError } from '../common/errors/api-error';

export interface CategoryResponse { id: number; name: string; }

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);
  constructor(
    @InjectModel(Category.name) private readonly model: Model<CategoryDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ids: IdsService,
    private readonly writes: WriteService,
  ) {}

  async onModuleInit() { await this.model.init(); }

  private response(category: { id: number; name: string }): CategoryResponse {
    return { id: category.id, name: category.name };
  }

  private duplicate(error: unknown): never {
    const duplicate = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (duplicate.code === 11000 && duplicate.keyPattern?.normalizedName) {
      throw apiError(409, 'DUPLICATE_CATEGORY_NAME', 'A category with that name already exists.', {
        name: ['Names must be unique, ignoring capitals and surrounding spaces.'],
      });
    }
    throw error;
  }

  async findAll(): Promise<{ items: CategoryResponse[] }> {
    const categories = await this.model.find().sort({ id: 1 }).exec();
    return { items: categories.map((category) => this.response(category)) };
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    const id = await this.ids.next('categories');
    try {
      const category = await this.writes.run(async (session) => {
        const record = new this.model({ id, name: dto.name, normalizedName: dto.name.toLowerCase() });
        return this.response(await record.save({ session }));
      });
      this.logger.log(`Created category ${id}`);
      return category;
    } catch (error) { this.duplicate(error); }
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    try {
      const category = await this.writes.run(async (session) => {
        const record = await this.model.findOne({ id }).session(session).exec();
        if (!record) throw apiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
        record.name = dto.name;
        record.normalizedName = dto.name.toLowerCase();
        return this.response(await record.save({ session }));
      });
      this.logger.log(`Updated category ${id}`);
      return category;
    } catch (error) { this.duplicate(error); }
  }

  async remove(id: number): Promise<void> {
    await this.writes.run(async (session) => {
      const category = await this.model.findOne({ id }).session(session).exec();
      if (!category) throw apiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
      // Read the contract collection without depending on the unfinished pantry service.
      const used = await this.connection.collection('pantry_items').findOne({ categoryId: id }, { session });
      if (used) throw apiError(409, 'CATEGORY_IN_USE', 'This category is used by a pantry item.');
      await this.model.deleteOne({ id }).session(session).exec();
    });
    this.logger.log(`Deleted category ${id}`);
  }
}
