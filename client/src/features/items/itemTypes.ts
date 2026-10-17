// Compatibility exports keep item components on the shared API contract.
import type { ApiClient } from '../../types';
export type {
  PantryStatus, ShoppingStatus, DateOnly, Timestamp, Category, CategoryList,
  PantryItem, PantryInput, PantryUpdate, ShoppingEntry, PendingSummary,
  ShoppingList, ShoppingQuery, ApiErrorBody,
} from '../../types';

export type ItemsApi = Pick<ApiClient,
  | 'listCategories'
  | 'getPantryItem'
  | 'createPantryItem'
  | 'updatePantryItem'
  | 'usePantryItem'
  | 'deletePantryItem'
  | 'listShoppingEntries'
>;
