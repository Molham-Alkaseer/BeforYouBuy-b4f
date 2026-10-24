import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ClockService } from '../common/clock/clock.service';
import { WriteService } from './write.service';
import { seedCategories, seedPantry } from './seed-data';

export function offsetDate(today: string, offset: number): string {
  const date = new Date(today + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly writes: WriteService,
    private readonly clock: ClockService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get<string>('SEED_ON_START', 'false') === 'true')
      await this.seed();
  }

  async ensureIndexes(): Promise<void> {
    const db = this.connection;
    for (const name of ['seed_runs', 'id_counters']) {
      try {
        await db.createCollection(name);
      } catch (error) {
        if ((error as { code?: number }).code !== 48) throw error;
      }
    }
    await db.collection('categories').createIndex({ id: 1 }, { unique: true });
    await db
      .collection('categories')
      .createIndex({ normalizedName: 1 }, { unique: true });
    await db
      .collection('pantry_items')
      .createIndex({ id: 1 }, { unique: true });
    await db
      .collection('pantry_items')
      .createIndex({ normalizedName: 1 }, { unique: true });
    await db
      .collection('shopping_entries')
      .createIndex({ id: 1 }, { unique: true });
    await db.collection('shopping_entries').createIndex(
      { normalizedName: 1 },
      {
        unique: true,
        partialFilterExpression: { status: 'Pending' },
      },
    );
    await db.collection('shopping_entries').createIndex(
      { pantryItemId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: 'Pending',
          pantryItemId: { $type: 'number' },
        },
      },
    );
  }

  async seed(): Promise<'seeded' | 'preserved'> {
    await this.ensureIndexes();
    const today = this.clock.today();
    const result = await this.writes.run(async (session) => {
      const markers = this.connection.collection<{
        _id: string;
        completedAt: Date;
      }>('seed_runs');
      if (await markers.findOne({ _id: 'demo-v1' }, { session }))
        return 'preserved' as const;
      for (const collection of [
        'categories',
        'pantry_items',
        'shopping_entries',
      ]) {
        if (
          await this.connection.collection(collection).findOne({}, { session })
        )
          return 'preserved' as const;
      }

      await this.connection.collection('categories').insertMany(
        seedCategories.map((category) => ({
          ...category,
          normalizedName: category.name.toLowerCase(),
        })),
        { session },
      );
      await this.connection.collection('pantry_items').insertMany(
        seedPantry.map((item) => ({
          id: item.id,
          name: item.name,
          normalizedName: item.name.toLowerCase(),
          categoryId: item.categoryId,
          quantity: item.quantity,
          unit: item.unit,
          minimumQuantity: item.minimumQuantity,
          expiryDate:
            item.expiryOffset === null
              ? null
              : offsetDate(today, item.expiryOffset),
        })),
        { session },
      );

      const counters = this.connection.collection<{
        _id: string;
        value: number;
      }>('id_counters');
      await counters.updateOne(
        { _id: 'categories' },
        { $max: { value: Math.max(...seedCategories.map((item) => item.id)) } },
        { upsert: true, session },
      );
      await counters.updateOne(
        { _id: 'pantry_items' },
        { $max: { value: Math.max(...seedPantry.map((item) => item.id)) } },
        { upsert: true, session },
      );
      await counters.updateOne(
        { _id: 'shopping_entries' },
        { $max: { value: 0 } },
        { upsert: true, session },
      );
      await markers.insertOne(
        { _id: 'demo-v1', completedAt: this.clock.now() },
        { session },
      );
      return 'seeded' as const;
    });
    this.logger.log(
      result === 'seeded'
        ? 'Seeded 7 categories and 20 pantry items.'
        : 'Existing application data preserved.',
    );
    return result;
  }
}
