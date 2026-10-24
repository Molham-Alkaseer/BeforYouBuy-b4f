# Molham Super — Backend Work and Integration

Updated 17 October 2026, Asia/Damascus.

Project: C:\Users\molha\OneDrive\Desktop\MiniProject\BeforYouBuy-b4f
Delivery branch: member-molham
Integration branch: codex/backend-integration

## Current result

The three backend contributions are merged and integrated:
- Molham: categories, shared infrastructure, IDs, clock, transactions, seed and documentation.
- Mustafa: pantry schema, status calculation, CRUD, stock use, filters and dashboard.
- Allaith: shopping contribution, with the integration fixes needed to replace mock storage and satisfy the shared contract.

The backend build and 94 tests across 6 suites pass. The client build and lint pass, but frontend branches/screens were not integrated in this backend task.

The backend dependencies previously listed as missing are resolved. The remaining project work is frontend/live screen integration and the team's presentation.

## 1. Your API foundation

Files: api/src/main.ts, api/src/app.module.ts, api/src/common/.

The API uses /api for resources and /docs for Swagger. ValidationPipe checks DTO decorators, rejects unknown fields and does not coerce body numeric strings into numbers.

PositiveIdPipe rejects zero, negatives, fractional/unsafe IDs and malformed text. NoFieldsPipe rejects fields where an endpoint accepts no body/query. JSON-object guards reject array bodies before DTO transformation.

Every failure returns statusCode, code, message and fieldErrors. Unexpected internal failures use safe generic text and do not log raw credentials or request bodies.

## 2. Your categories feature

Files: api/src/categories/.

The request flow is controller -> service -> Mongoose model -> clean response.

A category stores:
- id: public numeric identifier.
- name: readable, trimmed name.
- normalizedName: lowercase comparison name for uniqueness.

GET /api/categories is public. POST, PATCH and DELETE require x-internal-tool-key. The key belongs in api/.env and internal tooling, never React.

Blank/invalid names are rejected, duplicate names return 409, missing categories return 404, and used categories cannot be deleted. Responses expose only id/name, never MongoDB metadata or normalizedName.

## 3. Shared model registration and teammate wiring

Files: api/src/database/database.module.ts, domain-models.ts.

DatabaseModule now imports and registers all three actual owner schemas:
- Category -> categories.
- PantryItem -> pantry_items.
- ShoppingEntry -> shopping_entries.

It exports models and binds Mustafa's ClockService, IdsService and HouseholdWrites aliases to your shared implementations. PantryModule, DashboardModule and ShoppingListModule import the shared providers. No domain service imports another domain service.

Correctness indexes initialize even if automatic demo seeding is disabled.

## 4. Clock and IDs

ClockService.today() returns the calendar date in Asia/Damascus. now() returns an instant; timestamp responses are ISO UTC. Expiry stays a YYYY-MM-DD string or null.

IdsService uses durable atomic counters. It reconciles existing records and never lowers the counter, so deleted IDs are never reused.

Ordinary create operations allocate before retryable work; failed requests can leave harmless gaps. Generation allocates using IdsService.next(collection, session), so those counter changes participate in the same transaction as the generated records.

## 5. Safe writes

Files: api/src/database/write.service.ts and docs/write-consistency.md.

Every category, pantry and shopping mutation uses the same WriteService. It starts a MongoDB transaction and updates one shared fence before reading business state. Concurrent writers conflict and retry. If the fence is missing, writing fails safely.

Every participating read/write receives the same session. A failed history write therefore rolls back its stock update. The fence also protects category/item deletion checks against concurrent creation/generation.

Success logs run after the transaction commits. Callbacks can retry, so external side effects must stay outside them.

MongoDB transactions require the local replica set. api/scripts/start-local-mongo.ps1 starts byb-rs on localhost port 27018 with files in api/.local/mongo-rs. It does not modify the Windows MongoDB service on port 27017.

## 6. Atomic seed

Files: api/src/database/seed.ts, seed-data.ts, seed.module.ts.

SEED_ON_START=true creates 7 categories and 20 pantry items only in an empty application database with no completed marker.

All records, initial counters and the marker commit together. Partial failures roll back; existing data and edits survive restart.

Expiry dates use offsets from today's household date. The fixture contains 5 LOW STOCK, 3 USE SOON, 2 EXPIRED and 12 OK items; statuses overlap and are computed, never stored.

Optional shopping history is not seeded automatically. Generate creates current suggestions. The integration tests load fixed history fixtures only into disposable test databases.

## 7. Mustafa's code and integration

Mustafa's latest branch now contains real pantry/dashboard code, superseding the earlier scaffold inspection.

His status helper calculates overlapping LOW STOCK/EXPIRED/USE SOON and uses OK only when no other status applies. Pantry reads resolve current category names, validate references, combine filters, and hide storage metadata.

We connected his module/provider aliases to the shared infrastructure. His use/delete operations now run with the same transaction/fence as categories and shopping. We adjusted empty body/query validation to work with the global strict pipe.

