> Integration update, 17 October 2026: the requirements below are now wired in codex/backend-integration. All three models and aliases are registered, domain mutations share WriteService, the actual query has been measured, and the combined suite passes 94 tests. See docs/integration-results.md. The original handoff below is retained as historical context; statements about missing shared infrastructure are superseded.
# Mustafa's pantry and dashboard handoff

Implemented against `Tasks/apicontract.md` and `docs/api-plan.md`, using the supplied ZIP's Nest/Mongoose service structure as a reference. The reference's response envelopes, ID allocation, status names/reasons and delete concurrency were adapted to the agreed contract. Only Mustafa-owned pantry/dashboard source and feature-test directories were changed.

## Delivered

- All six pantry endpoints and `GET /dashboard`, with Swagger summaries, input properties and success responses.
- Raw-only `PantryItemSchema`, numeric application IDs, unique ID/normalized-name correctness indexes, and an explicit response allowlist.
- Pure exported `calculatePantryStatus(item, today)` with overlapping LOW STOCK, exclusive EXPIRED/USE SOON, reasons and nullable daysUntilExpiry.
- Strict DTOs: real calendar dates, finite quantities, trimmed nonblank names/units, safe integer IDs, no numeric body coercion, unknown body/query rejection, duplicate scalar query rejection, omission/null PATCH semantics and empty PATCH rejection.
- Combined literal case-insensitive search, category and computed-status filters; default public ordering by ID.
- Current category names, status totals, urgent items sorted by expiry then ID, Pending linked/manual totals, and zero-count categories.
- Use and delete participate in the required shared transactional write boundary. Use also compares the stored quantity before updating; successful writes log only after commit. Decimal subtraction avoids visible binary floating-point artifacts.

## Required integration (not implemented in teammates' files)

The current repository's shared database/clock/ID infrastructure and category/shopping schemas are still scaffolds. **The application is not ready to start through the unchanged AppModule.** The feature build and isolated checks passed before test cleanup. This does not establish that the unfinished shopping/category services are integrated.

Molham's DatabaseModule must register and export these model tokens exactly once:

| Token | Collection | Schema owner |
| --- | --- | --- |
| PantryItem | pantry_items | Mustafa: `schemas/pantry-item.schema.ts` |
| Category | categories | Molham, existing category schema path |
| ShoppingEntry | shopping_entries | Allaith, existing shopping schema path |

It must also export these injection aliases from `pantry-dependencies.ts`:

```ts
{ provide: PANTRY_CLOCK, useExisting: ClockService }
{ provide: PANTRY_IDS, useExisting: IdsService }
{ provide: PANTRY_WRITES, useExisting: SharedHouseholdWritesService }
```

`ClockService.today()` must return the current household date in **Asia/Damascus** per operation. `now()` returns a Date instant. `IdsService.next('pantry_items')` must atomically allocate a positive safe integer, initialized above seeded/historical IDs and never reused after deletion. Allocation occurs outside the retried feature transaction, so failed creates may leave harmless gaps.

Once the shared module exports those providers, the AppModule owner can wire:

```ts
PantryModule.register([DatabaseModule]),
DashboardModule.register([DatabaseModule]),
```

No feature service imports another domain service. The dynamic module imports avoid importing currently nonexistent shared source files. If DatabaseModule is global and exports every required token, the existing static feature modules also work.

### Shared write contract

`HouseholdWrites.run(work)` must acquire a common database write fence inside a MongoDB transaction, pass its session to `work`, retry transient conflicts, and resolve only after commit. All pantry writes already use this boundary and pass the session to their reads/writes. No unsafe production fallback is provided.

Category deletion, shopping generation, purchase and removal must use **the same fence and session**. A snapshot transaction alone does not prevent a concurrent Pending insertion after a deletion check: those operations can write different documents. A single existing fence document updated at the start of each transaction is one simple valid implementation for this small household application. Create the fence before use; do not allow an update of a missing fence to silently succeed. A local MongoDB replica set is required for this strategy.

Allaith must integrate and test the actual purchase/generation services with this boundary; a process-local mutex alone is insufficient for crash safety or multiple server processes.

The unchanged global validation pipe emits Nest errors; the feature HTTP filter normalizes those errors for pantry/dashboard. Common middleware/global error handling remains Molham's responsibility.

