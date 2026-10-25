# Before You Buy — API contract v3

Updated 26 October 2026: independent households, admin-managed family accounts and read-only members supersede the tasks 2 shared-household policy. Business quantities, dates, errors and transactional guarantees remain as specified below. See [migration and verification](../docs/household-access.md).

## 1. Common conventions

- Base URL: `http://localhost:3000/api`; client uses `/api` through the existing Vite proxy. Swagger: `http://localhost:3000/docs`.
- Request/response JSON, `Content-Type: application/json`. No extra `data` wrapper beyond the envelopes specified below. DELETE success is 204 with no body.
- IDs are positive safe integer application IDs. Relations use categoryId/pantryItemId, never MongoDB ObjectId/populate. Never expose `_id`, `__v` or normalizedName in responses.
- JSON numbers must be finite. Quantities/minimums allow decimals and must be >=0; amounts used/bought/to-buy must be >0. Do not coerce null, booleans, blank strings or numeric strings into valid body numbers.
- Names/units are trimmed, nonblank strings. Name uniqueness uses trimmed lowercase comparison within each household (categories are a shared global catalog). Units are text such as litres, kg, pots, tubs, pieces; no new unit-management resource. Category names also use normalized uniqueness.
- Expiry dates are real calendar `YYYY-MM-DD` strings or null, never timestamps. Reject invalid dates such as 2026-02-30. PATCH omission means keep; explicit expiryDate null means clear. Other non-nullable fields cannot be null. Unknown body AND query fields fail 400. Empty PATCH fails 400.
- Calendar policy: household date in `Asia/Damascus`. Server ClockService computes today's date per operation; compare date-only calendar values consistently, without browser timezone shifts. Date/timestamp display may be localized, but do not parse date-only values as UTC instants for display. UTC timestamps use ISO 8601 with Z.
- All statuses/reasons/days/counts are computed on backend reads from stored data. Frontend displays them. Mock adapter may simulate them only in explicit development mode.
- Deterministic status order: LOW STOCK first, then EXPIRED or USE SOON; OK alone. Reasons correspond to status order. A difference in human-readable wording is allowed; meaning must agree.
- Pantry/category default order is id ascending. Pending entries sort createdAt ascending, then id ascending; Purchased history purchasedAt descending, then id descending. No pagination.
- Category mutations require only `x-internal-tool-key`; wrong/missing -> 403 `INTERNAL_TOOL_FORBIDDEN`. Never ship this key in the client. Normal writes use JWT and current membership as specified below. Only the shared category catalog remains a public domain read.

## V3 authentication and permissions

| Endpoint | Required access |
| --- | --- |
| GET categories | Public shared catalog |
| GET pantry list/detail, shopping list/history, dashboard | JWT + current household membership, scoped to that household |
| POST/PATCH pantry; POST pantry/:id/use | JWT + owner/admin |
| DELETE pantry/:id | JWT + owner/admin |
| POST shopping-list; POST shopping-list/generate; POST shopping-list/:id/purchase | JWT + owner/admin |
| DELETE shopping-list/:id | JWT + owner/admin |
| POST/PATCH/DELETE categories | Internal key only |
| POST auth/register; POST auth/login; Swagger UI | Public |
| GET auth/me | JWT + current account and household membership |
| GET/POST household/members | JWT + owner/admin; list or create members in the current household |

```ts
type HouseholdRole = 'owner' | 'admin' | 'member';
interface SafeUser {
  id: number;
  name: string;
  email: string;
  createdAt: string; // ISO UTC
  householdRole: HouseholdRole;
  householdId: number;
}
interface RegisterInput { name: string; email: string; password: string }
interface LoginInput { email: string; password: string }
interface LoginResult { accessToken: string; user: SafeUser }
```

- Register: `POST /auth/register` returns 201 SafeUser without signing in. Trim name (1–120 characters) and email (valid email, max 254), lowercase email; never trim passwords. Passwords require at least 8 characters and no more than 72 UTF-8 bytes. Extra fields, arrays and non-object bodies fail validation.
- Public registration creates a new household ID plus an `admin` account/membership atomically. Household 1 is reserved for legacy data. `POST /household/members` accepts the same name/email/password fields and atomically creates a `member` in the verified admin’s household; `GET /household/members` returns `{ items: SafeUser[] }`. Existing emails return 409; this endpoint does not transfer accounts, promote roles or log out the admin. Public registration cannot set a role, ID or household. Email has a database unique index; concurrent duplicates yield one 201 and one 409 `EMAIL_ALREADY_EXISTS`, including `fieldErrors.email`.
- Login: `POST /auth/login` returns 200 LoginResult. Wrong credentials use a generic 401 `INVALID_CREDENTIALS`. Password hashes and MongoDB internal fields are never returned.
- JWT: HS256, two-hour expiry, `{ sub: number, email: string }` plus standard claims. Verify signature, expiry and claim types; load the current user and household membership before allowing private reads or writes. Household IDs and roles in JWT claims or client input never choose the data scope. Missing/bad/expired/deleted-user tokens return 401 `UNAUTHENTICATED`.
- Me: `GET /auth/me` returns current SafeUser, including current DB role/email. Missing membership returns 403 `FORBIDDEN`. Roles and household IDs are read from current membership for each protected request, never trusted from request data or JWT role claims. Missing role metadata denies access.
- Every newly registered household creator is an admin; family accounts are always members. Only the explicit backend `auth:set-role` command can change an existing account's role. No default owner, public promotion, refresh-token, password-reset or server-logout endpoint is included.
- Authorized writes still enforce every business restriction below, including Pending deletion blocks and immutable Purchased history. Verified actor IDs go to service logs; callers cannot supply `actorId`.
- Errors retain `{ statusCode, code, message: string, fieldErrors }`; auth/role errors do not disclose secrets. Domain HTTP success codes are unchanged.
- The React session stores `byb.accessToken` in sessionStorage and restores through `/auth/me`. Protected 401 invalidates only the session that issued the request, including a revision check for same-token logins; login 401 is a form error. A 403 never logs the user out. Logout clears browser state only, and writes are never automatically retried. Network restoration errors retain a retry path.
- Dashboard, pantry and shopping routes require sign-in. `/pantry/new`, `/pantry/:id/edit` and `/family` also require admin/owner access. Members see read-only content. `/login` and `/register` use sanitized local `returnTo` navigation. Signing out immediately leaves private pages.

