# Team work plan

Start with [apicontract.md](apicontract.md), then your assignment. These documents assign implementation work; the current app is a scaffold. Actual project folders are `client/` and `api/`.

| Member | Ownership | Assignment |
| --- | --- | --- |
| Rami | Frontend layout, dashboard, pantry list | [rami.md](rami.md) |
| Maya | Frontend add/edit form, item details and use action | [maya.md](maya.md) |
| Mohammad | Frontend shopping list, shared API/types and mocks | [mohammad.md](mohammad.md) |
| Molham | Backend categories, infrastructure, seed and integration | [molham.md](molham.md) |
| Mustafa | Backend pantry rules, statuses and dashboard | [mustafa.md](mustafa.md) |
| Allaith | Backend shopping list, purchases, restocking and history | [allaith.md](allaith.md) |

## Start all six assignments in parallel

1. Freeze contract v1 in this folder. All endpoint names, payloads and mock responses below are agreed targets, not currently implemented routes.
2. Frontend members use [mock-data.json](mock-data.json) and the exact transport signatures in the contract. Until Mohammad's adapter lands, use a local stub inside your own feature/test directory with those signatures. Do not wait for a backend or shared UI component.
3. Backend members test their services using fake Mongoose model providers, fixed clock and fake ID provider. Molham wires shared model registration later. No domain service imports another domain service, avoiding circular dependencies.
4. Each shared file has one owner. Request changes from that owner through PR notes instead of editing competing versions. Local stubs are temporary test/development tools, never production data providers.
5. Suggested branches: `codex/rami-ui`, `codex/maya-items`, `codex/mohammad-shopping`, `codex/molham-foundation`, `codex/mustafa-pantry`, `codex/allaith-shopping-api`. Everyone works from the same baseline and submits a focused PR.
6. Contract changes require Molham's coordination with affected owners. Update contract, fixtures and callers together. Do not silently rename a field or enum.

Independent implementation is possible; final integration still needs all six contributions tested together. Mock providers remove waiting, not the need for integration.

## Shared frontend ownership and interfaces

- Pages default-export React components with no required props. Existing routes remain `/`, `/pantry`, `/pantry/new`, `/pantry/:id`, `/pantry/:id/edit`, `/shopping-list`.
- Rami owns `App.tsx`, `main.tsx`, `index.css`, `Navbar.tsx`, `NotFoundPage.tsx`, client configuration/dependencies and existing `LoadingMessage`, `ErrorMessage`, `EmptyState`. Message props: `{ message: string }`.
- Rami adds `components/StatusBadge.tsx` with `{ status: PantryStatus }`, and `components/PurchaseHistoryTable.tsx` with `{ entries: ShoppingEntry[]; showItemName?: boolean }`. Until ready, use plain text/local test fallbacks in your own feature. Pages must not render a second sidebar.
- Mohammad owns `api.ts`, `types.ts`, `services/api-client.ts`, `services/http-api.ts`, `mocks/**`, and `client/.env.example`. Import the shared `api` object from `services/api-client` once available.
- Feature CSS: `dashboard-*`, `pantry-*` (Rami), `item-*` (Maya), `shopping-*` (Mohammad). Global CSS variables start `--byb-`. Approximate template palette: background `#faf8f2`, sidebar `#f1ecde`, primary `#2f7056`, text `#223129`, border `#e7e0d4`. White rounded panels; yellow/orange/red/green status badges. Use responsive layouts and visible keyboard focus.
- Molham owns API package/config changes. Rami owns client package/config changes. Avoid unrelated dependency/lockfile changes.

## Visual references

The supplied images map to: 1 item details (Maya), 2 add/edit item (Maya), 3 pantry (Rami), 4 dashboard (Rami), 5 shopping list (Mohammad). Follow their layout, hierarchy and alternate error states.

Image 1's normal available amount of 1 and error showing 0 are different moments: after use, update available stock before showing the next failed use. Do not show contradictory states simultaneously. The images show different history selections; use the unified fixture history rather than reproducing inconsistent row counts.

## Milestones and delivery rules

1. Everyone: first deliver owned files and isolated demo/tests against the contract. Rami, Mohammad and Molham publish shared foundations in small early PRs; others continue with stubs.
2. Everyone: finish owned behavior, errors/loading/empty states or business-rule tests, and Swagger for owned endpoints.
3. Molham integrates model registrations/modules and seed. Mohammad switches to live transport. Each owner verifies and fixes their own part against the real API/database.
4. Final gate: client/API builds, client lint, backend tests, the eight PDF demo flows, combined filters, error cases, restart persistence, business logs and real index measurements. Molham records results and unresolved gaps.

Each PR must include changed files, screenshots or HTTP examples, test commands/results, known gaps and a short English explanation for the presentation. Every member presents their own contribution.

## Scope

This contract supersedes the earlier `docs/api-plan.md` where ambiguous. Existing `client/src/types.ts` is an outline; Mohammad updates it to contract v1. No accounts, payments, pagination, aggregation pipelines, ObjectId relationships, external services or deployment. Category mutations are internal tooling only, not normal frontend controls.