Dashboard reads the actual models, counts overlapping statuses, orders urgent items and includes categories with zero items.

## 8. Allaith's code and integration fixes

The imported shopping service used mock arrays and a process-local ID counter. Those could not provide persistence or transaction safety.

We replaced that storage with the shared MongoDB models and IDs while preserving the intended shopping behavior:
- POST /shopping-list creates a manual entry.
- POST /shopping-list/generate returns added/updated/unchanged plus the refreshed Pending list.
- POST /shopping-list/:id/purchase returns entry and pantryItem.
- Generate and purchase return 200, as required by the contract.
- Listing includes asOfDate and Pending totals independent of filters.

The schema now persists normalizedName and newExpiryDate. Unique constraints apply only to Pending names/links, allowing multiple history records and manual entries.

Validation now handles real dates, positive decimals, wrong-type names, null semantics, query IDs, duplicate query keys and unexpected fields. The old runtime mock JSON was removed.

Generation derives eligibility from current pantry data, refreshes eligible suggestions and retains ineligible/manual/history entries. A name conflict aborts the entire operation.

Purchase adds normal stock, replaces expired stock only when a valid date is supplied, snapshots name/unit/effective expiry, and commits the history change with stock. Repeated/concurrent purchase cannot restock twice. Purchased history survives later edits and pantry deletion.

## 9. Query measurement and index decision

The measurement script imports the actual pantryStoredQuery helper called by PantryService.findAll.

For category 1 and USE SOON, the query filters categoryId plus a stored expiryDate range and sorts expiryDate/id. No computed status field is indexed.

Measured on the 20-item seed:

| Stage | Keys | Documents | Time |
| --- | ---: | ---: | ---: |
| Before candidate | 0 | 20 | 0 ms |
| Candidate categoryId/expiryDate/id index | 1 | 1 | 18 ms |
| After removing candidate | 0 | 20 | 0 ms |

One record matched each run. The candidate reduced examined documents, but this tiny workload did not establish a useful timing benefit. We decided to keep correctness indexes only and reconsider if the data grows. A post-decision measurement is recorded.

Evidence: docs/index-evidence.json.
Reproduce after building: node api/scripts/measure-index.cjs.

## 10. What we tested

94 tests across 6 suites pass against the real local replica set.

The integrated suite covers the backend behavior of all eight PDF section 17 cases:
1. LOW STOCK + USE SOON for quantity 1/minimum 2/expiry +2 days.
2. Clear rejection of excess stock use.
3. Correct repeated generation without duplicates.
4. Normal restock and expired-stock replacement/date requirement.
5. Pending-entry protection on pantry deletion.
6. Category-key enforcement and Swagger header documentation.
7. Data preserved after closing/recreating the backend.
8. A meaningful committed restock log.

Additional tests verify strict inputs, combined filters, dashboard refresh, immutable snapshots, generation collision rollback, a failed actual history write, and concurrent use/purchase/generation/deletion.

Existing tests still cover numeric ID concurrency, atomic seed recovery, safe errors and date policy. The recorded standalone MongoDB process restart evidence is retained in docs/restart-evidence.json.

API and client builds pass; client lint passes. These checks do not replace the final live frontend walkthrough.

## 11. Run and test

From the repository root:

```powershell
npm --prefix api run db:start
npm --prefix api run build
npm --prefix api test -- --runInBand
npm --prefix api run test:unit
npm --prefix client run build
npm --prefix client run lint
```

Inside api/, run npm run start:dev. Swagger is http://localhost:3000/docs.

Use the replica-set URI from api/.env.example. Keep the internal key local and out of Git. If port 3000 is occupied, use the existing development server or stop it before starting another.

Integration tests create and remove their own byb_test_* databases. They do not clear the household development database.

## 12. Git history

Your original six commits remain intact on member-molham. Allaith's 269413b contribution was already merged into the local integration branch via 1f615b4. Mustafa's 442bde4 contribution is merged with the shared backend fixes and verification.

The tested integration is pushed to codex/backend-integration and fast-forwarded into member-molham. No teammate branch is rewritten and no force push is used.

## 13. What remains

The backend merge/integration task is finished. Remaining whole-project work:
- Merge the frontend contributions separately.
- Complete Mohammad's live API adapter/types and connect all screens.
- Verify real screen flows and visible loading/error/empty states.
- Perform the complete visual demo and have every member present in English.

The requirements PDF is now present in docs/. Its eight backend acceptance behaviors were checked. Earlier notes saying the PDF or teammate backend implementations were unavailable are superseded by this guide.

## Short English explanation

“My responsibility was categories and the shared backend foundation. I implemented strict validation, consistent errors, numeric IDs, a Damascus clock, safe transactions and atomic demo data. I then integrated Mustafa's pantry/dashboard and Allaith's shopping contribution with the same models and transaction boundary. We tested real MongoDB behavior, including stock/history rollback, duplicate purchases, concurrent operations and persistence. The combined backend passes 94 tests. Frontend integration and the final team walkthrough remain.”
