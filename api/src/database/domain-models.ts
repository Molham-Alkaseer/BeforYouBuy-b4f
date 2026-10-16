import { ModelDefinition } from '@nestjs/mongoose';
import * as pantry from '../pantry/schemas/pantry-item.schema';
import * as shopping from '../shopping-list/schemas/shopping-entry.schema';
import { Schema } from 'mongoose';

// Import the owners' schemas only. Never manufacture replacement domain schemas.
// Until owners export their schemas, categories and isolated service tests still work.
const pantrySchema = (pantry as unknown as { PantryItemSchema?: Schema })
  .PantryItemSchema;
const shoppingSchema = (shopping as unknown as { ShoppingEntrySchema?: Schema })
  .ShoppingEntrySchema;

export const domainModels: ModelDefinition[] = [
  ...(pantrySchema
    ? [
        {
          name: pantry.PantryItem.name,
          schema: pantrySchema,
          collection: 'pantry_items',
        },
      ]
    : []),
  ...(shoppingSchema
    ? [
        {
          name: shopping.ShoppingEntry.name,
          schema: shoppingSchema,
          collection: 'shopping_entries',
        },
      ]
    : []),
];

export const missingDomainSchemas = [
  ...(!pantrySchema ? ['PantryItemSchema (Mustafa)'] : []),
  ...(!shoppingSchema ? ['ShoppingEntrySchema (Allaith)'] : []),
];
