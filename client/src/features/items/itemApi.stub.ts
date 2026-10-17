import { createApiError } from './apiError';
import type {
  Category,
  CategoryList,
  DateOnly,
  ItemsApi,
  PantryInput,
  PantryItem,
  PantryStatus,
  PantryUpdate,
  ShoppingEntry,
  ShoppingList,
  ShoppingQuery,
} from './itemTypes';

// TEMPORARY development stub. Fake calculations live here only.
// "Today" is frozen to the contract's mock date (Asia/Damascus).
const TODAY: DateOnly = '2026-10-16';
const WAIT_MS = 200;

// What is really stored: no categoryName, statuses, reasons or days.
type StoredItem = Omit<
  PantryItem,
  'categoryName' | 'statuses' | 'statusReasons' | 'daysUntilExpiry'
>;

const CATEGORIES: Category[] = [
  { id: 1, name: 'Dairy' },
  { id: 2, name: 'Produce' },
  { id: 3, name: 'Meat & Fish' },
  { id: 4, name: 'Frozen' },
  { id: 5, name: 'Grains & Pasta' },
  { id: 6, name: 'Pantry staples' },
  { id: 7, name: 'Drinks' },
];

const INITIAL_ITEMS: StoredItem[] = [
  { id: 1, name: 'Milk', categoryId: 1, quantity: 1, unit: 'litres', minimumQuantity: 2, expiryDate: '2026-10-18' },
  { id: 2, name: 'Yoghurt', categoryId: 1, quantity: 2, unit: 'pots', minimumQuantity: 3, expiryDate: '2026-10-15' },
  { id: 13, name: 'Rice', categoryId: 5, quantity: 4, unit: 'kg', minimumQuantity: 2, expiryDate: null },
];

// Milk (101) and Yoghurt (102) have a Pending entry, so they cannot be deleted.
const PENDING_ENTRIES: ShoppingEntry[] = [
  {
    id: 101, name: 'Milk', quantityToBuy: 1, unit: 'litres', pantryItemId: 1,
    status: 'Pending', createdAt: '2026-10-16T08:00:00.000Z', purchasedAt: null,
    purchasedQuantity: null, newExpiryDate: null, pantryStatuses: ['LOW STOCK', 'USE SOON'],
  },
  {
    id: 102, name: 'Yoghurt', quantityToBuy: 3, unit: 'pots', pantryItemId: 2,
    status: 'Pending', createdAt: '2026-10-16T08:00:00.000Z', purchasedAt: null,
    purchasedQuantity: null, newExpiryDate: null, pantryStatuses: ['LOW STOCK', 'EXPIRED'],
  },
];

// Purchase history snapshots: Milk has 3 records, Rice has 1.
const HISTORY: ShoppingEntry[] = [
  {
    id: 205, name: 'Milk', quantityToBuy: 2, unit: 'litres', pantryItemId: 1,
    status: 'Purchased', createdAt: '2026-10-06T08:00:00.000Z', purchasedAt: '2026-10-09T10:00:00.000Z',
    purchasedQuantity: 2, newExpiryDate: '2026-10-19', pantryStatuses: [],
  },
  {
    id: 204, name: 'Milk', quantityToBuy: 2, unit: 'litres', pantryItemId: 1,
    status: 'Purchased', createdAt: '2026-09-29T08:00:00.000Z', purchasedAt: '2026-10-02T10:00:00.000Z',
    purchasedQuantity: 2, newExpiryDate: '2026-10-12', pantryStatuses: [],
  },
  {
    id: 206, name: 'Milk', quantityToBuy: 3, unit: 'litres', pantryItemId: 1,
    status: 'Purchased', createdAt: '2026-09-23T08:00:00.000Z', purchasedAt: '2026-09-25T10:00:00.000Z',
    purchasedQuantity: 3, newExpiryDate: '2026-10-06', pantryStatuses: [],
  },
  {
    id: 201, name: 'Rice', quantityToBuy: 2, unit: 'kg', pantryItemId: 13,
    status: 'Purchased', createdAt: '2026-10-06T08:00:00.000Z', purchasedAt: '2026-10-09T10:00:00.000Z',
    purchasedQuantity: 2, newExpiryDate: null, pantryStatuses: [],
  },
];

// Same numbers as the full fixture (6 linked + 1 manual entry).
const PENDING_SUMMARY = { total: 7, linked: 6, manual: 1 };

let items: StoredItem[] = INITIAL_ITEMS.map((item) => ({ ...item }));
let nextId = 21;

