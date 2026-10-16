# Maya — Frontend item form and item details

## Deliverable and owned files

Implement images 1 and 2. Own `client/src/pages/ItemFormPage.tsx`, `ItemDetailsPage.tsx` and `client/src/features/items/**` (controls, panels, local styles/tests). Do not edit routes, global CSS, shared API/types/mocks or backend. Use Rami's shared badges/history/messages when available; temporary local test fallbacks let you start immediately.

## Required work

1. One form supports new `/pantry/new` and edit `/pantry/:id/edit`. Load categories for both; preload item in edit mode. An empty category list disables save with a clear message; no category-creation UI.
2. Fields: trimmed name, category, quantity, unit, minimumQuantity and optional expiry. Permit decimals; reject blank, negative or non-finite quantities. Require name/category/unit. Unit can be free text or editable suggestions; do not lose existing units.
3. Explain status rules in the side panel, but never submit or authoritatively calculate statuses. Send numbers, not numeric strings. Blank expiry is null; PATCH omission preserves the date, explicit null clears it.
4. Submit with `createPantryItem` or `updatePantryItem`; disable repeat submit and retain inputs on failure. Show summary and fieldErrors beside controls. Duplicate-name 409 highlights name; invalid quantity highlights quantity. The template's combined errors do not require detecting every database conflict in one invalid request.
5. Save navigates to returned item details. Cancel new returns pantry; cancel edit returns details. Validate route IDs. Details loads `getPantryItem(id)` plus `listShoppingEntries({status:'Purchased',pantryItemId:id})`.
6. Show all item data, statuses, reasons and daysUntilExpiry from the API. History uses purchased quantity/date/newExpiryDate snapshots. No expiry and empty history are valid states.
7. Use form posts `{quantity}` through `usePantryItem`. Require >0; show current available stock. On success replace displayed item with response and clear/revalidate input. Milk 1 -> use 1 -> 0; next use 1 must fail without changing stock.
8. Delete uses a confirmation; cancel sends no request. On 204 navigate to pantry. On pending-entry 409 stay on details and show the explanatory red banner and shopping-list link.
9. Handle loading, 404, error/retry, empty history, keyboard and mobile. Do not display example errors before an actual failure.

## Start independently

Use Milk 1, Yoghurt 2, Rice 13, categories/history and contract mutation/error examples. Locally stub `listCategories`, `getPantryItem`, `createPantryItem`, `updatePantryItem`, `usePantryItem`, `deletePantryItem`, `listShoppingEntries` in your feature tests. Follow [apicontract.md](apicontract.md) so the shared adapter replaces stubs unchanged.

## Acceptance checklist

- [ ] New/edit share one form; successful save opens the correct details.
- [ ] Duplicate name, missing/negative quantity, invalid category and server failure are visible with preserved input.
- [ ] Expiry clearing sends null; no derived fields are submitted.
- [ ] Milk shows two reasons and its three fixture history records.
- [ ] Use 1 changes availability to 0; over-use reports stock and does not fake success.
- [ ] Pending deletion blocked visibly; successful deletion returns pantry.
- [ ] Loading/404/error/empty/keyboard/mobile states work; client build/lint pass.

Submit a focused PR with screenshots, commands/results and a short English demo. Fix your own integration failures; coordinate shared-file changes through their owner.
