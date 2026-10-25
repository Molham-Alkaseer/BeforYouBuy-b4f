# Private households and family access — 26 October 2026

This update implements the user's revised policy and supersedes the public-read, single-household, member-write policy in the historical tasks 2 assignments. The original behavior was intentional in that contract: public UI routes, unauthenticated domain reads, registration into household 1 and globally queried inventory.

## Current behavior

- Public registration creates an **admin** in a distinct, empty household. It never joins the legacy demo household.
- An admin opens **Family members** (`/family`) and creates accounts using name, unused email and password. These accounts are always **members** in that admin's household. Creating a member keeps the admin signed in. No invitation email is sent; the admin shares sign-in details directly.
- A member can view the household's dashboard, pantry, shopping list and purchased history. Members cannot create, edit, use stock, generate shopping entries, purchase or delete, or manage family accounts. Existing `owner` accounts retain admin-level access.
- All private pages redirect anonymous users to sign-in with a safe return path. Add/edit/family routes also check admin access. Private page state is remounted when account, household or role changes, including logout.
- The API authenticates private reads as well as writes. Household IDs and roles come from current database membership, never client bodies, queries, headers or JWT tenant/role claims. Cross-household item/entry IDs produce 404.
- Every pantry/shopping lookup, aggregate count, duplicate-name check, generation and mutation uses that household's ID. Purchase updates a linked pantry item only in the same household. Admin permission does not bypass stock limits, Pending-entry conflicts or immutable purchase history.
- The category catalog remains shared and publicly readable. Category mutations remain backend internal tooling, as before.
- Explicit mock mode follows the same household and role policy. Only its three built-in demo accounts share demo household 1; new mock admins start empty. Mock accounts and data reset on reload.

## Accounts and data migration

Accounts have one membership each, enforced by a unique `userId` index. New household IDs are allocated persistently inside the same transaction as registration, with household 1 reserved. A family account and its membership also commit atomically. Duplicate emails return 409 rather than moving an existing account between households. Passwords retain bcrypt validation/hashing; responses never include credentials or hashes.

At API startup, after schema initialization, `migrateLegacyHousehold`:

1. Assigns only pantry/shopping records missing `householdId` to household 1.
2. Ensures unique `(householdId, normalizedName)` indexes for pantry and Pending shopping names.
3. Removes only the obsolete single-field unique normalized-name indexes after their replacement exists.

The operation is idempotent and preserves stock, history, IDs, categories, existing household assignments and account roles. It does not infer ownership of previously shared data. Existing members stay read-only in their previous household. To promote a known existing account explicitly, run from `api/`:

```powershell
npm run build
npm run auth:set-role -- registered-email@example.com admin
```

New registrations do not require this command. Legacy household 1 remains available to its existing accounts; new admins do not receive its seeded items. The original global transaction fence remains shared across households to preserve cross-collection atomicity. It serializes writes across households; this update does not introduce a new mutex or weaken transaction guarantees.

## Verification

`household-isolation.e2e-spec.ts` exercises the real API, real JWT guards and disposable MongoDB databases: independent concurrent signups, admin-created family accounts, member reads, all denied member mutations with unchanged data/counters, cross-household IDs, duplicate names across households, scoped filters/dashboard/generation/purchase/history, expiry/forged tokens, current membership, role/household injection, rollback and repeatable legacy migration.

The existing business, authentication, permission, logging and adapter suites were updated to use explicit household context and the new permission policy. Their shared regression fixtures deliberately join demo household 1; the isolation suite uses actual public registration and family-account creation without that fixture shortcut. Mock/session coverage additionally checks separate households, family reads and denied writes after switching accounts.

Verified on 26 October 2026 (Asia/Damascus):

| Check | Result |
| --- | --- |
| `npm --prefix api run build` | PASS |
| `npm --prefix api test -- --runInBand` | PASS: 185 tests, 12 suites |
| `npm --prefix client run build` | PASS |
| `npm --prefix client run lint` | PASS |
| `node api/scripts/verify-auth-restart.cjs` with installed MongoDB 8.2 | PASS |

Restart details are in [household-restart-evidence.json](household-restart-evidence.json). The restart verifier starts/stops only its own API and MongoDB children, checks persistence and current-role enforcement with the same token, and leaves the shared database on port 27018 running.

Direct browser interaction was unavailable in this session (no browser exposed; the in-app browser returned unavailable). Therefore no new visual walkthrough, responsive-layout or keyboard-interaction result is claimed. The previous tasks 2 browser evidence describes the previous version. Live HTTP and bundled client/mock tests cover the behavior described above.

Local verification initially required installing missing API dependencies (`@nestjs/jwt`/`bcrypt`) and locating the installed MongoDB 8.2 executable. The MongoDB startup script now discovers PATH/installed versions instead of assuming 8.0. Vite/esbuild and the isolated CLI restart verification required execution outside the process-spawn sandbox. Verification did not run against or rewrite the user's development database.
