import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

export type IdCollection =
  | 'categories'
  | 'pantry_items'
  | 'shopping_entries'
  | 'users'
  | 'households'
  | 'household_members';

@Injectable()
export class IdsService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async next(
    collection: IdCollection,
    session?: ClientSession,
  ): Promise<number> {
    const counters = this.connection.collection<{ _id: string; value: number }>(
      'id_counters',
    );
    // Reconcile existing/seeded IDs without ever lowering the persistent counter.
    const last =
      collection === 'households'
        ? await this.connection.collection('household_members').findOne(
            {},
            {
              sort: { householdId: -1 },
              projection: { householdId: 1 },
              session,
            },
          )
        : await this.connection.collection(collection).findOne(
            {},
            {
              sort: { id: -1 },
              projection: { id: 1 },
              session,
            },
          );
    // Household 1 is reserved for existing demo data, never a new signup.
    const floor =
      collection === 'households'
        ? Math.max(1, last?.householdId ?? 1)
        : (last?.id ?? 0);
    try {
      await counters.updateOne(
        { _id: collection },
        { $max: { value: floor } },
        { upsert: true, session },
      );
    } catch (error) {
      if (session || (error as { code?: number }).code !== 11000) throw error;
      await counters.updateOne({ _id: collection }, { $max: { value: floor } });
    }
    const result = await counters.findOneAndUpdate(
      { _id: collection, value: { $lt: Number.MAX_SAFE_INTEGER } },
      { $inc: { value: 1 } },
      { returnDocument: 'after', session },
    );
    if (!result || !Number.isSafeInteger(result.value) || result.value < 1) {
      throw new Error('Numeric ID allocation exhausted.');
    }
    return result.value;
  }
}
