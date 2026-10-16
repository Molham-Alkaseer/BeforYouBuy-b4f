import { DynamicModule, Module, ModuleMetadata } from "@nestjs/common";
import { PantryController } from "./pantry.controller";
import { PantryService } from "./pantry.service";
@Module({
  controllers: [PantryController],
  providers: [PantryService],
  exports: [PantryService],
})
export class PantryModule {
  // The shared DatabaseModule is supplied here once its owner lands it.
  static register(imports: ModuleMetadata["imports"]): DynamicModule {
    return { module: PantryModule, imports };
  }
}
