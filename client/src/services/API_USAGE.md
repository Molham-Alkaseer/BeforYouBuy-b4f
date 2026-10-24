# API Client Usage & Mock Tests

## 1. Teammate API Usage Example

You can import the shared `api` client anywhere in the project. It automatically switches to mock data if `VITE_USE_MOCKS=true` is in your `.env`.

```typescript
import { api } from "../services/api-client";

async function demoPantryUsage() {
  try {
    const pantry = await api.listPantry({ status: "LOW STOCK" });
    console.log(pantry.items);

    // Example mutation
    const updated = await api.usePantryItem(1, { quantity: 1 });
  } catch (error: any) {
    if (error.code === "NETWORK_ERROR") {
      console.error("Offline:", error.message);
    } else if (error.fieldErrors?.quantity) {
      console.error(
        "Validation failed for quantity:",
        error.fieldErrors.quantity[0],
      );
    } else {
      console.error("API Error:", error.message);
    }
  }
}
```

## 2. Auth Client Usage

The `authApi` export provides register, login, and me endpoints. It shares the same transport as `api`.

```typescript
import { authApi } from "../services/api-client";

// Register (does not sign in automatically)
const user = await authApi.register({ email: "a@b.com", password: "secret123" });

// Login (returns token + user, saves session)
const { token, user } = await authApi.login({ email: "a@b.com", password: "secret123" });

// Get current user (requires valid session)
const currentUser = await authApi.me();
```

## 3. Session / useAuth Hook

Use `useAuth` inside components wrapped by `AuthProvider`:

```typescript
import { useAuth } from "../features/session/useAuth";

function MyComponent() {
  const { status, user, login, logout } = useAuth();

  // status: "checking" | "anonymous" | "authenticated"
  if (status === "checking") return <div>Loading session...</div>;
  if (status === "anonymous") return <button onClick={() => login({ email, password })}>Sign in</button>;

  return <div>Welcome, {user.name} ({user.role})</div>;
}
```

`useAuth()` returns `{ status, user, login, logout }`:
- `status` — `"checking" | "anonymous" | "authenticated"`
- `user` — `SafeUser | null` (id, email, name, role)
- `login(input)` — calls `/auth/login`, saves token, sets authenticated status
- `logout()` — clears token and session, sets anonymous status

## 4. Environment / Mode Behavior

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | Base URL for all API requests |
| `VITE_USE_MOCKS` | `false` | When `true`, uses mock adapter instead of live backend |

- Mock mode is **explicit only** — live API failures never silently fall back to mocks.
- Switching modes requires a clean session (sign out first).
- Live mode never sends mock tokens.

## 5. Auth / Session Behavior

- Token is stored under `byb.accessToken` in `sessionStorage`.
- On reload with a token: status is `"checking"`, then `/auth/me` is called.
  - Success → `"authenticated"` with user.
  - 401/expired → `"anonymous"` with a usable sign-in path.
- Without a token: starts `"anonymous"`.
- Bearer `Authorization` header is added centrally to all protected requests.
- Register and login do **not** send a bearer token.
- The internal-tool key is never sent from the frontend.

## 6. 401 vs 403 Handling

| Status | Meaning | Behavior |
|--------|---------|----------|
| 401 | Unauthenticated / session expired | Invalidate only if the token used is still current; offer sign-in; keep public lists visible |
| 403 | Insufficient permission | Show permission feedback; retain session; no logout |

- Network / 500 failures never silently switch transports or report an incorrect password.
- POST / PATCH / DELETE are never automatically replayed after login or retry (at-most-once intent).

## 7. Mock Mode

Mock accounts (development fixtures only):

| Email | Password | Role |
|-------|----------|------|
| member@example.com | member123 | member |
| admin@example.com | admin123 | admin |
| owner@example.com | owner123 | owner |

- Registration normalizes email, creates a member account; role/ID input is not accepted.
- Mock login/me/session expiration reproduce contract success and 400/401/403/409 outcomes.
- Mock tokens are simulated development values, not a production JWT verifier.
- Reads are public. Mutations enforce session/role policy:
  - Member delete → 403
  - Admin/owner valid delete → 204
- `resetMockState()` resets domain data, mock account/session state, and simulation to a documented deterministic baseline.

To reset during tests:

```typescript
import { resetMockState } from "../services/api-client";

resetMockState();
```
