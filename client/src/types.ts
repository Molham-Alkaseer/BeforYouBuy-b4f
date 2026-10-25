export type PantryStatus = "LOW STOCK" | "USE SOON" | "EXPIRED" | "OK";
export type ShoppingStatus = "Pending" | "Purchased";
export type DateOnly = string;
export type Timestamp = string;

export interface Category {
  id: number;
  name: string;
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
  daysUntilExpiry: number | null;
}

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

export interface CategoryList {
  items: Category[];
}

export interface PantryList {
  asOfDate: DateOnly;
  items: PantryItem[];
  total: number;
}

export interface ShoppingList {
  asOfDate: DateOnly;
  items: ShoppingEntry[];
  total: number;
  pendingSummary: PendingSummary;
}

export interface Dashboard {
  asOfDate: DateOnly;
  totalItems: number;
  statusCounts: Record<PantryStatus, number>;
  urgentItems: PantryItem[];
  pendingShopping: PendingSummary;
  categoryCounts: {
    categoryId: number;
    categoryName: string;
    count: number;
  }[];
}

export interface GenerateResult {
  added: number;
  updated: number;
  unchanged: number;
  pending: ShoppingList;
}

export interface PurchaseResult {
  entry: ShoppingEntry;
  pantryItem: PantryItem | null;
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

export interface PantryQuery {
  name?: string;
  categoryId?: number;
  status?: PantryStatus;
}

export interface ShoppingQuery {
  status?: ShoppingStatus;
  pantryItemId?: number;
}

export interface PurchaseInput {
  purchasedQuantity: number;
  newExpiryDate?: DateOnly;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string[]>;
}

export class ApiError extends Error implements ApiErrorBody {
  statusCode: number;
  code: string;
  fieldErrors: Record<string, string[]>;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors ?? {};
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiClient {
  listCategories(): Promise<CategoryList>;
  listPantry(query?: PantryQuery): Promise<PantryList>;
  getPantryItem(id: number): Promise<PantryItem>;
  createPantryItem(input: PantryInput): Promise<PantryItem>;
  updatePantryItem(id: number, input: PantryUpdate): Promise<PantryItem>;
  usePantryItem(id: number, input: { quantity: number }): Promise<PantryItem>;
  deletePantryItem(id: number): Promise<void>;
  getDashboard(): Promise<Dashboard>;
  listShoppingEntries(query?: ShoppingQuery): Promise<ShoppingList>;
  generateShoppingList(): Promise<GenerateResult>;
  createManualEntry(input: {
    name: string;
    quantityToBuy: number;
  }): Promise<ShoppingEntry>;
  purchaseEntry(id: number, input: PurchaseInput): Promise<PurchaseResult>;
  deleteShoppingEntry(id: number): Promise<void>;
}

export type HouseholdRole = "member" | "admin" | "owner";

export interface SafeUser {
  id: number;
  email: string;
  name: string;
  createdAt: Timestamp;
  householdRole: HouseholdRole;
  householdId: number;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: SafeUser;
}

export interface AuthClient {
  register(input: RegisterInput): Promise<SafeUser>;
  login(input: LoginInput): Promise<LoginResult>;
  me(): Promise<SafeUser>;
  listMembers(): Promise<{ items: SafeUser[] }>;
  addMember(input: RegisterInput): Promise<SafeUser>;
}