## 2. Shared types

These declarations define wire shapes. Mohammad updates `client/src/types.ts` accordingly. Backend owners implement compatible response mappers; do not import client files into the API.

```ts
type PantryStatus = 'LOW STOCK' | 'USE SOON' | 'EXPIRED' | 'OK';
type ShoppingStatus = 'Pending' | 'Purchased';
type DateOnly = string; // validated YYYY-MM-DD
type Timestamp = string; // ISO UTC timestamp
interface Category { id: number; name: string }
interface PantryItem {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string; // resolved from the category, not stored redundantly
  quantity: number;
  unit: string;
  minimumQuantity: number;
  expiryDate: DateOnly | null;
  statuses: PantryStatus[];
  statusReasons: string[];
  daysUntilExpiry: number | null; // negative when expired
}
interface ShoppingEntry {
  id: number;
  name: string;
  quantityToBuy: number;
  unit: string | null; // null for manual entries
  pantryItemId: number | null; // null means manual, no extra isLinked flag
  status: ShoppingStatus;
  createdAt: Timestamp;
  purchasedAt: Timestamp | null;
  purchasedQuantity: number | null;
  newExpiryDate: DateOnly | null; // effective expiry just after this purchase
  pantryStatuses: PantryStatus[]; // current linked statuses only for Pending
}
interface PendingSummary { total: number; linked: number; manual: number }
interface CategoryList { items: Category[] }
interface PantryList { asOfDate: DateOnly; items: PantryItem[]; total: number }
interface ShoppingList {
  asOfDate: DateOnly;
  items: ShoppingEntry[];
  total: number; // number matching supplied filters
  pendingSummary: PendingSummary; // all Pending entries, independent of filters
}
interface Dashboard {
  asOfDate: DateOnly;
  totalItems: number;
  statusCounts: Record<PantryStatus, number>;
  urgentItems: PantryItem[]; // EXPIRED or USE SOON, expiry asc then id asc
  pendingShopping: PendingSummary;
  categoryCounts: { categoryId: number; categoryName: string; count: number }[];
}
interface GenerateResult {
  added: number;
  updated: number; // existing eligible entries whose persisted fields changed
  unchanged: number; // existing eligible entries already up to date
  pending: ShoppingList; // refreshed full Pending list
}
interface PurchaseResult {
  entry: ShoppingEntry; // Purchased
  pantryItem: PantryItem | null; // updated linked item, null for manual purchase
}
interface PantryInput {
  name: string;
  categoryId: number;
  quantity: number;
  unit: string;
  minimumQuantity: number;
  expiryDate?: DateOnly | null; // omitted on create -> null
}
type PantryUpdate = Partial<PantryInput>; // at least one valid field
interface PantryQuery { name?: string; categoryId?: number; status?: PantryStatus }
interface ShoppingQuery { status?: ShoppingStatus; pantryItemId?: number }
interface PurchaseInput { purchasedQuantity: number; newExpiryDate?: DateOnly }
interface ApiErrorBody {
  statusCode: number;
  code: string; // stable values in section 6
  message: string; // always readable, never string[]
  fieldErrors: Record<string, string[]>; // {} when not field-specific
}
```

All nullable response keys are present with null, not omitted. Pending purchase fields are null. Manual and Purchased pantryStatuses are always `[]`. Stored historical name/unit/newExpiryDate are snapshots and do not change when the pantry item later changes or is removed. On purchase, capture the current linked name/unit and resulting expiry. Existing pending linked names/units are refreshed by generation for eligible items; no automatic entry update is implied by PATCH pantry.

## 3. Complete endpoint map

Paths below are relative to `/api`. Any resource ID malformed -> 400; resource missing -> 404. POST action endpoints deliberately return 200, overriding Nest's default 201.

