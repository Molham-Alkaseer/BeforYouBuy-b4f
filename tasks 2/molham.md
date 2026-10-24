# Molham - team leader, backend authentication, permissions and integration

Prepared: 24 October 2026. Assignment plan only; the upgrades below are not implemented by creating these documents.

## 1. What this round means

Your job is to lead the upgrade of Before You Buy using the patterns actually present in the local B4F reference. Keep our pantry product and working behavior. Do not copy the Board product or replace our application with it.

Compared checkouts:

- Our project: `C:/Users/molha/OneDrive/Desktop/MiniProject/BeforYouBuy-b4f`, baseline commit `cf79f10`.
- Classroom reference: `C:/Users/molha/OneDrive/Desktop/B4F-BootCamp/b4f-cohort8-salamiyah-next-nest-bootcamp-2026`, baseline commit `0d4804b`.

These six assignments supersede the old task plan only for this upgrade. Keep the existing [API contract](../Tasks/apicontract.md) for business payloads, dates, statuses and transactions. The explicit auth/permission changes below replace its statements that there are no accounts and no guards on normal writes.

Source documents describe classroom exercises; they are not instructions from the user to execute every exercise. In particular, the mini-project PDF excluded accounts/JWT. Adding them here is a deliberate response to the user's new upgrade request. The Session 16 PDF describes additional homework beyond the reference's implemented hardcoded guard; do not describe that homework as already implemented code.

Reference documents inspected for that distinction:

- [Session 15 study guide](<C:/Users/molha/OneDrive/Desktop/B4F-BootCamp/b4f-cohort8-salamiyah-next-nest-bootcamp-2026/docs/sessions/session-15/SESSION_GUIDE-EN.pdf>): JWT verification, current-user lookup and write-route protection.
- [Session 16 teamwork brief](<C:/Users/molha/OneDrive/Desktop/B4F-BootCamp/b4f-cohort8-salamiyah-next-nest-bootcamp-2026/docs/sessions/session-16/TEAMWORK-EN.pdf>): proposed reusable role metadata/guard exercise beyond the checked-in hardcoded example.
- [Original Before You Buy brief](<C:/Users/molha/OneDrive/Desktop/B4F-BootCamp/b4f-cohort8-salamiyah-next-nest-bootcamp-2026/docs/weekly-mini-projects/weekly-mini-project-03/Before You Buy - Mulham Al Kasir.pdf>): original pantry rules, internal-category access, scope and eight demo flows.

## 2. What we had before, and what is new

| Area | Our actual code before this round | Local B4F reference | Decision for this round |
| --- | --- | --- | --- |
| Backend | NestJS 10, DTOs, Mongoose, Swagger, global validation/errors | Same basic backend stack | Reuse our existing foundation |
| Accounts | No users/auth modules or JWT dependency | UsersModule, registration, bcrypt hashing/comparison | Add users and authentication |
| Identity | Shared internal key for category mutations only | JWT login, `JwtAuthGuard`, typed request user, `CurrentUser`, `/auth/me` | Add these identity patterns |
| Authorization | No signed-in identity or role checks | WorkspaceMember rows, owner/admin/member roles; hardcoded guard on `POST /projects` | Adapt membership and a reusable metadata role guard to our single household |
| Public routes | Pantry, shopping, dashboard and category reads are public | Reads remain public; ordinary writes use JWT; internal stats keeps its key | Keep public reads and our internal category tooling; protect ordinary writes |
| Persistence | Atomic persistent counters, transaction fence, transactional seed and purchase history | Several IDs use highest-ID-plus-one; workspace + membership creation is separate writes | Preserve our stronger counters/transactions; do not copy those weaker write patterns |
| Frontend | Working React/Vite pages, shared live/mock adapter | No frontend source in this checkout; README describes a future Next.js frontend | Add auth to our current React client; no Next.js migration |
| Database | MongoDB/Mongoose | Actual API also uses MongoDB/Mongoose; README mentions future PostgreSQL | Keep MongoDB; no PostgreSQL migration |
| Dependencies | Our `api/package.json` mostly matches reference API versions | API adds `@nestjs/jwt` and `bcrypt`; reference root manifest has different major versions | Use compatible API dependencies, not the reference root manifest |

Evidence to read: our `api/src/main.ts`, `api/src/database/{ids.service,write.service,seed}.ts`, `client/src/services/api-client.ts`; reference `api/src/auth/**`, `api/src/users/**`, `api/src/workspace-members/**`, `api/src/projects/guards/admin-or-owner.guard.ts`, and `api/src/projects/projects.controller.ts`.

