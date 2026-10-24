# Backend integration results

Verified 17 October 2026, Asia/Damascus.

## Contributions

- Molham baseline: member-molham at 7967633.
- Allaith: origin/member-allaith at 269413b, already merged into the existing integration branch by 1f615b4.
- Mustafa: origin/member-mostafa at 442bde4, merged during this integration.

The histories are preserved. Integration work is performed on codex/backend-integration and promoted to member-molham after passing checks.

## Issues corrected

1. Replaced shopping service in-memory mock arrays with registered MongoDB models.
2. Added missing normalizedName/newExpiryDate persistence and Pending-only uniqueness indexes.
3. Bound Mustafa's clock, ID and write aliases to Molham's actual shared providers.
4. Imported DatabaseModule in pantry, dashboard and shopping modules; registered all owner schemas.
5. Fixed POST /shopping-list (manual entry), 200 action responses, full generation/purchase envelopes, ordering, asOfDate and Pending summary behavior.
6. Fixed shopping validation: wrong-type names, tiny positive quantities, real calendar dates, null handling, duplicate scalar query parameters and unknown fields.
7. Ensured generation conflicts roll back all prior changes and purchases commit stock/history together.
8. Preserved historical snapshots after edits/deletion; prevented double restocking.
9. Replaced empty pantry/dashboard DTO bindings with explicit no-field validation compatible with the strict global pipe.
10. Added body-object guards and fail-safe handling when the shared write fence is absent.

## Verification

| Check | Result |
| --- | --- |
| API build | PASS |
| Full suite | PASS: 94 tests, 6 suites |
| Client build | PASS |
| Client lint | PASS |
| MongoDB integration | Real local replica set; disposable databases |
| Index exercise | Actual pantryStoredQuery measured before/candidate/after final decision |
| Application restart | Purchased history, stock and manual entries preserved |
| Original database restart evidence | Retained in restart-evidence.json |

The first combined build exposed the old shopping JSON mock import. The initial test attempt found the local replica set stopped; it was started with db:start. A category race fixture also needed a unique normalized name once Mustafa's real pantry index was registered. Those failures were corrected before the final successful run.

## PDF section 17 backend acceptance

| # | Behavior | Evidence |
| --- | --- | --- |
| 1 | Quantity 1/minimum 2/expiry +2 days shows LOW STOCK + USE SOON | Integrated HTTP test |
| 2 | Excess use rejected with a clear message | Integrated HTTP test; unchanged quantity |
| 3 | Repeated generation gives correct quantities without duplicates | HTTP tests and concurrent generation |
| 4 | Normal purchase adds; expired purchase requires date and replaces stock | HTTP tests; failure rollback |
| 5 | Item deletion blocked by Pending entry | HTTP test; history survives allowed deletion |
| 6 | Category creation rejects absent key and succeeds with key | HTTP test plus Swagger definition |
| 7 | Backend restart retains data | Application closed/recreated; stock, history and manual entry checked |
| 8 | Restock business log appears | Logger assertion includes entry, item, quantity and resulting stock |

These checks verify backend behavior. The team still needs to perform the live visual walkthrough with the finished frontend and have every member present in English.

## Additional boundary and race coverage

- AND-combined pantry filters; literal regex-character search; empty results for valid nonexistent filters.
- Dashboard overlapping status counts, urgency order, Pending totals and zero-count categories.
- Invalid input types/dates/IDs, extra fields, empty PATCH, body arrays and repeated query keys.
- Duplicate names, immutable Purchased history, missing linked items, manual expiry rejection.
- Normal purchase preserves omitted expiry; snapshots preserve current name/unit/expiry.
- Ineligible Pending suggestions are retained; eligible ones refresh name/unit/quantity.
- Generation name conflicts roll back earlier inserts.
- Injected history persistence failure rolls back the stock update.
- Concurrent purchases restock once; concurrent uses cannot consume the same stock twice.
- Use/purchase overlap preserves both changes.
- Manual-entry/generation overlap preserves Pending uniqueness.
- Deletion/generation overlap cannot leave an orphaned Pending link.
- Missing write fence prevents mutations.

## Index evidence

The script now imports the production pantryStoredQuery helper. For category 1 + USE SOON on the seed:
- Before: 0 keys, 20 documents, 0 ms.
- Candidate categoryId/expiryDate/id index: 1 key, 1 document, 18 ms.
- After deciding not to retain it for the tiny workload: 0 keys, 20 documents, 0 ms.

One row matched each time. No speedup claim is made. Correctness indexes remain. See index-evidence.json for complete plans.

## Remaining scope

Frontend branches were not merged in this backend task. The starter client builds/lints, but real screen-to-API behavior and visual error states still require frontend integration. Team presentation is also outstanding. The three backend contributions and their actual cross-domain behavior are now integrated and verified.
