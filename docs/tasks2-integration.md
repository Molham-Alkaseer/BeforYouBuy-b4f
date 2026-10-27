# Tasks 2 — integrated delivery

Verified 25 October 2026 on `member-molham`. Implementation commit: `9525a14` (`feat: complete team auth integration and household permissions`). The following documentation commit records these results; use `git log -1 -- docs/tasks2-integration.md` to identify it.

## Reviewed and merged member work

The starting Molham commit was `d7847e1`. A local recovery branch, `codex/pre-tasks2-integration-20261025`, preserves that commit. All five latest remote tips below were fetched, reviewed and merged with merge commits. A second fetch before delivery found no newer member commits. `git merge-base --is-ancestor origin/<branch> HEAD` passed for all five.

| Member | Remote branch / reviewed tip | Merge commit | Contribution retained |
| --- | --- | --- | --- |
| Rami | `member-ramy` / `2482c93` | `cbbb310` | Existing navigation/dashboard/pantry UI, auth navigation and protected add/edit routes |
| Maya | `member-maya` / `db97d63` | `d994647` | Auth forms, item create/edit/details/use/delete, shared status/history components |
| Mohammad | `member-mohamed` / `eee829a` | `39dfd18` | Frontend session/transport scaffolding, mock auth and shopping permission UI |
| Mostafa | `member-mostafa` / `2053550` | `a78bc1c` | Pantry logging and 401/403 error mapping |
| Allith | `member-allaith` / `b0417bd` | `ffd7e40` | Transaction-safe shopping business logs and 12 logging/atomicity tests |

Rami's merge had conflicts in App, Navbar, global CSS, DashboardPage and PantryPage because its ancestry differed from the integration baseline. The actual branch-tip changes were reviewed and its completed UI version was retained, then verified against the integrated session contract. The other four merges applied cleanly. No unresolved conflict markers remain. Member commits and branches were not rewritten or force-pushed.

The member tips did **not** independently implement the entire assignment: Mostafa and Allith were waiting for Molham's auth foundation, Maya's production bridge was disconnected, and Mohammad's transport had contract/session gaps. Those gaps are completed in `9525a14`; the report does not attribute the integration fixes to the original member commits. Allith's evidence mentions a separate auth branch that was not available among the fetched remote branches; equivalent wiring was implemented and tested here rather than claiming to have merged an unavailable commit.

Original member evidence remains historical: [Maya](tasks2-maya.md), [Mohammad](tasks2-mohammad.md), [Mostafa](tasks2-mostafa.md), [Allith](tasks2-allith.md). The six [assignment files](../tasks%202/molham.md) now link to this closure record.

## Molham's completed engineering work

- Added NestJS-10-compatible JWT/bcrypt packages, users and household-membership modules, safe DTOs and account responses, normalized unique emails and persistent numeric IDs.
- Registration hashes outside the retried transaction, then creates the account, household-1 member record and both ID allocations atomically. Duplicate-email races return 409; membership failure rolls everything back. Passwords require at least 8 characters and at most 72 UTF-8 bytes.
- Implemented register/login/me, two-hour HS256 JWT verification, current-user lookup, deleted-account rejection, typed request identity, method role metadata and a guard reading current DB membership. Missing role metadata denies access.
- Wired every pantry/shopping write to verified identity plus the required role. Delete requires owner/admin; other writes permit all household roles. Actor IDs come from the verified request, and domain success logs stay outside retried transactions. Business rules are unchanged.
- Preserved anonymous domain reads and internal-key-only category mutations, with distinct `FORBIDDEN` and `INTERNAL_TOOL_FORBIDDEN` codes. Added operation-specific Swagger bearer documentation.
- Added explicit `auth:set-role` for an existing registered account. It does not create accounts, promote the first registrant or seed data. No production fixture credentials are committed.
- Validated backend JWT configuration, generated a private local secret in ignored `api/.env`, and updated the public placeholder example. No secret was put into the client or committed.
- Connected the actual auth bridge and corrected `accessToken`, `householdRole`, registration name and SafeUser fields. Centralized bearer transport and protected-401 invalidation; login 401 remains a form error and 403 retains the session.
- Added session revision/epoch checks: late 401s cannot clear a newer login, even when both logins receive the same JWT; late restore/login results cannot resurrect logout. Network restoration failure offers retry without pretending credentials were rejected or falling back to mocks.
- Made mock mode explicit and consistent with shared session storage and all write permissions. Live requests never send mock fixture tokens. No mutation is automatically retried.
- Connected shopping sign-in paths, disposed purchase/form state on identity/role changes, focused the purchase quantity field on opening, hid forms while session restoration is checking, and fixed duplicate sibling React keys in item details.
- Updated [API contract v2](../Tasks/apicontract.md), [README](../README.md), [test guide](../api/test/README.md), [client API guide](../client/src/services/API_USAGE.md), and assignment status notes.

## Verification actually run

Commands are from the repository root unless a working directory is stated.

