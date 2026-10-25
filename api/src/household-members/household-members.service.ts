import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  HOUSEHOLD_ID,
  HouseholdMember,
} from './schemas/household-member.schema';

@Injectable()
export class HouseholdMembersService {
  constructor(
    @InjectModel(HouseholdMember.name)
    private readonly members: Model<HouseholdMember>,
  ) {}

  findByUser(userId: number) {
    return this.members
      .findOne({ householdId: HOUSEHOLD_ID, userId })
      .lean()
      .exec();
  }

  async createMember(id: number, userId: number, session: ClientSession) {
    const [member] = await this.members.create(
      [
        {
          id,
          userId,
          householdId: HOUSEHOLD_ID,
          role: 'member',
          joinedAt: new Date(),
        },
      ],
      { session },
    );
    return member.toObject();
  }
}
