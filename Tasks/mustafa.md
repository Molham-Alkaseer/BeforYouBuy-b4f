# Mustafa — Backend pantry, statuses and dashboard

## Deliverable and owned files

Implement real MongoDB-backed pantry operations and dashboard. Own `api/src/pantry/**`, `api/src/dashboard/**`, and feature tests in those directories or `api/test/pantry/**`, `api/test/dashboard/**`. Molham owns common/database/category files; Allaith owns shopping. Export your schema/status helper with agreed names; do not duplicate others' schemas.

## Required work

1. Implement every pantry route in [apicontract.md](apicontract.md), Swagger summaries/properties, body/query DTOs and numeric IDs. Strip _id/__v in responses. Reject invalid real dates, unknown fields, blank names/units, invalid categories and non-finite/negative amounts. Enforce normalized name uniqueness on create/edit.
2. Schema stores raw fields only: numeric id/categoryId, name/normalizedName, quantities/unit and date-only expiry/null. Export PantryItemSchema for shared registration. No stored statuses/reasons or ObjectId relationship.
3. Export pure `calculatePantryStatus(item,today)` with the contract signature. LOW STOCK quantity < minimum; EXPIRED expiry < today; USE SOON today through +3 inclusive; OK only if no other status. LOW STOCK can overlap. EXPIRED/USE SOON cannot. Return reasons and daysUntilExpiry/null. Get today's date per operation, never once at startup.
4. List combines literal case-insensitive partial name, categoryId and computed status. Escape regex special characters. Filter stored fields first, derive current statuses then status-filter in application code. No aggregation/pagination. Return categoryName, total and asOfDate.
5. Create/edit return enriched PantryItem. PATCH omission preserves a field; null expiry clears; empty PATCH rejected. Duplicate normalized names -> 409; missing item -> 404.
6. Use requires finite positive quantity <= available; return 400 explaining available amount on over-use. Prevent negative stock/lost updates under overlapping uses. Return updated item and log business event.
7. Delete blocks any Pending shopping entry with 409; otherwise 204. Preserve purchased history. Read ShoppingEntry model directly instead of importing its service. Coordinate shared write protection so concurrent generation/purchase does not bypass the restriction.
8. Dashboard reads actual pantry/category/shopping collections: totalItems, overlapping status counts, full urgent items sorted expiry then id, pending total/linked/manual, all category counts including zero. Do not double-count a multi-status item in totalItems or urgentItems.
9. Provide the actual category+expiry query used for Molham's explain/index experiment. You own query behavior; he owns shared setup and documented measurements.

## Start independently

Inject model tokens PantryItem, Category, ShoppingEntry and shared ClockService/IdsService. In isolated tests provide fake models, deterministic IDs and fixed date 2026-10-16. Import DatabaseModule when wired; do not wait for category/shopping services. The contract's stored shapes are enough to build your fake providers.

## Acceptance checklist

- [ ] Fixture gives 5/3/2/12 and correct urgent order; next day's request changes statuses without editing records.
- [ ] Today/+3 USE SOON, +4 not, yesterday EXPIRED, null never expires; overlapping statuses correct.
- [ ] Dairy + USE SOON + mil -> only Milk; regex characters treated literally; unknown filters rejected.
- [ ] Duplicate ` milk `, missing category, invalid date/amount rejected; missing item 404.
- [ ] Milk use 1 -> 0; another use 1 fails; overlapping uses cannot make negative stock.
- [ ] Pending deletion blocked; purchased-only history survives allowed deletion.
- [ ] Dashboard is calculated, Swagger/logs complete, API build and meaningful unit/e2e tests pass.

Submit request/response examples, commands/results, known gaps and a short English demo. Fix your own integration failures; shared-file changes go through their owner.
