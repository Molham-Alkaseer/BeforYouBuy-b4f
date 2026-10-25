import { request, getAuthHeaders } from '../api';
import {
  ApiClient,
  CategoryList,
  Dashboard,
  GenerateResult,
  PantryInput,
  PantryItem,
  PantryList,
  PantryQuery,
  PantryUpdate,
  PurchaseInput,
  PurchaseResult,
  ShoppingEntry,
  ShoppingList,
  ShoppingQuery,
} from '../types';

function authInit(options?: RequestInit): RequestInit {
  return {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options?.headers ?? {}),
    },
  };
}


function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') continue;
      searchParams.append(key, trimmed);
    } else {
      searchParams.append(key, String(value));
    }
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const httpApi: ApiClient = {
  listCategories(): Promise<CategoryList> {
    return request<CategoryList>('/categories', authInit());
  },

  listPantry(query?: PantryQuery): Promise<PantryList> {
    const qs = buildQueryString(query as Record<string, unknown>);
    return request<PantryList>(`/pantry${qs}`, authInit());
  },

  getPantryItem(id: number): Promise<PantryItem> {
    return request<PantryItem>(`/pantry/${encodeURIComponent(id)}`, authInit());
  },

  createPantryItem(input: PantryInput): Promise<PantryItem> {
    return request<PantryItem>('/pantry', authInit({
      method: 'POST',
      body: JSON.stringify(input),
    }));
  },

  updatePantryItem(id: number, input: PantryUpdate): Promise<PantryItem> {
    return request<PantryItem>(`/pantry/${encodeURIComponent(id)}`, authInit({
      method: 'PATCH',
      body: JSON.stringify(input),
    }));
  },

  usePantryItem(id: number, input: { quantity: number }): Promise<PantryItem> {
    return request<PantryItem>(`/pantry/${encodeURIComponent(id)}/use`, authInit({
      method: 'POST',
      body: JSON.stringify(input),
    }));
  },

  deletePantryItem(id: number): Promise<void> {
    return request<void>(`/pantry/${encodeURIComponent(id)}`, authInit({
      method: 'DELETE',
    }));
  },

  getDashboard(): Promise<Dashboard> {
    return request<Dashboard>('/dashboard', authInit());
  },

  listShoppingEntries(query?: ShoppingQuery): Promise<ShoppingList> {
    const qs = buildQueryString(query as Record<string, unknown>);
    return request<ShoppingList>(`/shopping-list${qs}`, authInit());
  },

  generateShoppingList(): Promise<GenerateResult> {
    return request<GenerateResult>('/shopping-list/generate', authInit({
      method: 'POST',
    }));
  },

  createManualEntry(input: { name: string; quantityToBuy: number }): Promise<ShoppingEntry> {
    return request<ShoppingEntry>('/shopping-list', authInit({
      method: 'POST',
      body: JSON.stringify(input),
    }));
  },

  purchaseEntry(id: number, input: PurchaseInput): Promise<PurchaseResult> {
    return request<PurchaseResult>(`/shopping-list/${encodeURIComponent(id)}/purchase`, authInit({
      method: 'POST',
      body: JSON.stringify(input),
    }));
  },

  deleteShoppingEntry(id: number): Promise<void> {
    return request<void>(`/shopping-list/${encodeURIComponent(id)}`, authInit({
      method: 'DELETE',
    }));
  },
};