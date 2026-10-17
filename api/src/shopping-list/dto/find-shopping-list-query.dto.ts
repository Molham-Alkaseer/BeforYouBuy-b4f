import { ValidateIf, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryInteger } from '../../pantry/dto/validation';
import { EntryStatus } from '../schemas/shopping-entry.schema';

export class FindShoppingListQueryDto {
  @ApiPropertyOptional({ enum: EntryStatus })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @ValidateIf((_object, value) => value !== undefined)
  @QueryInteger()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  pantryItemId?: number;
}
