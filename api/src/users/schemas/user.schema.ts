import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'users', versionKey: false })
export class User {
  @Prop({
    required: true,
    unique: true,
    min: 1,
    validate: Number.isSafeInteger,
  })
  id: number;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;
  @Prop({ required: true, select: false }) passwordHash: string;
  @Prop({ required: true, default: () => new Date() }) createdAt: Date;
}
export const UserSchema = SchemaFactory.createForClass(User);
