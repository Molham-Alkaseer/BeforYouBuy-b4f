import { PartialType } from '@nestjs/swagger';
import { CreatePantryItemDto } from './create-pantry-item.dto';

// Only omission skips validation; null is accepted exclusively for expiryDate.
export class UpdatePantryItemDto extends PartialType(CreatePantryItemDto, {
  skipNullProperties: false,
}) {}
