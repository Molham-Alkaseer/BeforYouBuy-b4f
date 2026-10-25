import { createAccount, TEST_JWT_SECRET } from '../support/auth-fixtures';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import * as request from 'supertest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ClockService } from '../../src/common/clock/clock.service';
import { SeedService } from '../../src/database/seed';
import { WriteService } from '../../src/database/write.service';
import { createValidationPipe } from '../../src/common/validation';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ShoppingEntry } from '../../src/shopping-list/schemas/shopping-entry.schema';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../Tasks/mock-data.json'), 'utf8'),
);

describe('Integrated pantry, shopping, categories and dashboard', () => {
  let app: INestApplication;
  let connection: Connection;
  let token: string;
  const original = {
    JWT_SECRET: process.env.JWT_SECRET,
    MONGODB_URI: process.env.MONGODB_URI,
    SEED_ON_START: process.env.SEED_ON_START,
    INTERNAL_TOOL_KEY: process.env.INTERNAL_TOOL_KEY,
  };
  const clock = {
    today: () => '2026-10-16',
    now: () => new Date('2026-10-16T09:00:00Z'),
  };
  const key = 'backend-integration-key';

  async function start() {
    process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/byb_test_combined_${process.pid}?replicaSet=byb-rs`;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.SEED_ON_START = 'false';
    process.env.INTERNAL_TOOL_KEY = key;
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClockService)
      .useValue(clock)
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    connection = app.get(getConnectionToken());
    token = (await createAccount(app, 'admin')).token;
  }
  const get = (path: string) =>
    request(app.getHttpServer())
      .get('/api' + path)
      .set('Authorization', 'Bearer ' + token);
  const post = (path: string, body?: object) =>
    request(app.getHttpServer())
      .post('/api' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const patch = (path: string, body: object) =>
    request(app.getHttpServer())
      .patch('/api' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const remove = (path: string) =>
    request(app.getHttpServer())
      .delete('/api' + path)
      .set('Authorization', 'Bearer ' + token);

  beforeAll(start);
  beforeEach(async () => {
    for (const collection of [
      'shopping_entries',
      'pantry_items',
      'categories',
      'seed_runs',
      'id_counters',
    ]) {
      await connection.collection(collection).deleteMany({});
    }
    await app.get(SeedService).seed();
    const entries = [
      ...fixture.shoppingPending.items,
      ...fixture.shoppingPurchased.items,
    ].map(({ pantryStatuses, ...entry }) => ({
      ...entry,
      householdId: 1,
      normalizedName: entry.name.trim().toLowerCase(),
      createdAt: new Date(entry.createdAt),
      purchasedAt: entry.purchasedAt ? new Date(entry.purchasedAt) : null,
    }));
    await connection.collection('shopping_entries').insertMany(entries);
  });
  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('PDF 17.1: shows overlapping low-stock/use-soon statuses and combines all filters', async () => {
    const response = await get(
      '/pantry?name=mil&categoryId=1&status=USE%20SOON',
    ).expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      id: 1,
      name: 'Milk',
      quantity: 1,
      statuses: ['LOW STOCK', 'USE SOON'],
      daysUntilExpiry: 2,
    });
    expect(response.body.items[0]).not.toHaveProperty('_id');
    expect((await get('/pantry?name=.*').expect(200)).body.total).toBe(0);
    expect((await get('/pantry?categoryId=999').expect(200)).body.total).toBe(
      0,
    );
  });

  it('PDF 17.2: uses stock and rejects over-use without modifying stock', async () => {
    expect(
      (await post('/pantry/1/use', { quantity: 1 }).expect(200)).body.quantity,
    ).toBe(0);
    const rejected = await post('/pantry/1/use', { quantity: 1 }).expect(400);
    expect(rejected.body).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      fieldErrors: { quantity: expect.any(Array) },
    });
    expect((await get('/pantry/1')).body.quantity).toBe(0);
  });

  it('PDF 17.3: generates correct suggestions twice without duplicates', async () => {
    await connection
      .collection('shopping_entries')
      .deleteMany({ status: 'Pending', pantryItemId: { $ne: null } });
    const first = await post('/shopping-list/generate').expect(200);
    expect(first.body).toMatchObject({ added: 6, updated: 0, unchanged: 0 });
    expect(first.body.pending.pendingSummary).toEqual({
      total: 7,
      linked: 6,
      manual: 1,
    });
    const second = await post('/shopping-list/generate', {}).expect(200);
    expect(second.body).toMatchObject({ added: 0, updated: 0, unchanged: 6 });
    const milk = second.body.pending.items.find(
      (entry) => entry.pantryItemId === 1,
    );
    expect(milk.quantityToBuy).toBe(1);
    const yoghurt = second.body.pending.items.find(
      (entry) => entry.pantryItemId === 2,
    );
    expect(yoghurt.quantityToBuy).toBe(3);
  });

  it('PDF 17.4: purchases normal stock, requires expiry for expired stock and replaces it', async () => {
    const milk = await post('/shopping-list/101/purchase', {
      purchasedQuantity: 2,
      newExpiryDate: '2026-10-25',
    }).expect(200);
    expect(milk.body.pantryItem).toMatchObject({
      quantity: 3,
      statuses: ['OK'],
    });
    expect(milk.body.entry).toMatchObject({
      status: 'Purchased',
      purchasedQuantity: 2,
      pantryStatuses: [],
    });
    const error = await post('/shopping-list/102/purchase', {
      purchasedQuantity: 3,
    }).expect(400);
    expect(error.body.code).toBe('EXPIRY_REQUIRED');
    expect((await get('/pantry/2')).body.quantity).toBe(2);
    const yoghurt = await post('/shopping-list/102/purchase', {
      purchasedQuantity: 3,
      newExpiryDate: '2026-10-25',
    }).expect(200);
    expect(yoghurt.body.pantryItem).toMatchObject({
      quantity: 3,
      statuses: ['OK'],
    });
  });

  it('PDF 17.5: blocks deleting an item with a Pending entry and retains Purchased history', async () => {
    expect((await remove('/pantry/1').expect(409)).body.code).toBe(
      'ITEM_HAS_PENDING_ENTRY',
    );
    await remove('/shopping-list/101').expect(204);
    await remove('/pantry/1').expect(204);
    const history = await get(
      '/shopping-list?status=Purchased&pantryItemId=1',
    ).expect(200);
    expect(history.body.items.map((entry) => entry.id)).toEqual([
      205, 204, 206,
    ]);
    expect(history.body.items.every((entry) => entry.name === 'Milk')).toBe(
      true,
    );
    expect(history.body.pendingSummary).toEqual({
      total: 6,
      linked: 5,
      manual: 1,
    });
  });

  it('PDF 17.6: keeps category mutations key-only and documents their Swagger header', async () => {
    await post('/categories', { name: 'Baking' }).expect(403);
    const created = await post('/categories', { name: 'Baking' })
      .set('x-internal-tool-key', key)
      .expect(201);
    expect(created.body.name).toBe('Baking');
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    expect(document.paths['/api/categories'].post.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'x-internal-tool-key' }),
      ]),
    );
    await get('/pantry').expect(200);
    await get('/shopping-list').expect(200);
  });

  it('PDF 17.7: preserves purchase, stock and manual entries after backend restart', async () => {
    await post('/shopping-list/101/purchase', { purchasedQuantity: 2 }).expect(
      200,
    );
    const created = await post('/shopping-list', {
      name: 'Napkins',
      quantityToBuy: 2,
    }).expect(201);
    await app.close();
    await start();
    expect((await get('/pantry/1')).body.quantity).toBe(3);
    expect(
      (await get('/shopping-list?status=Purchased&pantryItemId=1')).body.total,
    ).toBe(4);
    expect(
      (await get('/shopping-list?status=Pending')).body.items,
    ).toContainEqual(
      expect.objectContaining({ id: created.body.id, name: 'Napkins' }),
    );
  });

  it('PDF 17.8: logs one committed restock with the entry, quantity and resulting stock', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    try {
      await post('/shopping-list/101/purchase', {
        purchasedQuantity: 2,
      }).expect(200);
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Purchased shopping entry 101; pantryItemId=1, quantity=2, stock=3',
        ),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('calculates dashboard counts, urgency, pending totals and zero-count categories', async () => {
    const baseline = (await get('/dashboard').expect(200)).body;
    expect(baseline).toMatchObject({
      totalItems: 20,
      statusCounts: { 'LOW STOCK': 5, 'USE SOON': 3, EXPIRED: 2, OK: 12 },
      pendingShopping: { total: 7, linked: 6, manual: 1 },
    });
    expect(baseline.urgentItems.map((item) => item.id)).toEqual([
      3, 2, 11, 1, 7,
    ]);
    await post('/categories', { name: 'Empty category' })
      .set('x-internal-tool-key', key)
      .expect(201);
    await post('/shopping-list/101/purchase', {
      purchasedQuantity: 2,
      newExpiryDate: '2026-10-25',
    }).expect(200);
    const updated = (await get('/dashboard')).body;
    expect(updated.statusCounts).toEqual({
      'LOW STOCK': 4,
      'USE SOON': 2,
      EXPIRED: 2,
      OK: 13,
    });
    expect(updated.pendingShopping).toEqual({ total: 6, linked: 5, manual: 1 });
    expect(updated.categoryCounts).toContainEqual(
      expect.objectContaining({ categoryName: 'Empty category', count: 0 }),
    );
  });

  it('creates, edits and clears expiry with current category names and strict references', async () => {
    const body = {
      name: ' Oats ',
      categoryId: 5,
      quantity: 2,
      unit: ' kg ',
      minimumQuantity: 1,
    };
    const created = (await post('/pantry', body).expect(201)).body;
    expect(created).toMatchObject({
      name: 'Oats',
      unit: 'kg',
      expiryDate: null,
      statuses: ['OK'],
      categoryName: 'Grains & Pasta',
    });
    await post('/pantry', { ...body, name: 'oats' }).expect(409);
    expect(
      (await post('/pantry', { ...body, categoryId: 999 }).expect(400)).body
        .code,
    ).toBe('INVALID_CATEGORY');
    const cleared = (await patch('/pantry/1', { expiryDate: null }).expect(200))
      .body;
    expect(cleared).toMatchObject({
      expiryDate: null,
      quantity: 1,
      statuses: ['LOW STOCK'],
    });
    await request(app.getHttpServer())
      .patch('/api/categories/1')
      .set('x-internal-tool-key', key)
      .send({ name: 'Dairy updated' })
      .expect(200);
    expect((await get('/pantry/1')).body.categoryName).toBe('Dairy updated');
  });

  it.each([
    { name: ' ' },
    { quantity: -1 },
    { quantity: '2' },
    { quantity: null },
    { minimumQuantity: -1 },
    { expiryDate: '2026-02-30' },
    { categoryId: 1.5 },
    { categoryId: null },
    { unit: null },
    {},
  ])('rejects invalid pantry PATCH %j', async (body) => {
    expect((await patch('/pantry/1', body).expect(400)).body.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it.each([
    '/pantry?extra=1',
    '/pantry?categoryId=1&categoryId=2',
    '/pantry?status=wrong',
    '/shopping-list?status=wrong',
    '/shopping-list?pantryItemId=1.2',
    '/shopping-list?pantryItemId=1&pantryItemId=2',
    '/dashboard?extra=1',
    '/shopping-list?extra=1',
    '/pantry/0',
    '/pantry/1?extra=1',
  ])('rejects invalid query or ID %s', async (path) => {
    await get(path).expect(400);
  });

  it.each([
    { name: 3, quantityToBuy: 1 },
    { name: ' ', quantityToBuy: 1 },
    { name: 'X', quantityToBuy: '1' },
    { name: 'X', quantityToBuy: 0 },
    { name: 'X', quantityToBuy: 1, extra: true },
  ])('rejects invalid manual input %j', async (body) => {
    await post('/shopping-list', body).expect(400);
  });

  it('allows small positive decimals and forbids arrays and unexpected action fields', async () => {
    await post('/shopping-list', {
      name: 'Spice',
      quantityToBuy: 0.001,
    }).expect(201);
    await post('/shopping-list', []).expect(400);
    await post('/pantry', []).expect(400);
    await post('/categories', []).set('x-internal-tool-key', key).expect(400);
    await post('/shopping-list/generate', { extra: true }).expect(400);
    await post('/shopping-list/generate?extra=1').expect(400);
    await post('/pantry/1/use', { quantity: 1, extra: true }).expect(400);
    await remove('/shopping-list/101?extra=1').expect(400);
  });

  it('rejects invalid purchase numbers and dates without changing stock', async () => {
    for (const body of [
      { purchasedQuantity: '2' },
      { purchasedQuantity: 0 },
      { purchasedQuantity: 2, newExpiryDate: null },
      { purchasedQuantity: 2, newExpiryDate: '2026-02-30' },
      { purchasedQuantity: 2, extra: true },
    ]) {
      await post('/shopping-list/101/purchase', body).expect(400);
    }
    expect((await get('/pantry/1')).body.quantity).toBe(1);
  });

  it('preserves expiry when omitted and captures snapshot values', async () => {
    await patch('/pantry/1', { name: 'Whole milk', unit: 'bottles' }).expect(
      200,
    );
    const bought = (
      await post('/shopping-list/101/purchase', {
        purchasedQuantity: 2,
      }).expect(200)
    ).body;
    expect(bought.pantryItem).toMatchObject({
      quantity: 3,
      statuses: ['USE SOON'],
      expiryDate: '2026-10-18',
    });
    expect(bought.entry).toMatchObject({
      name: 'Whole milk',
      unit: 'bottles',
      newExpiryDate: '2026-10-18',
    });
    await patch('/pantry/1', { name: 'Changed later' }).expect(200);
    expect(
      (await get('/shopping-list?status=Purchased&pantryItemId=1')).body
        .items[0].name,
    ).toBe('Whole milk');
  });

  it('manual purchases change no stock and reject an expiry date', async () => {
    await post('/shopping-list/107/purchase', {
      purchasedQuantity: 2,
      newExpiryDate: '2026-10-25',
    }).expect(400);
    const result = (
      await post('/shopping-list/107/purchase', {
        purchasedQuantity: 2,
      }).expect(200)
    ).body;
    expect(result.pantryItem).toBeNull();
    expect(result.entry).toMatchObject({
      pantryItemId: null,
      unit: null,
      newExpiryDate: null,
      pantryStatuses: [],
    });
    expect((await get('/pantry/1')).body.quantity).toBe(1);
  });

  it('rejects repeat purchases, deleting history, and missing linked items', async () => {
    expect(
      (
        await post('/shopping-list/205/purchase', {
          purchasedQuantity: 2,
        }).expect(409)
      ).body.code,
    ).toBe('ALREADY_PURCHASED');
    expect((await remove('/shopping-list/205').expect(409)).body.code).toBe(
      'ENTRY_ALREADY_PURCHASED',
    );
    await connection.collection('pantry_items').deleteOne({ id: 1 });
    expect(
      (
        await post('/shopping-list/101/purchase', {
          purchasedQuantity: 2,
        }).expect(404)
      ).body.code,
    ).toBe('ITEM_NOT_FOUND');
    expect(
      (await connection.collection('shopping_entries').findOne({ id: 101 }))
        .status,
    ).toBe('Pending');
    await post('/shopping-list/9999/purchase', { purchasedQuantity: 2 }).expect(
      404,
    );
    await remove('/shopping-list/9999').expect(404);
    await get('/pantry/9999').expect(404);
  });

  it('generation refreshes eligible fields and retains ineligible entries unchanged', async () => {
    await patch('/pantry/6', {
      quantity: 3,
      name: 'Fresh eggs',
      unit: 'eggs',
    }).expect(200);
    await patch('/pantry/1', { quantity: 10, expiryDate: null }).expect(200);
    const result = (await post('/shopping-list/generate').expect(200)).body;
    expect(result).toMatchObject({ added: 0, updated: 1, unchanged: 4 });
    expect(
      result.pending.items.find((entry) => entry.pantryItemId === 6),
    ).toMatchObject({ name: 'Fresh eggs', unit: 'eggs', quantityToBuy: 3 });
    expect(
      result.pending.items.find((entry) => entry.pantryItemId === 1),
    ).toMatchObject({ name: 'Milk', quantityToBuy: 1, pantryStatuses: ['OK'] });
  });

  it('a generation name conflict rolls back earlier generated changes', async () => {
    await remove('/shopping-list/101').expect(204);
    await remove('/shopping-list/102').expect(204);
    await post('/shopping-list', { name: 'Yoghurt', quantityToBuy: 1 }).expect(
      201,
    );
    const result = await post('/shopping-list/generate').expect(409);
    expect(result.body.code).toBe('PENDING_NAME_CONFLICT');
    expect(
      await connection
        .collection('shopping_entries')
        .countDocuments({ pantryItemId: 1, status: 'Pending' }),
    ).toBe(0);
  });

  it('a failed history write rolls back the actual purchase stock update', async () => {
    const model = app.get<Model<ShoppingEntry>>(
      getModelToken(ShoppingEntry.name),
    );
    const failure = jest
      .spyOn(model.collection, 'updateOne')
      .mockRejectedValueOnce(
        new Error('Injected purchase persistence failure'),
      );
    try {
      await post('/shopping-list/101/purchase', {
        purchasedQuantity: 2,
      }).expect(500);
    } finally {
      failure.mockRestore();
    }
    expect((await get('/pantry/1')).body.quantity).toBe(1);
    expect(
      (await connection.collection('shopping_entries').findOne({ id: 101 }))
        .status,
    ).toBe('Pending');
  });

  it('concurrent purchases restock exactly once', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        post('/shopping-list/101/purchase', { purchasedQuantity: 2 }),
      ),
    );
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(7);
    expect((await get('/pantry/1')).body.quantity).toBe(3);
  });

  it('concurrent use and purchase preserve both stock changes', async () => {
    const results = await Promise.all([
      post('/pantry/1/use', { quantity: 1 }),
      post('/shopping-list/101/purchase', { purchasedQuantity: 2 }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect((await get('/pantry/1')).body.quantity).toBe(2);
  });

  it('concurrent generation and manual creation preserve Pending uniqueness', async () => {
    await remove('/shopping-list/101').expect(204);
    const results = await Promise.all([
      post('/shopping-list/generate'),
      post('/shopping-list', { name: 'milk', quantityToBuy: 1 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(
      expect.arrayContaining([409]),
    );
    expect(
      await connection
        .collection('shopping_entries')
        .countDocuments({ normalizedName: 'milk', status: 'Pending' }),
    ).toBe(1);
  });

  it('concurrent generation does not produce duplicate links', async () => {
    await connection
      .collection('shopping_entries')
      .deleteMany({ status: 'Pending', pantryItemId: { $ne: null } });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => post('/shopping-list/generate')),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(
      await connection
        .collection('shopping_entries')
        .countDocuments({ status: 'Pending' }),
    ).toBe(7);
  });

  it('concurrent use requests cannot consume the same stock twice', async () => {
    const results = await Promise.all([
      post('/pantry/1/use', { quantity: 1 }),
      post('/pantry/1/use', { quantity: 1 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    expect((await get('/pantry/1')).body.quantity).toBe(0);
  });

  it('concurrent pantry deletion and generation never leave an orphaned Pending link', async () => {
    const created = await post('/pantry', {
      name: 'Race pantry item',
      categoryId: 1,
      quantity: 0,
      minimumQuantity: 1,
      unit: 'pieces',
    }).expect(201);
    const id = created.body.id;
    const results = await Promise.all([
      remove('/pantry/' + id),
      post('/shopping-list/generate'),
    ]);
    expect([204, 409]).toContain(results[0].status);
    expect(results[1].status).toBe(200);
    const pending = await connection
      .collection('shopping_entries')
      .findOne({ pantryItemId: id, status: 'Pending' });
    const item = await connection.collection('pantry_items').findOne({ id });
    if (pending) expect(item).not.toBeNull();
    if (!item) expect(pending).toBeNull();
  });

  it('refuses writes if the shared fence was removed', async () => {
    await connection.collection('write_fences').deleteMany({});
    try {
      await post('/pantry/1/use', { quantity: 1 }).expect(500);
      expect((await get('/pantry/1')).body.quantity).toBe(1);
    } finally {
      await app.get(WriteService).onModuleInit();
    }
  });
});
