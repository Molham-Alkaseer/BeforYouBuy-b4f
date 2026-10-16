import { IsNumber, IsPositive, IsOptional, IsString, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseEntryDto {
  @ApiProperty({ 
    description: 'The actual quantity purchased (must be greater than zero)', 
    example: 2,
    minimum: 0.01
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Min(0.01)
  purchasedQuantity: number;

  @ApiPropertyOptional({ 
    description: 'New expiry date (YYYY-MM-DD). Required if the linked pantry item was expired.', 
    example: '2026-10-25' 
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expiry date must be in YYYY-MM-DD format' })
  newExpiryDate?: string;
}