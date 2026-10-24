# Before You Buy

Household pantry assistant built with React, NestJS and MongoDB.

## Current status

The three backend contributions are integrated: Molham's foundation/categories, Mustafa's pantry/dashboard, and Allaith's shopping flow with MongoDB persistence and transaction fixes. Categories, pantry, shopping and dashboard endpoints work together against real stored data.

The frontend contributions have not been merged or verified end to end in this backend integration. The local client still builds and passes lint, but its pages remain the starter version.

See [integration results](docs/integration-results.md), [Molham's guide](docs/molham-super.md), and the authoritative [API contract](Tasks/apicontract.md).

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

The Windows database script defaults to MongoDB 8.0's installation path. Pass `-MongoExe` directly to `scripts/start-local-mongo.ps1` for another installation.

Configure `api/.env`:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27018/before_you_buy?replicaSet=byb-rs
INTERNAL_TOOL_KEY=replace-with-a-local-secret
SEED_ON_START=true
```

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

All paths are relative to /api. Generate, use and purchase return 200; resource creation returns 201; deletion returns empty 204. Manual entries are created at POST /shopping-list, not /shopping-list/manual.

Only category mutations require `x-internal-tool-key`. Keep that key in backend/internal tooling; never include it in React. [Category HTTP examples](docs/categories.http) are provided.

DTOs validate bodies and queries, reject extra fields, and retain strict numeric/date semantics. Body arrays are rejected. Names are trimmed and compared case-insensitively. Errors use `{ statusCode, code, message, fieldErrors }`; unexpected internal failures expose no credentials.

## Data and relationships

Categories, pantry items and shopping entries live in separate collections linked through numeric application IDs. This centralizes category names and preserves historical purchase snapshots independently of current stock. No ObjectId relationship, populate or aggregation pipeline is used.

DatabaseModule registers all three owner schemas and exports their models. It binds Mustafa's dependency aliases to the same ClockService, IdsService and WriteService used by the other domains. Domains do not import one another's services.

IdsService uses persistent counters and atomic increments; deleting a record never resets its counter. Normal create operations allocate before a retryable transaction, so failures may leave ID gaps. Generation allocates within the transaction using the same session, rolling back counter changes along with failed generation.

## Consistent writes and business behavior

Every category, pantry and shopping mutation uses WriteService. It starts a transaction and updates a shared household fence before business checks. All participating reads/writes use the same session. This prevents partial stock/history writes and cross-collection check/delete races. A missing fence fails safely. See [write consistency](docs/write-consistency.md).

- Pantry statuses/reasons are computed from stored quantities, minimums and expiry on each read.
- Use cannot exceed stock; deletion is blocked by a Pending shopping entry.
- Generation creates/updates suggestions for LOW STOCK or EXPIRED items and preserves manual/history entries.
- A conflicting Pending name aborts the entire generation.
- Purchase adds normal stock, replaces expired stock only with a supplied valid expiry date, and commits the history snapshot with stock.
- Purchased entries cannot be purchased again or deleted. Snapshots survive subsequent pantry edits/deletion.
- Dashboard totals and urgency lists are calculated from current stored records.

## Seed, dates and mock mode

SEED_ON_START=true seeds 7 categories and 20 items only when application collections are empty and no completed seed marker exists. Inserts, initial counters and the marker commit atomically. Existing data survives restarts and partial seed failures roll back.

Expiry offsets are relative to the household date. The seed gives 5 LOW STOCK, 3 USE SOON, 2 EXPIRED and 12 OK items; statuses overlap. Computed labels are never stored. Shopping/history is optional and not seeded automatically: generate creates current suggestions.

ClockService.today() returns YYYY-MM-DD in Asia/Damascus; now() provides an instant. Date-only expiry fields remain strings/null. Timestamp responses use ISO UTC.

The backend no longer imports shopping mock data. Frontend `VITE_API_URL=/api` uses Vite's port-3000 proxy. `VITE_USE_MOCKS` remains a contract setting for Mohammad's future adapter; setting it alone does not implement mock mode in this checkout.

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

The suite has 100 passing tests across 7 suites, including real MongoDB HTTP tests for all eight PDF section 17 backend demo behaviors. These are API/Swagger-definition/log checks, not a completed visual frontend demonstration. Tests use disposable byb_test_* databases on port 27018.

`node api/scripts/verify-db-restart.cjs` verifies a real database process restart. It checks the exact task-owned data path before restarting; run when nobody else is using that local instance. Existing [restart evidence](docs/restart-evidence.json) is retained.

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

