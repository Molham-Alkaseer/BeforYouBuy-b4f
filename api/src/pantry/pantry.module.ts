import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';
@Module({
  imports: [DatabaseModule, AuthModule],
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
