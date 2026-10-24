# Mostafa - pantry permissions, dashboard stability and backend regression

Prepared: 24 October 2026. You are the existing pantry/dashboard owner named Mustafa in the older Tasks folder. Read the [shared upgrade contract](molham.md#4-frozen-upgrade-contract) first.

## 1. What we had before

- PantryController already implements list/detail/create/update/use/delete with DTOs, body checks, strict IDs and feature validation/filtering.
- PantryService already reads MongoDB, computes response statuses using the household clock, validates categories and names, and uses the shared transaction fence for writes.
- Stock use rejects over-consumption and protects against conflicting updates. Deletion checks for a Pending shopping entry in the same transaction.
- DashboardService already computes status counts, urgent items, category counts and Pending summary from stored data. No rewrite is needed.
- PantryModule and DashboardModule already import DatabaseModule and have dynamic register support for isolated setups.
- Ordinary writes currently accept no JWT and do not identify the actor. `PantryHttpFilter` maps plain non-400 exceptions to `HTTP_ERROR`, which needs attention when auth guards are added.

## 2. Goal and B4F connection

B4F now verifies JWTs before writes and uses membership roles for permission checks. Apply those patterns to pantry writes while keeping public reads and all stock/date behavior unchanged.

After your work, any household role can create/edit/use stock, only owner/admin can delete an item, and no rejected auth request reaches a mutation. Dashboard and pantry filters retain their current results and response shapes.

## 3. Files you own

- `api/src/pantry/**`, including PantryHttpFilter and its tests/documentation.
- `api/src/dashboard/**` where integration/regression work is necessary.
- New `api/test/integration/pantry-auth.e2e-spec.ts` and `dashboard-regression.e2e-spec.ts`; any local test doubles use `api/test/support/mostafa-*` paths.
- `docs/tasks2-mostafa.md` for endpoint/log/check evidence.

Do not edit shared auth guards/decorators, Users/HouseholdMembers/DatabaseModule/IdsService/WriteService, package/config, AppModule, global error filter, old cross-feature suites or shopping source. Molham owns those shared files and the original test suites. Send him needed shared changes in your handoff.

## 4. Contract and parallel start

Use Molham's AuthModule exports and imports listed in his section 4. Add AuthModule to PantryModule for guard/provider resolution. Do not globally guard the whole controller or protect Dashboard GET. Existing controller body guard/feature validation must stay.

Exact method policy:

| Method/path under `/api` | Permission |
| --- | --- |
| GET /pantry, GET /pantry/:id, GET /dashboard | Public |
| POST /pantry, PATCH /pantry/:id, POST /pantry/:id/use | JWT, then roles owner/admin/member |
| DELETE /pantry/:id | JWT, then roles owner/admin |

Guard order on write methods: JwtAuthGuard then HouseholdRolesGuard, configured through `@HouseholdRoles(...)`. Controllers read `@CurrentUser() currentUser: RequestUser` and pass its `sub` as required actorId. Service signatures become `create(dto, actorId)`, `update(id, dto, actorId)`, `use(id, quantity, actorId)`, `remove(id, actorId)`. Reads stay unchanged. Do not accept actor/role fields in bodies.

Start immediately with filter compatibility, logging changes and existing service/status tests using your fixed clock and fake dependencies. Add isolated permission test cases using fixtures in your own test files. Real guard imports/controller-module wiring follow Molham's early foundation PR; do not create duplicate auth source or leave a fake allow-all guard in production. Full HTTP acceptance uses real guards and real users.

## 5. Step-by-step tasks

### Step 1 - record the pantry/dashboard baseline

- [ ] Capture one pantry list, one overlapping-status detail, a combined filter result and dashboard response.
- [ ] Confirm statuses are derived on reads; no stored status field or computed-status index is introduced.
- [ ] Preserve Damascus date-only semantics, decimal stock, strict body numbers, name normalization and expiry omitted/null behavior.
- [ ] Keep the existing category+expiry query helper and measured index decision. Auth does not justify an unrelated index experiment.

### Step 2 - wire authentication and permissions

- [ ] Import the real exported AuthModule in PantryModule once available. Preserve dynamic register behavior and existing DatabaseModule providers.
- [ ] Add method-level JWT + role guards/decorators to the four mutation routes according to the table.
- [ ] Use verified CurrentUser for actorId; never trust a userId/role/header supplied by a client body.
- [ ] Keep GET endpoints public. Authenticated/anonymous reads return the same business envelopes.
- [ ] Document each protected method with ApiBearerAuth plus 401/403 responses, without marking the public reads as secured.
- [ ] Confirm owner/admin deletion still calls the existing business checks; role authorization must not bypass a Pending-entry conflict.

### Step 3 - preserve the error contract

- [ ] Test PantryHttpFilter with shared guard exceptions. Keep `UNAUTHENTICATED` on 401 and `FORBIDDEN` on role/membership 403, with string message and fieldErrors object.
- [ ] Preserve existing structured pantry errors unchanged, including `ITEM_NOT_FOUND`, `INSUFFICIENT_STOCK`, `ITEM_HAS_PENDING_ENTRY`, `INVALID_CATEGORY`, duplicate-name errors and validation field errors.
- [ ] Coordinate shared defaults with Molham's global filter; only you edit PantryHttpFilter.
- [ ] For well-formed unauthenticated writes expect 401 before service mutation; for signed-in wrong-role deletion expect 403; after authorization, existing 400/404/409 semantics still apply.
- [ ] Verify invalid bodies/unknown fields remain rejected for authenticated callers, including arrays, empty PATCH and actor/role injection attempts.

### Step 4 - add useful actor-aware business logs

- [ ] Include verified actorId in successful create/edit/use/delete logs, while preserving existing useful item/quantity fields.
- [ ] For use, include requested quantity and final remaining stock; include starting stock if available without a new read outside the transaction.
- [ ] Keep expected over-use/Pending-deletion warnings and add safe actor context. Do not log tokens, passwords, headers, URI, arbitrary request bodies or unnecessary account email.
- [ ] Emit success only after WriteService resolves/commits. Do not produce a success log inside a transaction callback that can retry or roll back.
- [ ] Expected business warnings should not become repeated success-looking events during a retry. Use stable codes/item IDs and document what is logged.
- [ ] Keep service/DB interfaces compatible with Allith's transaction use; do not add another mutex or bypass the household fence.

### Step 5 - prove auth and business behavior together

- [ ] Add real HTTP tests using Molham's shared fixture helper for anonymous, member, admin and owner cases.
- [ ] Snapshot database state before/after 401/403 requests to prove no item or counter-changing business service call occurred.
- [ ] Test member create/edit/use succeeds; member delete fails; admin and owner delete an eligible item; an admin still gets 409 for Pending-linked deletion.
- [ ] Test missing, malformed, forged and expired tokens through shared guard behavior; at least one actual pantry route must exercise it end to end.
- [ ] Test changed membership role with the same token so permissions cannot come from stale client/JWT claims.
- [ ] Retain concurrency, rollback, decimal stock, duplicate names, invalid references, missing IDs and history-preservation behavior.
- [ ] Dashboard regression: status overlap, expiry ordering, category counts and Pending count after use/generate/purchase. Dashboard reads remain public.
- [ ] Give Molham the exact actor-signature/setup changes needed in old shared suites; do not edit those suites yourself.

## 6. Acceptance checks

| Request/state | Expected result |
| --- | --- |
| Anonymous GET pantry/detail/dashboard | Existing 200 responses |
| Anonymous valid pantry mutation | 401 UNAUTHENTICATED; stock unchanged |
| Signed-in member POST/PATCH/use | Existing 201/200 success and correct data |
| Member DELETE existing item | 403 FORBIDDEN; item remains |
| Admin/owner DELETE eligible item | Empty 204 |
| Admin DELETE item with Pending entry | 409 ITEM_HAS_PENDING_ENTRY |
| Use greater than stock | 400 INSUFFICIENT_STOCK; original stock remains |
| Role removed/demoted after login | Next protected operation reflects current membership |
| Today crosses expiry boundary | Status recomputed correctly without editing the item |
| Combined Dairy + USE SOON + mil | Correct result; literal name matching retained |
| Concurrent use or failed transaction | No lost stock/partial write/success log |

Commands from root after foundation integration:

```powershell
npm --prefix api run build
npm --prefix api test -- --runInBand pantry-auth dashboard-regression
```

Use disposable `byb_test_*` databases on the local replica set and close/drop only your suite's database. Existing foundation tests do not substitute for your pantry security tests. Molham runs the complete suite after integrating all contributions.

## 7. Expected result and delivery

Deliver `codex/tasks2-mostafa` with the permission matrix proved by real HTTP results, safe log samples, unchanged business-response examples, test commands/results and known gaps in your evidence file.

You are done when real guards enforce every pantry write, public reads/dashboard work, role and business errors retain their correct shapes, and the existing transaction/status rules still pass. Explain authentication versus permission versus the Pending-entry business rule in English.
