# Tasks 2 - Allith: shopping permissions, purchases and business logs

Prepared 24 October 2026. Assignment: [tasks 2/allith.md](../tasks%202/allith.md).

## Status

| Part | Branch / commit | State |
| --- | --- | --- |
| Committed-only restock logs, business warnings, actorId signatures, logging/atomicity suite | `codex/tasks2-allith` @ `2680072` | Done, verified (112/112 tests pass) |
| JWT + household-role guards, Swagger bearer docs, real-HTTP permission suite | `codex/tasks2-allith-auth` (one commit stacked on the above) | Written against the frozen contract; **does not compile or run until Molham's auth foundation lands** |

When this work started, Molham's foundation (`api/src/auth/**`, `api/src/household-members/**`) did not exist on any branch. Following the assignment ("start immediately with logging... wire shared guard imports after Molham's early foundation commit; no duplicate production auth"), the work is split:

- `codex/tasks2-allith` builds and passes on its own. Shopping writes are still as open as on the baseline, and logs show `actorId=null`. No stand-in auth or allow-all guard was added.
- `codex/tasks2-allith-auth` imports only the exact contract paths (`auth/auth.module`, `auth/guards/jwt-auth.guard`, `auth/guards/household-roles.guard`, `auth/household-roles.decorator`, `auth/current-user.decorator`, `auth/request-user.interface`). Its only type errors are those six missing modules.

To finish: rebase `codex/tasks2-allith-auth` onto the foundation commit, then run `npm --prefix api run build` and `npm --prefix api test -- --runInBand shopping-auth shopping-logging`.

## Normal vs expired restock

A purchase of a linked entry changes pantry stock and writes the Purchased snapshot in one transaction. Which stock rule applies depends on whether the pantry item is expired today:

- **Normal stock** (not expired): the purchase is added to what is on the shelf, so `stockAfter = stockBefore + purchasedQuantity`. `newExpiryDate` is optional; leaving it out keeps the current expiry.
- **Expired stock**: the old units are unusable, so they are replaced instead of topped up: `stockAfter = purchasedQuantity`. A valid `newExpiryDate` is required. Without one the request fails with `EXPIRY_REQUIRED`, and stock and history do not change.
- **Manual entry** (no pantry item): only history is recorded. No pantry item is created or changed, and the log says `restock=none` instead of inventing a stock value.

The log line carries both numbers and an explicit `expiredReplacement` flag, so a reader can check which rule ran without looking at the database.

### Log evidence (real API, disposable database, stock set to 3 first)

```text
LOG  [ShoppingListService] Purchased shopping entry 1; pantryItemId=1, quantity=2, stock=5, stockBefore=3, stockAfter=5, expiredReplacement=false, actorId=null
WARN [ShoppingListService] Rejected shopping purchase; code=EXPIRY_REQUIRED, actorId=null, entryId=2, pantryItemId=2
LOG  [ShoppingListService] Purchased shopping entry 2; pantryItemId=2, quantity=2, stock=2, stockBefore=3, stockAfter=2, expiredReplacement=true, actorId=null
LOG  [ShoppingListService] Purchased shopping entry 7; pantryItemId=manual, quantity=2, stock=unchanged, restock=none, actorId=null
```

- Entry 1 is Milk, not expired: 3 + 2 = 5.
- Entry 2 is Yoghurt, expired: the first attempt had no expiry and was rejected with one warning and no change. The second attempt replaced stock 3 with 2.
- `actorId=null` is the pre-auth baseline. With the auth branch it is the verified `CurrentUser.sub`. `shopping-logging` already asserts `actorId=7` through the service.
- `stock=` is kept as a legacy alias of `stockAfter`, so the existing combined-suite assertion (`...quantity=2, stock=3`) still passes unchanged.

Other log lines from the same run:

```text
LOG  Generated shopping list: added=6, updated=0, unchanged=0, actorId=null
LOG  Created manual shopping entry 7; actorId=null
WARN Rejected shopping purchase; code=ALREADY_PURCHASED, actorId=null, entryId=1, pantryItemId=1
WARN Rejected shopping delete; code=ENTRY_ALREADY_PURCHASED, actorId=null, entryId=1, pantryItemId=1
LOG  Deleted Pending shopping entry 3; pantryItemId=3, actorId=null
```

Searching the server log for `mongodb:`, `secret`, `key` and `password` found 0 matches. Business logs contain numeric IDs, quantities, codes and the actor ID only: no names typed by users, bodies, headers, tokens or emails.

## How the logging works

- `purchaseEntry` returns `{ response, restock }` from the `WriteService.run` callback. `restock` holds `stockBefore`, `stockAfter` and `expiredReplacement`, read from the same documents the transaction saves. The service logs from `restock` and returns only `response`, so the public payload is still exactly `{ entry, pantryItem }`. No schema or wire change.
- Success logs are written after `WriteService.run` resolves, which means after commit. A retried transaction logs once. A rolled-back one logs nothing.
- Warnings come from `logRejection`, which wraps the whole write outside the retry callback. The callback fills safe IDs as it runs, so retried losers in a race warn exactly once. Warned codes: `PENDING_NAME_CONFLICT` (add, generate), `ALREADY_PURCHASED`, `EXPIRY_REQUIRED`, `ENTRY_ALREADY_PURCHASED` (history delete). Unexpected errors are left to `AllExceptionsFilter`. Public error codes, messages and fieldErrors are unchanged.

## HTTP examples (pre-auth baseline, real API)

