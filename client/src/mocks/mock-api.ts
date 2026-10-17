import rawFixture from "./mock-data.json";
import {
  ApiClient,
  ApiError,
  Category,
  CategoryList,
  Dashboard,
  GenerateResult,
  PantryInput,
  PantryItem,
  PantryList,
  PantryQuery,
  PantryStatus,
  PantryUpdate,
  PendingSummary,
  PurchaseInput,
  PurchaseResult,
  ShoppingEntry,
  ShoppingList,
  ShoppingQuery,
} from "../types";

export const FIXED_TODAY = "2026-10-16";
export const FIXED_NOW_ISO = "2026-10-16T09:00:00.000Z";

export type SimulatedMockMode = "normal" | "empty" | "404" | "409" | "500";

interface MockSimulationConfig {
  latencyMs: number;
  mode: SimulatedMockMode;
}

interface StoredPantryRecord {
  id: number;
  name: string;
  categoryId: number;
  quantity: number;
  unit: string;
  minimumQuantity: number;
  expiryDate: string | null;
}

interface StoredShoppingRecord {
  id: number;
  name: string;
  quantityToBuy: number;
  unit: string | null;
  pantryItemId: number | null;
  status: "Pending" | "Purchased";
  createdAt: string;
  purchasedAt: string | null;
  purchasedQuantity: number | null;
  newExpiryDate: string | null;
}

interface MockState {
  categories: Category[];
  pantryItems: StoredPantryRecord[];
  shoppingEntries: StoredShoppingRecord[];
  nextCategoryId: number;
  nextPantryId: number;
  nextShoppingId: number;
}

