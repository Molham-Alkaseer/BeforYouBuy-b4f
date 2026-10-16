# Planned API (not implemented)
All resource routes use `/api`. Swagger is at `/docs`.

| Resource | Planned endpoints | Responsibility |
| --- | --- | --- |
| Categories | GET /categories; POST /categories; PATCH /categories/:id; DELETE /categories/:id | Only mutations use InternalToolGuard and Swagger's x-internal-tool-key header. Block deletion of used categories. |
| Pantry | GET /pantry; GET /pantry/:id; POST /pantry; PATCH /pantry/:id; DELETE /pantry/:id; POST /pantry/:id/use | Validate combined name/categoryId/status filters. Calculate statuses and reasons on every read. Enforce unique trimmed case-insensitive names, valid categories, quantities and deletion restrictions. |
| Shopping list | GET /shopping-list; POST /shopping-list/generate; POST /shopping-list; POST /shopping-list/:id/purchase; DELETE /shopping-list/:id | Pending/history filters, manual entries, idempotent generation, purchase once, correct restocking and expired-stock replacement. |
| Dashboard | GET /dashboard | Calculate status/category counts, ordered urgent items and pending count from MongoDB. |

Validate all bodies and query parameters; reject unknown fields. Add Swagger summaries/properties and meaningful 400/404/409 errors. Use numeric application IDs. Decide and document a consistent calendar-day policy before expiry calculations. Purchase updates must keep pantry stock and shopping history consistent if a write fails or requests overlap.
