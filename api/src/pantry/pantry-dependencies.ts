import { ClientSession } from 'mongoose';

// Explicit injection aliases let the shared module bind its class providers without
// importing missing files or implementing infrastructure owned by another teammate.
export const PANTRY_CLOCK = 'ClockService';
export const PANTRY_IDS = 'IdsService';
export const PANTRY_WRITES = 'HouseholdWrites';
export interface PantryClock {
  today(): string;
  now(): Date;
}
export interface PantryIds {
  next(
    collection: 'categories' | 'pantry_items' | 'shopping_entries',
  ): Promise<number>;
}
export interface HouseholdWrites {
  /**
   * Run in a retryable MongoDB transaction after acquiring a shared DB write fence.
   * Category mutations and shopping generate/purchase/remove MUST use this same
   * fence and session. Snapshot transactions alone do not prevent write skew.
   * Resolve only after commit; reject on abort. Never use a process-local mutex
   * as the production implementation. There is intentionally no unsafe fallback.
   */
  run<T>(work: (session: ClientSession) => Promise<T>): Promise<T>;
}
