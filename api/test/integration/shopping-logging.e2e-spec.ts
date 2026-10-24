import { HttpException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { ShoppingListService } from '../../src/shopping-list/shopping-list.service';
import { ShoppingEntry } from '../../src/shopping-list/schemas/shopping-entry.schema';
import {
  captureShoppingLogs,
  startAllithApp,
} from '../support/allith-shopping-harness';

// Service-level proof of committed-only logging and atomic stock/history.
// The actor is supplied directly here; HTTP permission proof lives in shopping-auth.
describe('Shopping business logs and atomic purchases', () => {
  const actor = 7;
  let harness: Awaited<ReturnType<typeof startAllithApp>>;
  let service: ShoppingListService;
  let logs: ReturnType<typeof captureShoppingLogs>;

  const pantry = (id: number) =>
    harness.connection.collection('pantry_items').findOne({ id });
  const entry = (id: number) =>
    harness.connection.collection('shopping_entries').findOne({ id });
  const setStock = (id: number, quantity: number) =>
    harness.connection
      .collection('pantry_items')
      .updateOne({ id }, { $set: { quantity } });
  async function rejection(work: Promise<unknown>) {
    const error = await work.then(
      () => {
        throw new Error('Expected a rejection');
      },
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpException);
    return (error as HttpException).getResponse() as {
      statusCode: number;
      code: string;
      message: string;
      fieldErrors: Record<string, string[]>;
    };
  }

  beforeAll(async () => {
    harness = await startAllithApp('logging');
    service = harness.app.get(ShoppingListService);
  });
  beforeEach(async () => {
    await harness.reset();
    logs = captureShoppingLogs();
  });
  afterEach(() => logs.restore());
  afterAll(() => harness?.stop());

  it('normal stock 3 + purchase 2 logs before 3, after 5, no replacement', async () => {
    await setStock(1, 3);
    const result = await service.purchaseEntry(
      101,
      { purchasedQuantity: 2 },
      actor,
    );
    expect(Object.keys(result).sort()).toEqual(['entry', 'pantryItem']);
    expect(result.pantryItem.quantity).toBe(5);
    expect((await pantry(1)).quantity).toBe(5);
    expect(logs.successes()).toEqual([
      'Purchased shopping entry 101; pantryItemId=1, quantity=2, stock=5, stockBefore=3, stockAfter=5, expiredReplacement=false, actorId=7',
    ]);
    expect(logs.warnings()).toEqual([]);
  });

  it('expired stock 3 + purchase 2 replaces stock and logs replacement', async () => {
    await setStock(2, 3);
    const result = await service.purchaseEntry(
      102,
      { purchasedQuantity: 2, newExpiryDate: '2026-10-30' },
      actor,
    );
    expect(Object.keys(result).sort()).toEqual(['entry', 'pantryItem']);
    expect(result.pantryItem).toMatchObject({
      quantity: 2,
      expiryDate: '2026-10-30',
    });
    expect(result.entry).toMatchObject({
      status: 'Purchased',
      purchasedQuantity: 2,
      newExpiryDate: '2026-10-30',
    });
    expect(logs.successes()).toEqual([
      'Purchased shopping entry 102; pantryItemId=2, quantity=2, stock=2, stockBefore=3, stockAfter=2, expiredReplacement=true, actorId=7',
    ]);
  });

  it('expired purchase without expiry is rejected with one warning and no change', async () => {
    await setStock(2, 3);
    const before = await harness.snapshot();
    const body = await rejection(
      service.purchaseEntry(102, { purchasedQuantity: 2 }, actor),
    );
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'EXPIRY_REQUIRED',
      fieldErrors: { newExpiryDate: expect.any(Array) },
    });
    expect(body.message).toMatch(/expiry date is required/i);
    expect(await harness.snapshot()).toEqual(before);
    expect(logs.successes()).toEqual([]);
    expect(logs.warnings()).toEqual([
      'Rejected shopping purchase; code=EXPIRY_REQUIRED, actorId=7, entryId=102, pantryItemId=2',
    ]);
  });

  it('manual purchase records history without claiming a restock', async () => {
    const pantryBefore = (await harness.snapshot()).pantry;
    const result = await service.purchaseEntry(
      107,
      { purchasedQuantity: 1 },
      actor,
    );
    expect(result.pantryItem).toBeNull();
    expect(result.entry).toMatchObject({
      status: 'Purchased',
      pantryItemId: null,
      unit: null,
    });
    expect((await harness.snapshot()).pantry).toEqual(pantryBefore);
    const [message] = logs.successes();
    expect(message).toBe(
      'Purchased shopping entry 107; pantryItemId=manual, quantity=1, stock=unchanged, restock=none, actorId=7',
    );
    expect(message).not.toMatch(/stockBefore|stockAfter|stock=0/);
  });

  it('a transaction retry commits and logs the restock exactly once', async () => {
    await setStock(1, 3);
    const model = harness.app.get<Model<ShoppingEntry>>(
      getModelToken(ShoppingEntry.name),
    );
    const transient = new MongoServerError({
      message: 'Injected transient write conflict',
      code: 112,
    });
    transient.addErrorLabel('TransientTransactionError');
    const save = jest
      .spyOn(model.collection, 'updateOne')
      .mockRejectedValueOnce(transient);
    try {
      await service.purchaseEntry(101, { purchasedQuantity: 2 }, actor);
      // The callback ran twice: first attempt rejected, second committed.
      expect(save).toHaveBeenCalledTimes(2);
    } finally {
      save.mockRestore();
    }
    expect((await pantry(1)).quantity).toBe(5);
    expect(logs.successes()).toEqual([
      expect.stringContaining('stockBefore=3, stockAfter=5'),
    ]);
  });

  it('a failure after the stock update rolls both back and logs no success', async () => {
    const before = await harness.snapshot();
    const model = harness.app.get<Model<ShoppingEntry>>(
      getModelToken(ShoppingEntry.name),
    );
    const failure = jest
      .spyOn(model.collection, 'updateOne')
      .mockRejectedValueOnce(new Error('Injected history save failure'));
    try {
      await expect(
        service.purchaseEntry(101, { purchasedQuantity: 2 }, actor),
      ).rejects.toThrow('Injected history save failure');
    } finally {
      failure.mockRestore();
    }
    expect(await harness.snapshot()).toEqual(before);
    expect(logs.successes()).toEqual([]);
    // Unexpected failures belong to the global filter, not business warnings.
    expect(logs.warnings()).toEqual([]);
  });

  it('concurrent purchases change stock once with one success log', async () => {
    await setStock(1, 3);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        service.purchaseEntry(101, { purchasedQuantity: 2 }, actor),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(rejected).toHaveLength(7);
    for (const { reason } of rejected)
      expect((reason as HttpException).getResponse()).toMatchObject({
        code: 'ALREADY_PURCHASED',
      });
    expect((await pantry(1)).quantity).toBe(5);
    expect(logs.successes()).toHaveLength(1);
    // Retried losers warn once each, never once per attempt.
    expect(logs.warnings()).toEqual(
      Array(7).fill(
        'Rejected shopping purchase; code=ALREADY_PURCHASED, actorId=7, entryId=101, pantryItemId=1',
      ),
    );
  });

  it('repeat generation keeps one Pending entry per item and logs counts with actor', async () => {
    const first = await service.generateShoppingList(actor);
    const second = await service.generateShoppingList(actor);
    expect(second).toMatchObject({ added: 0, updated: 0 });
    expect(second.unchanged).toBe(
      first.added + first.updated + first.unchanged,
    );
    const linked = (
      await harness.connection
        .collection('shopping_entries')
        .find({ status: 'Pending', pantryItemId: { $type: 'number' } })
        .toArray()
    ).map((e) => e.pantryItemId);
    expect(new Set(linked).size).toBe(linked.length);
    expect(logs.successes()).toEqual([
      `Generated shopping list: added=${first.added}, updated=${first.updated}, unchanged=${first.unchanged}, actorId=7`,
      `Generated shopping list: added=0, updated=0, unchanged=${second.unchanged}, actorId=7`,
    ]);
  });

  it('a generation name conflict rolls everything back with one warning', async () => {
    await service.deleteEntry(101, actor);
    await service.deleteEntry(102, actor);
    const manual = await service.addManualEntry(
      { name: 'Yoghurt', quantityToBuy: 1 },
      actor,
    );
    const before = await harness.snapshot();
    logs.restore();
    logs = captureShoppingLogs();
    const body = await rejection(service.generateShoppingList(actor));
    expect(body).toMatchObject({
      statusCode: 409,
      code: 'PENDING_NAME_CONFLICT',
    });
    expect(await harness.snapshot()).toEqual(before);
    expect(logs.successes()).toEqual([]);
    expect(logs.warnings()).toEqual([
      `Rejected shopping generate; code=PENDING_NAME_CONFLICT, actorId=7, entryId=${manual.id}, pantryItemId=2`,
    ]);
  });

  it('logs manual creation, removal and their business rejections safely', async () => {
    const created = await service.addManualEntry(
      { name: 'Secret napkins', quantityToBuy: 2 },
      actor,
    );
    await rejection(
      service.addManualEntry(
        { name: ' secret NAPKINS ', quantityToBuy: 1 },
        actor,
      ),
    );
    await service.deleteEntry(created.id, actor);
    const history = await rejection(service.deleteEntry(205, actor));
    expect(history).toMatchObject({
      statusCode: 409,
      code: 'ENTRY_ALREADY_PURCHASED',
    });
    expect(await entry(205)).toMatchObject({ status: 'Purchased' });
    expect(logs.successes()).toEqual([
      `Created manual shopping entry ${created.id}; actorId=7`,
      `Deleted Pending shopping entry ${created.id}; pantryItemId=manual, actorId=7`,
    ]);
    expect(logs.warnings()).toEqual([
      `Rejected shopping add; code=PENDING_NAME_CONFLICT, actorId=7, entryId=${created.id}, pantryItemId=none`,
      'Rejected shopping delete; code=ENTRY_ALREADY_PURCHASED, actorId=7, entryId=205, pantryItemId=1',
    ]);
    // Business logs carry IDs only: no user-entered names, URIs or secrets.
    for (const message of logs.all()) {
      expect(message).not.toMatch(/napkins|mongodb:|secret|password|token/i);
    }
  });

  it('keeps Purchased snapshots stable and rejects repeat purchase or deletion', async () => {
    await service.purchaseEntry(
      101,
      { purchasedQuantity: 2, newExpiryDate: '2026-10-28' },
      actor,
    );
    const snapshot = await entry(101);
    await harness.connection
      .collection('pantry_items')
      .updateOne({ id: 1 }, { $set: { name: 'Oat milk', unit: 'cartons' } });
    expect(await entry(101)).toEqual(snapshot);
    await harness.connection.collection('pantry_items').deleteOne({ id: 1 });
    expect(await entry(101)).toEqual(snapshot);
    expect(snapshot).toMatchObject({
      name: 'Milk',
      unit: 'litres',
      purchasedQuantity: 2,
      newExpiryDate: '2026-10-28',
    });
    expect(
      (
        await rejection(
          service.purchaseEntry(101, { purchasedQuantity: 1 }, actor),
        )
      ).code,
    ).toBe('ALREADY_PURCHASED');
    expect((await rejection(service.deleteEntry(101, actor))).code).toBe(
      'ENTRY_ALREADY_PURCHASED',
    );
    expect(await entry(101)).toEqual(snapshot);
  });

  it('keeps helpful messages for missing entries and items', async () => {
    const missing = await rejection(
      service.purchaseEntry(9999, { purchasedQuantity: 1 }, actor),
    );
    expect(missing).toMatchObject({
      statusCode: 404,
      code: 'ENTRY_NOT_FOUND',
      message: 'Shopping entry not found.',
    });
    await harness.connection.collection('pantry_items').deleteOne({ id: 1 });
    const orphan = await rejection(
      service.purchaseEntry(101, { purchasedQuantity: 1 }, actor),
    );
    expect(orphan).toMatchObject({
      statusCode: 404,
      code: 'ITEM_NOT_FOUND',
      message: 'Linked pantry item not found.',
    });
    expect(
      (
        await rejection(
          service.purchaseEntry(
            107,
            { purchasedQuantity: 1, newExpiryDate: '2026-10-30' },
            actor,
          ),
        )
      ).fieldErrors,
    ).toHaveProperty('newExpiryDate');
    expect(logs.successes()).toEqual([]);
  });
});
