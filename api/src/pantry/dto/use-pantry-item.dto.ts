import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";
export class UsePantryItemDto {
  @ApiProperty({ example: 1, minimum: 0, exclusiveMinimum: true })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(Number.MIN_VALUE)
  quantity: number;
}
