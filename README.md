# Before You Buy

Household pantry assistant built with React, NestJS and MongoDB.

## Current status

All six members' contributions are integrated on `member-molham`: existing navigation, dashboard, pantry and shopping UI, plus registration, login, verified JWTs and current household roles. As of 26 October 2026, all pantry, dashboard and shopping pages require sign-in. Each public signup creates an admin with a separate household. Family members have read-only access; admins manage all changes.

The upgrade keeps React/Vite, NestJS 10 and MongoDB. It adopts the B4F authentication patterns without replacing the pantry product or its transaction guarantees. The production auth bridge is connected to the live API; mock mode is explicitly selectable for development.

See the current [household access update](docs/household-access.md) and authoritative [API contract v3](Tasks/apicontract.md). The [tasks 2 integration report](docs/tasks2-integration.md) records the previous shared-demo policy.

## Folders and setup

- `client/`: React, TypeScript and Vite.
- `api/`: NestJS, MongoDB infrastructure and tests.
- `Tasks/`: assignments, contract and fixture.
- `docs/`: requirements, explanations and measured evidence.

Use Node.js 20+ and MongoDB Server with replica-set support. From the repository root:

```powershell
cd api
npm install
npm run db:start
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

The Windows database script finds `mongod` on PATH or the newest installed MongoDB Server version. Pass `-MongoExe` to `scripts/start-local-mongo.ps1` to choose an installation explicitly.

Configure `api/.env`:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27018/before_you_buy?replicaSet=byb-rs
INTERNAL_TOOL_KEY=replace-with-a-local-secret
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
SEED_ON_START=true
```

Replace both secret placeholders locally. Generate a JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste it into ignored `api/.env`; startup rejects a missing, short or placeholder JWT secret. Never put backend secrets in a `VITE_*` variable.

Inside `api/`, run `npm run start:dev`. This first starts the local Windows MongoDB replica set (or reuses it if already running) and waits for it to be ready before starting Nest. In a second terminal, enter `client/`, run `npm install`, then `npm run dev`.

Frontend: http://localhost:5173. API: http://localhost:3000/api. Swagger: http://localhost:3000/docs.

The database script runs a localhost-only replica set on port 27018, with data in ignored `api/.local/mongo-rs`. It does not change the existing MongoDB Windows service on port 27017. Restart the API after changing its environment. Transactions require this replica set; there is no nontransactional fallback.

## Implemented routes

| Resource | Routes |
| --- | --- |
| Categories | GET/POST /categories; PATCH/DELETE /categories/:id |
| Pantry | GET/POST /pantry; GET/PATCH/DELETE /pantry/:id; POST /pantry/:id/use |
| Shopping | GET/POST /shopping-list; POST /shopping-list/generate; POST /shopping-list/:id/purchase; DELETE /shopping-list/:id |
| Dashboard | GET /dashboard |
| Authentication | POST /auth/register; POST /auth/login; GET /auth/me |
| Family accounts | GET/POST /household/members (admin/owner only) |

All paths are relative to /api. Generate, use and purchase return 200; resource creation returns 201; deletion returns empty 204. Manual entries are created at POST /shopping-list, not /shopping-list/manual.

Category mutations require only `x-internal-tool-key`. Keep that key in backend/internal tooling; never include it in React. [Category HTTP examples](docs/categories.http) are provided. Every pantry/shopping mutation requires JWT plus admin/owner membership, including use, generate and purchase. Pantry, shopping and dashboard reads require a valid household account and are filtered by its server-side household ID. The shared category catalog remains public; its mutations remain internal tooling only.

## Accounts and roles

Register at `/register` with a name, email and password (8 or more characters, at most 72 UTF-8 bytes). Registration returns a safe user and asks you to sign in. Public signup creates an `admin` in a new, empty household. In **Family members** (`/family`), an admin enters a name, unused email and password to create a read-only `member` in that same household. Share those sign-in details directly with the family member. This does not sign the admin out or send email. Existing registered emails cannot be moved or added through this form. The server normalizes emails, hashes passwords with bcrypt, and atomically creates the user and membership with persistent numeric IDs.

To explicitly promote an **existing registered account**, run from `api/`:

```powershell
npm run build
npm run auth:set-role -- your-registered-email@example.com owner
```

Allowed roles are `owner`, `admin`, `member`. The command changes only that account's membership and never seeds or creates an account. There are no default live credentials, automatic first-user promotions or public role-edit endpoints. A changed DB role affects the next protected request with the same token; reload to refresh the role displayed by the client.

Login returns `{ accessToken, user }`. JWTs expire after two hours. The browser stores the token in `sessionStorage` under `byb.accessToken`, restores with `/auth/me`, and clears only the matching session on a protected 401. A 403 retains the session; network failures offer retry without silently switching to mocks. Logout clears local state; it does not revoke an already issued JWT. Mutations are never automatically replayed.

DTOs validate bodies and queries, reject extra fields, and retain strict numeric/date semantics. Body arrays are rejected. Names are trimmed and compared case-insensitively. Errors use `{ statusCode, code, message, fieldErrors }`; unexpected internal failures expose no credentials.

## Data and relationships

Categories, pantry items and shopping entries live in separate collections linked through numeric application IDs. This centralizes category names and preserves historical purchase snapshots independently of current stock. No ObjectId relationship, populate or aggregation pipeline is used.

