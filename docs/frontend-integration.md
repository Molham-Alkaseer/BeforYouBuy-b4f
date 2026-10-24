# Frontend integration verification

Maya's item pages now use Mohamad's shared API client and contract types. Live HTTP is the default; `VITE_USE_MOCKS=true` selects the same mock state for both item and shopping pages. The old item stub is no longer imported by the application.

## Repeatable checks

Install dependencies in both `client` and `api`, then run:

```powershell
cd client
npm run build
npm run lint
cd ../api
npm run db:start
npm test -- --runInBand
```

The frontend-client integration suite bundles the actual frontend modules using the client's installed esbuild. It starts NestJS on an ephemeral local port, uses a dedicated `byb_test_frontend_<process id>` MongoDB database, and drops that test database afterward. It does not use the normal application database.

Coverage includes shared adapter identity, MongoDB persistence, item creation/edit/use/deletion, fractional stock, 204 responses, 404 errors, shopping generation without duplicates, pending deletion conflicts, purchase history, repeat-purchase conflicts, expired-stock replacement and required expiry, manual purchases, small positive quantities, structured validation errors, network errors without mock fallback, and explicitly enabled shared mock state.

## Browser verification — 17 October 2026

Used a separate local test database and the real Vite-to-Nest proxy. Created an item with 1 boxes, used 0.001, reloaded and confirmed 0.999 remained. Generated its shopping entry, purchased 2 boxes, and confirmed the item showed 2.999 boxes and a history entry for 2 boxes. The shopping form rejected zero while retaining inputs, then accepted 0.0001 after correction.

This verifies the integrated item/shopping path. Rami's pending dashboard/pantry work and a complete application acceptance pass remain separate follow-up work.
