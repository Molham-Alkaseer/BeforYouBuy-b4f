# Before You Buy
Household pantry assistant for managing groceries, expiry dates and shopping lists.

## Current scope
This repository is a **file-structure starter**, not a completed application. React navigation and page placeholders are wired. NestJS bootstrap, MongoDB configuration, validation, Swagger, the exception filter and internal-tool guard are set up. Resource modules, controllers, services, DTOs, schema outlines and seed files mark where the team implements the requirements. Resource endpoints, persistence models, business rules, demo seeding and integration are still TODO.

## Structure
```text
frontend/                     React + TypeScript + Vite (from React/Node class setup)
  src/
    main.tsx, App.tsx          Entry point and routes
    api.ts, types.ts           HTTP helper and proposed response types
    components/               Navigation and loading/error/empty messages
    pages/                    Dashboard, Pantry, ItemForm, ItemDetails, ShoppingList, NotFound
backend/                      NestJS (based on the supplied api folder)
  src/
    main.ts, app.module.ts    Bootstrap, validation, Swagger and MongoDB connection
    common/filters/            Supplied exception filter
    common/guards/             Supplied InternalToolGuard
    categories/               Module, controller, service, dto/, schemas/
    pantry/                   Module, controller, service, dto/, schemas/, status helper
    shopping-list/            Module, controller, service, dto/, schemas/
    dashboard/                Module, controller, service
    database/seed.ts          Demo-data implementation task
  test/                       Acceptance-test plan and Jest e2e config
 docs/api-plan.md             Planned routes and responsibilities
```

## Install and run
Use Node.js 20+ and a local MongoDB instance. Run each app in its own terminal.

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Edit .env and set your local INTERNAL_TOOL_KEY and MongoDB URI.
npm run start:dev
```

Frontend: http://localhost:5173. Backend base: http://localhost:3000/api. Swagger: http://localhost:3000/docs (no resource operations until controllers are implemented).
Vite proxies `/api` to port 3000. Keep the proxy aligned if the backend port changes. Frontend `VITE_API_URL` defaults to `/api`; backend uses `PORT`, `MONGODB_URI`, and `INTERNAL_TOOL_KEY`. Never expose the internal key through Vite variables.

Build each app with `npm run build` from its directory. Frontend lint: `npm run lint`. Backend tests can be run after tests are implemented.

## Data design decisions to implement
- Relationship plan: separate categories, pantry items and shopping entries, linked by numeric application-level IDs. This keeps category names centralized and retains purchase history separately from current stock. Do not use ObjectId references or populate. Schema decorators, model registration and ID allocation are not implemented yet.
- Index decision: pending real measurement. After persistence is implemented, measure a stored-field query such as `find({ categoryId: 1 }).sort({ expiryDate: 1 }).explain('executionStats')`. Record results before deciding whether a compound index is justified, then measure again. Do not claim an improvement without evidence or index calculated status labels.

## Suggested implementation order
1. Category/pantry schemas, validated DTOs, numeric IDs and seed data.
2. Pantry CRUD, use action, combined filters and derived statuses/reasons.
3. Shopping generation, manual entries, purchases, history and deletion rules.
4. Dashboard calculations and Swagger descriptions for all routes.
5. Replace frontend placeholders with forms and API-backed screens.
6. Verify PDF acceptance flows, persistence after restart and index measurements.

No accounts, payments, external services or deployment are included. Category mutation controls belong to internal tooling, not the normal frontend.
