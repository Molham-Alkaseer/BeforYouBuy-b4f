import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { resolve } from 'path';
import { ClockService } from '../../src/common/clock/clock.service';
import { createValidationPipe } from '../../src/common/validation';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import type { ApiClient } from '../../../client/src/types';

// Bundle the real browser modules, replacing only Vite's build-time environment.
// Requests still travel over HTTP to a real Nest application and isolated MongoDB.
const { buildSync } = require('../../../client/node_modules/esbuild');
function loadClient(
  base: string,
  mocks = false,
): {
  api: ApiClient;
  itemApi: ApiClient;
  formatQuantity: (quantity: number, unit: string) => string;
} {
  const result = buildSync({
    absWorkingDir: resolve(__dirname, '../../../client'),
    stdin: {
      resolveDir: resolve(__dirname, '../../../client'),
      contents: `export { api } from './src/services/api-client';
      export { itemApi } from './src/features/items/itemApi';
      export { formatQuantity } from './src/features/items/itemFormat';`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    define: {
      'import.meta.env': JSON.stringify({
        VITE_API_URL: base,
        VITE_USE_MOCKS: String(mocks),
      }),
    },
  });
  const module = { exports: {} };
  new Function('module', 'exports', result.outputFiles[0].text)(
    module,
    module.exports,
  );
  return module.exports as ReturnType<typeof loadClient>;
}

describe('Frontend shared client against the live backend', () => {
  let app: INestApplication;
  let connection: Connection;
  let client: ReturnType<typeof loadClient>;
  let categoryId: number;
  const original = {
    MONGODB_URI: process.env.MONGODB_URI,
    SEED_ON_START: process.env.SEED_ON_START,
  };

  beforeAll(async () => {
    process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/byb_test_frontend_${process.pid}?replicaSet=byb-rs`;
    process.env.SEED_ON_START = 'true';
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClockService)
      .useValue({
        today: () => '2026-10-16',
        now: () => new Date('2026-10-16T09:00:00Z'),
      })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    connection = app.get(getConnectionToken());
    client = loadClient(`${await app.getUrl()}/api`);
    categoryId = (await client.api.listCategories()).items[0].id;
  });

  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('shares the adapter, persists create/edit/use, preserves units, and handles 204/404', async () => {
    expect(client.itemApi).toBe(client.api);
    expect(client.formatQuantity(1, 'boxes')).toBe('1 boxes');
    const created = await client.itemApi.createPantryItem({
      name: 'Adapter test boxes',
      categoryId,
      quantity: 1,
      unit: 'boxes',
      minimumQuantity: 0,
      expiryDate: null,
    });
    await client.itemApi.updatePantryItem(created.id, {
      name: 'Adapter edited boxes',
    });
    const used = await client.itemApi.usePantryItem(created.id, {
      quantity: 0.001,
    });
    expect(used.quantity).toBeCloseTo(0.999, 10);
    expect((await client.api.getPantryItem(created.id)).name).toBe(
      'Adapter edited boxes',
    );
    expect(
      (await connection.collection('pantry_items').findOne({ id: created.id }))
        .quantity,
    ).toBeCloseTo(0.999, 10);
    await expect(
      client.itemApi.deletePantryItem(created.id),
    ).resolves.toBeUndefined();
    await expect(
      client.itemApi.getPantryItem(created.id),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ITEM_NOT_FOUND' });
  });

  it('generates once, blocks deletion with pending entries, purchases, and exposes item history', async () => {
    const item = await client.itemApi.createPantryItem({
      name: 'Adapter low stock',
      categoryId,
      quantity: 1,
      unit: 'kg',
      minimumQuantity: 2,
    });
    const generated = await client.api.generateShoppingList();
    expect(generated.added).toBeGreaterThan(0);
    const repeated = await client.api.generateShoppingList();
    expect(repeated.added).toBe(0);
    expect(repeated.updated).toBe(0);
    const entries = await client.api.listShoppingEntries({
      status: 'Pending',
      pantryItemId: item.id,
    });
    expect(entries.items).toHaveLength(1);
    await expect(
      client.itemApi.deletePantryItem(item.id),
    ).rejects.toMatchObject({ statusCode: 409 });
    const bought = await client.api.purchaseEntry(entries.items[0].id, {
      purchasedQuantity: 2,
    });
    expect(bought.pantryItem.quantity).toBe(3);
    await expect(
      client.api.purchaseEntry(entries.items[0].id, { purchasedQuantity: 2 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const history = await client.itemApi.listShoppingEntries({
      status: 'Purchased',
      pantryItemId: item.id,
    });
    expect(history.items[0].purchasedQuantity).toBe(2);
    expect((await client.api.getDashboard()).totalItems).toBeGreaterThan(0);
  });

  it('requires a new expiry and replaces expired stock instead of adding to it', async () => {
    const item = await client.itemApi.createPantryItem({
      name: 'Adapter expired stock',
      categoryId,
      quantity: 9,
      unit: 'boxes',
      minimumQuantity: 2,
      expiryDate: '2026-10-15',
    });
    await client.api.generateShoppingList();
    const entry = (
      await client.api.listShoppingEntries({
        status: 'Pending',
        pantryItemId: item.id,
      })
    ).items[0];
    await expect(
      client.api.purchaseEntry(entry.id, { purchasedQuantity: 3 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      fieldErrors: {
        newExpiryDate: expect.arrayContaining([expect.any(String)]),
      },
    });
    const bought = await client.api.purchaseEntry(entry.id, {
      purchasedQuantity: 3,
      newExpiryDate: '2026-10-25',
    });
    expect(bought.pantryItem.quantity).toBe(3);
    expect(bought.pantryItem.statuses).toEqual(['OK']);
  });

  it('handles small manual quantities, duplicates, invalid input, and removal', async () => {
    const entry = await client.api.createManualEntry({
      name: 'Adapter candles',
      quantityToBuy: 0.0001,
    });
    expect(entry.quantityToBuy).toBe(0.0001);
    await expect(
      client.api.createManualEntry({
        name: ' adapter candles ',
        quantityToBuy: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      client.api.createManualEntry({
        name: 'Invalid adapter item',
        quantityToBuy: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      client.api.deleteShoppingEntry(entry.id),
    ).resolves.toBeUndefined();
    const manual = await client.api.createManualEntry({
      name: 'Adapter manual purchase',
      quantityToBuy: 0.05,
    });
    const before = await client.api.listPantry();
    const bought = await client.api.purchaseEntry(manual.id, {
      purchasedQuantity: 0.05,
    });
    expect(bought.pantryItem).toBeNull();
    expect((await client.api.listPantry()).items).toEqual(before.items);
  });

  it('reports network failures without silently switching to mocks', async () => {
    const offline = loadClient('http://127.0.0.1:1/api');
    await expect(offline.itemApi.listCategories()).rejects.toMatchObject({
      statusCode: 0,
      code: 'NETWORK_ERROR',
    });
  });

  it('shares item and shopping state when mocks are explicitly enabled', async () => {
    const mock = loadClient('/api', true);
    expect(mock.itemApi).toBe(mock.api);
    const item = await mock.itemApi.createPantryItem({
      name: 'Shared mock item',
      categoryId: 1,
      quantity: 0,
      unit: 'boxes',
      minimumQuantity: 1,
    });
    await mock.api.generateShoppingList();
    const entries = await mock.api.listShoppingEntries({
      status: 'Pending',
      pantryItemId: item.id,
    });
    expect(entries.items).toHaveLength(1);
    await mock.api.purchaseEntry(entries.items[0].id, { purchasedQuantity: 2 });
    expect((await mock.itemApi.getPantryItem(item.id)).quantity).toBe(2);
  });
});
