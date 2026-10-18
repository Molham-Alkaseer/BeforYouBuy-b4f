# Shared API client

All household pages import `api` from `src/services/api-client.ts` and wire types
from `src/types.ts`. The 13 method names, arguments, Promise results and error
fields follow `Tasks/apicontract.md`. There is no extra response wrapper.

```ts
import { api, ApiError } from '../services/api-client';

try {
  const result = await api.listPantry({
    name: 'mil', categoryId: 1, status: 'USE SOON',
  });
  console.log(result.items);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.message, error.code, error.fieldErrors);
  }
}
```

## Run locally

From `client`, install dependencies with `npm ci` when needed, then run
`npm run dev`. Copy `.env.example` to an ignored `.env.local` if you need local
settings. Restart Vite after changing environment variables.

- `VITE_API_URL=/api` uses the existing development proxy to localhost:3000.
- `VITE_USE_MOCKS=false` (or absent) uses HTTP. Run the backend for real data.
- `VITE_USE_MOCKS=true` selects shared in-memory data during `npm run dev` only.
- Production builds always use HTTP, even if the mock flag was accidentally set
  to true. The mock module and fixture are excluded from the production bundle.
- `npm run preview` serves the production build; it does not enable the Vite
  development proxy. Provide a same-origin `/api` reverse proxy or set a reachable
  `VITE_API_URL` when building (with backend CORS where necessary).

HTTP failures stay visible; they never trigger a mock fallback. `ApiError`
preserves `message`, `statusCode`, `code` and `fieldErrors`. Network failure has
`statusCode: 0` and `code: 'NETWORK_ERROR'`.

## Development mock checks

The shared mock module is imported once and keeps one in-memory state across
Dashboard, Pantry and other consumers. Browser reload restores the baseline;
this is not MongoDB persistence. The mock calendar is fixed at 2026-10-16.

Development checks may import `resetMockState`, `configureMockSimulation` and
`getMockSimulationConfig` directly from `src/mocks/mock-api.ts`. These helpers
are not household API methods and must not be imported by production pages.

Baseline: 20 pantry items, 7 categories, status counts 5/3/2/12 and Pending 7
(6 linked, 1 manual). Status counts overlap. Combined Dairy + USE SOON + mil
returns Milk. Repeated generation returns 0 added, 0 updated, 6 unchanged.
Buying Milk with quantity 2 and expiry 2026-10-25 updates stock to 3, Pending to
6 and Dashboard counts to 4/2/2/13. Expired Yoghurt requires a new expiry date.
Simulations support latency, empty responses and 404/409/500 errors.

Dashboard and Pantry now use the shared client directly. Rami's temporary
adapter/type copies and both feature-specific connection files were removed.
Run `npm run build` and `npm run lint` before committing. Real backend flows and
persistence still need verification against the team's completed endpoints.

## Short English demo outline

"This dashboard shows pantry totals, overlapping status counts and items to use
first. Generate shopping list reports added, updated and unchanged entries, then
refreshes the dashboard. On Pantry, I combine name, category and status filters.
Only the latest search response can update the table. Loading, empty results and
errors have clear feedback and retry controls. Both pages use the shared API
client; development mocks are explicitly enabled and production uses HTTP."
