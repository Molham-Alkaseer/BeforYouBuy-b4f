import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {
  static register(imports: ModuleMetadata['imports']): DynamicModule {
    return { module: DashboardModule, imports };
  }
}
