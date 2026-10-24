import { IsNumber, IsPositive, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateOnly } from '../../pantry/dto/validation';

export class PurchaseEntryDto {
  @ApiProperty({ example: 2, minimum: 0, exclusiveMinimum: true })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  purchasedQuantity: number;

  @ApiPropertyOptional({
    example: '2026-10-25',
    format: 'date',
    description:
      'Required when replacing expired stock; not allowed for manual entries.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateOnly()
  newExpiryDate?: string;
}