| Owner | Method / path | Input | Success |
| --- | --- | --- | --- |
| Molham | GET /categories | none | 200 CategoryList |
| Molham | POST /categories | `{name}` + internal header | 201 Category |
| Molham | PATCH /categories/:id | `{name}` + internal header | 200 Category |
| Molham | DELETE /categories/:id | internal header | 204 empty |
| Mustafa | GET /pantry | PantryQuery | 200 PantryList |
| Mustafa | GET /pantry/:id | none | 200 PantryItem |
| Mustafa | POST /pantry | PantryInput | 201 PantryItem |
| Mustafa | PATCH /pantry/:id | PantryUpdate | 200 PantryItem |
| Mustafa | POST /pantry/:id/use | `{quantity: number}` | 200 PantryItem |
| Mustafa | DELETE /pantry/:id | none | 204 empty |
| Mustafa | GET /dashboard | none | 200 Dashboard |
| Allaith | GET /shopping-list | ShoppingQuery | 200 ShoppingList |
| Allaith | POST /shopping-list/generate | no body | 200 GenerateResult |
| Allaith | POST /shopping-list | `{name, quantityToBuy}` | 201 ShoppingEntry |
| Allaith | POST /shopping-list/:id/purchase | PurchaseInput | 200 PurchaseResult |
| Allaith | DELETE /shopping-list/:id | none | 204 empty |

Endpoints without body/query parameters reject unexpected fields; generate accepts absent body or `{}` only. GET shopping without status returns all entries: Pending ordered first, then Purchased ordered as above. Frontend normally requests each status separately.

### Filters

`GET /pantry?name=mil&categoryId=1&status=USE%20SOON` returns Milk only in the fixture. All filters are AND. Name is trimmed, literal, case-insensitive partial match; escape regex characters. Blank name is treated as no name filter. Frontend omits other blank filters; malformed enum/ID/duplicate scalar query keys fail 400. Valid but nonexistent category ID yields an empty list, not 404. Valid but nonexistent pantryItemId in shopping history also yields an empty list, allowing history queries after deletion. Unknown query keys fail 400.

`GET /shopping-list?status=Purchased&pantryItemId=1` returns Milk's three fixture purchases, newest first. `total` is 3; pendingSummary still describes all seven Pending entries.

## 4. Business behavior at the boundaries

### Pantry and dashboard

- LOW STOCK when quantity < minimumQuantity, including expired items; stock quantity itself is not zeroed just because it expired.
- EXPIRED when expiryDate < today. USE SOON when 0 <= daysUntilExpiry <= 3. No date -> neither. OK only when no other status applies.
- Create checks existing category; unknown category -> 400 INVALID_CATEGORY. Duplicate normalized pantry name -> 409 DUPLICATE_ITEM_NAME. Renaming to your own normalized name is allowed.
- Use requires 0 < quantity <= available; invalid/over-use -> 400, no mutation. Missing item -> 404. Use does not automatically regenerate shopping suggestions.
- Delete with any Pending linked entry -> 409 ITEM_HAS_PENDING_ENTRY. Purchased history does not block deletion and must remain accessible. Missing -> 404.
- Dashboard counts overlap, urgentItems does not duplicate records, and categoryCounts includes zero-count categories. Never add status counts to derive totalItems.

### Generation

Eligible = LOW STOCK or EXPIRED. Suggested = `max(1, minimumQuantity - (expired ? 0 : quantity))`. Decimals remain decimals unless the minimum-of-1 rule applies; do not round everything up to integers. Avoid visible floating-point artifacts in quantities.

At most one Pending linked entry per pantry item. For each eligible item create if absent; otherwise update quantityToBuy/name/unit, leaving createdAt unchanged. Count updated only when a stored value changes; otherwise unchanged. Preserve Purchased history and manual entries. Existing linked Pending entries for items no longer eligible are retained unchanged and excluded from added/updated/unchanged; the user may remove/purchase them. This is an explicit v1 choice to avoid silently deleting a user's shopping entry.

