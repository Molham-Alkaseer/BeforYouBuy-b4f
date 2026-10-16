# Mohammad — Frontend shopping list and API/mock layer

## Deliverable and owned files

Implement image 5 and a shared transport that works in mock/live modes. Own `client/src/pages/ShoppingListPage.tsx`, `features/shopping/**`, `api.ts`, `types.ts`, new `services/api-client.ts`, `services/http-api.ts`, `mocks/**`, and `client/.env.example`. Rami owns routes/global styles/dependencies; Maya owns item screens. Do not edit their files.

## Required work

1. First publish types and exported `api` object with every method in [apicontract.md](apicontract.md). Preserve existing request helper compatibility where needed. Base `/api`. ApiError preserves statusCode, code, message, fieldErrors. Handle 204 without JSON parsing; never send internal-tool key.
2. Select mock adapter only when `VITE_USE_MOCKS=true`, default false. Both adapters return identical Promise types. Deep-clone [mock-data.json](mock-data.json) into mutable state; provide reset. Never silently fall back to mocks when real API calls fail.
3. Mock filters and mutations according to contract, including state changes across pantry/shopping/history/dashboard. Return copies. Fixed clock 2026-10-16; simulate latency and explicit empty/404/409/500 states. Keep simulation in mocks, not page components or production backend.
4. Shopping loads Pending and Purchased lists. Show summary, source/manual badge, suggested quantity/unit, current linked pantryStatuses and created date.
5. Generate displays added/updated/unchanged and reloads lists. Repeated generation cannot add duplicates. Disable relevant actions while submitting.
6. Manual form sends only name and quantityToBuy, retains values on failure, and shows duplicate errors. It never creates pantry items.
7. Purchase panel selects a Pending entry. Require positive purchasedQuantity. Linked entries may supply a date; expired linked entries require one and explain replacement of old stock. Manual entries have no expiry control. Errors stay inline; success closes panel and refreshes lists.
8. Remove Pending with confirmation and refresh. Purchased entries have no remove/purchase action. History displays purchasedQuantity, not quantityToBuy. Use shared history component if its columns fit; a shopping-local table is also allowed.
9. Give teammates an import/await/error-handling example. Verify live adapter method mappings with backend owners once available.

## Start independently

Your fixtures are provided now; no backend is needed. Publish types/interface first in a small PR, then mock/live adapters, then the shopping UI. Rami and Maya use local contract-compatible stubs until your adapter is ready. You do not implement their page behavior.

## Acceptance checklist

- [ ] Every contract method exists in both adapters; switching modes changes no page code.
- [ ] Initial snapshot has 7 Pending and 6 Purchased; Lentils and Olive oil suggestions are each 1.
- [ ] Repeat generation returns added 0, updated 0, unchanged 6 and keeps 7 Pending.
- [ ] Manual ` milk ` conflicts; manual purchase changes no pantry stock.
- [ ] Buy Milk 2/date 2026-10-25 -> stock 3, OK, purchased history entry.
- [ ] Expired Yoghurt without date -> 400; quantity 3/date 2026-10-25 -> stock exactly 3, OK; repeat purchase -> 409.
- [ ] Loading/errors/empty/keyboard/mobile states work; network failures never display fake success.
- [ ] Client build/lint pass; include mock mutation checks and live integration results.

Submit screenshots, test commands/results, any gaps and a short English demo. Fix your own integration failures; request shared-file changes from their owner.
