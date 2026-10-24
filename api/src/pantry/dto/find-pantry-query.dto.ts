import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min, ValidateIf } from 'class-validator';
import { PANTRY_STATUSES, PantryStatus } from '../pantry-status';
import { QueryInteger, Trim } from './validation';
export class FindPantryQueryDto {
  @ApiPropertyOptional({
    description: 'Literal case-insensitive partial name',
    example: 'mil',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Trim()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @QueryInteger()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId?: number;

  @ApiPropertyOptional({ enum: PANTRY_STATUSES })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(PANTRY_STATUSES)
  status?: PantryStatus;
}
