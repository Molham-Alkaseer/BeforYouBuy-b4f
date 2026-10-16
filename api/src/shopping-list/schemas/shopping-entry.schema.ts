// TODO: Add @Schema/@Prop decorators, SchemaFactory and module registration.
// Numeric application IDs link collections; no ObjectId references or populate.
export class ShoppingEntry {
id: number;
name: string;
quantityToBuy: number;
pantryItemId?: number;
status: 'Pending' | 'Purchased';
createdAt: Date;
purchasedAt?: Date;
}
