# Allith - shopping API permissions, purchases and business logs

Prepared: 24 October 2026. You are the existing shopping backend owner named Allaith in the older Tasks folder. Read the [shared upgrade contract](molham.md#4-frozen-upgrade-contract) first.

## 1. What we had before

- ShoppingListController already exposes list, add manual, generate, purchase and delete routes. Manual creation is `POST /shopping-list`, not `/shopping-list/manual`.
- ShoppingListService already persists entries in MongoDB and uses WriteService for every mutation.
- Generation computes suggestions from Low Stock/Expired items, updates existing Pending entries and does not duplicate them. Conflicting Pending names abort generation.
- Purchase already updates stock and the Purchased snapshot in one transaction. Expired stock is replaced only with a supplied valid expiry; normal stock is incremented. Purchased entries cannot be bought twice or deleted.
- History snapshots survive later pantry changes. Existing unique indexes protect Pending names/linked items.
- Ordinary shopping writes have no JWT/role checks. The current purchase log records entry ID, pantry item ID, purchased quantity and final stock, but omits starting stock and an explicit expired-replacement indicator. Several expected shopping rejections have no warning log.

## 2. Goal and B4F connection

B4F now guards signed-in writes and applies membership permissions. Add that boundary to shopping, and complete the useful business logging already expected by our project.

After your work, member/admin/owner can generate/add/purchase, only admin/owner can remove a Pending entry, rejected auth never changes stock/history, and logs accurately describe a committed restock or a meaningful business rejection.

## 3. Files you own

- `api/src/shopping-list/**` including controller, module, service, DTOs and schemas only when needed.
- New `api/test/integration/shopping-auth.e2e-spec.ts` and `shopping-logging.e2e-spec.ts`; isolated doubles use `api/test/support/allith-*` names.
- `docs/tasks2-allith.md` for safe HTTP/log/test evidence.

Do not edit auth/users/membership/guard infrastructure, pantry/dashboard source, DatabaseModule/WriteService/IdsService, AppModule/package/config, original combined suites or frontend files. Request shared changes from Molham and client changes from Mohammad.

## 4. Contract and parallel start

| Method/path under `/api` | Permission |
| --- | --- |
| GET /shopping-list, including Purchased filters | Public |
| POST /shopping-list, POST /shopping-list/generate, POST /shopping-list/:id/purchase | JWT then household roles owner/admin/member |
| DELETE /shopping-list/:id | JWT then household roles owner/admin |

Import AuthModule in ShoppingListModule and use Molham's exported JwtAuthGuard, HouseholdRolesGuard, HouseholdRoles, CurrentUser and RequestUser. Add guards at write-method level, preserving JsonObjectGuard and the public GET. Pass verified currentUser.sub as required actorId: `addManualEntry(dto, actorId)`, `generateShoppingList(actorId)`, `purchaseEntry(id, dto, actorId)`, `deleteEntry(id, actorId)`.

Start immediately with logging and transaction/business tests using your current services and fixed clock. You can design permission fixtures independently. Wire shared guard imports after Molham's early foundation commit; no duplicate production auth implementation or allow-all fallback. Final HTTP proof uses real accounts, membership rows and real guards.

## 5. Step-by-step tasks

### Step 1 - preserve existing shopping behavior

- [ ] Record current list/generate/manual/purchase responses and success HTTP codes.
- [ ] Preserve Pending/Purchased enum spelling, public numeric IDs, nullable manual pantryItemId/unit, timestamp/date-only conventions and default sorting.
- [ ] Preserve pendingSummary over all Pending records, independent of the supplied list filters.
- [ ] Keep suggested quantities, repeat-generation counts, manual/history retention and duplicate-name behavior.
- [ ] Do not rewrite transactions as independent updates or introduce pantry-service imports. Continue using registered models and the same session/fence.

### Step 2 - enforce method permissions

- [ ] Import real AuthModule and attach JWT then role guard to the four write methods using the permission table.
- [ ] Keep GET public, with no bearer requirement in its Swagger operation.
- [ ] Read actor identity from CurrentUser only; body actorId/userId/role remain unknown fields and are rejected.
- [ ] Document bearer requirement, 401 and 403 on the protected methods; retain business 400/404/409 docs and 201/200/204 success behavior.
- [ ] Check member remove ->403 before business mutation; admin/owner still cannot remove Purchased history or purchase an already-purchased entry.
- [ ] Ensure no client internal-tool key is required for normal shopping actions. Categories remain Molham's separate key-only tooling flow.

### Step 3 - complete committed restock logs

- [ ] Capture stockBefore, stockAfter, purchasedQuantity, pantryItemId, entryId, actorId and `expiredReplacement` from the same transaction's real values.
- [ ] For normal stock, the log proves stockAfter = stockBefore + purchasedQuantity. For expired stock, it proves stockAfter = purchasedQuantity and expiredReplacement = true.
- [ ] For manual purchases, log the purchase with no pantry restock; use null/explicit manual representation rather than invented stock zero.
- [ ] Return any private log metadata from the transaction to the service's outer scope, then strip it before returning the public `{ entry, pantryItem }` response. No wire/schema change is required for logging.
- [ ] Emit the success log after commit. Transaction retries must not emit duplicate success records; rolled-back purchases must emit no restock success.
- [ ] Keep generation added/updated/unchanged counts and include actorId after commit; log manual creation/removal with safe IDs and actor.
- [ ] Never log credentials, tokens, headers, DB URI, arbitrary request body or unnecessary account email.

### Step 4 - add safe business rejection logs

- [ ] Log meaningful expected rejections with stable business code, operation, actorId and safe entry/item IDs: pending-name conflict, already purchased, expiry required and attempted history deletion.
- [ ] Perform final warning emission outside retry callbacks where practical; do not double-log a retried business failure. Unexpected internal errors remain the common filter's responsibility.
- [ ] Do not change the existing public error codes/fieldErrors to support logging.
- [ ] Confirm errors still include a helpful message for missing entries/items and invalid expiry/purchase quantity.

### Step 5 - prove stock/history and auth stay atomic

- [ ] Real HTTP tests: anonymous writes 401, all roles may add/generate/purchase, member removal 403, admin/owner removal 204 for an eligible Pending entry.
- [ ] Compare database records before/after unauthorized requests; no stock/history change and no success log.
- [ ] Concurrent purchase attempts produce one purchase/stock change, with the other request rejected. Exactly one committed restock log appears.
- [ ] Inject failure after stock update but before history save; both roll back and no success log appears.
- [ ] Generate twice; maintain one Pending entry per eligible item. A later generation conflict rolls the entire operation back.
- [ ] Normal purchase adds stock; expired purchase requires new expiry and replaces old stock; manual purchase never creates a pantry item.
- [ ] Purchased snapshot name/unit/quantity/date remains stable after later item edits/deletion; repeat purchase/deletion remains rejected.
- [ ] Change a membership role after login and prove delete permission changes with the same token.
- [ ] Give Molham the actor-signature/setup changes for old combined suites; you own only your new suites.

## 6. Acceptance checks

| Scenario | Expected result |
| --- | --- |
| Anonymous GET shopping list/history | Existing 200 response |
| Anonymous valid POST generate/manual/purchase | 401 UNAUTHENTICATED, no state change |
| Member adds/generates/purchases | Existing successful payloads |
| Member removes Pending entry | 403 FORBIDDEN, entry remains |
| Admin/owner removes eligible Pending entry | Empty 204 |
| Admin removes Purchased entry | Existing 409, snapshot remains |
| Normal stock 3 + purchase 2 | Stock 5; one log with before 3, after 5, replacement false |
| Expired stock 3 + purchase 2 with valid expiry | Stock 2; one log with before 3, after 2, replacement true |
| Expired purchase without expiry | EXPIRY_REQUIRED, no stock/history change, useful warning |
| Manual purchase | Purchased entry, null pantryItem, no restock claimed |
| Forced rollback or duplicate purchase | No extra committed stock/history/success log |

Run from root after foundation integration:

```powershell
npm --prefix api run build
npm --prefix api test -- --runInBand shopping-auth shopping-logging
```

Use disposable `byb_test_*` databases on the replica set; close/drop only your own suite database. Keep tests deterministic with the existing clock pattern. Molham owns complete-suite integration and restart evidence.

## 7. Expected result and handoff

Deliver branch `codex/tasks2-allith` with successful/failed HTTP examples, a normal-restock log and an expired-replacement log without secrets, rollback/concurrency test results and known gaps in `docs/tasks2-allith.md`.

You are finished when every shopping mutation follows the real permission table, public browsing still works, stock/history remains atomic and logs describe only committed outcomes. Explain the normal-versus-expired restock difference and show the matching log evidence in English.
