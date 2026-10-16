// TODO: Add @Schema/@Prop decorators, SchemaFactory and module registration.
// Numeric application IDs link collections; no ObjectId references or populate.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ collection: 'categories' })
export class Category {
  @Prop({ required: true, unique: true, min: 1 })
  id: number;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  normalizedName: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
