// TODO: Add @Schema/@Prop decorators, SchemaFactory and module registration.
// Numeric application IDs link collections; no ObjectId references or populate.
export class PantryItem {
id: number;
name: string;
categoryId: number;
quantity: number;
unit: string;
minimumQuantity: number;
expiryDate?: string;
}
