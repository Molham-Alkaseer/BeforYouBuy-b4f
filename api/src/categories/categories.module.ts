import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { InternalToolGuard } from '../common/guards/internal-tool.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, InternalToolGuard],
  exports: [CategoriesService],
})
export class CategoriesModule {}