Confirmed unfinished details in our source:

- Maya's `ItemDetails.tsx` and `ItemHistory.tsx` still use temporary markup although shared components exist.
- Allith's purchase log includes final stock, but not starting stock or an explicit expired-stock replacement flag. Several shopping business rejections have no business warning.
- Our root README and test README contain old scaffold/unimplemented statements; the actual client and backend are integrated. Mohammad's API usage guide also names a nonexistent `resetMockDb()` instead of `resetMockState()`.
- Our global error filter lacks dedicated 401/role-forbidden defaults. `PantryHttpFilter` can turn plain auth exceptions into `HTTP_ERROR`; cover both filters.

Review checks executed on 24 October: API build PASS, client build PASS, client ESLint PASS, foundation tests 12/12 PASS, full backend/adapter regression 100/100 PASS across 7 suites. Exact commands and the environment-related reruns are recorded in section 7. No browser walkthrough or database process-restart experiment was performed in this review.

## 3. Team ownership

Use these exact names for this round. Mostafa corresponds to the existing `mustafa.md` owner; Allith corresponds to the existing `allaith.md` owner.

| Member | Responsibility | Assignment |
| --- | --- | --- |
| Rami | Add auth navigation, route protection and session handling to the existing dashboard/pantry UI; preserve existing shared components | [rami.md](rami.md) |
| Maya | Login/register screens, pantry add/edit/detail/use/delete/history UI | [maya.md](maya.md) |
| Mohammad | Shared frontend types, session state, live/mock auth transport, shopping UI, adapter tests | [mohammad.md](mohammad.md) |
| Mostafa | Pantry write guards, role-protected deletion, dashboard/pantry regression and error filtering | [mostafa.md](mostafa.md) |
| Allith | Shopping write guards, role-protected deletion, transaction-safe business logs and regression | [allith.md](allith.md) |
| Molham | Auth/users/membership foundation, shared role guard, infrastructure, categories, cross-feature tests and final integration | This file |

One person owns each shared file. Only Molham edits API package/lock/config files, `api/src/app.module.ts`, `api/src/main.ts`, shared auth/guard/error infrastructure, database infrastructure, root README and `Tasks/apicontract.md`. Rami owns client package/lock/config files. Mohammad owns frontend types, transport, mocks and session provider. Feature owners edit their own controllers/modules. Request another owner's change in the PR handoff instead of silently editing their files.

Existing navigation, dashboard and pantry screens are completed baseline features. Rami's assignment covers the new authentication interactions and regression checks on those screens. File ownership is not a request to rebuild existing features.

## 4. Frozen upgrade contract

### Scope and membership

This is a single shared household demo. Existing inventory remains household-wide. There is no household selector, tenant migration, per-user pantry, invitation system or Board workspace/project/issue feature.

Implement `HouseholdMember` with numeric `id`, server-fixed `householdId: 1`, numeric `userId`, `role: 'owner' | 'admin' | 'member'`, and `joinedAt`. Add a unique `(householdId, userId)` index and unique application `id`. Registration creates a user plus a `member` membership atomically. Public registration never accepts a role, membership, ID or household ID. Every registered account intentionally joins the same demo household; this is not a multi-tenant product.

Create owner/admin fixtures through an explicit backend-only development/test command, with supplied local credentials and an existing registered email. No committed real password, automatic first-user promotion, browser role editor or public promotion endpoint. Role checks read current membership data, not a role supplied in a body or JWT.

### Wire types and auth endpoints

```ts
type HouseholdRole = 'owner' | 'admin' | 'member';
interface SafeUser {
  id: number;
  name: string;
  email: string;
  createdAt: string; // ISO UTC
  householdRole: HouseholdRole;
}
interface RegisterInput { name: string; email: string; password: string }
interface LoginInput { email: string; password: string }
interface LoginResult { accessToken: string; user: SafeUser }
interface AuthClient {
  register(input: RegisterInput): Promise<SafeUser>;
  login(input: LoginInput): Promise<LoginResult>;
  me(): Promise<SafeUser>;
}
```