DatabaseModule registers the domain schemas plus users and household memberships, initializes correctness indexes, and exports their models. It binds Mustafa's dependency aliases to the same ClockService, IdsService and WriteService used by the other domains. Domains do not import one another's services. Accounts have unique numeric IDs and normalized emails; memberships have unique numeric IDs and unique `userId` and `(householdId, userId)` indexes. Pantry items and shopping entries carry `householdId`; normalized pantry and Pending shopping names are unique within a household. The same item name can exist in different households.

IdsService uses persistent counters and atomic increments; deleting a record never resets its counter. Existing domain create operations may allocate before a retryable transaction, so failures may leave ID gaps. Generation and registration allocate within the transaction using the same session, rolling back counter changes with failed writes.

## Consistent writes and business behavior

Every category, pantry and shopping mutation, account registration and explicit role update uses WriteService. It starts a transaction and updates a shared household fence before business checks. All participating reads/writes use the same session. This prevents partial stock/history writes and cross-collection check/delete races. A missing fence fails safely. Business success logs are emitted after commit with verified actor IDs. See [write consistency](docs/write-consistency.md).

- Pantry statuses/reasons are computed from stored quantities, minimums and expiry on each read.
- Use cannot exceed stock; deletion is blocked by a Pending shopping entry.
- Generation creates/updates suggestions for LOW STOCK or EXPIRED items and preserves manual/history entries.
- A conflicting Pending name aborts the entire generation.
- Purchase adds normal stock, replaces expired stock only with a supplied valid expiry date, and commits the history snapshot with stock.
- Purchased entries cannot be purchased again or deleted. Snapshots survive subsequent pantry edits/deletion.
- Dashboard totals and urgency lists are calculated from current stored records.

## Seed, dates and mock mode

SEED_ON_START=true seeds 7 categories and 20 items only when application collections are empty and no completed seed marker exists. Inserts, initial counters and the marker commit atomically. Existing data survives restarts and partial seed failures roll back. Demo inventory belongs to reserved household 1; newly registered admins start empty. Startup assigns unscoped legacy pantry/shopping data to household 1 and replaces only the old global name indexes with household-scoped indexes. Existing account roles and household assignments are preserved; legacy members remain read-only until explicitly promoted with the CLI.

Expiry offsets are relative to the household date. The seed gives 5 LOW STOCK, 3 USE SOON, 2 EXPIRED and 12 OK items; statuses overlap. Computed labels are never stored. Shopping/history is optional and not seeded automatically: generate creates current suggestions.

ClockService.today() returns YYYY-MM-DD in Asia/Damascus; now() provides an instant. Date-only expiry fields remain strings/null. Timestamp responses use ISO UTC.

The backend does not import shopping mock data. Frontend `VITE_API_URL=/api` uses Vite's port-3000 proxy. Set `VITE_USE_MOCKS=true` in ignored `client/.env` and restart Vite to use the shared in-memory mock adapter. Development-only mock accounts are `member@example.com` / `member123`, `admin@example.com` / `admin123`, and `owner@example.com` / `owner123`. They do not exist in the live database. Mock registration/data reset on reload; there is no fallback from live errors. See [client usage](client/src/services/API_USAGE.md).

## Verification

Start the replica set, then run from the root:

```powershell
npm --prefix api run build
npm --prefix api test -- --runInBand
npm --prefix api run test:unit
npm --prefix client run build
npm --prefix client run lint
node api/scripts/measure-index.cjs
```

The existing business regressions remain, with additional shopping-log, authentication, permission, household-isolation and session tests. Tests use disposable `byb_test_*` databases on port 27018 and real guards, including distinct member/admin/owner fixtures. The [household access report](docs/household-access.md) records the current 185 passing tests across 12 suites and verification limits. The previous integration report is historical.

`node api/scripts/backup-local.cjs` saves a BSON-preserving snapshot under ignored `api/.local/backups` without changing database records. Keep backups private because they include account data/password hashes.

After building the API, `node api/scripts/verify-auth-restart.cjs` verifies stock, history, accounts, memberships and counters across actual API and MongoDB process restarts. It creates its own isolated replica set on free localhost ports, leaving port 27018 running. Set `MONGO_EXE` if mongod is installed outside the default Windows MongoDB 8.0 path. See [current restart evidence](docs/household-restart-evidence.json). The older `verify-db-restart.cjs` restarts the shared test instance and should only be used when no one else is using it.

## Actual query and index decision

The measurement script imports Mustafa's actual `pantryStoredQuery()`, also used by PantryService.findAll. For category 1 and USE SOON it filters categoryId plus an expiryDate range and sorts by expiryDate then id. Statuses are still calculated afterward and public results are sorted by id.

On the 20-item seed, measured 17 October 2026:

| Stage | Keys examined | Documents examined | Time |
| --- | ---: | ---: | ---: |
| Before candidate | 0 | 20 | 0 ms |
| Candidate { categoryId: 1, expiryDate: 1, id: 1 } | 1 | 1 | 18 ms |
| After decision: candidate removed | 0 | 20 | 0 ms |

One item matched in each run. The candidate reduces examined documents but this tiny sample does not show a useful latency benefit. The decision is to keep correctness indexes only for the current workload and reconsider if it grows. No computed-status index exists. Full plans and the post-decision measurement are in [index-evidence.json](docs/index-evidence.json).

Latest combined frontend/backend status and remaining requirements: [completion review](docs/completion-review.md).

