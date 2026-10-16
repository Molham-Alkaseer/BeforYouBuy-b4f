# Molham Super — My Backend Work Explained

Prepared for Molham on 17 October 2026 (Asia/Damascus).

Project: C:\Users\molha\OneDrive\Desktop\MiniProject\BeforYouBuy-b4f
Branch: member-molham
Requested standalone copy: C:\Users\molha\OneDrive\Desktop\MiniProject\molham-super.md

## What is finished?

Your category backend, shared API foundation, clock, durable numeric IDs, transaction helper, atomic seed, database setup, automated tests and setup documentation are implemented.

Full team integration is NOT finished. Mustafa's schema and business endpoints are still placeholders in this checkout. Allaith's separate branch needs contract and shared-session fixes. The frontend owners must connect and verify their screens. These dependencies are listed explicitly below rather than marked done.

## 1. API foundation

Files:
- api/src/main.ts
- api/src/app.module.ts
- api/src/common/validation.ts
- api/src/common/errors/api-error.ts
- api/src/common/filters/all-exceptions.filter.ts
- api/src/common/pipes/positive-id.pipe.ts
- api/src/common/pipes/no-fields.pipe.ts

The server uses /api for resource routes and /docs for Swagger.

ValidationPipe runs the decorators on DTO classes. Unknown properties are rejected instead of silently ignored. The category endpoints also use NoFieldsPipe for places that accept no body/query fields.

PositiveIdPipe accepts positive safe integer IDs and rejects 0, negatives, fractions, scientific notation, invalid text and numbers beyond JavaScript's safe integer limit.

Every error response has:
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Please correct the invalid fields.",
  "fieldErrors": { "name": ["name should not be empty"] }
}
```

Business errors use apiError(). Unexpected server failures return a generic message. Logs include a safe error type, not raw credentials or request bodies.

Proof: validation, invalid-ID, error-safety and HTTP tests pass. Future domain controllers must bind their own DTOs to use the same validation.

## 2. Categories — your first complete feature

Files: api/src/categories/ (controller, service, module, DTOs and schema).

The request flow is:

```text
HTTP request
  -> controller (route, input DTO and guard)
  -> service (business rules)
  -> Mongoose model (database access)
  -> clean response containing id and name
