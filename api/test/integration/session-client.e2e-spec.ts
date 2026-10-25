import { resolve } from 'path';
import type {
  ApiClient,
  AuthClient,
  SafeUser,
} from '../../../client/src/types';

const { buildSync } = require('../../../client/node_modules/esbuild');
function loadSession(mocks = false) {
  const result = buildSync({
    absWorkingDir: resolve(__dirname, '../../../client'),
    stdin: {
      resolveDir: resolve(__dirname, '../../../client'),
      contents: `
      export { api, authApi } from './src/services/api-client';
      export * from './src/services/session-storage';
      export * from './src/features/session/session-store';
      export { sanitizeReturnTo } from './src/features/navigation/returnTo';`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    define: {
      'import.meta.env': JSON.stringify({
        VITE_API_URL: '/api',
        VITE_USE_MOCKS: String(mocks),
      }),
    },
  });
  const module = { exports: {} };
  new Function('module', 'exports', result.outputFiles[0].text)(
    module,
    module.exports,
  );
  return module.exports as {
    api: ApiClient;
    authApi: AuthClient;
    login(input: { email: string; password: string }): Promise<void>;
    logout(): void;
    restoreSession(): Promise<void>;
    getSessionState(): {
      status: string;
      user: SafeUser | null;
      error: string | null;
    };
    getAccessToken(): string | null;
    setAccessToken(token: string): void;
    sanitizeReturnTo(value: string | null): string;
  };
}
const user: SafeUser = {
  id: 1,
  name: 'Member',
  email: 'member@example.com',
  createdAt: '2026-10-25T00:00:00.000Z',
  householdRole: 'member',
};
const input = { email: user.email, password: 'member123' };
const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200 });
const error = (status: number, code: string) =>
  new Response(
    JSON.stringify({
      statusCode: status,
      code,
      message: code,
      fieldErrors: {},
    }),
    { status },
  );
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('Shared session and transport behavior', () => {
  let client: ReturnType<typeof loadSession>;
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    client = loadSession();
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('uses accessToken, restores current user with bearer, and leaves public reads anonymous', async () => {
    fetchMock.mockResolvedValueOnce(ok({ accessToken: 'real-token', user }));
    await expect(client.login(input)).resolves.toBeUndefined();
    expect(client.getSessionState()).toMatchObject({
      status: 'authenticated',
      user,
    });
    expect(client.getAccessToken()).toBe('real-token');
    expect(fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(false);
    fetchMock.mockResolvedValueOnce(ok({ ...user, householdRole: 'admin' }));
    await client.restoreSession();
    expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe(
      'Bearer real-token',
    );
    expect(client.getSessionState().user.householdRole).toBe('admin');
    fetchMock.mockResolvedValueOnce(ok({ items: [] }));
    await client.api.listCategories();
    expect(fetchMock.mock.calls[2][1].headers.has('Authorization')).toBe(false);
  });

  it('invalidates a protected 401 once and never retries the mutation', async () => {
    client.setAccessToken('expired');
    fetchMock.mockResolvedValueOnce(error(401, 'UNAUTHENTICATED'));
    await expect(client.api.generateShoppingList()).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(client.getAccessToken()).toBeNull();
    expect(client.getSessionState().status).toBe('anonymous');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])(
    'keeps login errors and permission errors from clearing a valid session (%s)',
    async (status) => {
      client.setAccessToken('valid');
      fetchMock.mockResolvedValueOnce(
        error(status, status === 401 ? 'INVALID_CREDENTIALS' : 'FORBIDDEN'),
      );
      await expect(
        status === 401
          ? client.authApi.login(input)
          : client.api.deletePantryItem(1),
      ).rejects.toMatchObject({ statusCode: status });
      expect(client.getAccessToken()).toBe('valid');
    },
  );

  it.each(['different-token', 'same-token'])(
    'ignores a late 401 after a newer login even with %s',
    async (nextToken) => {
      client.setAccessToken('same-token');
      const delayed = deferred<Response>();
      fetchMock.mockReturnValueOnce(delayed.promise);
      const pending = client.api.generateShoppingList();
      fetchMock.mockResolvedValueOnce(ok({ accessToken: nextToken, user }));
      await client.login(input);
      delayed.resolve(error(401, 'UNAUTHENTICATED'));
      await expect(pending).rejects.toMatchObject({ statusCode: 401 });
      expect(client.getSessionState().status).toBe('authenticated');
      expect(client.getAccessToken()).toBe(nextToken);
    },
  );

  it('cannot resurrect a logged-out session with a delayed restoration', async () => {
    client.setAccessToken('valid');
    const delayed = deferred<Response>();
    fetchMock.mockReturnValueOnce(delayed.promise);
    const pending = client.restoreSession();
    client.logout();
    delayed.resolve(ok(user));
    await pending;
    expect(client.getSessionState()).toMatchObject({
      status: 'anonymous',
      user: null,
    });
    expect(client.getAccessToken()).toBeNull();
  });

  it('cannot resurrect a logged-out session with a delayed login', async () => {
    const delayed = deferred<Response>();
    fetchMock.mockReturnValueOnce(delayed.promise);
    const pending = client.login(input);
    client.logout();
    delayed.resolve(ok({ accessToken: 'late-token', user }));
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(client.getAccessToken()).toBeNull();
  });

  it('keeps a failed restore retryable and never falls back to mock accounts', async () => {
    client.setAccessToken('valid');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await client.restoreSession();
    expect(client.getSessionState()).toMatchObject({
      status: 'anonymous',
      error: expect.any(String),
    });
    expect(client.getAccessToken()).toBe('valid');
    fetchMock.mockResolvedValueOnce(ok(user));
    await client.restoreSession();
    expect(client.getSessionState().status).toBe('authenticated');
  });

  it('never sends a mock fixture token to a live server', async () => {
    client.setAccessToken('mock-token-1-123');
    fetchMock.mockResolvedValueOnce(error(401, 'UNAUTHENTICATED'));
    await expect(client.authApi.me()).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(false);
    expect(client.getAccessToken()).toBeNull();
  });

  it('preserves structured validation errors and supports bodyless 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'Bad name',
          code: 'VALIDATION_ERROR',
          fieldErrors: { name: ['Required'] },
        }),
        { status: 400 },
      ),
    );
    await expect(
      client.authApi.register({ ...input, name: '' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      fieldErrors: { name: ['Required'] },
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(client.api.deleteShoppingEntry(1)).resolves.toBeUndefined();
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/login',
    '/register?returnTo=/login',
    '/%6cogin',
    '/bad%ZZ',
    '/\nwrong',
  ])('rejects unsafe returnTo %j', (value) => {
    expect(client.sanitizeReturnTo(value)).toBe('/pantry');
  });
  it('preserves a local return path with query and fragment', () => {
    expect(client.sanitizeReturnTo('/pantry/12/edit?from=detail#name')).toBe(
      '/pantry/12/edit?from=detail#name',
    );
  });
});

