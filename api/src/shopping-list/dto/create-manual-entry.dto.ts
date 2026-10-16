import { IsString, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateManualEntryDto {
  @ApiProperty({ 
    description: 'The name of the item to buy (must not duplicate existing pending items)', 
    example: 'Birthday candles' 
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()) 
  name: string;

  @ApiProperty({ 
    description: 'The quantity requested to buy (must be a positive number)', 
    example: 1,
    minimum: 0.01
  })
  @IsNumber({ allowNaN: false, allowInfinity: false }) 
  @IsPositive()
  @Min(0.01)
  quantityToBuy: number;
}