const simulationConfig: MockSimulationConfig = {
  latencyMs: 0,
  mode: "normal",
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function roundQuantity(num: number): number {
  return Number(Math.round(Number(num + "e6")) + "e-6");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function computeDaysUntilExpiry(
  expiryDate: string | null,
  today: string,
): number | null {
  if (!expiryDate) return null;
  const [ey, em, ed] = expiryDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const expUtc = Date.UTC(ey, em - 1, ed);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((expUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

export function calculateMockPantryStatus(
  item: {
    quantity: number;
    minimumQuantity: number;
    unit: string;
    expiryDate: string | null;
  },
  today: string = FIXED_TODAY,
): {
  statuses: PantryStatus[];
  statusReasons: string[];
  daysUntilExpiry: number | null;
} {
  const statuses: PantryStatus[] = [];
  const statusReasons: string[] = [];
  const daysUntilExpiry = computeDaysUntilExpiry(item.expiryDate, today);

  if (item.quantity < item.minimumQuantity) {
    const diff = roundQuantity(item.minimumQuantity - item.quantity);
    statuses.push("LOW STOCK");
    statusReasons.push(
      `${diff} ${item.unit} below the minimum of ${item.minimumQuantity} ${item.unit}`,
    );
  }

  if (daysUntilExpiry !== null) {
    if (daysUntilExpiry < 0) {
      const daysAgo = Math.abs(daysUntilExpiry);
      statuses.push("EXPIRED");
      statusReasons.push(
        daysAgo === 1 ? "Expired 1 day ago" : `Expired ${daysAgo} days ago`,
      );
    } else if (daysUntilExpiry <= 3) {
      statuses.push("USE SOON");
      statusReasons.push(
        daysUntilExpiry === 0
          ? "Expires today"
          : daysUntilExpiry === 1
            ? "Expires in 1 day"
            : `Expires in ${daysUntilExpiry} days`,
      );
    }
  }

  if (statuses.length === 0) {
    statuses.push("OK");
    statusReasons.push("Stock is sufficient and no expiry action is needed");
  }

  return { statuses, statusReasons, daysUntilExpiry };
}

function createInitialState(): MockState {
  const cloned = deepClone(rawFixture);

  const categories: Category[] = cloned.categories.items.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const pantryItems: StoredPantryRecord[] = cloned.pantry.items.map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    quantity: p.quantity,
    unit: p.unit,
    minimumQuantity: p.minimumQuantity,
    expiryDate: p.expiryDate,
  }));

  const pendingEntries: StoredShoppingRecord[] =
    cloned.shoppingPending.items.map((s) => ({
      id: s.id,
      name: s.name,
      quantityToBuy: s.quantityToBuy,
      unit: s.unit,
      pantryItemId: s.pantryItemId,
      status: "Pending",
      createdAt: s.createdAt,
      purchasedAt: s.purchasedAt,
      purchasedQuantity: s.purchasedQuantity,
      newExpiryDate: s.newExpiryDate,
    }));

  const purchasedEntries: StoredShoppingRecord[] =
    cloned.shoppingPurchased.items.map((s) => ({
      id: s.id,
      name: s.name,
      quantityToBuy: s.quantityToBuy,
      unit: s.unit,
      pantryItemId: s.pantryItemId,
      status: "Purchased",
      createdAt: s.createdAt,
      purchasedAt: s.purchasedAt,
      purchasedQuantity: s.purchasedQuantity,
      newExpiryDate: s.newExpiryDate,
    }));

  return {
    categories,
    pantryItems,
    shoppingEntries: [...pendingEntries, ...purchasedEntries],
    nextCategoryId: 8,
    nextPantryId: 21,
    nextShoppingId: 207,
  };
}

let state: MockState = createInitialState();

export function resetMockState(): void {
  state = createInitialState();
  simulationConfig.latencyMs = 0;
  simulationConfig.mode = "normal";
}

export function configureMockSimulation(
  options: Partial<MockSimulationConfig>,
): void {
  if (options.latencyMs !== undefined) {
    simulationConfig.latencyMs = Math.max(0, options.latencyMs);
  }
  if (options.mode !== undefined) {
    simulationConfig.mode = options.mode;
  }
}

export function getMockSimulationConfig(): MockSimulationConfig {
  return { ...simulationConfig };
}

async function applySimulationGate(): Promise<void> {
  if (simulationConfig.latencyMs > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, simulationConfig.latencyMs),
    );
  }

  if (simulationConfig.mode === "404") {
    throw new ApiError({
      statusCode: 404,
      code: "ITEM_NOT_FOUND",
      message: "The requested resource was not found.",
      fieldErrors: {},
    });
  }

  if (simulationConfig.mode === "409") {
    throw new ApiError({
      statusCode: 409,
      code: "PENDING_NAME_CONFLICT",
      message: "A conflicting record already exists.",
      fieldErrors: {},
    });
  }

  if (simulationConfig.mode === "500") {
    throw new ApiError({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred. Please try again.",
      fieldErrors: {},
    });
  }
}

function enrichPantryItem(raw: StoredPantryRecord): PantryItem {
  const category = state.categories.find((c) => c.id === raw.categoryId);
  const { statuses, statusReasons, daysUntilExpiry } =
    calculateMockPantryStatus(raw, FIXED_TODAY);

  return {
    id: raw.id,
    name: raw.name,
    categoryId: raw.categoryId,
    categoryName: category ? category.name : "Unknown",
    quantity: raw.quantity,
    unit: raw.unit,
    minimumQuantity: raw.minimumQuantity,
    expiryDate: raw.expiryDate,
    statuses,
    statusReasons,
    daysUntilExpiry,
  };
}

function enrichShoppingEntry(raw: StoredShoppingRecord): ShoppingEntry {
  let pantryStatuses: PantryStatus[] = [];

  if (raw.status === "Pending" && raw.pantryItemId !== null) {
    const linkedItem = state.pantryItems.find((p) => p.id === raw.pantryItemId);
    if (linkedItem) {
      pantryStatuses = calculateMockPantryStatus(
        linkedItem,
        FIXED_TODAY,
      ).statuses;
    }
  }

  return {
    id: raw.id,
    name: raw.name,
    quantityToBuy: raw.quantityToBuy,
    unit: raw.unit,
    pantryItemId: raw.pantryItemId,
    status: raw.status,
    createdAt: raw.createdAt,
    purchasedAt: raw.purchasedAt,
    purchasedQuantity: raw.purchasedQuantity,
    newExpiryDate: raw.newExpiryDate,
    pantryStatuses,
  };
}