## Actual category + expiry query for the index experiment

`pantryStoredQuery()` is called by `PantryService.findAll()`. For a household date of 2026-10-16 and `GET /api/pantry?categoryId=1&status=USE%20SOON`, it executes this stored-field query:

```js
db.pantry_items.find({
  categoryId: 1,
  expiryDate: { $gte: '2026-10-16', $lte: '2026-10-19' }
}).sort({ expiryDate: 1, id: 1 })
```

An EXPIRED filter uses `{ expiryDate: { $ne: null, $lt: today } }`. Name search, if provided, adds an escaped literal regex. The service then calculates statuses, applies the requested status filter, and sorts the public list by ID to preserve the contract. No aggregation or pagination is used.

Molham can measure the above with `.explain('executionStats')`, evaluate a candidate `{ categoryId: 1, expiryDate: 1, id: 1 }` index, and measure again on realistic data. **No performance index or fabricated measurements are supplied.** Existing unique indexes are correctness constraints, not the performance experiment. Computed statuses are never indexed or stored.

## Verification and cleanup — 2026-10-17

Restored the accidentally reverted `pantry-status.ts` implementation. Before removing feature test files at the user's request, the final verification passed:

- API build.
- 8 unit tests for status boundaries and dashboard counts/order/date changes.
- 24 isolated HTTP/integration checks for filters, input validation, CRUD, overlapping use, pending deletion, retained history, rollback and Swagger generation.

These final checks used fake model providers, not a live MongoDB server. Earlier real MongoDB checks were run on 2026-10-16; they were not rerun during this cleanup. The feature test sources and helpers have now been removed, so the earlier test commands no longer reproduce those checks. Shared Jest configuration and package scripts remain unchanged for the team's future tests.

Build the remaining production source from `api`:

```powershell
npm.cmd run build
```

Runtime helpers (validation, response mapping, errors, guards and dependency interfaces) are required and retained. This document contains the required integration handoff, query, examples and English demo.

Remaining integration checks: shared ClockService/IdsService, actual category/shopping schema registration and write participation, frontend integration, full backend restart persistence/seed behavior, and the owner's index measurements. The unchanged AppModule still needs shared wiring before the application and Swagger server can start.

## Request / response examples

Examples assume the contract fixture date and completed shared wiring. They are not claims that the unfinished application is already serving requests.

```http
GET /api/pantry?categoryId=1&status=USE%20SOON&name=mil
```

```json
{
  "asOfDate": "2026-10-16",
  "items": [{
    "id": 1, "name": "Milk", "categoryId": 1, "categoryName": "Dairy",
    "quantity": 1, "unit": "litres", "minimumQuantity": 2,
    "expiryDate": "2026-10-18", "statuses": ["LOW STOCK", "USE SOON"],
    "statusReasons": ["1 litres below minimum", "Expires in 2 days"],
    "daysUntilExpiry": 2
  }],
  "total": 1
}
```

```http
POST /api/pantry/1/use
Content-Type: application/json

{"quantity":1}
```

Returns 200 with Milk's full enriched item, quantity 0 and recalculated reasons. Repeating it returns:

```json
{
  "statusCode": 400,
  "code": "INSUFFICIENT_STOCK",
  "message": "Only 0 litres of Milk are available.",
  "fieldErrors": { "quantity": ["Use no more than the available quantity: 0 litres."] }
}
```

`PATCH /api/pantry/1` with `{"expiryDate":null}` clears expiry; omitting it preserves the current date. `DELETE /api/pantry/1` returns 409 `ITEM_HAS_PENDING_ENTRY` while a Pending link exists. After removing/purchasing the Pending entry it returns 204 and leaves Purchased snapshots intact.

## Short English demo

“My part is the pantry API and the dashboard. The backend reads raw quantities and dates from MongoDB and calculates statuses for the current household date. Milk can be both low stock and use soon. I can combine a category, status and name search. Using the last litre sets the quantity to zero, and another use is rejected with the available amount. A pending shopping entry prevents deletion, while purchased history is preserved. The dashboard counts overlapping statuses without duplicating items. My tests cover validation, date boundaries and concurrent writes; the shared transaction boundary must also be used by the shopping services.”

