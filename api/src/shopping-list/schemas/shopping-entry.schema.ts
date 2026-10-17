import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { isDateOnly } from '../../pantry/dto/validation';

export enum EntryStatus {
  PENDING = 'Pending',
  PURCHASED = 'Purchased',
}

@Schema({ collection: 'shopping_entries', versionKey: false })
export class ShoppingEntry {
  @Prop({
    required: true,
    unique: true,
    min: 1,
    validate: Number.isSafeInteger,
  })
  id: number;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true }) normalizedName: string;
  @Prop({ required: true, min: Number.MIN_VALUE, validate: Number.isFinite })
  quantityToBuy: number;
  @Prop({ type: String, default: null }) unit: string | null;
  @Prop({ type: Number, default: null }) pantryItemId: number | null;
  @Prop({ required: true, enum: EntryStatus, default: EntryStatus.PENDING })
  status: EntryStatus;
  @Prop({ required: true, type: Date }) createdAt: Date;
  @Prop({ type: Date, default: null }) purchasedAt: Date | null;
  @Prop({ type: Number, default: null }) purchasedQuantity: number | null;
  @Prop({
    type: String,
    default: null,
    validate: (value: unknown) => value === null || isDateOnly(value),
  })
  newExpiryDate: string | null;
}
export type ShoppingEntryDocument = HydratedDocument<ShoppingEntry>;
export const ShoppingEntrySchema = SchemaFactory.createForClass(ShoppingEntry);
ShoppingEntrySchema.index(
  { normalizedName: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } },
);
ShoppingEntrySchema.index(
  { pantryItemId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'Pending',
      pantryItemId: { $type: 'number' },
    },
  },
);
