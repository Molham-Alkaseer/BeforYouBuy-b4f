# Molham — Team lead, backend foundation, categories and seed

## Deliverable and owned files

Provide working category endpoints, shared NestJS/MongoDB infrastructure and demo seed, then integrate the team contributions. Own `api/src/main.ts`, `app.module.ts`, `common/**`, `database/**`, `categories/**`, API package/config/env, shared tests under `api/test/integration/**`, root README, `docs/**`, and contract/fixtures in Tasks. Do not edit teammates' pantry/shopping schemas or logic; request changes from their owners.

## Required implementation

1. Configure `/api`, Swagger `/docs`, MongoDB, strict body AND query DTO validation, unknown-field rejection, numeric ID parsing and normalized contract errors including fieldErrors. Log meaningful events/internal errors without exposing secrets.
2. Implement public GET categories and guarded POST/PATCH/DELETE categories. Document x-internal-tool-key in Swagger on mutations only. Validate trimmed names; duplicate normalized name -> 409, missing category -> 404, category used by a pantry item -> 409 on delete.
3. Build DatabaseModule registering/exporting Category, PantryItem and ShoppingEntry models using each owner's schema. It imports schema files, not domain service modules. Domains import DatabaseModule and inject models; no circular domain service imports. Mock model providers allow others to start before this is ready.
4. Supply ClockService and IdsService from the contract. IDs are positive application-level numbers, never reused after deletion, safely allocated under concurrent creation. No populate, aggregation pipelines or ObjectId relationships.
5. Coordinate a failure-safe shared write mechanism with Allaith/Mustafa for purchase, use, generate and guarded deletes. Choose and document the actual MongoDB write strategy and local setup. Do not approve unprotected stock-save then entry-save as a completed purchase implementation. This integration decision must not block isolated feature tests.
6. Seed only an empty application database with at least fixture's 7 categories and 20 items, using relative expiry offsets from the current clock, not hard-coded October 2026 dates. Ensure >=3 LOW STOCK, >=3 USE SOON, >=2 EXPIRED, several OK. Do not overwrite or duplicate existing data on restart. Handle partial seed failure and initialize ID allocation above seeded IDs.
7. Optionally seed fixture shopping/history for demo. Historical purchases are snapshots; never replay them into the already-seeded quantities. Store no computed pantry statuses/reasons/dashboard totals.
8. README: correct client/api paths, installation, run commands, env, DB requirements, guard usage, mock mode, date policy, numeric IDs, write consistency and relationship decision (separate collections linked numerically; historical snapshots survive item deletion).
9. Work with Mustafa's actual stored category+expiry query. Run explain('executionStats') before deciding on an index; measure after the decision and record keys/docs examined and execution time honestly. Do not fabricate a speedup or index computed status labels. Correctness indexes for unique IDs/names are separate from this performance exercise.

## Lead and integration responsibilities

- Keep [apicontract.md](apicontract.md) v1 stable; coordinate necessary changes with both affected owners and update fixtures/callers together.
- Merge model schemas/shared registration and domains; wire seed after registrations. Mohammad switches to live mode, and each screen owner verifies their pages against it.
- Record all PDF section 17 demo tests, combined filters, errors, business logs, DB restart persistence and index evidence. Each owner fixes their own failed feature; do not take over all implementation.
- Ensure every member contributes meaningful code and presents their own part in English.

## Start independently

Use a fake PantryItem model for category-use checks and fixture shapes for seed preparation. Domain services are not needed to implement your categories/infrastructure. Your deliverable includes working code, not only coordination.

## Acceptance checklist

- [ ] Public category GET works without key; mutations fail 403 with absent/wrong key and succeed with valid key.
- [ ] Used Dairy deletion -> 409; unused category deletion -> 204; blank/duplicate category rejected.
- [ ] Unknown body/query keys -> 400; errors have the stable envelope.
- [ ] Empty DB gets valid data; restart preserves edits and does not reseed.
- [ ] Numeric IDs remain unique under concurrent creates; chosen write mechanism is tested with domain owners.
- [ ] API build/tests pass; README includes actual index measurements and reproducible integration results.

Submit a focused PR with HTTP examples, test results, remaining gaps and a short English demo.
