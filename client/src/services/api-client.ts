import type { ApiClient } from '../types';
import { httpApi } from './http-api';

export const isMockMode = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

async function getAdapter(): Promise<ApiClient> {
  // Vite removes this development-only import from production builds.
  if (import.meta.env.DEV && isMockMode) {
    const { mockApi } = await import('../mocks/mock-api');
    return mockApi;
  }
  return httpApi;
}

// Every page uses this object; the imported mock module shares one state.
export const api: ApiClient = {
  async listCategories() {
    return (await getAdapter()).listCategories();
  },
  async listPantry(query) {
    return (await getAdapter()).listPantry(query);
  },
  async getPantryItem(id) {
    return (await getAdapter()).getPantryItem(id);
  },
  async createPantryItem(input) {
    return (await getAdapter()).createPantryItem(input);
  },
  async updatePantryItem(id, input) {
    return (await getAdapter()).updatePantryItem(id, input);
  },
  async usePantryItem(id, input) {
    return (await getAdapter()).usePantryItem(id, input);
  },
  async deletePantryItem(id) {
    return (await getAdapter()).deletePantryItem(id);
  },
  async getDashboard() {
    return (await getAdapter()).getDashboard();
  },
  async listShoppingEntries(query) {
    return (await getAdapter()).listShoppingEntries(query);
  },
  async generateShoppingList() {
    return (await getAdapter()).generateShoppingList();
  },
  async createManualEntry(input) {
    return (await getAdapter()).createManualEntry(input);
  },
  async purchaseEntry(id, input) {
    return (await getAdapter()).purchaseEntry(id, input);
  },
  async deleteShoppingEntry(id) {
    return (await getAdapter()).deleteShoppingEntry(id);
  },
};

export { ApiError } from '../types';
export type { ApiClient } from '../types';
