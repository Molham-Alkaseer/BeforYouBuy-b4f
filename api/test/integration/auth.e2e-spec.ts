import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HouseholdMembersService } from '../../src/household-members/household-members.service';
import { requireJwtSecret } from '../../src/auth/auth.module';
import {
  createAccount,
  startAuthApp,
  TEST_JWT_SECRET,
  TEST_PASSWORD,
} from '../support/auth-fixtures';

describe('Real account authentication', () => {
  let ctx: Awaited<ReturnType<typeof startAuthApp>>;
  beforeAll(async () => {
    ctx = await startAuthApp('auth');
  });
  afterAll(async () => {
    if (ctx) await ctx.stop();
  });
  const register = (body: object) =>
    request(ctx.app.getHttpServer()).post('/api/auth/register').send(body);
  const me = (token: string) =>
    request(ctx.app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ' + token);

  it('normalizes registration, hashes the untouched password, and returns only safe fields', async () => {
    const result = await register({
      name: '  Molham  ',
      email: '  TEST@Example.com  ',
      password: ' password with spaces ',
    }).expect(201);
    expect(Object.keys(result.body).sort()).toEqual([
      'createdAt',
      'email',
      'householdId',
      'householdRole',
      'id',
      'name',
    ]);
    expect(result.body).toMatchObject({
      name: 'Molham',
      email: 'test@example.com',
      householdRole: 'admin',
    });
    const stored = await ctx.connection
      .collection('users')
      .findOne({ id: result.body.id });
    expect(stored.passwordHash).not.toBe(' password with spaces ');
    expect(
      await bcrypt.compare(' password with spaces ', stored.passwordHash),
    ).toBe(true);
    expect(
      await ctx.connection.collection('household_members').countDocuments({
        householdId: result.body.householdId,
        userId: result.body.id,
        role: 'admin',
      }),
    ).toBe(1);
    const login = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ' TEST@EXAMPLE.COM ', password: ' password with spaces ' })
      .expect(200);
    expect(Object.keys(login.body).sort()).toEqual(['accessToken', 'user']);
    const claims = ctx.app.get(JwtService).verify(login.body.accessToken);
    expect(claims.exp - claims.iat).toBe(7200);
    expect((await me(login.body.accessToken).expect(200)).body).toEqual(
      result.body,
    );
  });

  it.each([
    { name: ' ', email: 'valid@example.com', password: TEST_PASSWORD },
    { name: 'Name', email: 'invalid', password: TEST_PASSWORD },
    { name: 'Name', email: 'valid@example.com', password: 'short' },
    { name: 'Name', email: 'valid@example.com', password: 'a'.repeat(73) },
    { name: 'Name', email: 'valid@example.com', password: '🙂'.repeat(19) },
    {
      name: 'Name',
      email: 'valid@example.com',
      password: TEST_PASSWORD,
      role: 'owner',
    },
    {
      name: 'Name',
      email: 'valid@example.com',
      password: TEST_PASSWORD,
      householdId: 2,
    },
    [],
  ])('rejects invalid registration without writing: %j', async (body) => {
    const before = await ctx.connection.collection('users').countDocuments();
    const response = await register(body).expect(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: expect.any(Object),
    });
    expect(await ctx.connection.collection('users').countDocuments()).toBe(
      before,
    );
  });

  it('accepts the bcrypt 72-byte boundary', async () => {
    await register({
      name: 'Boundary',
      email: 'boundary@example.com',
      password: '🙂'.repeat(18),
    }).expect(201);
  });

  it('maps concurrent normalized duplicate registrations to one account and one 409', async () => {
    const results = await Promise.all(
      [' Race@example.com ', 'race@EXAMPLE.com'].map((email) =>
        register({ name: 'Race', email, password: TEST_PASSWORD }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409).body.code).toBe(
      'EMAIL_ALREADY_EXISTS',
    );
    const account = await ctx.connection
      .collection('users')
      .findOne({ email: 'race@example.com' });
    expect(
      await ctx.connection
        .collection('household_members')
        .countDocuments({ userId: account.id }),
    ).toBe(1);
  });

  it('rolls back the account and counters if membership creation fails', async () => {
    const counters = await ctx.connection
      .collection('id_counters')
      .find()
      .sort({ _id: 1 })
      .toArray();
    const failure = jest
      .spyOn(ctx.app.get(HouseholdMembersService), 'createMember')
      .mockRejectedValueOnce(new Error('Injected failure'));
    try {
      await register({
        name: 'Rollback',
        email: 'rollback@example.com',
        password: TEST_PASSWORD,
      }).expect(500);
    } finally {
      failure.mockRestore();
    }
    expect(
      await ctx.connection
        .collection('users')
        .findOne({ email: 'rollback@example.com' }),
    ).toBeNull();
    expect(
      await ctx.connection
        .collection('id_counters')
        .find()
        .sort({ _id: 1 })
        .toArray(),
    ).toEqual(counters);
  });

  it('uses identical credential errors for an unknown account and a wrong password', async () => {
    const account = await createAccount(ctx.app);
    const responses = await Promise.all(
      [account.email, 'missing@example.com'].map((email) =>
        request(ctx.app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'wrong-password' })
          .expect(401),
      ),
    );
    expect(responses[0].body).toEqual(responses[1].body);
    expect(responses[0].body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects missing, forged, expired and malformed tokens with the same safe response', async () => {
    const account = await createAccount(ctx.app);
    const jwt = ctx.app.get(JwtService);
    const tokens = [
      '',
      'not-a-token',
      jwt.sign(
        { sub: account.id, email: account.email },
        { secret: 'different-private-signing-secret', expiresIn: '1h' },
      ),
      jwt.sign({ sub: account.id, email: account.email }, { expiresIn: -1 }),
      jwt.sign({ sub: '1', email: account.email }),
    ];
    const results = await Promise.all(
      tokens.map((token) => me(token).expect(401)),
    );
    for (const result of results)
      expect(result.body).toEqual({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Invalid or missing authentication token.',
        fieldErrors: {},
      });
  });

  it('reads current email and role and rejects a subsequently deleted account', async () => {
    const account = await createAccount(ctx.app);
    await ctx.connection
      .collection('users')
      .updateOne(
        { id: account.id },
        { $set: { email: 'changed@example.com' } },
      );
    await ctx.connection
      .collection('household_members')
      .updateOne({ userId: account.id }, { $set: { role: 'admin' } });
    expect((await me(account.token).expect(200)).body).toMatchObject({
      email: 'changed@example.com',
      householdRole: 'admin',
    });
    await ctx.connection.collection('users').deleteOne({ id: account.id });
    await me(account.token).expect(401);
    await request(ctx.app.getHttpServer())
      .post('/api/shopping-list/generate')
      .set('Authorization', 'Bearer ' + account.token)
      .expect(401);
  });

  it('rejects an account without membership and never reuses a deleted account ID', async () => {
    const account = await createAccount(ctx.app);
    await ctx.connection
      .collection('household_members')
      .deleteOne({ userId: account.id });
    await me(account.token).expect(403);
    await ctx.connection.collection('users').deleteOne({ id: account.id });
    expect((await createAccount(ctx.app)).id).toBeGreaterThan(account.id);
  });

  it('fails startup configuration for absent or placeholder secrets', () => {
    for (const secret of [
      undefined,
      'short',
      'replace-with-a-random-secret-at-least-32-characters',
    ]) {
      expect(() =>
        requireJwtSecret({ get: () => secret } as unknown as ConfigService),
      ).toThrow('JWT_SECRET');
    }
    expect(
      requireJwtSecret({
        get: () => TEST_JWT_SECRET,
      } as unknown as ConfigService),
    ).toBe(TEST_JWT_SECRET);
  });
});
