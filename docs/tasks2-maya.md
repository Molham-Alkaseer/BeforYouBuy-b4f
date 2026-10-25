# Tasks 2 - Maya: login/register screens and item workflows

Branch: `member-maya` (kept instead of `codex/tasks2-maya`, synced with the leader's merged branch `member-molham` before starting).

## What was delivered

1. Shared components: the item screens now use `StatusBadge` and `PurchaseHistoryTable`. The temporary labels, the local table and the obsolete CSS were removed.
2. Register and login forms with validation, server field errors, pending state and no password in navigation state.
3. `LoginPage` and `RegisterPage` with `returnTo` handling (safe local paths only, fallback `/pantry`).
4. Item details and item form adapted to the session: public reading, sign-in invitation for signed-out users, no enabled actions while the session is `checking`, delete only for admin/owner.
5. 401 and 403 handling for add, edit, use and delete.

## Changed files (client)

New:
- `src/features/auth-forms/`: `authTypes.ts`, `authValidation.ts`, `AuthField.tsx`, `auth-forms.css`, `RegisterForm.tsx`, `LoginForm.tsx`, `RegisterScreen.tsx`, `LoginScreen.tsx`, `authBridge.ts`
- `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`
- `src/features/items/`: `itemSession.ts`, `SignInNotice.tsx`, `sessionErrors.ts`, `SessionProblem.tsx`

Modified:
- `src/features/items/`: `ItemDetails.tsx`, `ItemHistory.tsx`, `StatusRulesPanel.tsx`, `ItemForm.tsx`, `ItemFormBody.tsx`, `UseItemForm.tsx`, `DeleteItem.tsx`, `items.css`

Not committed on purpose (local trial helpers only): fixtures and preview pages for the auth forms and for the item screens with a chosen session or a forced 401/403.

## How the temporary connection works

Everything that must come from the team's shared session files is gathered in `src/features/auth-forms/authBridge.ts`:
- `useAuthStatus()` and `useAuthRole()` stand in for `useAuth()`.
- `loginAction` and `registerAction` stand in for `useAuth().login` and `authApi.register`. They fail with the message "Sign-in is not connected to the server yet." They never fake a successful sign-in.
- `sanitizeReturnTo` stands in for the shared function from `features/navigation/returnTo.ts`.

Connecting the real files means editing only this file.

## Build and lint

- `npm run build`: [ ] passed
- `npm run lint`: [ ] passed

## Manual browser results (mock mode)

| Scenario | Result |
| --- | --- |
| Status badges and purchase history table on details | [ ] ok |
| Register: blank, malformed email, short and oversize password | [ ] ok |
| Register: duplicate email shown on the email field | [ ] ok |
| Register: network and server failure keep the typed values | [ ] ok |
| Register success asks the user to sign in, no automatic session | [ ] ok |
| Login: unknown email and wrong password show the same message | [ ] ok |
| Login: safe returnTo is used, external, `//` and auth-page returnTo go to `/pantry` | [ ] ok |
| Already authenticated visitor is redirected once, no loop | [ ] ok |
| Details: signed out, checking, member, admin, owner | [ ] ok |
| Use: 1 litre of Milk, then over-use is rejected without changing stock | [ ] ok |
| Delete with a pending entry keeps the existing business message | [ ] ok |
| 401 on use, delete, save: session message, input kept, no navigation | [ ] ok |
| 403 on use, delete, save: permission message, no sign-in request | [ ] ok |
| Layout at 360px and zoom 200%, keyboard only | [ ] ok |

## Known gaps

- The real session is not connected yet (`useAuth`, `authApi`, `sanitizeReturnTo`, `RequireAuth` were not in the merged branch). Until `authBridge.ts` is connected, the real details and form pages show the signed-out state, so edit, use and delete are locked for everyone. This change should not be merged before the session is connected.
- `/login` and `/register` are not reachable until the routes are added in `App.tsx` (owned by Rami).
- Nothing was verified against the live API: real 401/403 responses, real token expiry and real roles are still to be checked after integration.
- Focus is not moved to the error message after a failed submit. The messages use `role="alert"`.
- No automated tests: the client has no test script. Checks were manual.
- Differences from the reference images: quantity shows "1 litres" (the shared formatting keeps the unit as typed), and the shared history table shows the time and different column names.

## Registration and login flow (for the English presentation)

The register form checks the name, the email and the password length in the browser: at least 8 characters and at most 72 bytes, without trimming the password. If the server answers with field errors, they are shown next to the matching input, and a duplicate email is shown on the email field. On success there is no automatic session: the form says the account was created and links to sign in, passing only the email, never the password.

The login form calls the shared `login` function once. Whether the email is unknown or the password is wrong, the user sees the same message, so we never reveal which one was wrong. After a successful login, we go to a sanitized `returnTo` with `replace`, and only paths inside the app are accepted.

## One stock-error flow (for the English presentation)

On the Milk page, the quantity is 1 litre. The member records one litre and the server returns the updated item, so the page shows 0 litres. Recording one more litre fails: the server answers that there is not enough Milk and only 0 litres are left, the typed amount stays in the field, and the stock on the screen does not change. If the server answers 401, the page shows that the session expired with a link to sign in again; with 403, it shows a permission message and the user stays signed in.