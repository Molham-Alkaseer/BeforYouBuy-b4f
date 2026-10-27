# Mohammad - shared auth transport, session state, mocks and shopping UI

> Integration status — 25 October 2026: Merged `origin/member-mohamed` at `eee829a`. Integration completed accessToken/householdRole/name wire types, current-user bearer transport, protected-401 invalidation, session race handling, all mock write permissions and shopping session cleanup. See [final integration evidence](../docs/tasks2-integration.md). The original assignment below is preserved as a planning record; the integrated engineering status supersedes its unchecked planning boxes. Individual presentations and teammate sign-off are not claimed.

Prepared: 24 October 2026. Read the [shared upgrade contract](molham.md#4-frozen-upgrade-contract) first. This document describes work to implement next.

## 1. What we had before

- `client/src/api.ts` already performs requests, sets JSON headers, handles empty 204 responses and maps network/API errors to ApiError.
- `services/http-api.ts` implements the real pantry/shopping/dashboard adapter. `services/api-client.ts` selects live or explicit mock mode.
- `features/items/itemApi.ts` already points to the same api object; all pages share state in mock mode.
- `mocks/mock-api.ts` already simulates pantry/shopping business rules and exports `resetMockState()` plus simulation controls.
- ShoppingListPage already supports generation, manual entries, purchase, removal and Purchased history.
- There is no token handling, auth client, session provider, 401/403 policy or mock user/role state.
- `services/API_USAGE.md` incorrectly tells developers to call `resetMockDb()` and uses an old fixed-date example. The root README also understates the implemented mock adapter.

## 2. Goal and B4F connection

B4F's new API issues and verifies JWTs and has current-user/membership concepts. Your job is to connect every frontend feature to one session-aware request layer, while keeping existing business APIs stable.

After your work, Maya and Rami consume one AuthClient/useAuth contract, all writes carry the same token, permission failures behave consistently, shopping works with the new role rules and explicit mock mode supports the same user journeys without a running backend.

## 3. Files you own

- `client/src/types.ts`, `client/src/api.ts`.
- `client/src/services/**`, `client/src/mocks/**`, `client/src/vite-env.d.ts`, client `.env.example` if documentation needs a public setting.
- `client/src/pages/ShoppingListPage.tsx`, `client/src/pages/shopping-list.css`.
- New `client/src/features/session/**`: non-React session-store, AuthProvider, context/useAuth and session helpers.
- Existing `api/test/integration/frontend-client.e2e-spec.ts` and new `api/test/integration/client-session.e2e-spec.ts` for transport verification using the existing Jest/esbuild approach.
- `docs/tasks2-mohammad.md` for your evidence.

Do not edit App/main/routes/Navbar/shared UI, Maya's item/auth forms, backend auth implementation, API package/config or other members' tests. Rami owns client dependency changes; Molham owns shared backend test helpers. Your test files must retain the configured `.e2e-spec.ts` suffix so the current Jest config discovers them.

## 4. Interface delivery and parallel start

Publish these first: SafeUser/HouseholdRole/RegisterInput/LoginInput/LoginResult/AuthClient types, `authApi` export, non-React session-store interface, `AuthProvider`, and named `useAuth` from `features/session/useAuth.ts`.

`useAuth()` returns `{ status, user, login, logout }`; statuses are `checking | anonymous | authenticated`; login resolves only when the new session is ready, logout is synchronous local cleanup. Auth endpoints and exact payloads/errors are frozen in Molham's file. The register response does not sign in automatically.

Start with contract fixtures and mocked fetch responses now. You do not need the backend auth implementation to test bearer headers, 204/error handling, expired sessions or role-dependent shopping controls. Provide an explicit mock member/admin/owner fixture immediately so Rami and Maya can work independently. Use temporary fixtures only in owned mock/test paths; do not replace production API behavior with a silent fallback.

## 5. Step-by-step tasks

### Step 1 - keep one transport and add auth types

- [ ] Preserve all existing ApiClient method signatures and business wire shapes. Keep `itemApi === api` true in live and mock mode.
- [ ] Add AuthClient separately, exporting `authApi` from `services/api-client.ts`; do not force auth methods into ItemsApi.
- [ ] Implement real register/login/me requests under existing `/api` base URL. Keep Vite proxy behavior and normalized slashes.
- [ ] Keep the current ApiError shape, JSON headers, query serialization, network code and empty-204 behavior.
- [ ] Avoid new circular imports: session-store must not import api/client/provider; the request helper may read session-store and publish invalidation, while the provider consumes both.

### Step 2 - centralize token and session lifecycle

- [ ] Store only the access token under `byb.accessToken` in sessionStorage through one non-React module, with an injectable/in-memory storage implementation for Node tests.
- [ ] On reload with a token, set status checking and call `/auth/me`; use its current safe user/role result. Without a token, start anonymous.
- [ ] Add Bearer Authorization centrally to protected requests. Do not attach an old bearer token to register/login, and never add the internal-tool key.
- [ ] Implement `login`: call authApi.login, save the returned token, set safe session state and notify React. Stale session-restoration responses must not overwrite a newer login/logout.
- [ ] Implement logout: clear token/user and notify all consumers once. No invented backend logout or refresh route; existing tokens naturally expire server-side.
- [ ] On a protected-request 401, invalidate only if the token used by that request is still current. A late 401 from a previous account must not log out the new account.
- [ ] Do not globally invalidate on a login 401. A 403 is a permission failure, never a logout. Network/500 failures must not silently switch transports or report an incorrect password.
- [ ] Never automatically replay POST/PATCH/DELETE after login, refresh or retry. Preserve at-most-once UI intent for purchases.

### Step 3 - extend explicit mocks

- [ ] Add deterministic accounts and household memberships for member/admin/owner, plus a separate mock AuthClient; keep all state in the same mock store as pantry/shopping.
- [ ] Mock registration normalizes email, returns a SafeUser and creates a member; do not accept role/ID input. Mock credentials are fake development fixtures only.
- [ ] Mock login/me/session expiration reproduce contract success and 400/401/403/409 outcomes. Mock tokens are simulated development values, not a production JWT verifier.
- [ ] Keep reads public. Enforce session/role policy on every mock mutation before changing mock data; member delete ->403, admin valid delete ->204, business conflicts unchanged.
- [ ] `resetMockState()` resets domain data, mock account/session state and simulation to a documented deterministic baseline. Keep existing simulation controls working.
- [ ] Ensure live mode never sends mock tokens and live API failures never activate mocks automatically. Document a mode change as requiring a clean session.
- [ ] Avoid dates tied to today's wall clock in deterministic mock checks; use the existing fixture clock or computed values relative to that fixture.

### Step 4 - update shopping interactions

- [ ] Anonymous visitors can browse Pending and Purchased entries; generation, add-manual and purchase offer sign-in and issue no write.
- [ ] Signed-in member/admin/owner can generate/add/purchase; only admin/owner sees Remove Pending entry.
- [ ] Keep generate idempotency, manual-name field errors, positive quantities, expiry-required validation, pending counts and history refresh behavior.
- [ ] A protected 401 closes/disables stale mutation state and offers sign-in without blanking public lists. A 403 shows permission feedback and retains the session.
- [ ] Keep duplicate-click guards; logout/role changes cannot leave an enabled stale modal that still submits as the old account.
- [ ] Use safe returnTo navigation for sign-in links; coordinate with Rami's helper. Do not duplicate redirect sanitization.
- [ ] Preserve mobile layout, keyboard modal/form focus, cancel actions and disabled states. Request shared-component changes from Rami.

### Step 5 - test the shared layer and document it

- [ ] Extend the existing real frontend-client backend suite to register/login test users, supply tokens for writes and use admin for destructive actions; retain original business assertions.
- [ ] Add focused session tests using the existing Jest/esbuild technique: bearer injection, omitted auth on login/register, me restoration, 204 handling, ApiError mapping, login 401, protected 401, retained session on 403, network errors, logout and stale-response races.
- [ ] Tests run in Node where sessionStorage is absent; inject fake storage rather than assuming a browser global.
- [ ] Test live and explicit mock flows separately, including shared item/shopping state and role denial before mutation.
- [ ] Use Molham's shared auth fixtures once available; you alone edit your two suites, while Molham owns common test infrastructure.
- [ ] Update API_USAGE.md with real exports including `resetMockState`, session APIs, environment/mode behavior, auth flow and 401 versus 403 handling. Remove incorrect fixed-date instructions.

## 6. Acceptance checks

| Scenario | Expected result |
| --- | --- |
| Login -> pantry edit -> shopping purchase | One account/token used consistently |
| Reload with valid token | checking -> `/auth/me` -> authenticated |
| Reload with expired token | Anonymous with a usable sign-in path |
| Wrong login credentials | Form error; no redirect loop |
| Old request returns 401 after a new login | New session survives |
| Member direct remove request | 403, no data change, still signed in |
| Admin removes eligible Pending entry | 204 parsed without JSON error |
| Purchase double-click or repeated request | No duplicate stock/history success |
| Network failure in live mode | NETWORK_ERROR; no mock fallback |
| Mock mode + member/admin sessions | Same permission outcomes as the API |
| Mock item use then shopping generation/purchase | Shared state updates correctly |

Commands from root:

```powershell
npm --prefix client run build
npm --prefix client run lint
npm --prefix api test -- --runInBand frontend-client client-session
```

The backend test command needs the local replica set and Molham's auth foundation. Early transport tests can use mocked fetch without MongoDB. There is no existing frontend `npm test` command; do not invent a passing result for one.

## 7. Expected result and handoff

Deliver branch `codex/tasks2-mohammad`, publishing the small interface PR early and the completed transport/shopping PR afterward. Include safe sample requests, screenshots for anonymous/member/admin shopping, executed tests, mock/live instructions and known gaps in your evidence file.

You are done when Maya/Rami use your real provider/API, all existing adapters still share one transport, the real backend and explicit mocks enforce the same contract and no secret or fallback auth implementation is shipped. Explain one successful purchase and the difference between session expiry and insufficient permission in English.
