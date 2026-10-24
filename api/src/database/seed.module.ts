import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from './database.module';
import { SeedService } from './seed';

@Module({
  imports: [DatabaseModule, CommonModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
