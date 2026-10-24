import { DatabaseModule } from '../database/database.module';
import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';
@Module({
  imports: [DatabaseModule],
  controllers: [PantryController],
  providers: [PantryService],
  exports: [PantryService],
})
export class PantryModule {
  // Additional imports remain available for isolated feature setups.
  static register(imports: ModuleMetadata['imports']): DynamicModule {
    return { module: PantryModule, imports };
  }
}
