import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HouseholdMembersService } from './household-members.service';

@Module({
  imports: [DatabaseModule],
  providers: [HouseholdMembersService],
  exports: [HouseholdMembersService],
})
export class HouseholdMembersModule {}
