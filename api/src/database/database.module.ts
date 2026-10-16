import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { IdsService } from './ids.service';
import { WriteService } from './write.service';
import { domainModels, missingDomainSchemas } from './domain-models';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Category.name, schema: CategorySchema },
    ...domainModels,
  ])],
  providers: [IdsService, WriteService],
  exports: [MongooseModule, IdsService, WriteService],
})
export class DatabaseModule implements OnModuleInit {
  onModuleInit() {
    if (missingDomainSchemas.length) {
      new Logger(DatabaseModule.name).warn(`Integration pending: ${missingDomainSchemas.join(', ')}`);
    }
  }
}