- `POST /api/auth/register`: public, 201, returns SafeUser; does not log the user in.
- `POST /api/auth/login`: public, 200, returns LoginResult.
- `GET /api/auth/me`: bearer JWT, 200, fetches current account and membership; deleted account -> 401, absent membership -> 403.
- JWT payload: `{ sub: number, email: string }`, plus standard issued/expiry claims. Sign with backend-only `JWT_SECRET`, two-hour lifetime as in the reference. Verify signature/expiry and validate claim types. Never use decode as authentication.
- Protected writes also reject a token for a deleted user. Shared JwtAuthGuard attaches a verified `RequestUser` with numeric `sub` and current account email; HouseholdRolesGuard reads membership for household 1.
- Trim name, require nonblank; trim/lowercase email before lookup/storage; password is a string, at least 8 characters, at most 72 UTF-8 bytes for bcrypt, never trimmed. Document this limit in DTOs/UI. Unknown fields, arrays and non-object bodies fail 400. Email uniqueness is enforced in MongoDB and duplicate-key races map to 409.
- Never expose password/passwordHash, MongoDB `_id`, `__v`, JWT secret or internal-tool key.
- Errors retain `{ statusCode, code, message: string, fieldErrors }`. Codes: 400 `VALIDATION_ERROR`; 409 `EMAIL_ALREADY_EXISTS` with email field error; 401 `INVALID_CREDENTIALS` for all wrong-login combinations; 401 `UNAUTHENTICATED` for missing/bad/expired/deleted-user tokens; 403 `FORBIDDEN` for missing membership or insufficient role; category-tool failures keep `INTERNAL_TOOL_FORBIDDEN`.

### Exact endpoint permission policy

| Endpoints | Policy | Owner |
| --- | --- | --- |
| GET categories, pantry list/detail, shopping list/history, dashboard | Public, existing responses unchanged | Existing feature owners |
| POST/PATCH pantry, POST pantry/:id/use | JWT then household roles owner/admin/member | Mostafa |
| DELETE pantry/:id | JWT then household roles owner/admin | Mostafa |
| POST shopping-list, POST shopping-list/generate, POST shopping-list/:id/purchase | JWT then household roles owner/admin/member | Allith |
| DELETE shopping-list/:id | JWT then household roles owner/admin | Allith |
| POST/PATCH/DELETE categories | Existing internal key only; preserve internal-tool caller flow | Molham |
| Register/login; Swagger UI | Public | Molham |
| GET auth/me | JWT plus current account/membership lookup | Molham |

The extra role restriction on destructive pantry/shopping actions is our chosen adaptation of B4F's membership pattern. It is not a claim that B4F contains these pantry routes. Successful HTTP codes, business rules and payloads remain unchanged. A permitted admin still cannot bypass a Pending-entry deletion block or delete Purchased history.

### Shared import and service agreement

Molham publishes these real exports in the first foundation PR:

- `api/src/auth/auth.module.ts`: `AuthModule`, exporting JwtAuthGuard and HouseholdRolesGuard; its imported providers must resolve in standalone feature-module tests.
- `api/src/auth/guards/jwt-auth.guard.ts`: `JwtAuthGuard`.
- `api/src/auth/guards/household-roles.guard.ts`: `HouseholdRolesGuard`.
- `api/src/auth/household-roles.decorator.ts`: `HouseholdRoles(...roles: HouseholdRole[])`, metadata read with Reflector handler-over-controller precedence.
- `api/src/auth/current-user.decorator.ts`: `CurrentUser`.
- `api/src/auth/request-user.interface.ts`: `RequestUser { sub: number; email: string }`.
- `api/src/household-members/**`: membership module/service/schema. AuthModule imports it; pantry/shopping must not import one another's services.

Use method-level `@UseGuards(JwtAuthGuard, HouseholdRolesGuard)` and `@HouseholdRoles(...)` on normal writes, and method-level Swagger bearer docs. Preserve existing controller body guards and validation. Do not globally guard public routes. Without required role metadata, the role guard denies; it must never silently grant access.

Authenticated controllers pass `currentUser.sub` as a required final `actorId` argument to their mutation service methods. Mostafa: `create(dto, actorId)`, `update(id, dto, actorId)`, `use(id, quantity, actorId)`, `remove(id, actorId)`. Allith: `addManualEntry(dto, actorId)`, `generateShoppingList(actorId)`, `purchaseEntry(id, dto, actorId)`, `deleteEntry(id, actorId)`. Read signatures stay unchanged. The actor comes from the verified request, never an accepted body field. This actor is for business logging, not a new response field.

