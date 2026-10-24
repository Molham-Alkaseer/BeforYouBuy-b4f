import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly, Trim } from './validation';

export class CreatePantryItemDto {
  @ApiProperty({ example: 'Milk' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId: number;

  @ApiProperty({ example: 1, minimum: 0 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 'litres' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minimumQuantity: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-18',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateOnly()
  expiryDate?: string | null;
}
