// Local copy of the types from apicontract.md (contract v1).
// Later, Mohammad's shared types.ts can replace these imports.

export type PantryStatus = 'LOW STOCK' | 'USE SOON' | 'EXPIRED' | 'OK';
export type ShoppingStatus = 'Pending' | 'Purchased';
export type DateOnly = string; // YYYY-MM-DD
export type Timestamp = string; // ISO UTC timestamp

export interface Category {
  id: number;
  name: string;
}

export interface CategoryList {
  items: Category[];
}

export interface PantryItem {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  quantity: number;
  unit: string;
  minimumQuantity: number;
  expiryDate: DateOnly | null;
  statuses: PantryStatus[];
  statusReasons: string[];
  daysUntilExpiry: number | null; // negative when expired
}

export interface PantryInput {
  name: string;
  categoryId: number;
  quantity: number;
  unit: string;
  minimumQuantity: number;
  expiryDate?: DateOnly | null;
}

export type PantryUpdate = Partial<PantryInput>;

export interface ShoppingEntry {
  id: number;
  name: string;
  quantityToBuy: number;
  unit: string | null;
  pantryItemId: number | null;
  status: ShoppingStatus;
  createdAt: Timestamp;
  purchasedAt: Timestamp | null;
  purchasedQuantity: number | null;
  newExpiryDate: DateOnly | null;
  pantryStatuses: PantryStatus[];
}

export interface PendingSummary {
  total: number;
  linked: number;
  manual: number;
}

export interface ShoppingList {
  asOfDate: DateOnly;
  items: ShoppingEntry[];
  total: number;
  pendingSummary: PendingSummary;
}

export interface ShoppingQuery {
  status?: ShoppingStatus;
  pantryItemId?: number;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string[]>;
}

// The 7 functions our two pages need (same names as the contract).
export interface ItemsApi {
  listCategories(): Promise<CategoryList>;
  getPantryItem(id: number): Promise<PantryItem>;
  createPantryItem(input: PantryInput): Promise<PantryItem>;
  updatePantryItem(id: number, input: PantryUpdate): Promise<PantryItem>;
  usePantryItem(id: number, input: { quantity: number }): Promise<PantryItem>;
  deletePantryItem(id: number): Promise<void>;
  listShoppingEntries(query?: ShoppingQuery): Promise<ShoppingList>;
}