import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { HouseholdMembersService } from '../../src/household-members/household-members.service';
import { migrateLegacyHousehold } from '../../src/database/household-migration';
import { startAuthApp, TEST_PASSWORD } from '../support/auth-fixtures';

describe('Private households and read-only family accounts', () => {
  let ctx: Awaited<ReturnType<typeof startAuthApp>>;
  let first: any, second: any, member: any;
  let itemId: number, entryId: number;
  const input = {
    name: 'Family milk',
    categoryId: 1,
    quantity: 1.5,
    unit: 'L',
    minimumQuantity: 3,
    expiryDate: null,
  };
  const accountInput = () => ({
    name: 'Family account',
    email: `${randomUUID()}@example.com`,
    password: TEST_PASSWORD,
  });
  function call(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    account?: { accessToken: string },
    body?: object,
  ) {
    const operation = request(ctx.app.getHttpServer())[method]('/api' + path);
    if (account)
      operation.set('Authorization', 'Bearer ' + account.accessToken);
    return operation.send(body);
  }
  async function signup() {
    const input = accountInput();
    const registered = await call(
      'post',
      '/auth/register',
      undefined,
      input,
    ).expect(201);
    expect(registered.body.householdRole).toBe('admin');
    expect(registered.body.householdId).toBeGreaterThan(1);
    const login = await call('post', '/auth/login', undefined, {
      email: input.email,
      password: input.password,
    }).expect(200);
    expect(login.body.user).toEqual(registered.body);
    return login.body;
  }
  async function snapshot() {
    const result = {};
    for (const name of [
      'users',
      'household_members',
      'pantry_items',
      'shopping_entries',
      'id_counters',
    ]) {
      result[name] = await ctx.connection
        .collection(name)
        .find()
        .sort({ _id: 1 })
        .toArray();
    }
    return result;
  }
  beforeAll(async () => {
    ctx = await startAuthApp('household_isolation');
    [first, second] = await Promise.all([signup(), signup()]);
    const data = accountInput();
    const created = await call(
      'post',
      '/household/members',
      first,
      data,
    ).expect(201);
    expect(created.body).toMatchObject({
      householdId: first.user.householdId,
      householdRole: 'member',
    });
    expect(created.body).not.toHaveProperty('password');
    expect(created.body).not.toHaveProperty('passwordHash');
    member = (
      await call('post', '/auth/login', undefined, {
        email: data.email,
        password: data.password,
      }).expect(200)
    ).body;
  });
  afterAll(async () => {
    if (ctx) await ctx.stop();
  });

  it('creates separate empty households and lists only your own family', async () => {
    expect(first.user.householdId).not.toBe(second.user.householdId);
    for (const account of [first, second, member]) {
      expect(
        (await call('get', '/pantry', account).expect(200)).body.items,
      ).toEqual([]);
      expect(
        (await call('get', '/dashboard', account).expect(200)).body.totalItems,
      ).toBe(0);
      expect(
        (await call('get', '/shopping-list', account).expect(200)).body.items,
      ).toEqual([]);
    }
    expect(
      (await call('get', '/household/members', first).expect(200)).body.items
        .map((u) => u.id)
        .sort(),
    ).toEqual([first.user.id, member.user.id].sort());
    expect(
      (
        await call('get', '/household/members', second).expect(200)
      ).body.items.map((u) => u.id),
    ).toEqual([second.user.id]);
    await call('get', '/household/members', member).expect(403);
  });

  it('shares data with family only and permits the same names in separate households', async () => {
    itemId = (await call('post', '/pantry', first, input).expect(201)).body.id;
    const secondItem = (
      await call('post', '/pantry', second, { ...input, quantity: 20 }).expect(
        201,
      )
    ).body;
    expect(secondItem.id).not.toBe(itemId);
    for (const account of [first, member]) {
      const list = (
        await call(
          'get',
          '/pantry?name=milk&categoryId=1&status=LOW%20STOCK',
          account,
        ).expect(200)
      ).body;
      expect(list.items.map((item) => item.id)).toEqual([itemId]);
      expect(
        (await call('get', `/pantry/${itemId}`, account).expect(200)).body
          .quantity,
      ).toBe(1.5);
    }
    await call('get', `/pantry/${secondItem.id}`, first).expect(404);
    await call('get', `/pantry/${itemId}`, second).expect(404);
    expect(
      (await call('get', '/dashboard', first).expect(200)).body.statusCounts[
        'LOW STOCK'
      ],
    ).toBe(1);
    expect(
      (await call('get', '/dashboard', second).expect(200)).body.statusCounts[
        'LOW STOCK'
      ],
    ).toBe(0);
    await call('post', '/pantry', first, input).expect(409);
    entryId = (
      await call('post', '/shopping-list', first, {
        name: 'Family bread',
        quantityToBuy: 1,
      }).expect(201)
    ).body.id;
    await call('post', '/shopping-list', second, {
      name: 'Family bread',
      quantityToBuy: 1,
    }).expect(201);
  });

  it('denies every member mutation without changing data or ID counters', async () => {
    const before = await snapshot();
    const operations: ['post' | 'patch' | 'delete', string, object?][] = [
      ['post', '/pantry', input],
      ['patch', `/pantry/${itemId}`, { quantity: 4 }],
      ['post', `/pantry/${itemId}/use`, { quantity: 0.5 }],
      ['delete', `/pantry/${itemId}`],
      ['post', '/shopping-list', { name: 'No write', quantityToBuy: 1 }],
      ['post', '/shopping-list/generate'],
      ['post', `/shopping-list/${entryId}/purchase`, { purchasedQuantity: 1 }],
      ['delete', `/shopping-list/${entryId}`],
      ['post', '/household/members', accountInput()],
    ];
    for (const [method, path, body] of operations) {
      expect(
        (await call(method, path, member, body).expect(403)).body.code,
      ).toBe('FORBIDDEN');
    }
    expect(await snapshot()).toEqual(before);
  });

  it('rejects cross-household IDs for every item/entry mutation without changing either household', async () => {
    const before = await snapshot();
    const operations: ['post' | 'patch' | 'delete', string, object?][] = [
      ['patch', `/pantry/${itemId}`, { quantity: 200 }],
      ['post', `/pantry/${itemId}/use`, { quantity: 0.5 }],
      ['delete', `/pantry/${itemId}`],
      ['post', `/shopping-list/${entryId}/purchase`, { purchasedQuantity: 2 }],
      ['delete', `/shopping-list/${entryId}`],
    ];
    for (const [method, path, body] of operations)
      await call(method, path, second, body).expect(404);
    expect(
      (
        await call(
          'get',
          `/shopping-list?pantryItemId=${itemId}`,
          second,
        ).expect(200)
      ).body.items,
    ).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });

  it('keeps generation, purchase, dashboard and history inside the household', async () => {
    await call('patch', `/pantry/${itemId}`, first, { quantity: 2.5 }).expect(
      200,
    );
    expect(
      (
        await call('post', `/pantry/${itemId}/use`, first, {
          quantity: 1,
        }).expect(200)
      ).body.quantity,
    ).toBe(1.5);
    const generated = (
      await call('post', '/shopping-list/generate', first).expect(200)
    ).body;
    expect(generated.added).toBe(1);
    expect(generated.pending.total).toBe(2);
    const linked = generated.pending.items.find(
      (entry) => entry.pantryItemId === itemId,
    );
    await call('delete', `/pantry/${itemId}`, first).expect(409);
    const purchased = (
      await call('post', `/shopping-list/${linked.id}/purchase`, first, {
        purchasedQuantity: 1.5,
      }).expect(200)
    ).body;
    expect(purchased.pantryItem.quantity).toBe(3);
    expect(
      (
        await call('get', '/shopping-list?status=Purchased', member).expect(200)
      ).body.items.map((entry) => entry.id),
    ).toEqual([linked.id]);
    expect(
      (await call('get', '/shopping-list?status=Purchased', second).expect(200))
        .body.items,
    ).toEqual([]);
    expect(
      (await call('get', '/dashboard', member).expect(200)).body
        .pendingShopping,
    ).toEqual({ total: 1, linked: 0, manual: 1 });
    expect(
      (await call('get', '/dashboard', second).expect(200)).body.totalItems,
    ).toBe(1);
    await call('delete', `/shopping-list/${linked.id}`, first).expect(409);
    await call('delete', `/pantry/${itemId}`, first).expect(204);
    expect(
      (await call('get', '/shopping-list?status=Purchased', member).expect(200))
        .body.items,
    ).toHaveLength(1);
    await call('delete', `/shopping-list/${entryId}`, first).expect(204);
  });

  it('blocks anonymous, malformed and expired tokens on private reads', async () => {
    const jwt = ctx.app.get(JwtService);
    const expired = jwt.sign(
      { sub: first.user.id, email: first.user.email },
      { expiresIn: -1 },
    );
    for (const path of [
      '/pantry',
      '/pantry/1',
      '/dashboard',
      '/shopping-list',
      '/household/members',
    ]) {
      for (const account of [
        undefined,
        { accessToken: 'forged' },
        { accessToken: expired },
      ]) {
        expect((await call('get', path, account).expect(401)).body.code).toBe(
          'UNAUTHENTICATED',
        );
      }
    }
  });

  it('ignores JWT tenant/role claims and reads current membership with the same token', async () => {
    const signed = ctx.app.get(JwtService).sign({
      sub: member.user.id,
      email: member.user.email,
      householdId: second.user.householdId,
      role: 'admin',
    });
    await call('post', '/pantry', { accessToken: signed }, input).expect(403);
    expect(
      (await call('get', '/auth/me', { accessToken: signed }).expect(200)).body
        .householdId,
    ).toBe(first.user.householdId);
    await ctx.connection
      .collection('household_members')
      .updateOne({ userId: second.user.id }, { $set: { role: 'member' } });
    await call('post', '/shopping-list/generate', second).expect(403);
    await call('post', '/household/members', second, accountInput()).expect(
      403,
    );
    await call('get', '/pantry', second).expect(200);
    await ctx.connection
      .collection('household_members')
      .deleteOne({ userId: second.user.id });
    await call('get', '/pantry', second).expect(403);
  });

  it('rejects role/tenant injection, duplicate emails and rolls back failed family creation', async () => {
    for (const field of [
      { role: 'admin' },
      { householdId: 1 },
      { userId: first.user.id },
    ]) {
      await call('post', '/household/members', first, {
        ...accountInput(),
        ...field,
      }).expect(400);
      await call('post', '/pantry', first, { ...input, ...field }).expect(400);
    }
    const before = await snapshot();
    await call('post', '/household/members', first, {
      ...accountInput(),
      email: member.user.email,
    }).expect(409);
    const failure = jest
      .spyOn(ctx.app.get(HouseholdMembersService), 'createMember')
      .mockRejectedValueOnce(new Error('Rollback test'));
    try {
      await call('post', '/household/members', first, accountInput()).expect(
        500,
      );
    } finally {
      failure.mockRestore();
    }
    expect(await snapshot()).toEqual(before);
  });

  it('preserves legacy demo data in household 1 and migrates indexes idempotently', async () => {
    await ctx.connection
      .collection('pantry_items')
      .createIndex({ normalizedName: 1 }, { unique: true });
    await ctx.connection
      .collection('pantry_items')
      .updateOne({ id: 1 }, { $unset: { householdId: '' } });
    const original = await ctx.connection
      .collection('pantry_items')
      .findOne({ id: 1 });
    await migrateLegacyHousehold(ctx.connection);
    await migrateLegacyHousehold(ctx.connection);
    expect(
      await ctx.connection.collection('pantry_items').findOne({ id: 1 }),
    ).toEqual({ ...original, householdId: 1 });
    await call('get', '/pantry/1', first).expect(404);
    const indexes = await ctx.connection.collection('pantry_items').indexes();
    expect(
      indexes.some(
        (index) =>
          index.unique &&
          index.key.householdId === 1 &&
          index.key.normalizedName === 1,
      ),
    ).toBe(true);
    expect(
      indexes.some(
        (index) =>
          index.unique &&
          Object.keys(index.key).length === 1 &&
          index.key.normalizedName === 1,
      ),
    ).toBe(false);
  });
});
