import { Connection, createConnection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../../src/common/clock/clock.service';
import { WriteService } from '../../src/database/write.service';
import { SeedService } from '../../src/database/seed';
import { IdsService } from '../../src/database/ids.service';

describe('Atomic demo seed with real MongoDB', () => {
  let connection: Connection;
  let seed: SeedService;
  let writes: WriteService;
  const clock = new ClockService();
  const database = `byb_test_seed_${process.pid}`;
  beforeAll(async () => {
    connection = await createConnection(
      `mongodb://127.0.0.1:27018/${database}?replicaSet=byb-rs`,
    ).asPromise();
    jest.spyOn(clock, 'today').mockReturnValue('2030-01-01');
    writes = new WriteService(connection);
    seed = new SeedService(connection, writes, clock, new ConfigService());
  });
  beforeEach(async () => {
    await connection.dropDatabase();
    await writes.onModuleInit();
  });
  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it('seeds the fixture with relative dates and no computed fields', async () => {
    expect(await seed.seed()).toBe('seeded');
    expect(await connection.collection('categories').countDocuments()).toBe(7);
    const items = await connection.collection('pantry_items').find().toArray();
    expect(items).toHaveLength(20);
    let low = 0,
      soon = 0,
      expired = 0,
      ok = 0;
    for (const item of items) {
      const isLow = item.quantity < item.minimumQuantity;
      const days = item.expiryDate
        ? (Date.parse(item.expiryDate) - Date.parse('2030-01-01')) / 86400000
        : null;
      const isExpired = days !== null && days < 0;
      const isSoon = days !== null && days >= 0 && days <= 3;
      if (isLow) low++;
      if (isExpired) expired++;
      if (isSoon) soon++;
      if (!isLow && !isExpired && !isSoon) ok++;
      expect(item).not.toHaveProperty('statuses');
      expect(item).not.toHaveProperty('statusReasons');
      expect(item).not.toHaveProperty('daysUntilExpiry');
      expect(item).not.toHaveProperty('expiryOffset');
    }
    expect({ low, soon, expired, ok }).toEqual({
      low: 5,
      soon: 3,
      expired: 2,
      ok: 12,
    });
    expect(
      (await connection.collection('pantry_items').findOne({ id: 1 }))
        .expiryDate,
    ).toBe('2030-01-03');
    expect(await new IdsService(connection).next('categories')).toBe(8);
    expect(await new IdsService(connection).next('pantry_items')).toBe(21);
  });

  it('preserves edits across restart and does not recreate intentionally deleted data', async () => {
    await seed.seed();
    await connection
      .collection('pantry_items')
      .updateOne({ id: 1 }, { $set: { quantity: 99 } });
    const restarted = await createConnection(
      `mongodb://127.0.0.1:27018/${database}?replicaSet=byb-rs`,
    ).asPromise();
    try {
      const nextSeed = new SeedService(
        restarted,
        new WriteService(restarted),
        clock,
        new ConfigService(),
      );
      expect(await nextSeed.seed()).toBe('preserved');
      expect(
        (await restarted.collection('pantry_items').findOne({ id: 1 }))
          .quantity,
      ).toBe(99);
      await restarted.collection('categories').deleteMany({});
      await restarted.collection('pantry_items').deleteMany({});
      expect(await nextSeed.seed()).toBe('preserved');
      expect(await restarted.collection('pantry_items').countDocuments()).toBe(
        0,
      );
    } finally {
      await restarted.close();
    }
  });

  it('does not add demo data to a nonempty application database', async () => {
    await connection
      .collection('categories')
      .insertOne({ id: 100, name: 'Custom', normalizedName: 'custom' });
    expect(await seed.seed()).toBe('preserved');
    expect(await connection.collection('categories').countDocuments()).toBe(1);
    expect(await connection.collection('pantry_items').countDocuments()).toBe(
      0,
    );
  });

  it('rolls back a partial seed and safely retries on the next run', async () => {
    const pantry = connection.collection('pantry_items');
    const failure = jest
      .spyOn(pantry, 'insertMany')
      .mockRejectedValueOnce(new Error('Injected seed failure'));
    await expect(seed.seed()).rejects.toThrow('Injected seed failure');
    failure.mockRestore();
    expect(await connection.collection('categories').countDocuments()).toBe(0);
    expect(await connection.collection('pantry_items').countDocuments()).toBe(
      0,
    );
    expect(await connection.collection('seed_runs').countDocuments()).toBe(0);
    expect(await seed.seed()).toBe('seeded');
  });

  it('allows only one concurrent seed to populate the database', async () => {
    const outcomes = await Promise.all([seed.seed(), seed.seed()]);
    expect(outcomes.sort()).toEqual(['preserved', 'seeded']);
    expect(await connection.collection('pantry_items').countDocuments()).toBe(
      20,
    );
  });

  it('limits uniqueness constraints to Pending entries and allows manual/history records', async () => {
    await seed.ensureIndexes();
    const entries = connection.collection('shopping_entries');
    await entries.insertMany([
      {
        id: 1,
        normalizedName: 'candles',
        status: 'Pending',
        pantryItemId: null,
      },
      {
        id: 2,
        normalizedName: 'napkins',
        status: 'Pending',
        pantryItemId: null,
      },
      { id: 3, normalizedName: 'milk', status: 'Purchased', pantryItemId: 1 },
      { id: 4, normalizedName: 'milk', status: 'Purchased', pantryItemId: 1 },
      { id: 5, normalizedName: 'milk', status: 'Pending', pantryItemId: 1 },
    ]);
    await expect(
      entries.insertOne({
        id: 6,
        normalizedName: 'milk again',
        status: 'Pending',
        pantryItemId: 1,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      entries.insertOne({
        id: 7,
        normalizedName: 'milk',
        status: 'Pending',
        pantryItemId: null,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