// Call this to put the stub back to its starting data.
export function resetItemStub(): void {
  items = INITIAL_ITEMS.map((item) => ({ ...item }));
  nextId = 21;
}

// ---------- small helpers ----------

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, WAIT_MS));
}

function fail(
  statusCode: number,
  code: string,
  message: string,
  fieldErrors: Record<string, string[]> = {},
): never {
  throw createApiError({ statusCode, code, message, fieldErrors });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function isValidDate(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// Whole days between two YYYY-MM-DD dates, with no timezone shifts.
function daysBetween(from: DateOnly, to: DateOnly): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(diff / 86400000);
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// The fake "backend calculation": turns a stored item into a full PantryItem.
function toPantryItem(stored: StoredItem): PantryItem {
  const statuses: PantryStatus[] = [];
  const statusReasons: string[] = [];
  const days =
    stored.expiryDate === null ? null : daysBetween(TODAY, stored.expiryDate);

  if (stored.quantity < stored.minimumQuantity) {
    const gap = round(stored.minimumQuantity - stored.quantity);
    statuses.push('LOW STOCK');
    statusReasons.push(
      `${gap} ${stored.unit} below the minimum of ${stored.minimumQuantity} ${stored.unit}`,
    );
  }

  if (days !== null && days < 0) {
    statuses.push('EXPIRED');
    statusReasons.push(`Expired ${plural(-days, 'day')} ago`);
  } else if (days !== null && days <= 3) {
    statuses.push('USE SOON');
    statusReasons.push(
      days === 0 ? 'Expires today' : `Expires in ${plural(days, 'day')}`,
    );
  }

  if (statuses.length === 0) {
    statuses.push('OK');
    statusReasons.push('Stock is sufficient and no expiry action is needed');
  }

  return {
    ...stored,
    categoryName:
      CATEGORIES.find((category) => category.id === stored.categoryId)?.name ??
      'Unknown',
    statuses,
    statusReasons,
    daysUntilExpiry: days,
  };
}

function findStored(id: number): StoredItem {
  const found = items.find((item) => item.id === id);
  if (!found) {
    fail(404, 'ITEM_NOT_FOUND', 'Item not found.');
  }
  return found;
}

// Checks only the fields that were sent (or all of them when creating).
function checkFields(
  input: PantryUpdate,
  requireAll: boolean,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (field: string, message: string) => {
    errors[field] = [...(errors[field] ?? []), message];
  };

  if (input.name !== undefined || requireAll) {
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      add('name', 'Enter a name for the item.');
    }
  }

  if (input.unit !== undefined || requireAll) {
    if (typeof input.unit !== 'string' || input.unit.trim() === '') {
      add('unit', 'Enter a unit, such as litres or kg.');
    }
  }

  for (const field of ['quantity', 'minimumQuantity'] as const) {
    const value = input[field];
    if (value !== undefined || requireAll) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        const label = field === 'quantity' ? 'Quantity' : 'Minimum';
        add(field, `${label} must be 0 or more. Decimals such as 0.5 are fine.`);
      }
    }
  }

  if (input.categoryId !== undefined || requireAll) {
    if (typeof input.categoryId !== 'number' || !Number.isInteger(input.categoryId)) {
      add('categoryId', 'Choose a category.');
    }
  }

  if (
    input.expiryDate !== undefined &&
    input.expiryDate !== null &&
    !isValidDate(input.expiryDate)
  ) {
    add('expiryDate', 'Enter a valid date.');
  }

  return errors;
}

function throwIfInvalid(fieldErrors: Record<string, string[]>): void {
  const count = Object.values(fieldErrors).reduce(
    (sum, list) => sum + list.length,
    0,
  );
  if (count > 0) {
    fail(
      400,
      'VALIDATION_ERROR',
      `This item could not be saved. Please fix the ${plural(count, 'problem')} marked below.`,
      fieldErrors,
    );
  }
}

function checkCategoryExists(categoryId: number): void {
  if (!CATEGORIES.some((category) => category.id === categoryId)) {
    fail(400, 'INVALID_CATEGORY', 'That category does not exist.', {
      categoryId: ['Choose one of the listed categories.'],
    });
  }
}

function checkNameIsFree(name: string, ignoreId?: number): void {
  const taken = items.some(
    (item) => item.id !== ignoreId && normalize(item.name) === normalize(name),
  );
  if (taken) {
    fail(
      409,
      'DUPLICATE_ITEM_NAME',
      `An item called ${name.trim()} is already in your pantry.`,
      {
        name: [
          'Names are the same even if capitals or surrounding spaces differ.',
        ],
      },
    );
  }
}

