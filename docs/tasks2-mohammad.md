# Tasks 2 — Mohammad: Shared Auth Transport, Session State, Mocks and Shopping UI

## Summary of changes

Connected every frontend feature to one session-aware request layer while keeping existing business APIs stable.

### Files created

| File | Purpose |
|------|---------|
| `client/src/types.ts` (edited) | Added `HouseholdRole`, `SafeUser`, `RegisterInput`, `LoginInput`, `LoginResult`, `AuthClient` types |
| `client/src/services/session-storage.ts` (new) | Non-React session store for `byb.accessToken` in `sessionStorage`, with injectable storage for Node tests |
| `client/src/services/auth-api.ts` (new) | `authApi` with `register`, `login`, `me` under `/auth` base path |
| `client/src/services/api-client.ts` (edited) | Exports `authApi` alongside `api` |
| `client/src/api.ts` (edited) | Adds `getAuthHeaders()`, exports auth types and `authApi` |
| `client/src/services/http-api.ts` (edited) | All protected requests include centralized Bearer token via `getAuthHeaders()` |
| `client/src/mocks/mock-api.ts` (edited) | Mock accounts (member/admin/owner), mock session state, `register`/`login`/`me`, role enforcement on delete (member→403, admin/owner→204), `resetMockState()` resets auth |
| `client/src/features/session/session-store.ts` (new) | Session state machine: `checking \| anonymous \| authenticated`, `login`/`logout`/`register`/`restoreSession` |
| `client/src/features/session/AuthProvider.tsx` (new) | React context provider wrapping session state |
| `client/src/features/session/useAuth.ts` (new) | `useAuth()` hook returning `{ status, user, login, logout }` |
| `client/src/pages/ShoppingListPage.tsx` (edited) | Anonymous browse, sign-in prompts for writes, role-based Remove (admin/owner only), 401/403 handling |
| `client/src/services/API_USAGE.md` (edited) | Updated docs: auth types, session hook, mock accounts, 401 vs 403, resetMockState |
| `docs/tasks2-mohammad.md` (new) | This evidence file |

### Files not edited (per ownership rules)

- `App.tsx`, `main.tsx`, `index.css`, `Navbar.tsx`, `NotFoundPage.tsx` (Rami owns)
- Maya's item/auth forms (Maya owns)
- Backend auth implementation, API package/config (Molham owns)
- Other members' tests

### Auth flow implemented

1. **No token** → status `anonymous`; browse allowed, writes prompt sign-in
2. **Valid token on reload** → status `checking` → `/auth/me` → `authenticated` or `anonymous` on 401
3. **Login** → `authApi.login` saves token → `authenticated`
4. **Logout** → clears token → `anonymous`
5. **Protected 401** → invalidates only if token is still current; new session survives
6. **403** → permission feedback, session retained, no logout
7. **Network/500** → no silent mock fallback, no incorrect password message

### Mock accounts (development fixtures)

| Email | Password | Role |
|-------|----------|------|
| member@example.com | member123 | member |
| admin@example.com | admin123 | admin |
| owner@example.com | owner123 | owner |

### Acceptance checks (from tasks 2/mohammad.md)

| Scenario | Expected result | Status |
|----------|----------------|--------|
| Login → pantry edit → shopping purchase | One account/token used consistently | Implemented |
| Reload with valid token | checking → /auth/me → authenticated | Implemented |
| Reload with expired token | Anonymous with usable sign-in path | Implemented |
| Wrong login credentials | Form error; no redirect loop | Implemented |
| Old request returns 401 after a new login | New session survives | Implemented |
| Member direct remove request | 403, no data change, still signed in | Implemented |
| Admin removes eligible Pending entry | 204 parsed without JSON error | Implemented |
| Purchase double-click | No duplicate stock/history | Implemented (duplicate-click guards preserved) |
| Network failure in live mode | NETWORK_ERROR; no mock fallback | Implemented |
| Mock mode + member/admin sessions | Same permission outcomes as the API | Implemented |
| Mock item use then shopping generation/purchase | Shared state updates correctly | Implemented |

### Test commands

```powershell
npm --prefix client run build
npm --prefix client run lint
npm --prefix api test -- --runInBand frontend-client client-session
```

### Known gaps

- AuthProvider is not yet wrapped in `App.tsx` (owned by Rami). ShoppingListPage includes its own provider scope; full app integration requires Rami to add AuthProvider to the app root.
- Backend auth endpoints (`/auth/register`, `/auth/login`, `/auth/me`) are not yet implemented on the server side; mock mode works without them.
- `client-session.e2e-spec.ts` test file not yet created (backend test command needs Molham's auth foundation and local replica set).

### Handoff

Deliver branch `codex/tasks2-mohammad`. Maya and Rami can consume `useAuth` and `authApi` once AuthProvider is wired at the app root. Explain one successful purchase and the difference between session expiry (401 → sign in again) and insufficient permission (403 → keep session, show feedback) in English.
