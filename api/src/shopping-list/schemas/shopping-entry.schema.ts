import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShoppingEntryDocument = ShoppingEntry & Document;

export enum EntryStatus {
  PENDING = 'Pending',
  PURCHASED = 'Purchased',
}

@Schema({ timestamps: true }) 
export class ShoppingEntry {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0.01 }) 
  quantityToBuy: number;

  @Prop({ type: String, default: null })
  unit: string;

  @Prop({ type: Number, default: null })
  pantryItemId: number;

  @Prop({ required: true, enum: EntryStatus, default: EntryStatus.PENDING })
  status: string;


  @Prop({ type: Date, default: null })
  purchasedAt: Date;

  @Prop({ type: Number, default: null })
  purchasedQuantity: number;

  newExpiryDate: string;
}

export const ShoppingEntrySchema = SchemaFactory.createForClass(ShoppingEntry);
