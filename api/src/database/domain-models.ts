import { ModelDefinition } from '@nestjs/mongoose';
import {
  PantryItem,
  PantryItemSchema,
} from '../pantry/schemas/pantry-item.schema';
import {
  ShoppingEntry,
  ShoppingEntrySchema,
} from '../shopping-list/schemas/shopping-entry.schema';

export const domainModels: ModelDefinition[] = [
  {
    name: PantryItem.name,
    schema: PantryItemSchema,
    collection: 'pantry_items',
  },
  {
    name: ShoppingEntry.name,
    schema: ShoppingEntrySchema,
    collection: 'shopping_entries',
  },
];
export const missingDomainSchemas: string[] = [];