function computePendingSummary(): PendingSummary {
  if (simulationConfig.mode === "empty") {
    return { total: 0, linked: 0, manual: 0 };
  }
  const pending = state.shoppingEntries.filter((e) => e.status === "Pending");
  const linked = pending.filter((e) => e.pantryItemId !== null).length;
  const manual = pending.length - linked;
  return {
    total: pending.length,
    linked,
    manual,
  };
}

function sortShoppingRecords(
  records: StoredShoppingRecord[],
): StoredShoppingRecord[] {
  const pending = records
    .filter((r) => r.status === "Pending")
    .sort((a, b) => {
      const timeCmp = a.createdAt.localeCompare(b.createdAt);
      return timeCmp !== 0 ? timeCmp : a.id - b.id;
    });

  const purchased = records
    .filter((r) => r.status === "Purchased")
    .sort((a, b) => {
      const aTime = a.purchasedAt ?? "";
      const bTime = b.purchasedAt ?? "";
      const timeCmp = bTime.localeCompare(aTime);
      return timeCmp !== 0 ? timeCmp : b.id - a.id;
    });

  return [...pending, ...purchased];
}

function validateIdParam(id: number, codeIfInvalid = "VALIDATION_ERROR"): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError({
      statusCode: 400,
      code: codeIfInvalid,
      message: "Resource ID must be a positive integer.",
      fieldErrors: { id: ["ID must be a positive integer."] },
    });
  }
}

