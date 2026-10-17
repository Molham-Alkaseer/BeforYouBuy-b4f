import { Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { CommonModule } from '../common/common.module';
import { ClockService } from '../common/clock/clock.service';
import { IdsService } from './ids.service';
import { WriteService } from './write.service';
import { domainModels } from './domain-models';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      ...domainModels,
    ]),
  ],
  providers: [
    IdsService,
    WriteService,
    { provide: 'ClockService', useExisting: ClockService },
    { provide: 'IdsService', useExisting: IdsService },
    { provide: 'HouseholdWrites', useExisting: WriteService },
  ],
  exports: [
    MongooseModule,
    IdsService,
    WriteService,
    'ClockService',
    'IdsService',
    'HouseholdWrites',
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  async onModuleInit() {
    // Enforce schema correctness indexes even when demo seeding is disabled.
    for (const name of [
      Category.name,
      ...domainModels.map((model) => model.name),
    ]) {
      await this.connection.models[name].init();
    }
  }
}
