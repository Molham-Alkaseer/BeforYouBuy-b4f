# Allaith — Backend shopping list, purchase history and restocking

## Deliverable and owned files

Implement duplicate-free generation, manual entries, purchases and persistent history. Own `api/src/shopping-list/**` and feature tests there or `api/test/shopping-list/**`. Export ShoppingEntrySchema for Molham's DatabaseModule. Do not edit pantry/category/common infrastructure or import PantryService into ShoppingListService.

## Required work

1. Implement list/generate/manual-add/purchase/delete endpoints in [apicontract.md](apicontract.md), strict DTOs, errors and Swagger. GET status/pantryItemId filters combine; Pending sort createdAt ascending then id; Purchased sort purchasedAt descending then id. pendingSummary describes all Pending entries regardless of filters.
2. Schema uses numeric id/pantryItemId, normalized name, name/unit snapshots, quantityToBuy, status, timestamps and purchase snapshots. Compute pantryStatuses for pending linked entries; do not store them. Keep history after pantry deletion.
3. Generate for LOW STOCK or EXPIRED, using max(1, minimumQuantity - effectiveQuantity), with expired effective stock zero. At most one Pending per pantry item. Update existing eligible suggestions, count identical ones unchanged, preserve manual/history. Return actual counts and refreshed Pending response.
4. Follow collision and no-longer-eligible behavior in contract. Enforce normalized Pending name uniqueness, including manual entries. Generation must not silently link a colliding manual record; preflight and fail without partial changes. Repeated/concurrent calls cannot duplicate entries.
5. Manual add accepts only trimmed name/positive finite quantityToBuy; no pantryItemId or unit. Duplicate Pending name -> 409. Never create pantry stock.
6. Purchase only once, positive purchasedQuantity. Normal linked purchase adds stock and optionally replaces expiry. Expired purchase requires a new date and replaces stock with bought amount. Record entry/purchase snapshots only after success. Manual purchase only changes entry.
7. Coordinate one failure-safe write operation with Molham: stock and entry must agree if a write fails or requests overlap. Do not deliver two unprotected saves. Test repeated/concurrent purchase and purchase/use interactions. Local unit tests can mock the agreed write boundary while infrastructure is being wired.
8. Delete Pending -> 204; missing -> 404; Purchased -> 409. Removed Pending entries unlock pantry deletion. Item history filter must work even if the item was later deleted.
9. Log generation counts and successful restock including before/after quantities and expired replacement, plus significant rejected business operations. No secrets in logs.

## Start independently

Use fake ShoppingEntry/PantryItem models, fixed ClockService, fake IdsService and a stub matching Mustafa's pure status helper. Fixtures supply expected results. You do not need another service implementation; Molham connects shared models/write mechanism later.

## Acceptance checklist

- [ ] Empty pending state generates 6 linked entries; repeat adds 0. Provided fixture repeat returns 0 added/0 updated/6 unchanged and keeps 7 Pending.
- [ ] Yoghurt suggestion 3, Lentils 1, Olive oil 1; expired item with minimum 0 still suggests 1.
- [ ] Manual ` milk ` conflicts; buying a manual entry changes no pantry item.
- [ ] Milk +2 -> 3; expired Yoghurt without date fails; quantity 3/date 2026-10-25 -> exactly 3, OK.
- [ ] Repeat purchase -> 409; overlapping/failed writes never double-restock or lose quantities.
- [ ] Item history and deletion rules work; purchased snapshots survive pantry deletion.
- [ ] Swagger/logs/build/tests complete, including concurrency, generation collision and missing-item errors.

Submit HTTP examples, commands/results, remaining gaps and a short English demo. Fix your own integration failures and request shared changes from the owner.
