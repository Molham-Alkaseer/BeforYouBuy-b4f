import { Connection, createConnection } from 'mongoose';
import { IdsService } from '../../src/database/ids.service';
import { WriteService } from '../../src/database/write.service';

describe('Real MongoDB transaction and ID infrastructure', () => {
  let connection: Connection;
  let ids: IdsService;
  let writes: WriteService;
  const database = `byb_test_foundation_${process.pid}`;

  beforeAll(async () => {
    connection = await createConnection(`mongodb://127.0.0.1:27018/${database}?replicaSet=byb-rs`).asPromise();
    ids = new IdsService(connection);
    writes = new WriteService(connection);
    await writes.onModuleInit();
    await connection.createCollection('pantry_items');
    await connection.createCollection('shopping_entries');
  });
  afterAll(async () => {
    if (connection) { await connection.dropDatabase(); await connection.close(); }
  });

  it('allocates 50 distinct IDs concurrently above existing records', async () => {
    await connection.collection('categories').insertOne({ id: 7, name: 'Dairy' });
    const allocated = await Promise.all(Array.from({ length: 50 }, () => ids.next('categories')));
    expect(new Set(allocated).size).toBe(50);
    expect(Math.min(...allocated)).toBe(8);
    expect(Math.max(...allocated)).toBe(57);
    await connection.collection('categories').deleteMany({});
    expect(await ids.next('categories')).toBe(58);
  });

  it('rolls back stock when the corresponding history write fails', async () => {
    await connection.collection('pantry_items').insertOne({ id: 1, quantity: 1 });
    await expect(writes.run(async (session) => {
      await connection.collection('pantry_items').updateOne({ id: 1 }, { $inc: { quantity: 2 } }, { session });
      throw new Error('Simulated failure before purchase history');
    })).rejects.toThrow('Simulated failure');
    expect((await connection.collection('pantry_items').findOne({ id: 1 })).quantity).toBe(1);
  });

  it('serializes concurrent read/check/write operations without losing stock', async () => {
    await Promise.all(Array.from({ length: 12 }, () => writes.run(async (session) => {
      const item = await connection.collection('pantry_items').findOne({ id: 1 }, { session });
      await connection.collection('pantry_items').updateOne({ id: 1 }, { $set: { quantity: item.quantity + 1 } }, { session });
    })));
    expect((await connection.collection('pantry_items').findOne({ id: 1 })).quantity).toBe(13);
  });

  it('commits related writes together', async () => {
    await writes.run(async (session) => {
      await connection.collection('pantry_items').updateOne({ id: 1 }, { $inc: { quantity: 2 } }, { session });
      await connection.collection('shopping_entries').insertOne({ id: 1, status: 'Purchased' }, { session });
    });
    expect((await connection.collection('pantry_items').findOne({ id: 1 })).quantity).toBe(15);
    expect(await connection.collection('shopping_entries').countDocuments()).toBe(1);
  });

  it('keeps ID allocation across a new service connection', async () => {
    const restarted = await createConnection(`mongodb://127.0.0.1:27018/${database}?replicaSet=byb-rs`).asPromise();
    try { expect(await new IdsService(restarted).next('categories')).toBe(59); }
    finally { await restarted.close(); }
  });
});
