import { IsOptional, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EntryStatus } from '../schemas/shopping-entry.schema';

export class FindShoppingListQueryDto {
  @ApiPropertyOptional({ 
    enum: EntryStatus, 
    description: 'Filter entries by their status (Pending or Purchased)' 
  })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @ApiPropertyOptional({ 
    description: 'Filter entries by a specific pantry item ID' 
  })
  @IsOptional()
  @Type(() => Number) 
  @IsNumber()
  pantryItemId?: number;
}