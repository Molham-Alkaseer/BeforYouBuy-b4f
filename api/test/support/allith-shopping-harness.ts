import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ClockService } from '../../src/common/clock/clock.service';
import { SeedService } from '../../src/database/seed';
import { createValidationPipe } from '../../src/common/validation';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../Tasks/mock-data.json'), 'utf8'),
);

export const allithClock = {
  today: () => '2026-10-16',
  now: () => new Date('2026-10-16T09:00:00Z'),
};

/** Boots the real AppModule on a disposable byb_test_* database owned by one suite. */
export async function startAllithApp(suite: string) {
  const original = {
    MONGODB_URI: process.env.MONGODB_URI,
    SEED_ON_START: process.env.SEED_ON_START,
    INTERNAL_TOOL_KEY: process.env.INTERNAL_TOOL_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
  };
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/byb_test_allith_${suite}_${process.pid}?replicaSet=byb-rs`;
  process.env.SEED_ON_START = 'false';
  process.env.INTERNAL_TOOL_KEY = `allith-${suite}-key`;
  // Ignored until the shared AuthModule exists; required by it afterwards.
  process.env.JWT_SECRET = `allith-${suite}-jwt-secret-for-tests-only`;
  const { AppModule } = await import('../../src/app.module');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClockService)
    .useValue(allithClock)
    .compile();
  const app: INestApplication = module.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  const connection = app.get<Connection>(getConnectionToken());

  /** Seeds pantry/categories and the shared shopping fixture; keeps account collections. */
  async function reset() {
    for (const collection of [
      'shopping_entries',
      'pantry_items',
      'categories',
      'seed_runs',
    ]) {
      await connection.collection(collection).deleteMany({});
    }
    // Only domain counters: account/membership counters must survive between tests.
    await connection.collection<{ _id: string }>('id_counters').deleteMany({
      _id: { $in: ['categories', 'pantry_items', 'shopping_entries'] },
    });
    await app.get(SeedService).seed();
    const entries = [
      ...fixture.shoppingPending.items,
      ...fixture.shoppingPurchased.items,
    ].map(({ pantryStatuses, ...entry }) => ({
      ...entry,
      normalizedName: entry.name.trim().toLowerCase(),
      createdAt: new Date(entry.createdAt),
      purchasedAt: entry.purchasedAt ? new Date(entry.purchasedAt) : null,
    }));
    await connection.collection('shopping_entries').insertMany(entries);
  }

  async function stop() {
    if (connection) await connection.dropDatabase();
    await app.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  /** Read-only snapshot used to prove a rejected request changed nothing. */
  async function snapshot() {
    const strip = { projection: { _id: 0 } };
    return {
      pantry: await connection
        .collection('pantry_items')
        .find({}, strip)
        .sort({ id: 1 })
        .toArray(),
      entries: await connection
        .collection('shopping_entries')
        .find({}, strip)
        .sort({ id: 1 })
        .toArray(),
    };
  }

  return { app, connection, reset, stop, snapshot };
}

/** Captures Logger output without printing it; restore in afterEach. */
export function captureShoppingLogs() {
  const log = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => undefined);
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  const text = (spy: jest.SpyInstance) =>
    spy.mock.calls.map(([message]) => String(message));
  return {
    successes: () => text(log).filter((message) => /shopping/i.test(message)),
    warnings: () => text(warn),
    all: () => [...text(log), ...text(warn)],
    restore: () => {
      log.mockRestore();
      warn.mockRestore();
    },
  };
}
