import * as request from 'supertest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HouseholdRolesGuard } from '../../src/auth/guards/household-roles.guard';
import { HOUSEHOLD_ROLES_KEY } from '../../src/auth/household-roles.decorator';
import { createAccount, startAuthApp } from '../support/auth-fixtures';

describe('Household permissions on real domain routes', () => {
  let ctx: Awaited<ReturnType<typeof startAuthApp>>;
  let member: Awaited<ReturnType<typeof createAccount>>;
  let admin: typeof member;
  let owner: typeof member;
  beforeAll(async () => {
    ctx = await startAuthApp('permissions');
    member = await createAccount(ctx.app);
    admin = await createAccount(ctx.app, 'admin');
    owner = await createAccount(ctx.app, 'owner');
  });
  afterAll(async () => {
    if (ctx) await ctx.stop();
  });
  const write = (
    method: 'post' | 'patch' | 'delete',
    path: string,
    token?: string,
    body?: object,
  ) => {
    const call = request(ctx.app.getHttpServer())[method]('/api' + path);
    if (token) call.set('Authorization', 'Bearer ' + token);
    return call.send(body);
  };
  const input = (name: string) => ({
    name,
    categoryId: 1,
    quantity: 3,
    unit: 'boxes',
    minimumQuantity: 0,
    expiryDate: null,
  });
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const name of ['pantry_items', 'shopping_entries', 'id_counters'])
      result[name] = await ctx.connection
        .collection(name)
        .find()
        .sort({ _id: 1 })
        .toArray();
    return result;
  }

  it.each([
    '/categories',
    '/pantry',
    '/pantry/1',
    '/dashboard',
    '/shopping-list?status=Purchased',
  ])('keeps anonymous GET %s public', async (path) => {
    await request(ctx.app.getHttpServer())
      .get('/api' + path)
      .expect(200);
  });

  it.each([
    [
      'post',
      '/pantry',
      {
        name: 'Unauthorized',
        categoryId: 1,
        quantity: 1,
        unit: 'box',
        minimumQuantity: 0,
      },
    ],
    ['patch', '/pantry/1', { quantity: 1 }],
    ['post', '/pantry/1/use', { quantity: 1 }],
    ['delete', '/pantry/1', undefined],
    ['post', '/shopping-list', { name: 'Unauthorized', quantityToBuy: 1 }],
    ['post', '/shopping-list/generate', undefined],
    ['post', '/shopping-list/1/purchase', { purchasedQuantity: 1 }],
    ['delete', '/shopping-list/1', undefined],
  ] as const)(
    'rejects anonymous %s %s before changing records or counters',
    async (method, path, body) => {
      const before = await snapshot();
      expect(
        (await write(method, path, undefined, body).expect(401)).body.code,
      ).toBe('UNAUTHENTICATED');
      expect(await snapshot()).toEqual(before);
    },
  );

  it.each(['member', 'admin', 'owner'] as const)(
    'allows %s to create/edit/use/generate/add/purchase',
    async (role) => {
      const account = { member, admin, owner }[role];
      const item = (
        await write(
          'post',
          '/pantry',
          account.token,
          input('Allowed ' + role),
        ).expect(201)
      ).body;
      await write('patch', '/pantry/' + item.id, account.token, {
        quantity: 4,
      }).expect(200);
      expect(
        (
          await write('post', '/pantry/' + item.id + '/use', account.token, {
            quantity: 1,
          }).expect(200)
        ).body.quantity,
      ).toBe(3);
      await write('post', '/shopping-list/generate', account.token).expect(200);
      const entry = (
        await write('post', '/shopping-list', account.token, {
          name: 'Manual ' + role,
          quantityToBuy: 1,
        }).expect(201)
      ).body;
      expect(
        (
          await write(
            'post',
            '/shopping-list/' + entry.id + '/purchase',
            account.token,
            { purchasedQuantity: 1 },
          ).expect(200)
        ).body.entry.status,
      ).toBe('Purchased');
    },
  );

  it('denies member deletion and honors an immediate role change with the same token', async () => {
    const account = await createAccount(ctx.app);
    const item = (
      await write(
        'post',
        '/pantry',
        account.token,
        input('Role changed'),
      ).expect(201)
    ).body;
    const entry = (
      await write('post', '/shopping-list', account.token, {
        name: 'Role change entry',
        quantityToBuy: 1,
      }).expect(201)
    ).body;
    const before = await snapshot();
    for (const path of ['/pantry/' + item.id, '/shopping-list/' + entry.id])
      expect(
        (await write('delete', path, account.token).expect(403)).body.code,
      ).toBe('FORBIDDEN');
    expect(await snapshot()).toEqual(before);
    await ctx.connection
      .collection('household_members')
      .updateOne({ userId: account.id }, { $set: { role: 'admin' } });
    for (const path of ['/pantry/' + item.id, '/shopping-list/' + entry.id])
      expect(
        (await write('delete', path, account.token).expect(204)).text,
      ).toBe('');
    await ctx.connection
      .collection('household_members')
      .deleteOne({ userId: account.id });
    await write('post', '/shopping-list/generate', account.token).expect(403);
  });

  it.each(['admin', 'owner'] as const)(
    'allows %s deletion but preserves Pending/history business restrictions',
    async (role) => {
      const token = { admin, owner }[role].token;
      const item = (
        await write('post', '/pantry', token, input('Delete ' + role)).expect(
          201,
        )
      ).body;
      await write('delete', '/pantry/' + item.id, token).expect(204);
      const entry = (
        await write('post', '/shopping-list', token, {
          name: 'Remove ' + role,
          quantityToBuy: 1,
        }).expect(201)
      ).body;
      await write('delete', '/shopping-list/' + entry.id, token).expect(204);
      await write('post', '/shopping-list/generate', token).expect(200);
      expect(
        (await write('delete', '/pantry/1', token).expect(409)).body.code,
      ).toBe('ITEM_HAS_PENDING_ENTRY');
      const history = await ctx.connection
        .collection('shopping_entries')
        .findOne({ status: 'Purchased' });
      expect(
        (
          await write('delete', '/shopping-list/' + history.id, token).expect(
            409,
          )
        ).body.code,
      ).toBe('ENTRY_ALREADY_PURCHASED');
    },
  );

  it('rejects actor/role injection and still enforces stock limits after authorization', async () => {
    await write('post', '/pantry', member.token, {
      ...input('Injection'),
      actorId: admin.id,
    }).expect(400);
    await write('post', '/shopping-list', member.token, {
      name: 'Injection',
      quantityToBuy: 1,
      role: 'owner',
    }).expect(400);
    const item = (
      await write('post', '/pantry', member.token, input('No overuse')).expect(
        201,
      )
    ).body;
    expect(
      (
        await write('post', '/pantry/' + item.id + '/use', member.token, {
          quantity: 99,
        }).expect(400)
      ).body.code,
    ).toBe('INSUFFICIENT_STOCK');
  });

  it('keeps category tooling key-only and distinguishes its 403 from role denial', async () => {
    expect(
      (
        await write('post', '/categories', admin.token, {
          name: 'Internal category',
        }).expect(403)
      ).body.code,
    ).toBe('INTERNAL_TOOL_FORBIDDEN');
    await request(ctx.app.getHttpServer())
      .post('/api/categories')
      .set('x-internal-tool-key', 'byb-auth-test-internal-key')
      .send({ name: 'Internal category' })
      .expect(201);
  });

  it('documents security on protected operations only', () => {
    const doc = SwaggerModule.createDocument(
      ctx.app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    for (const [path, methods] of Object.entries(doc.paths))
      for (const [method, operation] of Object.entries(methods)) {
        const protectedOperation =
          path === '/api/auth/me' ||
          ((path.startsWith('/api/pantry') ||
            path.startsWith('/api/shopping-list')) &&
            method !== 'get');
        if (protectedOperation)
          expect(operation.security).toEqual([{ bearer: [] }]);
        else expect(operation.security).toBeUndefined();
      }
  });

  it('denies missing role metadata and supports handler-over-controller metadata', async () => {
    class ExampleController {}
    const handler = () => undefined;
    Reflect.defineMetadata(HOUSEHOLD_ROLES_KEY, ['owner'], ExampleController);
    Reflect.defineMetadata(HOUSEHOLD_ROLES_KEY, ['member'], handler);
    const context = {
      getHandler: () => handler,
      getClass: () => ExampleController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: member.id, email: member.email } }),
      }),
    } as unknown as ExecutionContext;
    expect(
      new Reflector().getAllAndOverride(HOUSEHOLD_ROLES_KEY, [
        handler,
        ExampleController,
      ]),
    ).toEqual(['member']);
    expect(await ctx.app.get(HouseholdRolesGuard).canActivate(context)).toBe(
      true,
    );
    Reflect.deleteMetadata(HOUSEHOLD_ROLES_KEY, handler);
    Reflect.deleteMetadata(HOUSEHOLD_ROLES_KEY, ExampleController);
    await expect(
      ctx.app.get(HouseholdRolesGuard).canActivate(context),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });
});
