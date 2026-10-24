# Maya - login/register screens and item workflows

Prepared: 24 October 2026. Read the [shared upgrade contract](molham.md#4-frozen-upgrade-contract) first. This is an implementation assignment, not a report that the upgrade already exists.

## 1. What we had before

- ItemFormPage and ItemDetailsPage already delegate to `client/src/features/items/**`.
- Your forms already cover create/edit, category selection, quantities, expiry validation and API field errors. Details already loads backend-calculated statuses/reasons, use/delete actions and purchase history.
- `features/items/itemApi.ts` already aliases the common `api`; your feature shares live or mock state with shopping. Keep that integration.
- `ItemDetails.tsx` still renders temporary status labels, and `ItemHistory.tsx` still renders a temporary local table. Rami's StatusBadge and PurchaseHistoryTable are now available.
- There are no login/register pages or session-aware item controls. Currently the API does not require an account for ordinary item mutations.

## 2. Goal and B4F connection

B4F now has real registration, bcrypt/JWT login and `/auth/me`. You supply usable React screens for those APIs and adapt your existing item workflows to the agreed permissions.

After your work, a visitor can register and sign in, a signed-in household member can add/edit/use items, an owner/admin can delete an eligible item, and the item screen uses the existing shared components. All existing business errors remain clear.

## 3. Files you own

Existing: `client/src/pages/ItemFormPage.tsx`, `ItemDetailsPage.tsx`, and `client/src/features/items/**`.

New: default-export `client/src/pages/LoginPage.tsx` and `RegisterPage.tsx`, supporting `client/src/features/auth-forms/**` with scoped CSS/helpers, and `docs/tasks2-maya.md` for implementation evidence.

Do not edit App/main/Navbar/global CSS/shared components, shared types, transport, mocks, provider or backend files. Rami wires your routes and owns shared visuals; Mohammad supplies auth state and requests; Mostafa owns item permissions and errors; Allith owns purchase-history behavior.

## 4. Contract and parallel start

- Login input `{ email, password }`; registration input `{ name, email, password }`. Never submit role/ID/household fields.
- `authApi.register(input)` from `services/api-client.ts` returns a SafeUser, but does not sign in. After success, show confirmation and navigate/link to login, optionally prefilling email through route state; never pass a password through navigation state.
- `useAuth()` from `features/session/useAuth.ts` supplies `login(input): Promise<void>`, logout, status and SafeUser. Use it for login; do not keep a second token store.
- Rami supplies `sanitizeReturnTo` from `features/navigation/returnTo.ts`. Consume it on login and registration navigation; fallback `/pantry`. Auth URLs use a `returnTo` query parameter.
- Public item details/history remain readable. Create/edit routes require login via Rami's RequireAuth. Add/edit/use are available to member/admin/owner. Delete is available only to admin/owner and still obeys the Pending-entry rule.
- Preserve shared props: StatusBadge receives `{ status }`; PurchaseHistoryTable receives `{ entries, showItemName?: boolean }`.

Start by replacing temporary markup and building forms against deterministic AuthClient/session fixtures in an isolated feature wrapper. You can verify loading/validation/error states without waiting for backend auth. Keep doubles out of production and integrate Mohammad's early auth interface commit before final app checks. Do not create his shared files yourself.

## 5. Step-by-step tasks

### Step 1 - complete shared-component adoption

- [ ] Replace temporary status badges in ItemDetails, including reason labels where appropriate, with Rami's StatusBadge.
- [ ] Replace the local success-state table in ItemHistory with PurchaseHistoryTable. Keep your existing loading, retry, empty and fetch-cancellation behavior.
- [ ] Preserve `status: 'Purchased', pantryItemId` history filtering; only show the selected item's snapshots.
- [ ] Delete obsolete temporary comments and local CSS only after verifying they are no longer used.

### Step 2 - build registration

- [ ] Add labeled name, email and password inputs with suitable autocomplete (`name`, `email`, `new-password`).
- [ ] Validate nonblank trimmed name, valid email, minimum 8-character password and maximum 72 UTF-8 bytes; do not trim or lowercase passwords. Backend remains authoritative.
- [ ] Display server `fieldErrors` beside the matching input, with a readable summary for other failures.
- [ ] Show `EMAIL_ALREADY_EXISTS` as an email conflict, retaining safe input values and allowing correction.
- [ ] Prevent repeated submission while pending; restore controls after network/validation failure.
- [ ] Success clearly asks the user to sign in. Clear password state; never display/log a password or token.
- [ ] Preserve a sanitized local returnTo through the register -> login journey.

### Step 3 - build login

- [ ] Add labeled email/password fields with `email` and `current-password` autocomplete.
- [ ] Call shared `login(input)` once. It saves/verifies session state; your page must not call fetch or sessionStorage directly.
- [ ] Treat `INVALID_CREDENTIALS` uniformly for unknown email and wrong password. Show one clear error without claiming which credential was wrong.
- [ ] On success navigate with replace to sanitized returnTo. Do not automatically replay the mutation the user originally attempted.
- [ ] Show pending, network-failure and server-error states; preserve email but clear password on successful login/unmount as appropriate.
- [ ] Provide a Register link that preserves the safe returnTo and a route back to public browsing.
- [ ] Handle an already-authenticated visitor without an auth-page redirect loop.

### Step 4 - adapt item details and forms to session changes

- [ ] Public details/history still load without login. For signed-out users, show a sign-in invitation for edit/use actions with a local return path; do not send an anonymous write.
- [ ] While the session is `checking`, do not briefly expose enabled mutations.
- [ ] Member/admin/owner can submit add/edit/use. Keep existing validation, expiry null-versus-omitted semantics and numeric payloads.
- [ ] Show Delete only for owner/admin. A hidden control is a UI affordance; the backend must still reject unauthorized direct requests.
- [ ] Confirm deletion before sending it and disable duplicate clicks. A Pending shopping entry must still produce the existing helpful business error.
- [ ] On protected-call 401, show session-expired/sign-in state through the shared session flow. Do not erase the public item details.
- [ ] On 403, show a permission message and retain the session. Handle role changes since page load, rather than assuming hidden controls guarantee success.
- [ ] Do not navigate away as though a failed edit/use/delete succeeded. Ignore stale mutation results after logout/unmount.

### Step 5 - retain stock/history correctness

- [ ] Using the last unit updates displayed stock to zero before a later over-use message.
- [ ] Expired and Use Soon never display together; overlapping Low Stock + Use Soon remains visible.
- [ ] Invalid route IDs and missing items keep their current clear states; auth handling must not turn every error into a login request.
- [ ] History renders stored purchase snapshots after later pantry edits; do not recalculate historical quantities from current stock.
- [ ] Check labels, focus movement after error, keyboard submission, 360px layout and 200% zoom for both auth and item forms.

## 6. Acceptance checks

| Scenario | Expected result |
| --- | --- |
| Valid register | 201, clear success, then login; no automatic session |
| Blank name, malformed email, short/oversize password | Useful field error; no success navigation |
| Existing email with different case/spaces | Clear duplicate-email error |
| Wrong email or wrong password | Same readable invalid-credentials message |
| Login with safe item-edit returnTo | Returns to intended edit page |
| Login with external returnTo | Stays in the app at `/pantry` |
| Anonymous opens item details | Reads item/history; mutations invite sign-in |
| Member uses an item | Correct stock update; over-use still rejected |
| Member tries direct Delete through API | 403; UI does not offer Delete |
| Admin deletes item with Pending entry | Existing 409 business error, data unchanged |
| Token expires while editing | No false success or automatic retry; sign-in state shown |
| Server returns 403 after a role change | Permission feedback, user remains signed in |
| Shared history and status components | Same data, accessible table and correct badge labels |

Run `npm --prefix client run build` and `npm --prefix client run lint` from root. Record manual browser results; no existing client test script is available. If you need a new dependency, request it from Rami rather than editing the client lockfile.

## 7. Expected result and delivery

Deliver branch `codex/tasks2-maya` with auth/item screenshots before and after, exact changed files, successful/failed login examples without credentials, validation/permission screenshots, build/lint results and known gaps in `docs/tasks2-maya.md`.

You are done when the real AuthProvider/AuthClient and live API work with your forms, Rami's routes load your pages, item business rules remain intact and temporary shared-component replacements are gone. Explain your registration/login flow and one stock-error flow in English.