```

The Category schema stores:
- id: the public numeric identifier.
- name: the readable trimmed name.
- normalizedName: the lowercase name used for uniqueness.

The controller provides:
- GET /api/categories — public list sorted by ID.
- POST /api/categories — create.
- PATCH /api/categories/:id — rename.
- DELETE /api/categories/:id — delete an unused category.

Only mutations require x-internal-tool-key. The key is read from api/.env and must never be put in React code.

CreateCategoryDto rejects missing, blank, null and non-string names. It trims whitespace first. UpdateCategoryDto requires a name because it is the only editable field, so an empty PATCH is invalid.

The service catches normalized-name uniqueness failures and returns 409 DUPLICATE_CATEGORY_NAME. Missing records return 404 CATEGORY_NOT_FOUND. A category used by a pantry item returns 409 CATEGORY_IN_USE on deletion. Successful deletion returns 204 with no response body.

The service reads the pantry collection directly for the usage check, avoiding a dependency on Mustafa's unfinished PantryService.

Proof: real HTTP tests cover success, all guard cases, invalid inputs, duplicates, used-category deletion, concurrent creates, protected delete/reference races and persistence after restart.

## 3. Shared database registration

Files:
- api/src/database/database.module.ts
- api/src/database/domain-models.ts

Your bootcamp used MongooseModule.forFeature inside each feature module. Here, the team agreement puts registrations in one DatabaseModule.

CategoriesModule imports DatabaseModule and injects Category through @InjectModel(Category.name). DatabaseModule does not import PantryModule or ShoppingListModule, so no circular service dependency is introduced.

The registration code imports each owner's schema file and uses the owner's exported schema when available. The current placeholders do not export PantryItemSchema or ShoppingEntrySchema, so startup warns and omits those two registrations. This is an unfinished integration dependency, not an implemented pantry/shopping model.

Mustafa and Allaith need to export their schemas and import DatabaseModule in their modules.

## 4. Clock and numeric IDs

Files:
- api/src/common/clock/clock.service.ts
- api/src/common/common.module.ts
- api/src/database/ids.service.ts

ClockService.today() returns YYYY-MM-DD in Asia/Damascus. ClockService.now() returns a Date representing an instant. Calendar expiry strings must not shift according to the browser timezone.

IdsService.next('categories' | 'pantry_items' | 'shopping_entries') allocates IDs with a persistent counter and an atomic database increment. It first accounts for existing/seeded IDs.

Unlike reading the last ID and adding one in application memory, concurrent requests cannot receive the same counter value. Deleting the highest record does not reset the counter. Failed requests may leave gaps; that is expected and safe.

Proof: 50 simultaneous allocations were unique, allocation continued above seeded records, deleted IDs were not reused, and a new connection preserved the counter.

## 5. Failure-safe shared writes

Files:
- api/src/database/write.service.ts
- api/scripts/start-local-mongo.ps1
- api/scripts/init-replica.cjs
- docs/write-consistency.md

A purchase may change stock and create purchase history. Saving one and then failing on the other would leave inconsistent data.

WriteService.run() wraps related work in one MongoDB transaction. It updates a shared fence record before business reads. Competing writers conflict and retry, preventing check/delete races when all domains follow the protocol.

If any step fails, MongoDB rolls back the transaction. If everything succeeds, all writes commit together.

Every participating read/write must receive the SAME session. Allocate IDs before the callback; put success logs after run() resolves. Do not run nontransactional side effects inside the callback because MongoDB can retry it.

Transactions require a replica set. The provided script starts an isolated localhost instance on port 27018, named byb-rs. The existing MongoDB Windows service on 27017 is untouched. Data is stored in api/.local/mongo-rs.

Proof: failure injection rolled back stock, concurrent read/modify/write operations lost no updates, paired stock/history writes committed together, and a cooperating category-reference writer could not leave an orphan.

Remaining: Mustafa and Allaith must use this helper in every mutation and add their own business-rule tests.

## 6. Atomic demo seed

Files:
- api/src/database/seed-data.ts
- api/src/database/seed.ts
- api/src/database/seed.module.ts

With SEED_ON_START=true, the seed runs after modules initialize. It creates the contract fixture's 7 categories and 20 pantry items only when the application collections are empty and no completed seed marker exists.

Expiry dates are calculated from today's household date using relative offsets. Nothing is tied to October 2026.

The seed produces:
- 5 LOW STOCK items.
- 3 USE SOON items.
- 2 EXPIRED items.
- 12 OK items.

Some statuses overlap. Computed status labels, reasons and dashboard totals are not stored.

Category inserts, pantry inserts, initial ID counters and the completion marker are one transaction. A failure cannot leave half the demo data. A completed marker also prevents recreating demo records after the user deliberately deletes all of them.

Existing data is preserved on restart. Optional shopping/history seed was omitted, so no historical purchases are replayed into stock.

Proof: tests cover relative dates in 2030, exact fixture counts, no computed fields, existing data preservation, restart preservation, concurrent seed requests, partial failure rollback and successful retry.

## 7. Relationships and indexes

Collections are separate and linked with numeric categoryId/pantryItemId values. No populate, aggregation pipeline or ObjectId relationship is used.

Unique ID/name indexes enforce correctness. Shopping uniqueness is scoped to Pending records; multiple manual entries with null links and repeated Purchased history for an item are allowed.

Historical purchase snapshots must survive pantry deletion. That behavior remains Allaith's implementation responsibility.

A real index experiment was run on a disposable 20-item fixture database:

| Measurement | Keys examined | Documents examined | Time |
| --- | ---: | ---: | ---: |
| No category/expiry index | 0 | 20 | 1 ms |
| Candidate chosen by optimizer | 6 | 6 | 14 ms |
| Candidate explicitly hinted | 6 | 6 | 0 ms |

The index examined fewer documents but the timing sample does not establish a speedup. No production performance index was added. Mustafa's final query is still missing, so the final index decision remains pending.

Evidence: docs/index-evidence.json.
Reproduce: node api/scripts/measure-index.cjs after building the API.

## 8. Tests and working local setup

Verified:
- API build passes.
- All 44 automated tests across 5 suites pass.
- 12 independent foundation tests pass without MongoDB.
- Frontend build and lint pass.
- GET http://localhost:3000/api/categories returns all 7 seeded categories.
- Swagger at http://localhost:3000/docs returns HTTP 200.
- Application restart preserves data.
- A real shutdown/restart of the isolated MongoDB process preserved a stored marker.

Run from the repository root:

```powershell
npm --prefix api run db:start
npm --prefix api run build
npm --prefix api test -- --runInBand
npm --prefix api run test:unit
npm --prefix client run build
npm --prefix client run lint
```

Start development:

```powershell
cd api
npm run start:dev
```

The local api/.env was updated to use port 27018 and SEED_ON_START=true while preserving its internal key. It remains ignored by Git. Do not run a second server on port 3000 if the development server is already running.

Tests create disposable databases and clean them up. The database restart script validates the exact owned data path before stopping the local test instance.

## 9. Git delivery

Each completed implementation group was committed and pushed separately to origin/member-molham:

| Commit | Purpose |
| --- | --- |
| f1f5793 | Shared validation, errors and household date service |
| 31f57ee | Durable IDs and transactional write coordination |
| deb20c4 | Guarded category CRUD and contract validation |
| 3ff4559 | Atomic demo seed with relative dates |
| 7b074da | Startup, persistence, index evidence and verification tooling |

A separate final documentation commit contains this guide, updated setup instructions, HTTP examples and the integration checklist.

Your earlier category work was built upon and included. Teammates' pantry/shopping business files were not rewritten.

## 10. Remaining team responsibilities

These are the reasons the entire project cannot honestly be called finished yet:

1. Mustafa must supply the real PantryItemSchema and pantry/dashboard behavior.
2. Allaith must complete the shopping schema and shared model/session integration. The inspected separate branch lacked normalizedName, a persisted newExpiryDate property and the shared module import.
3. Both backend owners must pass the same session through all reads and writes under WriteService.
4. Mohammad must complete the mock/live transport and preserve structured error fields.
5. Screen owners must verify live frontend flows.
6. Measure Mustafa's actual stored-field query after it exists.
7. Run the exact PDF section 17 acceptance cases when that PDF is available. No PDF was present in the inspected project files.
8. Each team member must present their own work in English.

The contract remains unchanged. docs/integration-results.md records these open checks and the owner for each one. Foundation tests do not prove unfinished business endpoints work.

## Short English presentation

“My responsibility was the backend foundation and category management. I implemented public category reads and protected category changes, with validation and consistent errors. I connected the category model to MongoDB, added safe numeric IDs and a Damascus date service, and built a transaction helper for shared writes. I also added an atomic demo seed that preserves existing data and uses relative expiry dates. I tested category behavior, concurrency, rollback, seeding and persistence with real MongoDB. The remaining integration requires the pantry, shopping and frontend owners to connect their completed features to these shared services.”