| Check | Result |
| --- | --- |
| `npm --prefix api run db:start` | PASS; local replica set ready on 27018 |
| `npm --prefix api run build` | PASS |
| `npm --prefix api test -- --runInBand` | **177/177 tests, 11/11 suites PASS**, 20.606 seconds on the final full run |
| `npm --prefix client run build` | PASS; TypeScript and Vite production bundle, including the final React-key fix |
| `npm --prefix client run lint` | PASS; zero warnings/errors |
| `node api/scripts/backup-local.cjs` | PASS; private snapshot of 6 collections / 38 documents, BSON round-trip checked |
| `node api/scripts/verify-auth-restart.cjs` | PASS; actual API and isolated MongoDB process restarts, [machine-readable result](tasks2-restart-evidence.json) |
| Compare original development DB with the saved snapshot after upgraded startup | PASS; categories 7, pantry items 20, shopping entries 6 and ID counters 3 unchanged |
| `git diff --check` / staged equivalent | PASS |
| Five member-tip ancestor checks | PASS |

The original 100 cases remain. The additions are Allith's 12 logging tests plus 65 authentication, permissions and session cases. Auth fixtures register/login through HTTP and promote only within disposable `byb_test_*` databases. No real guards are overridden in HTTP acceptance tests. Tests cover all eight original PDF demo behaviors, including overlapping status filters, use/over-use, idempotent generation, normal/expired purchases, Pending/history deletion rules, key-only categories, application restart and committed restock logs. New tests cover the complete write permission table with distinct member/admin/owner fixtures, safe errors, account deletion, live role changes, registration races/rollback, and client session races.

Intermediate failures were resolved before delivery: the sandbox initially blocked Vite/esbuild parent-directory access, so the build was rerun with approved access; a new test helper had a TypeScript `unknown` argument that was narrowed to an object; the restart verifier initially confused signal termination with a numeric exit code, which was fixed and rerun successfully; the browser revealed a duplicate React key, which was fixed and rechecked. The full tests passed before the final React-key-only change; its affected client build, lint and browser path were checked afterward. A later test-description edit only clarifies category-tool wording.

## Browser walkthrough

Used the real Vite client and API with a disposable `byb_test_ui_tasks2` database. The walkthrough did not change the user's inventory.

| Path or flow | Observed result |
| --- | --- |
| `/` as guest | Existing dashboard counts, urgency and category UI visible |
| Add item as guest | `/login?returnTo=%2Fpantry%2Fnew` |
| Register -> sign in | Safe success message; registration does not sign in automatically; email carried to login without password |
| Keyboard Enter on sign-in | Authenticated and returned to `/pantry/new` |
| Add `Browser check rice` | Saved through HTTP; details showed 2 bags, minimum 3, LOW STOCK |
| Record use of 1 bag | Stock became 1; success feedback shown |
| Shopping empty -> generate | Seven suggestions, including the test item; member sees no removal controls |
| Open purchase | Quantity field received keyboard focus |
| Purchase 2 bags | Pending entry moved to Purchased history; item became 3 bags / OK with a 2-bag history snapshot |
| Reload | Current account restored through `/auth/me` |
| Explicit CLI promotion of disposable account -> reload | Admin role and delete/remove controls appeared |
| Open purchase -> logout | Purchase/manual/remove controls disappeared; public lists/history remained available |
| Guest purchase sign-in button | Navigated to login with `/shopping-list` as return path |
| Mobile viewport 390×844 | Shopping and item details readable; document content width equaled viewport width (375 CSS pixels excluding scrollbar), no page overflow |
| Desktop viewport 1280×900 | Item information, use form and history arranged correctly |
| Console after React-key fix | No new warning/error entries in the rechecked sign-in/item-details flow |

The screenshot is local at `api/.local/tasks2-browser.png` (ignored test evidence). Temporary viewport overrides were reset. The disposable UI DB was removed after the walkthrough; the upgraded API was then started with the original development database. A private backup remains under `api/.local/backups/before-tasks2-1792957041921.ejson`; do not commit it because backups can contain account data. The original development records were compared with this backup and preserved.

The restart verifier starts its own MongoDB on free localhost ports with a unique ignored data directory. It verifies the owned path before shutdown and leaves the shared 27018 instance and Windows service untouched. It exercises the explicit role CLI, checks the original JWT after restart, compares stored records/counters, and confirms an admin deletion retains the Purchased snapshot.

## Remaining limits and team handoff

- `npm audit` in `api/` currently reports **26 advisories: 3 low, 14 moderate, 9 high, 0 critical**. These are not build/test failures, and this delivery is not a claim of zero vulnerabilities. The audit proposes major NestJS/Swagger upgrades for several findings; a coordinated dependency/security upgrade remains separate from this NestJS-10-compatible B4F integration. No `npm audit fix --force` or unrelated framework migration was applied.
- This is the specified shared-household demo. There is no per-user tenancy, token revocation, refresh-token flow, password recovery or public role editor. A role changed in the DB is enforced immediately on the next write; refresh the page to update displayed controls.
- Mock accounts/data are development fixtures in memory, not a production authentication system. New mock registrations and inventory edits reset on reload.
- UI verification sampled real flows and two viewport sizes. It is not a complete accessibility audit, every browser/device combination, or proof of every member's individual loading/error/keyboard demonstration.
- Each member still owns their English presentation and personal sign-off. No team meeting or individual demo is claimed. Suggested order: Molham foundation/permissions, Rami navigation, Maya items, Mohammad transport/shopping UI, Mostafa pantry/dashboard, Allith transactions/logs.

For a live demo, register a local account first, then explicitly promote that registered email if needed using the README command. Keep the internal category key in backend tooling. No credentials need to be sent to teammates or published with the code.
