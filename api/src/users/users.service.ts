import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  findByEmail(email: string, includePassword = false) {
    const query = this.users.findOne({ email: email.trim().toLowerCase() });
    if (includePassword) query.select('+passwordHash');
    return query.lean().exec();
  }

  findById(id: number) {
    return this.users.findOne({ id }).lean().exec();
  }

  async create(data: User, session: ClientSession): Promise<User> {
    const [user] = await this.users.create([data], { session });
    return user.toObject();
  }
}
