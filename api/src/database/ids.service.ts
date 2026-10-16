import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export type IdCollection = 'categories' | 'pantry_items' | 'shopping_entries';

@Injectable()
export class IdsService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async next(collection: IdCollection): Promise<number> {
    const counters = this.connection.collection<{ _id: string; value: number }>('id_counters');
    // Reconcile existing/seeded IDs without ever lowering the persistent counter.
    const last = await this.connection.collection(collection).findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
    try {
      await counters.updateOne({ _id: collection }, { $max: { value: last?.id ?? 0 } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      await counters.updateOne({ _id: collection }, { $max: { value: last?.id ?? 0 } });
    }
    const result = await counters.findOneAndUpdate(
      { _id: collection, value: { $lt: Number.MAX_SAFE_INTEGER } },
      { $inc: { value: 1 } },
      { returnDocument: 'after' },
    );
    if (!result || !Number.isSafeInteger(result.value) || result.value < 1) {
      throw new Error('Numeric ID allocation exhausted.');
    }
    return result.value;
  }
}
