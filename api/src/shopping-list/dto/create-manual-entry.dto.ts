import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '../../pantry/dto/validation';

export class CreateManualEntryDto {
  @ApiProperty({ example: 'Birthday candles' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, minimum: 0, exclusiveMinimum: true })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  quantityToBuy: number;
}