Mohammad publishes `authApi: AuthClient` from `client/src/services/api-client.ts`; the existing `api: ApiClient` remains the pantry/shopping transport and `itemApi === api` remains true. Named `useAuth` export lives in `client/src/features/session/useAuth.ts`. It returns `{ status, user, login, logout }`, with status `checking | anonymous | authenticated`, `user: SafeUser | null`, `login(input): Promise<void>`, `logout(): void`. `AuthProvider` lives alongside it and owns session restoration.

The token is stored under `byb.accessToken` in sessionStorage through one non-React session-store module; a reload calls `/auth/me`. Logout clears browser auth state only; the issued bearer token remains valid until expiry. No refresh-token or server-logout endpoint in this round. On protected-request 401, clear only the session that issued that request, never a newer login. Login 401 is a form error. 403 is a permission error and must not log the user out. Do not retry writes automatically.

Routes: existing public browse routes stay public; add `/login` and `/register`. Only `/pantry/new` and `/pantry/:id/edit` require a signed-in session. Rami owns route assembly and `components/RequireAuth.tsx`, plus `features/navigation/returnTo.ts` exporting `sanitizeReturnTo(value): string`. Maya owns default-export auth pages. Use `/login?returnTo=<encoded local path>`; reject external/protocol-relative/backslash URLs and auth-page loops; fallback `/pantry`. Ordinary members may edit/use/purchase; only owner/admin see delete actions. Category management remains outside the normal UI.

## 5. Step-by-step team leader work

### Step 1 - establish the baseline and publish the contract

- [ ] Save the common starting commit, the actual test output, and a safe local database backup before implementation. Leave teammates' work untouched.
- [ ] Review this contract with all six members; record any agreed change in this file before implementation diverges.
- [ ] Update `Tasks/apicontract.md` to a clearly labeled v2 with this additive auth contract and the permission table; retain existing business schemas/rules.
- [ ] Assign branches `codex/tasks2-molham`, `codex/tasks2-rami`, `codex/tasks2-maya`, `codex/tasks2-mohammad`, `codex/tasks2-mostafa`, `codex/tasks2-allith` from that common baseline.
- [ ] Each member first reads their file and this section 4. No package manifest copying or unrelated redesign.

### Step 2 - publish a small working auth foundation early

- [ ] Add API-compatible `@nestjs/jwt` and `bcrypt` dependencies, using reference API versions as the compatibility starting point; add bcrypt typings if needed. You alone own API lockfile updates.
- [ ] Create UsersModule/User schema/service with unique numeric ID and normalized-email indexes, safe response mapping and passwordHash excluded from public responses.
- [ ] Extend IdsService's collection type for `users` and `household_members`; reuse atomic persistent counters. Keep the existing pantry counter interface compatible.
- [ ] Register new schemas and initialize correctness indexes. Avoid circular dependencies: UsersModule and HouseholdMembersModule can use DatabaseModule; DatabaseModule must not import AuthModule.
- [ ] Implement register/login/me, current-user decorator, request augmentation, JWT guard, metadata role decorator/guard and explicit AuthModule exports.
- [ ] Use the same transaction for user + membership creation. If membership creation fails, no orphan account remains. Do not hash passwords inside a retried transaction callback.
- [ ] Add an explicit backend-only role fixture command that never runs automatically at startup. Confirm changing a DB role affects the next protected request with the same token.
- [ ] Add JWT_SECRET to `api/.env.example` using a placeholder; validate startup configuration. Do not put it in client environment files.
- [ ] Preserve the global validation/error shape, add auth-specific codes and safe 401/403 mapping, configure Swagger bearer authentication, keep `/api` and `/docs` paths.
- [ ] Make InternalToolGuard emit an explicit structured `INTERNAL_TOOL_FORBIDDEN` error. A generic 403 default cannot represent both category-tool failures and ordinary role denial; preserve both distinct codes in tests.
- [ ] Publish real working foundation exports and an auth smoke test immediately. Others can integrate this commit while your later leadership work continues.

### Step 3 - make independent work practical

- [ ] Mohammad publishes types/session APIs and Rami publishes route/shared-component interfaces early, each in a small PR.
- [ ] Before those commits exist, owners use fixtures or test-only doubles inside their owned feature/test folders. No duplicate shared auth module or fake auth in production.
- [ ] Backend owners can implement service logging and test behavior immediately; guard wiring and full-module builds use your foundation once available. Frontend owners can build their pages with isolated wrappers and contract fixtures.
- [ ] Keep missing-foundation integration work explicit in PR checklists. Independent implementation does not mean the final app can skip integration.

### Step 4 - own cross-feature test integration

