import { ModelDefinition } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  HouseholdMember,
  HouseholdMemberSchema,
} from '../household-members/schemas/household-member.schema';
import {
  PantryItem,
  PantryItemSchema,
} from '../pantry/schemas/pantry-item.schema';
import {
  ShoppingEntry,
  ShoppingEntrySchema,
} from '../shopping-list/schemas/shopping-entry.schema';

export const domainModels: ModelDefinition[] = [
  { name: User.name, schema: UserSchema, collection: 'users' },
  {
    name: HouseholdMember.name,
    schema: HouseholdMemberSchema,
    collection: 'household_members',
  },
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
