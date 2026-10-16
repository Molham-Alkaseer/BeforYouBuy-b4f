# Before You Buy

Household pantry assistant built with React, NestJS and MongoDB.

## Current status

Molham's category endpoints, shared validation/errors, Damascus clock, numeric IDs, transaction helper and atomic demo seed are implemented. Pantry, shopping and dashboard code in this checkout remains a scaffold. The frontend pages are also placeholders. A successful build does not mean the entire application is finished.

See [Molham's implementation guide](docs/molham-super.md), [integration results](docs/integration-results.md), and the authoritative [API contract v1](Tasks/apicontract.md).

## Folders

- `client/`: React, TypeScript and Vite.
- `api/`: NestJS API, shared infrastructure and tests.
- `Tasks/`: team assignments, contract and mock fixture.
- `docs/`: integration handoff, database evidence and explanations.

## Install and run on Windows

Use Node.js 20+ and MongoDB Server with replica-set support. The supplied script defaults to MongoDB 8.0's Windows installation path; pass `-MongoExe` if yours differs.

From the repository root:

```powershell
cd api
npm install
npm run db:start
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `api/.env`:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27018/before_you_buy?replicaSet=byb-rs
INTERNAL_TOOL_KEY=replace-with-a-local-secret
SEED_ON_START=true
```

Then, inside `api/`:

```powershell
npm run start:dev
```

In a second terminal, from the repository root:

```powershell
cd client
npm install
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3000/api. Swagger: http://localhost:3000/docs.

The local database script starts a localhost-only replica set named `byb-rs` on port 27018. Data lives in ignored `api/.local/mongo-rs`. The existing standalone MongoDB Windows service on port 27017 is untouched. Keep the data directory to preserve your work. Restart the API after changing its environment file.

A standalone MongoDB connection can support reads, but transactional mutations require the replica set. Never silently fall back to nontransactional writes.

## Category API

| Method | Route | Success | Access |
| --- | --- | --- | --- |
| GET | /api/categories | 200 `{ items: [{ id, name }] }` | Public |
| POST | /api/categories | 201 `{ id, name }` | Internal key |
| PATCH | /api/categories/:id | 200 `{ id, name }` | Internal key |
| DELETE | /api/categories/:id | 204, no body | Internal key |

POST/PATCH accept only `{ "name": "Dairy" }`. Names are trimmed and compared case-insensitively for uniqueness. Blank names, wrong types, unknown body/query fields, empty PATCH and invalid numeric IDs are rejected. A category used by a pantry item cannot be deleted.

Use the `x-internal-tool-key` header for mutations only. The internal key belongs in the backend environment and internal tools, never the frontend. See [HTTP examples](docs/categories.http).

Every error is `{ statusCode, code, message, fieldErrors }`. Internal failures return generic text; logs record a safe error type without raw requests, credentials or database errors.

## Database design and concurrency

Separate `categories`, `pantry_items` and `shopping_entries` collections use numeric application IDs as relationships. MongoDB's internal `_id` is not part of the API. There is no populate or aggregation pipeline. Purchased records must retain snapshots after pantry edits/deletion; implementation of that business behavior belongs to Allaith.

`IdsService.next(collection)` uses durable counters and atomic increments. It reconciles existing IDs, never lowers counters and never reuses deleted IDs. Failed operations may consume IDs.

`WriteService.run(callback)` uses a MongoDB transaction and a shared write-fence document. Every cooperating domain mutation must use it and pass the same session to ALL reads/writes. This prevents partial stock/history updates and reference-check/delete races. See [the required integration protocol](docs/write-consistency.md). The unfinished pantry/shopping code is not yet integrated with this helper.

`DatabaseModule` imports the owners' schema files without importing domain modules/services. It registers each schema when the owner exports it. Missing schemas produce an explicit startup warning. This preserves independent category development without fabricating teammate implementations.

## Seed and dates

`SEED_ON_START=true` runs the seed after module initialization. False/absent disables automatic seeding. Only an empty application database gets demo data: 7 categories and 20 pantry items. Existing application records or a completed seed marker prevent reseeding.

All inserts, counter initialization and the completion marker commit together. A failure rolls everything back. Relative expiry offsets use the current household date, so the demo remains useful on future days. The seed gives 5 LOW STOCK, 3 USE SOON, 2 EXPIRED and 12 OK items; statuses can overlap. These labels are checked in tests, not stored in MongoDB.

ClockService.today() uses Asia/Damascus and returns YYYY-MM-DD. ClockService.now() returns an instant; timestamp responses use ISO UTC. Expiry remains a calendar string or null.

Shopping/history demo records are optional and are not seeded. Purchases are never replayed into stock.

## Frontend transport and mock mode

Vite proxies `/api` to port 3000. `VITE_API_URL=/api` is the normal client setting. The contract assigns `VITE_USE_MOCKS=true` to Mohammad's development adapter; that adapter is not implemented in this checkout. Setting the variable alone currently does not create a working mock. Normal category reads need no key.

## Verification

Start the local replica set first, then run from the repository root:

```powershell
npm --prefix api run build
npm --prefix api test -- --runInBand
npm --prefix api run test:unit
npm --prefix client run build
npm --prefix client run lint
node api/scripts/measure-index.cjs
node api/scripts/verify-db-restart.cjs
```

The integration suite uses disposable `byb_test_*` databases on port 27018 and removes them afterward. The unit command runs shared-foundation checks without MongoDB.

The restart verification intentionally restarts only the task-created local replica set after verifying its exact data path and replica-set name. Run it when no other work is using that test instance.

## Actual index measurements

A representative `find({ categoryId: 1 }).sort({ expiryDate: 1 })` query was measured against the 20-item seed on 17 October 2026 (Asia/Damascus):

| Run | Keys examined | Documents examined | Execution time |
| --- | ---: | ---: | ---: |
| Before candidate index | 0 | 20 | 1 ms |
| After candidate index, optimizer selected it | 6 | 6 | 14 ms |
| Explicitly hinted candidate | 6 | 6 | 0 ms |

The candidate reduced examined documents but this tiny timing sample does not demonstrate a speedup. No production performance index was added. Mustafa's actual category/expiry query is still unimplemented; repeat the measurement after integration on representative data. Correctness indexes for unique IDs/names and Pending shopping constraints are separate.

Raw plans: [index evidence](docs/index-evidence.json). Restart evidence: [database restart result](docs/restart-evidence.json).