| Request | Result |
| --- | --- |
| `GET /api/shopping-list?status=Pending` | 200 `{ asOfDate, items, total, pendingSummary }` |
| `POST /api/shopping-list/generate` | 200 `{ added: 6, updated: 0, unchanged: 0, pending }` |
| `POST /api/shopping-list` `{"name":"Birthday balloons","quantityToBuy":2}` | 201, Pending entry with `unit: null`, `pantryItemId: null` |
| `POST /api/shopping-list/1/purchase` `{"purchasedQuantity":2}` | 200 `{ entry: {status: "Purchased", ...}, pantryItem: {quantity: 5, ...} }` |
| `POST /api/shopping-list/2/purchase` `{"purchasedQuantity":2}` (expired) | 400 `EXPIRY_REQUIRED`, `fieldErrors.newExpiryDate` |
| `POST /api/shopping-list/2/purchase` `{"purchasedQuantity":2,"newExpiryDate":"2026-11-05"}` | 200, `pantryItem.quantity: 2`, expiry 2026-11-05 |
| `POST /api/shopping-list/7/purchase` (manual) | 200, `pantryItem: null` |
| `POST /api/shopping-list/1/purchase` again | 409 `ALREADY_PURCHASED` |
| `DELETE /api/shopping-list/1` (Purchased) | 409 `ENTRY_ALREADY_PURCHASED` |
| `DELETE /api/shopping-list/3` (Pending) | 204, empty body |
| `POST /api/shopping-list/9999/purchase` | 404 `ENTRY_NOT_FOUND`, "Shopping entry not found." |

With the auth branch, the expected responses (asserted in `shopping-auth`, not yet run) are:

| Request | Result |
| --- | --- |
| Anonymous or bad-token POST generate/manual/purchase, DELETE | 401 `UNAUTHENTICATED`, database unchanged, no success log |
| Member/admin/owner add, generate, purchase | Same payloads as above; log `actorId` = that user's ID |
| Member DELETE Pending entry | 403 `FORBIDDEN`, entry remains |
| Admin/owner DELETE Pending entry | 204 empty |
| Admin DELETE Purchased entry | 409 `ENTRY_ALREADY_PURCHASED` |
| Body containing `actorId`, `userId` or `role` | 400 (unknown field) |
| Anonymous GET list/history | 200, unchanged |

## Permission table (auth branch)

| Method/path under `/api` | Guards |
| --- | --- |
| `GET /shopping-list` | Public, plus the existing JsonObjectGuard; no bearer in Swagger |
| `POST /shopping-list`, `POST /shopping-list/generate`, `POST /shopping-list/:id/purchase` | `JwtAuthGuard`, `HouseholdRolesGuard`, `@HouseholdRoles('owner','admin','member')` |
| `DELETE /shopping-list/:id` | `JwtAuthGuard`, `HouseholdRolesGuard`, `@HouseholdRoles('owner','admin')` |

The guards are set per method. The class-level `JsonObjectGuard` is kept. No internal-tool key is needed for shopping.

## Test results

Run on 24 October 2026 against the local `byb-rs` replica set (port 27018), from `codex/tasks2-allith`:

| Command | Result |
| --- | --- |
| `npm --prefix api run build` | PASS |
| `npm --prefix api test -- --runInBand shopping-logging` | PASS, 12/12 |
| `npm --prefix api test -- --runInBand` | PASS, 112/112 in 8 suites (100 existing + 12 new) |
| `shopping-auth` (auth branch) | NOT RUN: blocked on the foundation. Type-checks apart from the six missing auth modules |

`shopping-logging` covers:

- Normal 3 + 2 → 5 with `expiredReplacement=false`.
- Expired 3 + 2 → 2 with `expiredReplacement=true`.
- Missing expiry: one warning, database byte-identical.
- Manual purchase: no pantry change, `restock=none`.
- Injected `TransientTransactionError`: the callback runs twice, stock changes once, one log.
- Injected failure after the stock update: stock and history both roll back, no success log, no warning.
- 8 concurrent purchases: 1 success, 7 `ALREADY_PURCHASED`, stock +2 once, exactly 1 success log and 7 warnings.
- Repeat generation: one Pending entry per item, counts logged with the actor.
- Generation name conflict: full rollback, one warning.
- Manual add/delete logs and their rejections, with no typed names in any log line.
- Snapshot stable after a pantry item is renamed or deleted; repeat purchase and delete rejected.
- Helpful 404 messages.

Each suite uses its own `byb_test_allith_<suite>_<pid>` database and drops only that one.

## Handoff to Molham

1. **Foundation dependency.** The auth branch needs the six exports above. `AuthModule` must resolve when imported into `ShoppingListModule`.
2. **Membership collection name.** `shopping-auth` promotes roles by updating `household_members` (`{ householdId: 1, userId }`). If the collection name differs, change `setRole` in that suite, or I can switch it to your `test/support/auth-fixtures.ts` helper once it exists.
3. **Swagger security name.** The suite expects `@ApiBearerAuth()` to resolve to the default `bearer` scheme from `DocumentBuilder().addBearerAuth()`.
4. **Old combined suites** (`backend-flows`, `frontend-client`): no service-signature changes reach them, since they use HTTP. After the auth branch merges, their shopping writes need a member token. `DELETE /shopping-list/:id` (lines ~182, 487-488, 545 in `backend-flows`) needs an admin or owner token. The `PDF 17.8` log assertion still matches.
5. **Startup env.** `test/support/allith-shopping-harness.ts` already sets and restores `JWT_SECRET`.

## Known gaps

- The permission suite has not run. Final HTTP proof with real accounts depends on the foundation.
- Until the auth branch merges, the logged `actorId` is `null` over HTTP.
- `PENDING_NAME_CONFLICT` raised by the unique-index race path (11000), rather than by the pre-check, has no conflicting entry ID, so it logs `entryId=none`.
- No frontend changes. Mohammad owns shopping UI handling of 401/403.