You own existing `api/test/integration/{backend-flows,categories,bootstrap,database,seed,foundation}.e2e-spec.ts`, shared `api/test/support/auth-fixtures.ts`, new `auth.e2e-spec.ts` and `permissions.e2e-spec.ts`. Mohammad alone owns existing `frontend-client.e2e-spec.ts` and his new session adapter suite; feature owners add their separately named suites.

- [ ] Add helpers that register/login real test accounts, promote only within disposable test databases, and return member/admin/owner tokens. Never override real guards in final HTTP acceptance tests.
- [ ] Update old authenticated business-flow tests to send the appropriate token; keep explicit anonymous-read and rejected-write tests. Category internal-key tests must stay independent of JWT.
- [ ] Supply JWT_SECRET in all AppModule test setups, restore environment values afterward, and include users/memberships/counters in test isolation. Do not clear an auth account mid-suite while retaining its token.
- [ ] Preserve the 100 existing regression cases, adapting setup and actor arguments rather than deleting assertions. Add real tests for duplicate-email registration races, atomic registration rollback, counter continuity, safe responses, bad passwords, forged/expired tokens and changed/deleted accounts.
- [ ] Prove all write routes enforce the table with real users; owner/admin are distinct fixtures even where both are allowed. Inspect Swagger operation security so public reads are not accidentally documented as JWT-only.

### Step 5 - integrate and verify the real product

- [ ] Merge foundation, transport and route interfaces first; then each member's feature work. Resolve shared-file conflicts according to ownership and rerun affected checks.
- [ ] Keep category guards, seed markers, existing data, transaction fence, dates, ID semantics and Purchased snapshots intact. Existing data does not need to gain user ownership fields.
- [ ] Verify register -> login -> add -> use -> generate -> purchase -> dashboard/history -> logout with the real API. Verify member delete denial and admin allowed deletion, including business-rule rejection afterward.
- [ ] Run all eight original demo flows, adding login before protected writes. The internal-category demonstration remains key-only.
- [ ] Ask each feature owner to prove loading, empty, error, permission, mobile and keyboard states in their own part. Record evidence rather than assuming CSS proves accessibility.
- [ ] Update root README and `api/test/README.md` with actual status, environment/setup, account/role fixture workflow, permissions, and preserved relationship/index decisions. Mohammad updates his API guide.
- [ ] Write `docs/tasks2-integration.md` with final commit, exact commands/results, tested browser paths, known gaps and teammate evidence links. Do not reuse old PASS counts as proof of the new build.
- [ ] Recheck restart persistence on an isolated demo database. Schedule the existing process-restart script when nobody else is using the local instance; do not interrupt teammates' database sessions.

## 6. Final gate and expected result

Run from the repository root after the local replica set is ready:

```powershell
npm --prefix api run db:start
npm --prefix api run build
npm --prefix api test -- --runInBand
npm --prefix client run build
npm --prefix client run lint
```

Expected delivery: a working upgrade with real users, verified JWTs, current household-role checks, authenticated writes, public browsing, unchanged category-tool access and intact pantry/shopping behavior. Every member has a focused contribution and can explain it in English. Present foundation first, then a member/admin comparison, then the original product flows.

Your own PR must include the contract and ownership agreement, auth implementation and tests, database compatibility explanation, integration report, final checks, remaining risks and presentation order. The six assignment files themselves are planning deliverables, not evidence that implementation is finished.

## 7. Review-run verification record

The following checks ran against the unchanged application baseline while preparing these six task files:

| Check | Actual review result |
| --- | --- |
| `npm --prefix api run build` | PASS |
| `npm --prefix client run build` | PASS after rerun outside the sandbox |
| `npm --prefix client run lint` | PASS |
| `npm --prefix api run test:unit` | PASS, 12 tests |
| `npm --prefix api run db:start` | Local replica set ready on 127.0.0.1:27018 |
| `npm --prefix api test -- --runInBand` | PASS, 100 tests in 7 suites after rerun outside the sandbox |

The sandbox initially prevented esbuild from reading a parent directory. That blocked the client build and six frontend-adapter regression cases; the other 94 cases passed. The same checks passed outside the sandbox without application code changes. Do not treat the temporary access failures as a discovered application defect.

The regression suites used their existing disposable `byb_test_*` databases. The review did not run the process-restart or index-measurement scripts, a new visual walkthrough, deployment or implementation of this auth plan. Git-tracked changes from this request are limited to the six Markdown files in `tasks 2/`.
