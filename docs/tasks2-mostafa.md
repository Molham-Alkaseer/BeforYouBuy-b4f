# Mostafa: pantry logging and pre-authentication regression

Prepared 25 October 2026 on `member-mostafa`, starting from `d2501d9`.

## Scope and integration status

The user explicitly chose to stay within Mostafa's files and prepare the work that is possible until Molham's authentication foundation is available. This is a partial delivery of the assignment, not completed authentication or role protection. At this baseline there is no `api/src/auth`, UsersModule, HouseholdMembersModule, JWT dependency or shared auth fixture helper.

Pantry writes still have their existing public behavior. There is no fake authentication, production guard stub or duplicate auth implementation. Controller/module wiring and real HTTP security acceptance remain pending.

The supplied `New folder (2).zip` was inspected directly, without extracting its `.env` or compiled files. Its AuthModule, AuthService, CurrentUser decorator, JWT guard, role decorator/guard and ProjectsController demonstrate the intended NestJS pattern: verified JWT identity followed by a lookup of current membership. Our eventual integration follows the frozen household contract rather than copying workspace/product logic. In particular, missing role metadata must deny access, even though the reference's workspace guard allows it.

## Implemented

- `PantryHttpFilter` maps plain 401 to `UNAUTHENTICATED` and plain 403 to `FORBIDDEN`. Existing structured pantry errors pass through unchanged, with their field errors intact.
- Pantry mutation service methods accept a final optional numeric `actorId` for integration. Existing controller and old-suite calls remain compatible until the real CurrentUser decorator is available. No actor is invented for legacy calls; no actor, user or role is accepted from request bodies.
- Create/edit/use/delete success logs include the supplied actor when available. Use logs include starting stock, requested quantity and final stock, without another database read.
- Success logs remain outside retryable transaction callbacks and occur only when the write boundary resolves. Expected over-use and Pending-deletion warnings also occur outside the callback, once the operation rejects, with stable codes and safe item/actor context.
- Stock, dates, filtering, response envelopes, indexes, shared transaction/ID infrastructure and dashboard source retain their existing behavior.

Safe service-test log examples (fixture actor 42, not evidence of verified HTTP identity):

```text
Pantry item created: id=1, actorId=42
Pantry item updated: id=1, actorId=42
Pantry stock used: id=1, actorId=42, starting=0.3, quantity=0.1, remaining=0.2
Pantry use rejected: code=INSUFFICIENT_STOCK, id=1, actorId=42, available=0.1, requested=0.2
Pantry deletion blocked: code=ITEM_HAS_PENDING_ENTRY, id=1, actorId=42
Pantry item deleted: id=1, actorId=42
```

No tokens, passwords, headers, URIs, request bodies or account emails are added to these logs.

## Verification

The API build passed. The two temporary feature suites passed **21 tests**. The final complete run passed **121 tests in all 9 suites** (100 existing cases plus 21 new cases), in 18.175 seconds, with no skipped tests.

| Command from repository root | Actual result |
| --- | --- |
| `npm --prefix api run build` | PASS, also after final source formatting |
| `npm --prefix api test -- --runInBand pantry-auth dashboard-regression` | PASS: 21 tests, 2 suites |
| `npm --prefix api test -- --runInBand` | PASS: 121 tests, 9 suites, run outside the sandbox |
| `git diff --check` | PASS |

The first complete attempt passed 115 tests but could not load the frontend adapter suite because `client/node_modules/esbuild` was absent. After installing client dependencies from the existing lockfile, the sandbox blocked esbuild's child process with `spawn EPERM`; the complete run outside the sandbox passed all 121 tests without application changes. Dependency installation initially required retrying after automatic approval-review timeouts; it subsequently completed with the user's explicit approval. No dependency manifest or lockfile was modified.

Covered cases: real HTTP public list/detail/dashboard and Swagger reads; combined literal filters; overlapping statuses; Damascus midnight; date-driven status changes without stored updates; decimal/concurrent consumption; rollback on injected transaction failure; one success log after a real driver transaction retry; duplicate names; invalid references and IDs; omitted/null expiry; empty PATCH; arrays; strict numbers; actor/user/role injection rejection without pantry/counter changes; Pending deletion conflicts; Purchased history preservation; dashboard counts after use/generate/purchase; plain 401/403 feature-filter mapping; and legacy service-call compatibility.

All new suites use dedicated `byb_test_mostafa_*` databases and drop/close only their own databases. The MongoDB process for this run was started on previously unused port 27018 using a new `api/.local/mostafa-mongo` data directory. The existing shared suites and package/config files are unchanged. New test source, captured JSON, generated build output and the isolated MongoDB process/data are cleaned after verification as requested; installed dependencies remain available to run the project.