// ---------- the 7 functions (same names as the contract) ----------

export const itemApiStub: ItemsApi = {
  async listCategories(): Promise<CategoryList> {
    await wait();
    return { items: copy(CATEGORIES) };
  },

  async getPantryItem(id: number): Promise<PantryItem> {
    await wait();
    return toPantryItem(findStored(id));
  },

  async createPantryItem(input: PantryInput): Promise<PantryItem> {
    await wait();
    throwIfInvalid(checkFields(input, true));
    checkCategoryExists(input.categoryId);
    checkNameIsFree(input.name);

    const stored: StoredItem = {
      id: nextId,
      name: input.name.trim(),
      categoryId: input.categoryId,
      quantity: input.quantity,
      unit: input.unit.trim(),
      minimumQuantity: input.minimumQuantity,
      expiryDate: input.expiryDate ?? null,
    };
    nextId += 1;
    items.push(stored);
    return toPantryItem(stored);
  },

  async updatePantryItem(id: number, input: PantryUpdate): Promise<PantryItem> {
    await wait();
    const stored = findStored(id);

    if (Object.values(input).every((value) => value === undefined)) {
      fail(400, 'VALIDATION_ERROR', 'Send at least one field to change.');
    }
    throwIfInvalid(checkFields(input, false));

    if (input.categoryId !== undefined) {
      checkCategoryExists(input.categoryId);
    }
    if (input.name !== undefined) {
      checkNameIsFree(input.name, id);
    }

    if (input.name !== undefined) stored.name = input.name.trim();
    if (input.categoryId !== undefined) stored.categoryId = input.categoryId;
    if (input.quantity !== undefined) stored.quantity = input.quantity;
    if (input.unit !== undefined) stored.unit = input.unit.trim();
    if (input.minimumQuantity !== undefined) {
      stored.minimumQuantity = input.minimumQuantity;
    }
    // undefined = keep the date, null = clear it, a string = replace it
    if (input.expiryDate !== undefined) stored.expiryDate = input.expiryDate;

    return toPantryItem(stored);
  },

  async usePantryItem(
    id: number,
    input: { quantity: number },
  ): Promise<PantryItem> {
    await wait();
    const stored = findStored(id);
    const used = input.quantity;

    if (typeof used !== 'number' || !Number.isFinite(used) || used <= 0) {
      fail(400, 'VALIDATION_ERROR', 'Enter an amount greater than 0.', {
        quantity: ['The amount used must be greater than 0.'],
      });
    }

    if (used > stored.quantity) {
      fail(
        400,
        'INSUFFICIENT_STOCK',
        `There is not enough ${stored.name}. Only ${stored.quantity} ${stored.unit} are left.`,
        {
          quantity: [
            `Use no more than the available quantity: ${stored.quantity} ${stored.unit}.`,
          ],
        },
      );
    }

    stored.quantity = round(stored.quantity - used);
    return toPantryItem(stored);
  },

  async deletePantryItem(id: number): Promise<void> {
    await wait();
    const stored = findStored(id);

    const hasPending = PENDING_ENTRIES.some(
      (entry) => entry.pantryItemId === id,
    );
    if (hasPending) {
      fail(
        409,
        'ITEM_HAS_PENDING_ENTRY',
        `${stored.name} cannot be deleted yet. Remove or purchase its pending shopping entry first.`,
      );
    }

    items = items.filter((item) => item.id !== id);
  },

  async listShoppingEntries(query: ShoppingQuery = {}): Promise<ShoppingList> {
    await wait();
    const matches = (entry: ShoppingEntry) =>
      (query.status === undefined || entry.status === query.status) &&
      (query.pantryItemId === undefined ||
        entry.pantryItemId === query.pantryItemId);

    // Pending first (oldest first), then Purchased (newest first).
    const pending = PENDING_ENTRIES.filter(matches).sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
    );
    const purchased = HISTORY.filter(matches).sort(
      (a, b) =>
        (b.purchasedAt ?? '').localeCompare(a.purchasedAt ?? '') || b.id - a.id,
    );
    const list = [...pending, ...purchased];

    return {
      asOfDate: TODAY,
      items: copy(list),
      total: list.length,
      pendingSummary: { ...PENDING_SUMMARY },
    };
  },
};