import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { isDateOnly } from '../dto/validation';

@Schema({ collection: 'pantry_items', versionKey: false })
export class PantryItem {
  @Prop({
    required: true,
    unique: true,
    min: 1,
    validate: Number.isSafeInteger,
  })
  id: number;
  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  householdId: number;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true }) normalizedName: string;
  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  categoryId: number;
  @Prop({ required: true, min: 0, validate: Number.isFinite }) quantity: number;
  @Prop({ required: true, trim: true }) unit: string;
  @Prop({ required: true, min: 0, validate: Number.isFinite })
  minimumQuantity: number;
  @Prop({
    type: String,
    default: null,
    validate: (value: unknown) => value === null || isDateOnly(value),
  })
  expiryDate: string | null;
}
export type PantryItemDocument = HydratedDocument<PantryItem>;
export const PantryItemSchema = SchemaFactory.createForClass(PantryItem);
PantryItemSchema.index({ householdId: 1, normalizedName: 1 }, { unique: true });
