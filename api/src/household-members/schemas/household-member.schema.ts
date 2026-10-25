import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const HOUSEHOLD_ID = 1;
export const HOUSEHOLD_ROLES = ['owner', 'admin', 'member'] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

@Schema({ collection: 'household_members', versionKey: false })
export class HouseholdMember {
  @Prop({
    required: true,
    unique: true,
    min: 1,
    validate: Number.isSafeInteger,
  })
  id: number;
  @Prop({ required: true, enum: [HOUSEHOLD_ID] }) householdId: number;
  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  userId: number;
  @Prop({ required: true, enum: HOUSEHOLD_ROLES }) role: HouseholdRole;
  @Prop({ required: true, default: () => new Date() }) joinedAt: Date;
}
export const HouseholdMemberSchema =
  SchemaFactory.createForClass(HouseholdMember);
HouseholdMemberSchema.index({ householdId: 1, userId: 1 }, { unique: true });