describe('Explicit mock authentication follows the shared session', () => {
  it('registers safely without login and rejects duplicates or role injection', async () => {
    const client = loadSession(true);
    const data = {
      name: ' Mock Member ',
      email: ' NEW@example.com ',
      password: 'password123',
    };
    expect(await client.authApi.register(data)).toMatchObject({
      name: 'Mock Member',
      email: 'new@example.com',
      householdRole: 'member',
    });
    expect(client.getAccessToken()).toBeNull();
    await expect(client.authApi.register(data)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
    });
    await expect(
      client.authApi.register({ ...data, role: 'owner' } as any),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('denies every anonymous mutation but permits public browsing', async () => {
    const client = loadSession(true);
    expect((await client.api.listPantry()).items.length).toBeGreaterThan(0);
    const calls = [
      () =>
        client.api.createPantryItem({
          name: 'Test',
          categoryId: 1,
          quantity: 1,
          minimumQuantity: 0,
          unit: 'kg',
        }),
      () => client.api.updatePantryItem(1, { name: 'Changed' }),
      () => client.api.usePantryItem(1, { quantity: 1 }),
      () => client.api.deletePantryItem(1),
      () => client.api.createManualEntry({ name: 'Test', quantityToBuy: 1 }),
      () => client.api.generateShoppingList(),
      () => client.api.purchaseEntry(1, { purchasedQuantity: 1 }),
      () => client.api.deleteShoppingEntry(1),
    ];
    for (const call of calls)
      await expect(call()).rejects.toMatchObject({ statusCode: 401 });
  });
  it('allows member writes, forbids member deletion, restores session, and honors logout', async () => {
    const client = loadSession(true);
    await client.login(input);
    const entry = await client.api.createManualEntry({
      name: 'Member test',
      quantityToBuy: 1,
    });
    await expect(
      client.api.deleteShoppingEntry(entry.id),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(client.getSessionState().status).toBe('authenticated');
    await client.restoreSession();
    expect(client.getSessionState().user.householdRole).toBe('member');
    client.logout();
    await expect(client.api.generateShoppingList()).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  it.each(['admin', 'owner'])(
    'allows %s to delete eligible entries',
    async (role) => {
      const client = loadSession(true);
      await client.login({
        email: role + '@example.com',
        password: role + '123',
      });
      const entry = await client.api.createManualEntry({
        name: 'Delete test',
        quantityToBuy: 1,
      });
      await expect(
        client.api.deleteShoppingEntry(entry.id),
      ).resolves.toBeUndefined();
    },
  );
});
