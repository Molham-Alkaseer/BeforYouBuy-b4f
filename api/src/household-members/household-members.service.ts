import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  HouseholdMember,
  HouseholdRole,
} from './schemas/household-member.schema';

@Injectable()
export class HouseholdMembersService {
  constructor(
    @InjectModel(HouseholdMember.name)
    private readonly members: Model<HouseholdMember>,
  ) {}

  findByUser(userId: number, session?: ClientSession) {
    return this.members
      .findOne({ userId })
      .session(session ?? null)
      .lean()
      .exec();
  }

  async createMember(
    id: number,
    userId: number,
    session: ClientSession,
    householdId: number,
    role: HouseholdRole,
  ) {
    const [member] = await this.members.create(
      [
        {
          id,
          userId,
          householdId,
          role,
          joinedAt: new Date(),
        },
      ],
      { session },
    );
    return member.toObject();
  }

  findHousehold(householdId: number) {
    return this.members.find({ householdId }).sort({ id: 1 }).lean().exec();
  }
}
