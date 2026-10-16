// Proposed API contract. Statuses and reasons must be calculated by the backend.
export type PantryStatus = 'LOW STOCK' | 'USE SOON' | 'EXPIRED' | 'OK';
export interface Category { id: number; name: string }
export interface PantryItem {
 id: number; name: string; categoryId: number; quantity: number;
 unit: string; minimumQuantity: number; expiryDate?: string;
 statuses: PantryStatus[]; statusReasons: string[]; daysUntilExpiry?: number;
}
export interface ShoppingEntry {
 id: number; name: string; quantityToBuy: number; pantryItemId?: number;
 status: 'Pending' | 'Purchased'; createdAt: string; purchasedAt?: string;
 purchasedQuantity?: number;
}