export const mockApi: ApiClient = {
  async listCategories(): Promise<CategoryList> {
    await applySimulationGate();
    if (simulationConfig.mode === "empty") {
      return { items: [] };
    }
    const sorted = [...state.categories].sort((a, b) => a.id - b.id);
    return deepClone({ items: sorted });
  },

  async listPantry(query?: PantryQuery): Promise<PantryList> {
    await applySimulationGate();
    if (simulationConfig.mode === "empty") {
      return { asOfDate: FIXED_TODAY, items: [], total: 0 };
    }

    let items = [...state.pantryItems]
      .sort((a, b) => a.id - b.id)
      .map(enrichPantryItem);

    if (query?.name !== undefined) {
      const trimmed = query.name.trim();
      if (trimmed !== "") {
        const needle = trimmed.toLowerCase();
        items = items.filter((item) =>
          item.name.toLowerCase().includes(needle),
        );
      }
    }

    if (query?.categoryId !== undefined) {
      validateIdParam(Number(query.categoryId));
      items = items.filter(
        (item) => item.categoryId === Number(query.categoryId),
      );
    }

    if (query?.status !== undefined) {
      items = items.filter((item) => item.statuses.includes(query.status!));
    }

    return deepClone({
      asOfDate: FIXED_TODAY,
      items,
      total: items.length,
    });
  },

  async getPantryItem(id: number): Promise<PantryItem> {
    await applySimulationGate();
    validateIdParam(id);

    const found = state.pantryItems.find((item) => item.id === id);
    if (!found) {
      throw new ApiError({
        statusCode: 404,
        code: "ITEM_NOT_FOUND",
        message: `Pantry item ${id} was not found.`,
        fieldErrors: {},
      });
    }

    return deepClone(enrichPantryItem(found));
  },

  async createPantryItem(input: PantryInput): Promise<PantryItem> {
    await applySimulationGate();

    const fieldErrors: Record<string, string[]> = {};
    const trimmedName = typeof input.name === "string" ? input.name.trim() : "";
    const trimmedUnit = typeof input.unit === "string" ? input.unit.trim() : "";

    if (!trimmedName) {
      fieldErrors.name = ["Name is required."];
    }
    if (!trimmedUnit) {
      fieldErrors.unit = ["Unit is required."];
    }
    if (
      typeof input.quantity !== "number" ||
      !Number.isFinite(input.quantity) ||
      input.quantity < 0
    ) {
      fieldErrors.quantity = ["Quantity must be 0 or greater."];
    }
    if (
      typeof input.minimumQuantity !== "number" ||
      !Number.isFinite(input.minimumQuantity) ||
      input.minimumQuantity < 0
    ) {
      fieldErrors.minimumQuantity = ["Minimum quantity must be 0 or greater."];
    }

    const expiryDate = input.expiryDate === undefined ? null : input.expiryDate;
    if (
      expiryDate !== null &&
      (typeof expiryDate !== "string" || !isValidCalendarDate(expiryDate))
    ) {
      fieldErrors.expiryDate = [
        "Expiry date must be a valid YYYY-MM-DD calendar date.",
      ];
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted fields.",
        fieldErrors,
      });
    }

    const category = state.categories.find((c) => c.id === input.categoryId);
    if (!category) {
      throw new ApiError({
        statusCode: 400,
        code: "INVALID_CATEGORY",
        message: "Selected category does not exist.",
        fieldErrors: { categoryId: ["Select a valid category."] },
      });
    }

    const duplicate = state.pantryItems.find(
      (p) => normalizeName(p.name) === normalizeName(trimmedName),
    );
    if (duplicate) {
      throw new ApiError({
        statusCode: 409,
        code: "DUPLICATE_ITEM_NAME",
        message: `An item called ${duplicate.name} is already in your pantry.`,
        fieldErrors: {
          name: [
            "Names are the same even if capitals or surrounding spaces differ.",
          ],
        },
      });
    }

    const newRecord: StoredPantryRecord = {
      id: state.nextPantryId++,
      name: trimmedName,
      categoryId: input.categoryId,
      quantity: roundQuantity(input.quantity),
      unit: trimmedUnit,
      minimumQuantity: roundQuantity(input.minimumQuantity),
      expiryDate,
    };

    state.pantryItems.push(newRecord);
    return deepClone(enrichPantryItem(newRecord));
  },

  async updatePantryItem(id: number, input: PantryUpdate): Promise<PantryItem> {
    await applySimulationGate();
    validateIdParam(id);

    if (!input || Object.keys(input).length === 0) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "At least one field must be provided for update.",
        fieldErrors: {},
      });
    }

    const existing = state.pantryItems.find((item) => item.id === id);
    if (!existing) {
      throw new ApiError({
        statusCode: 404,
        code: "ITEM_NOT_FOUND",
        message: `Pantry item ${id} was not found.`,
        fieldErrors: {},
      });
    }

    const fieldErrors: Record<string, string[]> = {};
    let nextName = existing.name;
    let nextCategoryId = existing.categoryId;
    let nextQuantity = existing.quantity;
    let nextUnit = existing.unit;
    let nextMinQuantity = existing.minimumQuantity;
    let nextExpiryDate = existing.expiryDate;

    if (input.name !== undefined) {
      const trimmed = typeof input.name === "string" ? input.name.trim() : "";
      if (!trimmed) {
        fieldErrors.name = ["Name cannot be blank."];
      } else {
        nextName = trimmed;
      }
    }

    if (input.unit !== undefined) {
      const trimmed = typeof input.unit === "string" ? input.unit.trim() : "";
      if (!trimmed) {
        fieldErrors.unit = ["Unit cannot be blank."];
      } else {
        nextUnit = trimmed;
      }
    }

    if (input.quantity !== undefined) {
      if (
        typeof input.quantity !== "number" ||
        !Number.isFinite(input.quantity) ||
        input.quantity < 0
      ) {
        fieldErrors.quantity = ["Quantity must be 0 or greater."];
      } else {
        nextQuantity = roundQuantity(input.quantity);
      }
    }

    if (input.minimumQuantity !== undefined) {
      if (
        typeof input.minimumQuantity !== "number" ||
        !Number.isFinite(input.minimumQuantity) ||
        input.minimumQuantity < 0
      ) {
        fieldErrors.minimumQuantity = [
          "Minimum quantity must be 0 or greater.",
        ];
      } else {
        nextMinQuantity = roundQuantity(input.minimumQuantity);
      }
    }

    if (input.expiryDate !== undefined) {
      if (
        input.expiryDate !== null &&
        (typeof input.expiryDate !== "string" ||
          !isValidCalendarDate(input.expiryDate))
      ) {
        fieldErrors.expiryDate = [
          "Expiry date must be a valid YYYY-MM-DD calendar date.",
        ];
      } else {
        nextExpiryDate = input.expiryDate;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted fields.",
        fieldErrors,
      });
    }

    if (input.categoryId !== undefined) {
      const category = state.categories.find((c) => c.id === input.categoryId);
      if (!category) {
        throw new ApiError({
          statusCode: 400,
          code: "INVALID_CATEGORY",
          message: "Selected category does not exist.",
          fieldErrors: { categoryId: ["Select a valid category."] },
        });
      }
      nextCategoryId = input.categoryId;
    }

    const duplicate = state.pantryItems.find(
      (p) => p.id !== id && normalizeName(p.name) === normalizeName(nextName),
    );
    if (duplicate) {
      throw new ApiError({
        statusCode: 409,
        code: "DUPLICATE_ITEM_NAME",
        message: `An item called ${duplicate.name} is already in your pantry.`,
        fieldErrors: {
          name: [
            "Names are the same even if capitals or surrounding spaces differ.",
          ],
        },
      });
    }

    existing.name = nextName;
    existing.categoryId = nextCategoryId;
    existing.quantity = nextQuantity;
    existing.unit = nextUnit;
    existing.minimumQuantity = nextMinQuantity;
    existing.expiryDate = nextExpiryDate;

    return deepClone(enrichPantryItem(existing));
  },

  async usePantryItem(
    id: number,
    input: { quantity: number },
  ): Promise<PantryItem> {
    await applySimulationGate();
    validateIdParam(id);

    const existing = state.pantryItems.find((item) => item.id === id);
    if (!existing) {
      throw new ApiError({
        statusCode: 404,
        code: "ITEM_NOT_FOUND",
        message: `Pantry item ${id} was not found.`,
        fieldErrors: {},
      });
    }

    if (
      typeof input?.quantity !== "number" ||
      !Number.isFinite(input.quantity) ||
      input.quantity <= 0
    ) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Quantity used must be greater than 0.",
        fieldErrors: { quantity: ["Enter a positive quantity to use."] },
      });
    }

    if (input.quantity > existing.quantity) {
      throw new ApiError({
        statusCode: 400,
        code: "INSUFFICIENT_STOCK",
        message: `There is not enough ${existing.name}. Only ${existing.quantity} ${existing.unit} are left.`,
        fieldErrors: {
          quantity: [
            `Use no more than the available quantity: ${existing.quantity} ${existing.unit}.`,
          ],
        },
      });
    }

    existing.quantity = roundQuantity(existing.quantity - input.quantity);
    return deepClone(enrichPantryItem(existing));
  },

  async deletePantryItem(id: number): Promise<void> {
    await applySimulationGate();
    validateIdParam(id);

    const index = state.pantryItems.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new ApiError({
        statusCode: 404,
        code: "ITEM_NOT_FOUND",
        message: `Pantry item ${id} was not found.`,
        fieldErrors: {},
      });
    }

    const item = state.pantryItems[index];
    const hasPendingEntry = state.shoppingEntries.some(
      (e) => e.status === "Pending" && e.pantryItemId === id,
    );

    if (hasPendingEntry) {
      throw new ApiError({
        statusCode: 409,
        code: "ITEM_HAS_PENDING_ENTRY",
        message: `${item.name} cannot be deleted yet. Remove or purchase its pending shopping entry first.`,
        fieldErrors: {},
      });
    }

    state.pantryItems.splice(index, 1);
  },

  async getDashboard(): Promise<Dashboard> {
    await applySimulationGate();

    if (simulationConfig.mode === "empty") {
      return {
        asOfDate: FIXED_TODAY,
        totalItems: 0,
        statusCounts: {
          "LOW STOCK": 0,
          "USE SOON": 0,
          EXPIRED: 0,
          OK: 0,
        },
        urgentItems: [],
        pendingShopping: { total: 0, linked: 0, manual: 0 },
        categoryCounts: state.categories.map((c) => ({
          categoryId: c.id,
          categoryName: c.name,
          count: 0,
        })),
      };
    }

    const enrichedItems = state.pantryItems.map(enrichPantryItem);
    const statusCounts: Record<PantryStatus, number> = {
      "LOW STOCK": 0,
      "USE SOON": 0,
      EXPIRED: 0,
      OK: 0,
    };

    for (const item of enrichedItems) {
      for (const st of item.statuses) {
        statusCounts[st] += 1;
      }
    }

    const urgentItems = enrichedItems
      .filter(
        (item) =>
          item.statuses.includes("EXPIRED") ||
          item.statuses.includes("USE SOON"),
      )
      .sort((a, b) => {
        const expA = a.expiryDate ?? "9999-12-31";
        const expB = b.expiryDate ?? "9999-12-31";
        const cmp = expA.localeCompare(expB);
        return cmp !== 0 ? cmp : a.id - b.id;
      });

    const categoryCounts = [...state.categories]
      .sort((a, b) => a.id - b.id)
      .map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        count: state.pantryItems.filter((p) => p.categoryId === cat.id).length,
      }));

    return deepClone({
      asOfDate: FIXED_TODAY,
      totalItems: enrichedItems.length,
      statusCounts,
      urgentItems,
      pendingShopping: computePendingSummary(),
      categoryCounts,
    });
  },

  async listShoppingEntries(query?: ShoppingQuery): Promise<ShoppingList> {
    await applySimulationGate();

    if (simulationConfig.mode === "empty") {
      return {
        asOfDate: FIXED_TODAY,
        items: [],
        total: 0,
        pendingSummary: { total: 0, linked: 0, manual: 0 },
      };
    }

    let records = [...state.shoppingEntries];

    if (query?.status !== undefined) {
      records = records.filter((r) => r.status === query.status);
    }

    if (query?.pantryItemId !== undefined) {
      validateIdParam(Number(query.pantryItemId));
      records = records.filter(
        (r) => r.pantryItemId === Number(query.pantryItemId),
      );
    }

    const sorted = sortShoppingRecords(records).map(enrichShoppingEntry);

    return deepClone({
      asOfDate: FIXED_TODAY,
      items: sorted,
      total: sorted.length,
      pendingSummary: computePendingSummary(),
    });
  },

  async generateShoppingList(): Promise<GenerateResult> {
    await applySimulationGate();

    const enrichedPantry = [...state.pantryItems]
      .sort((a, b) => a.id - b.id)
      .map(enrichPantryItem);

    const eligibleItems = enrichedPantry.filter(
      (item) =>
        item.statuses.includes("LOW STOCK") ||
        item.statuses.includes("EXPIRED"),
    );

    const pendingEntries = state.shoppingEntries.filter(
      (e) => e.status === "Pending",
    );

    for (const item of eligibleItems) {
      const normalizedItemName = normalizeName(item.name);
      const conflictingEntry = pendingEntries.find(
        (entry) =>
          entry.pantryItemId !== item.id &&
          normalizeName(entry.name) === normalizedItemName,
      );

      if (conflictingEntry) {
        throw new ApiError({
          statusCode: 409,
          code: "PENDING_NAME_CONFLICT",
          message: `Cannot generate shopping entry for "${item.name}" because a pending entry with that name already exists. Please remove or purchase the conflicting entry first.`,
          fieldErrors: {
            name: ["A pending shopping entry with this name already exists."],
          },
        });
      }
    }

    let added = 0;
    let updated = 0;
    let unchanged = 0;

    for (const item of eligibleItems) {
      const isExpired = item.statuses.includes("EXPIRED");
      const effectiveQty = isExpired ? 0 : item.quantity;
      const suggestedQty = Math.max(
        1,
        roundQuantity(item.minimumQuantity - effectiveQty),
      );

      const existingEntry = pendingEntries.find(
        (e) => e.pantryItemId === item.id,
      );

      if (!existingEntry) {
        state.shoppingEntries.push({
          id: state.nextShoppingId++,
          name: item.name,
          quantityToBuy: suggestedQty,
          unit: item.unit,
          pantryItemId: item.id,
          status: "Pending",
          createdAt: FIXED_NOW_ISO,
          purchasedAt: null,
          purchasedQuantity: null,
          newExpiryDate: null,
        });
        added += 1;
      } else {
        const hasChanges =
          existingEntry.quantityToBuy !== suggestedQty ||
          existingEntry.name !== item.name ||
          existingEntry.unit !== item.unit;

        if (hasChanges) {
          existingEntry.quantityToBuy = suggestedQty;
          existingEntry.name = item.name;
          existingEntry.unit = item.unit;
          updated += 1;
        } else {
          unchanged += 1;
        }
      }
    }

    const refreshedPending = await mockApi.listShoppingEntries({
      status: "Pending",
    });

    return deepClone({
      added,
      updated,
      unchanged,
      pending: refreshedPending,
    });
  },

  async createManualEntry(input: {
    name: string;
    quantityToBuy: number;
  }): Promise<ShoppingEntry> {
    await applySimulationGate();

    const fieldErrors: Record<string, string[]> = {};
    const trimmedName =
      typeof input?.name === "string" ? input.name.trim() : "";

    if (!trimmedName) {
      fieldErrors.name = ["Item name is required."];
    }
    if (
      typeof input?.quantityToBuy !== "number" ||
      !Number.isFinite(input.quantityToBuy) ||
      input.quantityToBuy <= 0
    ) {
      fieldErrors.quantityToBuy = ["Quantity to buy must be greater than 0."];
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Please provide a valid item name and quantity.",
        fieldErrors,
      });
    }

    const duplicatePending = state.shoppingEntries.find(
      (e) =>
        e.status === "Pending" &&
        normalizeName(e.name) === normalizeName(trimmedName),
    );

    if (duplicatePending) {
      throw new ApiError({
        statusCode: 409,
        code: "PENDING_NAME_CONFLICT",
        message: `An entry called "${duplicatePending.name}" is already on your pending shopping list.`,
        fieldErrors: {
          name: [
            "Names are the same even if capitals or surrounding spaces differ.",
          ],
        },
      });
    }

    const newEntry: StoredShoppingRecord = {
      id: state.nextShoppingId++,
      name: trimmedName,
      quantityToBuy: roundQuantity(input.quantityToBuy),
      unit: null,
      pantryItemId: null,
      status: "Pending",
      createdAt: FIXED_NOW_ISO,
      purchasedAt: null,
      purchasedQuantity: null,
      newExpiryDate: null,
    };

    state.shoppingEntries.push(newEntry);
    return deepClone(enrichShoppingEntry(newEntry));
  },

  async purchaseEntry(
    id: number,
    input: PurchaseInput,
  ): Promise<PurchaseResult> {
    await applySimulationGate();
    validateIdParam(id);

    const entry = state.shoppingEntries.find((e) => e.id === id);
    if (!entry) {
      throw new ApiError({
        statusCode: 404,
        code: "ENTRY_NOT_FOUND",
        message: `Shopping entry ${id} was not found.`,
        fieldErrors: {},
      });
    }

    if (entry.status === "Purchased") {
      throw new ApiError({
        statusCode: 409,
        code: "ALREADY_PURCHASED",
        message: `${entry.name} has already been marked as purchased.`,
        fieldErrors: {},
      });
    }

    if (
      typeof input?.purchasedQuantity !== "number" ||
      !Number.isFinite(input.purchasedQuantity) ||
      input.purchasedQuantity <= 0
    ) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Purchased quantity must be a positive number.",
        fieldErrors: {
          purchasedQuantity: ["Enter a purchased quantity greater than 0."],
        },
      });
    }

    const purchasedQty = roundQuantity(input.purchasedQuantity);
    const hasSuppliedDate =
      input.newExpiryDate !== undefined && input.newExpiryDate !== "";

    if (input.newExpiryDate === (null as unknown as string)) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "New expiry date cannot be null during purchase.",
        fieldErrors: {
          newExpiryDate: ["Provide a valid YYYY-MM-DD date or omit the field."],
        },
      });
    }

    if (entry.pantryItemId === null) {
      if (hasSuppliedDate) {
        throw new ApiError({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "Manual shopping entries do not accept an expiry date.",
          fieldErrors: {
            newExpiryDate: [
              "Expiry date is only supported for linked pantry items.",
            ],
          },
        });
      }

      entry.status = "Purchased";
      entry.purchasedAt = FIXED_NOW_ISO;
      entry.purchasedQuantity = purchasedQty;
      entry.newExpiryDate = null;

      return deepClone({
        entry: enrichShoppingEntry(entry),
        pantryItem: null,
      });
    }

    const linkedItem = state.pantryItems.find(
      (p) => p.id === entry.pantryItemId,
    );
    if (!linkedItem) {
      throw new ApiError({
        statusCode: 404,
        code: "ITEM_NOT_FOUND",
        message: `Linked pantry item for ${entry.name} no longer exists.`,
        fieldErrors: {},
      });
    }

    if (hasSuppliedDate && !isValidCalendarDate(input.newExpiryDate!)) {
      throw new ApiError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message:
          "New expiry date must be a real calendar date in YYYY-MM-DD format.",
        fieldErrors: {
          newExpiryDate: ["Enter a valid calendar date (YYYY-MM-DD)."],
        },
      });
    }

    const currentStatuses = calculateMockPantryStatus(
      linkedItem,
      FIXED_TODAY,
    ).statuses;
    const isExpired = currentStatuses.includes("EXPIRED");

    if (isExpired && !hasSuppliedDate) {
      throw new ApiError({
        statusCode: 400,
        code: "EXPIRY_REQUIRED",
        message: `A new expiry date is required because the old ${linkedItem.name} expired.`,
        fieldErrors: {
          newExpiryDate: ["Enter the expiry date of the new stock."],
        },
      });
    }

    if (isExpired) {
      linkedItem.quantity = purchasedQty;
      linkedItem.expiryDate = input.newExpiryDate!;
    } else {
      linkedItem.quantity = roundQuantity(linkedItem.quantity + purchasedQty);
      if (hasSuppliedDate) {
        linkedItem.expiryDate = input.newExpiryDate!;
      }
    }

    entry.name = linkedItem.name;
    entry.unit = linkedItem.unit;
    entry.status = "Purchased";
    entry.purchasedAt = FIXED_NOW_ISO;
    entry.purchasedQuantity = purchasedQty;
    entry.newExpiryDate = linkedItem.expiryDate;

    return deepClone({
      entry: enrichShoppingEntry(entry),
      pantryItem: enrichPantryItem(linkedItem),
    });
  },

  async deleteShoppingEntry(id: number): Promise<void> {
    await applySimulationGate();
    validateIdParam(id);

    const index = state.shoppingEntries.findIndex((e) => e.id === id);
    if (index === -1) {
      throw new ApiError({
        statusCode: 404,
        code: "ENTRY_NOT_FOUND",
        message: `Shopping entry ${id} was not found.`,
        fieldErrors: {},
      });
    }

    const entry = state.shoppingEntries[index];
    if (entry.status === "Purchased") {
      throw new ApiError({
        statusCode: 409,
        code: "ENTRY_ALREADY_PURCHASED",
        message: "Purchased history entries cannot be removed.",
        fieldErrors: {},
      });
    }

    state.shoppingEntries.splice(index, 1);
  },
};