The two new suite files were `api/test/integration/pantry-auth.e2e-spec.ts` (10 pre-foundation HTTP cases, explicitly not JWT/role acceptance) and `dashboard-regression.e2e-spec.ts` (11 service/dashboard/filter cases). They are removed at the user's request, so their commands above record the completed verification session; after cleanup the normal full-suite command runs the 100 existing cases. Real auth/permission acceptance remains pending, regardless of these successful business regression results.

### Captured HTTP baseline

Actual fixture responses used household date `2026-10-24`. `GET /api/pantry` returned this list; the combined `GET /api/pantry?name=mil&categoryId=1&status=USE%20SOON` returned the same complete list. `GET /api/pantry/1` returned its item object directly.

```json
{
  "asOfDate": "2026-10-24",
  "items": [{
    "id": 1, "name": "Milk", "categoryId": 1, "categoryName": "Dairy",
    "quantity": 1, "unit": "litres", "minimumQuantity": 2,
    "expiryDate": "2026-10-26", "statuses": ["LOW STOCK", "USE SOON"],
    "statusReasons": ["1 litres below minimum", "Expires in 2 days"],
    "daysUntilExpiry": 2
  }],
  "total": 1
}
```

`GET /api/dashboard` returned `asOfDate: "2026-10-24"`, `totalItems: 1`, the following counts, and `urgentItems` containing exactly the complete Milk item above:

```json
{
  "statusCounts": { "LOW STOCK": 1, "USE SOON": 1, "EXPIRED": 0, "OK": 0 },
  "pendingShopping": { "total": 0, "linked": 0, "manual": 0 },
  "categoryCounts": [{ "categoryId": 1, "categoryName": "Dairy", "count": 1 }]
}
```

No computed-status field/index was added; the category/expiry query helper and measured-index decision are unchanged.

## Exact handoff after Molham's foundation lands

1. Import real `AuthModule` in `PantryModule` alongside `DatabaseModule`; retain `PantryModule.register(imports)` and its existing providers/exports.
2. Import the exact shared paths in `tasks 2/molham.md`: `auth/guards/jwt-auth.guard`, `auth/guards/household-roles.guard`, `auth/household-roles.decorator`, `auth/current-user.decorator` and `auth/request-user.interface`.
3. On POST pantry, PATCH pantry/:id and POST pantry/:id/use add method-level `@UseGuards(JwtAuthGuard, HouseholdRolesGuard)` followed by `@HouseholdRoles('owner', 'admin', 'member')`. DELETE uses `@HouseholdRoles('owner', 'admin')`. Preserve PantryBodyGuard and all existing validation. GET pantry/detail/dashboard remain public.
4. Add `@CurrentUser() currentUser: RequestUser` to mutation controller methods. Pass `currentUser.sub` as the final service argument: `create(body, sub)`, `update(id, body, sub)`, `use(id, body.quantity, sub)` and `remove(id, sub)`.
5. Make all four service actor arguments required (`actorId: number`) when those callers are integrated. Remove the temporary optional-actor bridge. Old direct service tests must supply the fixture user's ID as the final argument; old HTTP write helpers must send that user's bearer token. Do not send actor/role in request bodies.
6. Add method-level Swagger bearer documentation and 401/403 responses on those four mutation operations only. Verify operation security and standalone feature-module provider resolution.
7. Use Molham's real `api/test/support/auth-fixtures.ts`, real JWT guard and real database memberships for anonymous/member/admin/owner acceptance. Prove 401/403 leave pantry, counters and business mutation calls unchanged; cover malformed/forged/expired/deleted-user tokens, current-role changes with the same token, missing membership, invalid authenticated inputs, eligible admin/owner deletion and Pending-linked 409. Temporary tests from this delivery cannot substitute for those missing tests.
8. Molham owns updates to old shared suites and JWT_SECRET setup/restoration. Keep all existing business assertions and category internal-key behavior. Coordinate the global filter's plain 401/403 defaults with him; only the feature filter was changed here.

## English explanation

Authentication verifies who is calling: a valid, unexpired JWT must identify an existing user. Authorization checks what that user may do using the current household membership in the database. Members can create, edit and use pantry stock; only owners and admins can delete. The Pending-entry rule is a separate business constraint: even an authorized admin receives `409 ITEM_HAS_PENDING_ENTRY` until the Pending shopping entry is removed or purchased. These security checks still require Molham's real foundation before this project enforces them.
