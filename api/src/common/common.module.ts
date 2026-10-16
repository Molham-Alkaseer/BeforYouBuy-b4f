import { Module } from '@nestjs/common';
import { ClockService } from './clock/clock.service';
@Module({ providers: [ClockService], exports: [ClockService] })
export class CommonModule {}