All Pending normalized names must be unique. If generation would collide with a different Pending entry (e.g. a manual entry has a newly eligible pantry item's name), return 409 PENDING_NAME_CONFLICT and change nothing; tell the user to remove/purchase the conflicting entry. Never silently turn a manual entry into a linked entry. Guard concurrency as well as repeat sequential calls.

### Purchase and remove

- Require a Pending entry and finite purchasedQuantity >0; quantity may differ from suggested. A purchased entry cannot be purchased twice (409 ALREADY_PURCHASED).
- Normal linked purchase adds bought quantity. Omitted newExpiryDate keeps the existing date; a provided valid date replaces it. Null is not accepted for purchase date; clearing expiry is done through pantry edit.
- Expired linked purchase requires newExpiryDate, discards expired stock, and sets stock exactly to purchasedQuantity. Missing -> 400 EXPIRY_REQUIRED. The new date must be a valid calendar date; v1 does not add an unstated restriction that it be >today+3. Status is recalculated from the supplied date, so a near date may still show USE SOON. Use 2026-10-25 in the fixed demo to produce OK.
- Manual purchase changes no pantry item; sending newExpiryDate for a manual entry -> 400 VALIDATION_ERROR. pantryItem is null in response.
- Linked item missing -> 404 ITEM_NOT_FOUND with no purchase/stock writes. Snapshot name/unit/effective expiry and timestamp are captured on successful purchase. quantityToBuy remains the original suggestion; purchasedQuantity is the actual amount.
- Stock update and purchase must succeed together; repeat/concurrent requests must not double-restock. Deletion/generation/use must not bypass invariants under overlap.
- DELETE shopping accepts Pending only; Purchased -> 409 ENTRY_ALREADY_PURCHASED. Missing -> 404 ENTRY_NOT_FOUND. History is read-only.

## 5. Exact frontend adapter contract

Mohammad exports `api` from `client/src/services/api-client.ts`. Rami/Maya may use local stubs with this interface today. Each method returns the exact HTTP success body; DELETE returns undefined. Category mutation methods are intentionally absent from the household client.

```ts
interface ApiClient {
  listCategories(): Promise<CategoryList>;
  listPantry(query?: PantryQuery): Promise<PantryList>;
  getPantryItem(id: number): Promise<PantryItem>;
  createPantryItem(input: PantryInput): Promise<PantryItem>;
  updatePantryItem(id: number, input: PantryUpdate): Promise<PantryItem>;
  usePantryItem(id: number, input: { quantity: number }): Promise<PantryItem>;
  deletePantryItem(id: number): Promise<void>;
  getDashboard(): Promise<Dashboard>;
  listShoppingEntries(query?: ShoppingQuery): Promise<ShoppingList>;
  generateShoppingList(): Promise<GenerateResult>;
  createManualEntry(input: { name: string; quantityToBuy: number }): Promise<ShoppingEntry>;
  purchaseEntry(id: number, input: PurchaseInput): Promise<PurchaseResult>;
  deleteShoppingEntry(id: number): Promise<void>;
}
// Rejected promises throw Error instances extended with:
// statusCode: number (0 for network failure), code: string,
// fieldErrors: Record<string,string[]>; message is inherited from Error.
```

`VITE_USE_MOCKS=true` selects a development mock; false/absent uses HTTP. Build configuration must not silently enable mock mode. No fallback to fake data when live requests fail. `VITE_API_URL=/api` is the normal base. The mock supports all filters/mutations plus reset; keep fake calculations in mock files only. Example usage:

```ts
const result = await api.listPantry({ categoryId: 1, status: 'USE SOON', name: 'mil' });
// render result.items; errors caught by the page render a visible message
const saved = await api.usePantryItem(1, { quantity: 1 });
// replace displayed item with saved, then reload any affected visible summaries
```

Use one mock-state instance across pages. Deep-clone fixture on reset. A successful purchase updates pantry, pending/history and dashboard together; refresh requests must see the new state. Baseline fixture is already AFTER generation and manual candle addition.

## 6. Error contract

Every failure uses ApiErrorBody; fieldErrors may be empty. DTO validation arrays are normalized by Molham's global error handling into a summary string and per-field arrays. Client must retain this data, not reduce it to only Error.message. Internal 500 messages are safe generic text. Tests assert status/code and useful content, not punctuation.

| HTTP | code | Trigger / field |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | bad types/date/ID/enum, unknown fields, empty PATCH |
| 400 | INVALID_CATEGORY | nonexistent categoryId in item write / categoryId |
| 400 | INSUFFICIENT_STOCK | use exceeds available / quantity |
| 400 | EXPIRY_REQUIRED | expired purchase lacks newExpiryDate / newExpiryDate |
| 403 | INTERNAL_TOOL_FORBIDDEN | missing/wrong internal header |
| 404 | ITEM_NOT_FOUND | pantry item absent |
| 404 | ENTRY_NOT_FOUND | shopping entry absent |
| 404 | CATEGORY_NOT_FOUND | category mutation targets absent category |
| 409 | DUPLICATE_ITEM_NAME | normalized pantry name already used / name |
| 409 | DUPLICATE_CATEGORY_NAME | normalized category name used / name |
| 409 | PENDING_NAME_CONFLICT | normalized Pending name collision / name |
| 409 | ITEM_HAS_PENDING_ENTRY | pantry deletion blocked |
| 409 | CATEGORY_IN_USE | category deletion blocked |
| 409 | ALREADY_PURCHASED | second purchase |
| 409 | ENTRY_ALREADY_PURCHASED | deleting history |
| 500 | INTERNAL_ERROR | unexpected server failure |

Example responses (separate scenarios, not simultaneous errors):

```json
{
  "statusCode": 409,
  "code": "DUPLICATE_ITEM_NAME",
  "message": "An item called Milk is already in your pantry.",
  "fieldErrors": { "name": ["Names are the same even if capitals or surrounding spaces differ."] }
}
```

```json
{
  "statusCode": 400,
  "code": "INSUFFICIENT_STOCK",
  "message": "There is not enough Milk. Only 0 litres are left.",
  "fieldErrors": { "quantity": ["Use no more than the available quantity: 0 litres."] }
}
```

```json
{
  "statusCode": 400,
  "code": "EXPIRY_REQUIRED",
  "message": "A new expiry date is required because the old Yoghurt expired.",
  "fieldErrors": { "newExpiryDate": ["Enter the expiry date of the new stock."] }
}
```

```json
{
  "statusCode": 409,
  "code": "ITEM_HAS_PENDING_ENTRY",
  "message": "Milk cannot be deleted yet. Remove or purchase its pending shopping entry first.",
  "fieldErrors": {}
}
```

For unknown fields, fieldErrors uses the unexpected key, e.g. `{"statuses":["This field is not allowed."]}`. For general/network failures use `{}`; network failure is adapter code NETWORK_ERROR/statusCode 0, not an HTTP response.

## 7. Mock data included with this contract

The full copy-ready JSON is [mock-data.json](mock-data.json). It contains exact CategoryList, PantryList, ShoppingList and Dashboard bodies under keys `categories`, `pantry`, `shoppingPending`, `shoppingPurchased`, `dashboard`. `fixtureDate` is mock metadata, not an API field. The following examples are extracted from that same fixture; do not maintain separate conflicting data sets.

Fixed mock today is **2026-10-16 in Asia/Damascus**. Freeze this clock for mock tests. Real backend seed uses relative dates from runtime today; production never fixes today's date to the screenshot.

| Mock key | API use |
| --- | --- |
| categories | GET /categories |
| pantry | GET /pantry without filters |
| pantry.items[0] | GET /pantry/1 (Milk) |
| shoppingPending | GET /shopping-list?status=Pending |
| shoppingPurchased | GET /shopping-list?status=Purchased |
| dashboard | GET /dashboard |

Fixture overview: 7 categories, 20 pantry items, 7 Pending entries (6 linked + Birthday candles), 6 Purchased snapshots. Milk has 3 history records. The extra historical Milk rows unify the detail and shopping templates; historical purchases do not reconstruct current stock because intervening uses/edits are not represented in this fixture.

### Categories: exact GET /categories body

```json
{
  "items": [
    {
      "id": 1,
      "name": "Dairy"
    },
    {
      "id": 2,
      "name": "Produce"
    },
    {
      "id": 3,
      "name": "Meat & Fish"
    },
    {
      "id": 4,
      "name": "Frozen"
    },
    {
      "id": 5,
      "name": "Grains & Pasta"
    },
    {
      "id": 6,
      "name": "Pantry staples"
    },
    {
      "id": 7,
      "name": "Drinks"
    }
  ]
}
```

### Milk: exact GET /pantry/1 body

```json
{
  "id": 1,
  "name": "Milk",
  "categoryId": 1,
  "categoryName": "Dairy",
  "quantity": 1,
  "unit": "litres",
  "minimumQuantity": 2,
  "expiryDate": "2026-10-18",
  "statuses": [
    "LOW STOCK",
    "USE SOON"
  ],
  "statusReasons": [
    "1 litres below the minimum of 2 litres",
    "Expires in 2 days"
  ],
  "daysUntilExpiry": 2
}
```

### Combined filter: exact PantryList body

```json
{
  "asOfDate": "2026-10-16",
  "items": [
    {
      "id": 1,
      "name": "Milk",
      "categoryId": 1,
      "categoryName": "Dairy",
      "quantity": 1,
      "unit": "litres",
      "minimumQuantity": 2,
      "expiryDate": "2026-10-18",
      "statuses": [
        "LOW STOCK",
        "USE SOON"
      ],
      "statusReasons": [
        "1 litres below the minimum of 2 litres",
        "Expires in 2 days"
      ],
      "daysUntilExpiry": 2
    }
  ],
  "total": 1
}
```

### Full pantry snapshot

The full JSON objects are in mock-data.json. All days are relative to fixtureDate.

| id | Name | Category ID | Quantity | Unit | Minimum | Expiry | Statuses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Milk | 1 | 1 | litres | 2 | 2026-10-18 | LOW STOCK, USE SOON |
| 2 | Yoghurt | 1 | 2 | pots | 3 | 2026-10-15 | LOW STOCK, EXPIRED |
| 3 | Cream cheese | 1 | 1 | tubs | 1 | 2026-10-13 | EXPIRED |
| 4 | Butter | 1 | 2 | packs | 1 | 2026-11-25 | OK |
| 5 | Cheddar | 1 | 1 | blocks | 1 | 2026-10-28 | OK |
| 6 | Eggs | 1 | 4 | pieces | 6 | 2026-10-25 | LOW STOCK |
| 7 | Spinach | 2 | 1 | bags | 1 | 2026-10-19 | USE SOON |
| 8 | Tomatoes | 2 | 6 | pieces | 4 | 2026-10-21 | OK |
| 9 | Apples | 2 | 8 | pieces | 4 | 2026-10-25 | OK |
| 10 | Carrots | 2 | 1.5 | kg | 1 | 2026-10-30 | OK |
| 11 | Chicken breast | 3 | 0.8 | kg | 0.5 | 2026-10-17 | USE SOON |
| 12 | Salmon fillets | 4 | 2 | pieces | 2 | 2026-12-15 | OK |
| 13 | Rice | 5 | 4 | kg | 2 | null | OK |
| 14 | Pasta | 5 | 3 | packs | 2 | null | OK |
| 15 | Lentils | 5 | 0.5 | kg | 1 | null | LOW STOCK |
| 16 | Olive oil | 6 | 0.3 | litres | 0.5 | 2027-05-04 | LOW STOCK |
| 17 | Flour | 6 | 2 | kg | 1 | 2027-02-13 | OK |
| 18 | Sugar | 6 | 1 | kg | 1 | null | OK |
| 19 | Orange juice | 7 | 2 | litres | 1 | 2026-10-26 | OK |
| 20 | Green tea | 7 | 20 | bags | 10 | 2027-08-12 | OK |

### Pending shopping: exact GET /shopping-list?status=Pending body

```json
{
  "asOfDate": "2026-10-16",
  "items": [
    {
      "id": 101,
      "name": "Milk",
      "quantityToBuy": 1,
      "unit": "litres",
      "pantryItemId": 1,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": [
        "LOW STOCK",
        "USE SOON"
      ]
    },
    {
      "id": 102,
      "name": "Yoghurt",
      "quantityToBuy": 3,
      "unit": "pots",
      "pantryItemId": 2,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": [
        "LOW STOCK",
        "EXPIRED"
      ]
    },
    {
      "id": 103,
      "name": "Cream cheese",
      "quantityToBuy": 1,
      "unit": "tubs",
      "pantryItemId": 3,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": [
        "EXPIRED"
      ]
    },
    {
      "id": 104,
      "name": "Eggs",
      "quantityToBuy": 2,
      "unit": "pieces",
      "pantryItemId": 6,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": [
        "LOW STOCK"
      ]
    },
    {
      "id": 105,
      "name": "Lentils",
      "quantityToBuy": 1,
      "unit": "kg",
      "pantryItemId": 15,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": [
        "LOW STOCK"
      ]
    },
    {
      "id": 106,
      "name": "Olive oil",
      "quantityToBuy": 1,
      "unit": "litres",
      "pantryItemId": 16,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": [
        "LOW STOCK"
      ]
    },
    {
      "id": 107,
      "name": "Birthday candles",
      "quantityToBuy": 1,
      "unit": null,
      "pantryItemId": null,
      "status": "Pending",
      "createdAt": "2026-10-16T08:00:00.000Z",
      "purchasedAt": null,
      "purchasedQuantity": null,
      "newExpiryDate": null,
      "pantryStatuses": []
    }
  ],
  "total": 7,
  "pendingSummary": {
    "total": 7,
    "linked": 6,
    "manual": 1
  }
}
```

### Item purchase history: exact Milk history response

```json
{
  "asOfDate": "2026-10-16",
  "items": [
    {
      "id": 205,
      "name": "Milk",
      "quantityToBuy": 2,
      "unit": "litres",
      "pantryItemId": 1,
      "status": "Purchased",
      "createdAt": "2026-10-06T08:00:00.000Z",
      "purchasedAt": "2026-10-09T10:00:00.000Z",
      "purchasedQuantity": 2,
      "newExpiryDate": "2026-10-19",
      "pantryStatuses": []
    },
    {
      "id": 204,
      "name": "Milk",
      "quantityToBuy": 2,
      "unit": "litres",
      "pantryItemId": 1,
      "status": "Purchased",
      "createdAt": "2026-09-29T08:00:00.000Z",
      "purchasedAt": "2026-10-02T10:00:00.000Z",
      "purchasedQuantity": 2,
      "newExpiryDate": "2026-10-12",
      "pantryStatuses": []
    },
    {
      "id": 206,
      "name": "Milk",
      "quantityToBuy": 3,
      "unit": "litres",
      "pantryItemId": 1,
      "status": "Purchased",
      "createdAt": "2026-09-23T08:00:00.000Z",
      "purchasedAt": "2026-09-25T10:00:00.000Z",
      "purchasedQuantity": 3,
      "newExpiryDate": "2026-10-06",
      "pantryStatuses": []
    }
  ],
  "total": 3,
  "pendingSummary": {
    "total": 7,
    "linked": 6,
    "manual": 1
  }
}
```

### Dashboard: exact GET /dashboard body

```json
{
  "asOfDate": "2026-10-16",
  "totalItems": 20,
  "statusCounts": {
    "LOW STOCK": 5,
    "USE SOON": 3,
    "EXPIRED": 2,
    "OK": 12
  },
  "urgentItems": [
    {
      "id": 3,
      "name": "Cream cheese",
      "categoryId": 1,
      "categoryName": "Dairy",
      "quantity": 1,
      "unit": "tubs",
      "minimumQuantity": 1,
      "expiryDate": "2026-10-13",
      "statuses": [
        "EXPIRED"
      ],
      "statusReasons": [
        "Expired 3 days ago"
      ],
      "daysUntilExpiry": -3
    },
    {
      "id": 2,
      "name": "Yoghurt",
      "categoryId": 1,
      "categoryName": "Dairy",
      "quantity": 2,
      "unit": "pots",
      "minimumQuantity": 3,
      "expiryDate": "2026-10-15",
      "statuses": [
        "LOW STOCK",
        "EXPIRED"
      ],
      "statusReasons": [
        "1 pots below the minimum of 3 pots",
        "Expired 1 day ago"
      ],
      "daysUntilExpiry": -1
    },
    {
      "id": 11,
      "name": "Chicken breast",
      "categoryId": 3,
      "categoryName": "Meat & Fish",
      "quantity": 0.8,
      "unit": "kg",
      "minimumQuantity": 0.5,
      "expiryDate": "2026-10-17",
      "statuses": [
        "USE SOON"
      ],
      "statusReasons": [
        "Expires in 1 day"
      ],
      "daysUntilExpiry": 1
    },
    {
      "id": 1,
      "name": "Milk",
      "categoryId": 1,
      "categoryName": "Dairy",
      "quantity": 1,
      "unit": "litres",
      "minimumQuantity": 2,
      "expiryDate": "2026-10-18",
      "statuses": [
        "LOW STOCK",
        "USE SOON"
      ],
      "statusReasons": [
        "1 litres below the minimum of 2 litres",
        "Expires in 2 days"
      ],
      "daysUntilExpiry": 2
    },
    {
      "id": 7,
      "name": "Spinach",
      "categoryId": 2,
      "categoryName": "Produce",
      "quantity": 1,
      "unit": "bags",
      "minimumQuantity": 1,
      "expiryDate": "2026-10-19",
      "statuses": [
        "USE SOON"
      ],
      "statusReasons": [
        "Expires in 3 days"
      ],
      "daysUntilExpiry": 3
    }
  ],
  "pendingShopping": {
    "total": 7,
    "linked": 6,
    "manual": 1
  },
  "categoryCounts": [
    {
      "categoryId": 1,
      "categoryName": "Dairy",
      "count": 6
    },
    {
      "categoryId": 2,
      "categoryName": "Produce",
      "count": 4
    },
    {
      "categoryId": 3,
      "categoryName": "Meat & Fish",
      "count": 1
    },
    {
      "categoryId": 4,
      "categoryName": "Frozen",
      "count": 1
    },
    {
      "categoryId": 5,
      "categoryName": "Grains & Pasta",
      "count": 3
    },
    {
      "categoryId": 6,
      "categoryName": "Pantry staples",
      "count": 3
    },
    {
      "categoryId": 7,
      "categoryName": "Drinks",
      "count": 2
    }
  ]
}
```

### Normal Milk purchase: exact success example

POST /shopping-list/101/purchase with purchasedQuantity 2 and newExpiryDate 2026-10-25:

```json
{
  "entry": {
    "id": 101,
    "name": "Milk",
    "quantityToBuy": 1,
    "unit": "litres",
    "pantryItemId": 1,
    "status": "Purchased",
    "createdAt": "2026-10-16T08:00:00.000Z",
    "purchasedAt": "2026-10-16T09:00:00.000Z",
    "purchasedQuantity": 2,
    "newExpiryDate": "2026-10-25",
    "pantryStatuses": []
  },
  "pantryItem": {
    "id": 1,
    "name": "Milk",
    "categoryId": 1,
    "categoryName": "Dairy",
    "quantity": 3,
    "unit": "litres",
    "minimumQuantity": 2,
    "expiryDate": "2026-10-25",
    "statuses": [
      "OK"
    ],
    "statusReasons": [
      "Stock is sufficient and no expiry action is needed"
    ],
    "daysUntilExpiry": 9
  }
}
```


## 8. Mutation scenarios for frontend mocks and backend acceptance

Reset fixture between scenarios unless explicitly continuing. Returned item objects always include the complete PantryItem shape from section 2. IDs for newly created records are allocated by the server, not hard-coded by callers; mocks start above the fixture maximum (pantry 20, categories 7, shopping 206).

| Action from baseline | Request | Expected result/state |
| --- | --- | --- |
| Create item | POST /pantry body `{ "name":"Oats", "categoryId":5, "quantity":2, "unit":"kg", "minimumQuantity":1, "expiryDate":null }` | 201 full item; fixture mock id 21, categoryName Grains & Pasta, OK, null daysUntilExpiry |
| Edit Milk | PATCH /pantry/1 body `{ "quantity":3, "expiryDate":null }` | 200 full item; OK, no expiry; other fields unchanged |
| Clear expiry | PATCH /pantry/1 body `{ "expiryDate":null }` | LOW STOCK only, quantity 1, reasons updated |
| Use Milk | POST /pantry/1/use body `{ "quantity":1 }` | 200 full item quantity 0; LOW STOCK + USE SOON, low-stock reason 2 below minimum |
| Use again after above | same request | 400 INSUFFICIENT_STOCK; still 0 |
| Delete Milk | DELETE /pantry/1 | 409 ITEM_HAS_PENDING_ENTRY |
| Remove then delete | DELETE /shopping-list/101, then DELETE /pantry/1 | 204 both; Milk history retained |
| Delete Rice | DELETE /pantry/13 | 204; its Purchased snapshot retained |
| Add manual | POST /shopping-list body `{ "name":"Napkins", "quantityToBuy":2 }` | 201 Pending, mock id 207, unit/link/purchase fields null, pantryStatuses [] |
| Duplicate manual | same endpoint body `{ "name":" milk ", "quantityToBuy":1 }` | 409 PENDING_NAME_CONFLICT, no mutation |
| Re-generate baseline | POST /shopping-list/generate, no body | 200 added 0, updated 0, unchanged 6, pending contains original 7 |
| Generate from cleared Pending list | clear only Pending entries, then generate | 200 added 6, updated 0, unchanged 0; history remains |
| Change Eggs then generate | PATCH /pantry/6 `{ "quantity":3 }`, then generate | added 0, updated 1, unchanged 5; Eggs suggestion becomes 3 |
| Buy normal Milk | POST /shopping-list/101/purchase `{ "purchasedQuantity":2, "newExpiryDate":"2026-10-25" }` | stock 3, OK; Purchased entry 101 and full updated item |
| Buy expired Yoghurt, missing date | POST /shopping-list/102/purchase `{ "purchasedQuantity":3 }` | 400 EXPIRY_REQUIRED, still Pending, stock still 2 |
| Buy expired Yoghurt, valid date | same endpoint `{ "purchasedQuantity":3, "newExpiryDate":"2026-10-25" }` | stock exactly 3, OK; Purchased entry 102 |
| Buy manual candles | POST /shopping-list/107/purchase `{ "purchasedQuantity":2 }` | Purchased entry, pantryItem null; no pantry changes |
| Buy Purchased again | repeat successful purchase | 409 ALREADY_PURCHASED; quantities unchanged |
| Remove Purchased | DELETE /shopping-list/201 | 409 ENTRY_ALREADY_PURCHASED |
| Missing item | GET /pantry/9999 | 404 ITEM_NOT_FOUND |

After buying Milk from baseline: Pending total 6 (5 linked/1 manual), Purchased total 7, totalItems 20, LOW STOCK 4, USE SOON 2, EXPIRED 2, OK 13. These checks catch stale dashboard mocks. If buying Milk without a new date, stock becomes 3 but USE SOON remains; do not incorrectly force OK.

For a full purchase response, take entry 101, set status Purchased, purchasedQuantity 2, purchasedAt to mock clock timestamp, newExpiryDate 2026-10-25, pantryStatuses []; take Milk, set quantity 3, expiryDate 2026-10-25, statuses [OK], statusReasons [Stock is sufficient and no expiry action is needed], daysUntilExpiry 9. Return `{entry, pantryItem}`. All unmentioned fields remain unchanged.

Category examples: POST `/categories` with `{ "name":"Baking" }` and valid header returns 201 `{ "id":8, "name":"Baking" }` in mock tooling/tests; PATCH `/categories/8` `{ "name":"Baking supplies" }` returns updated Category; DELETE `/categories/8` -> 204 if unused. DELETE Dairy id 1 -> 409 CATEGORY_IN_USE. Household client does not expose these mutations.

## 9. Backend development interfaces and integration boundaries

Each backend owner can test immediately with the providers below. The exact DatabaseModule/provider implementation belongs to Molham; domain logic must not wait for another domain service.

- Mongoose model tokens/classes: `Category`, `PantryItem`, `ShoppingEntry`, `User`, `HouseholdMember`. Explicit collection names: `categories`, `pantry_items`, `shopping_entries`, `users`, `household_members`.
- Schema exports: CategorySchema (Molham), PantryItemSchema (Mustafa), ShoppingEntrySchema (Allaith), from existing resource schema paths. Molham registers them once in `api/src/database/database.module.ts` and exports MongooseModule. Domain modules import DatabaseModule only; it must not import their modules/services.
- Stored Category fields: id/name/normalizedName. Stored PantryItem: id/name/normalizedName/categoryId/quantity/unit/minimumQuantity/expiryDate. Stored ShoppingEntry: all ShoppingEntry fields except pantryStatuses, plus normalizedName. Timestamps may be BSON Dates internally but serialize as ISO strings. Date-only expiry fields stay date-only/null.
- Correctness constraints: unique numeric IDs, unique normalized pantry/category names, at most one Pending per linked pantryItemId, unique normalized Pending names. Do not use a plain unique index on nullable pantryItemId that blocks multiple manual/history records; scope the constraint to Pending linked records. History uniqueness rules differ from Pending rules.

```ts
// Molham: api/src/common/clock/clock.service.ts
class ClockService {
  today(): string; // current YYYY-MM-DD in Asia/Damascus
  now(): Date;     // instant for timestamps
}
// Molham: api/src/database/ids.service.ts
class IdsService {
  next(collection: 'categories' | 'pantry_items' | 'shopping_entries'): Promise<number>;
}
// Mustafa: api/src/pantry/pantry-status.ts
type StatusInput = {
  quantity: number; minimumQuantity: number; unit: string; expiryDate: string | null;
};
function calculatePantryStatus(item: StatusInput, today: string): {
  statuses: PantryStatus[]; statusReasons: string[]; daysUntilExpiry: number | null;
};
```

These are interface declarations, not method implementations to paste as executable classes. Unit tests supply objects implementing them. Fake model providers must support the operations the service uses; fixture objects alone are not Mongoose models. Allaith can stub calculatePantryStatus's known result before Mustafa lands the helper. Dashboard reads models directly; no ShoppingListService/PantryService cycle.

For stock/history write consistency, Molham owns the common infrastructure and local database setup; Allaith owns purchase behavior and tests, Mustafa owns use/delete behavior and tests. Agree on the shared write boundary in the first foundation PR. A MongoDB transaction with a local replica set is an acceptable option; if selected, document setup and propagate the same session through every participating write, with protection against check/write races for category and pantry deletion. An alternative must demonstrate equivalent failure safety; a JavaScript mutex alone does not recover partial writes after a crash. This internal implementation choice must not change the HTTP contract or stop independent fake-provider tests.

## 10. Ready-to-integrate checks

- All routes, enum spellings, null semantics, response envelopes and status codes match this file in Swagger and both adapters.
- Fixture JSON parses; counts, filters, suggested quantities and history links agree across screens.
- Every endpoint has useful validation/errors; no body/status label is trusted as computed truth.
- Normal UI requests work without internal key; category mutations require it.
- Mocks off: UI changes are persisted in MongoDB and survive a backend restart.
- Race/failure tests cover use, generate and purchase; partial stock/history updates are not accepted as complete.
- Molham records actual performance-index measurements and all required demo flows; each owner fixes their own failed checks.
