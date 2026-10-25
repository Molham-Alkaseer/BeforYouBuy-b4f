# Rami - add authentication controls to the existing navigation and pages

> Integration status — 25 October 2026: Merged `origin/member-ramy` at `2482c93`. Existing navigation/dashboard/pantry UI was preserved; auth navigation and protected add/edit routes were integrated and checked in the real browser. See [final integration evidence](../docs/tasks2-integration.md). The original assignment below is preserved as a planning record; the integrated engineering status supersedes its unchecked planning boxes. Individual presentations and teammate sign-off are not claimed.

Prepared: 24 October 2026. Read the [shared upgrade contract](molham.md#4-frozen-upgrade-contract) first. This document assigns future implementation work.

## 1. What we had before

- `client/src/App.tsx` already wires dashboard, pantry, add/edit/detail, shopping and not-found routes.
- `main.tsx` supplies BrowserRouter. Navbar, skip link, focusable main region and responsive styling already exist.
- Dashboard and pantry pages already call the shared `api`, show calculated backend statuses and support the existing filters/generate behavior.
- `StatusBadge.tsx` and `PurchaseHistoryTable.tsx` already exist. Maya's item feature has not adopted them yet.
- There is no login/register navigation, session provider, signed-in user display, return-after-login routing or distinction between a member and an administrator.
- The client build and lint passed during this review. Do not rebuild working pages as a scaffold.

## 2. B4F difference and your goal

The B4F API now identifies callers with JWTs and checks membership roles for a protected action. It contains no implemented Next.js frontend to copy. Your goal is to make our existing React layout respond correctly to that new backend behavior.

After your work, people can still browse the pantry/dashboard while signed out, reach Maya's login/register screens, return to a safe intended page after login, and see actions that fit their session. All original dashboard/filter behavior remains usable.

Navigation, dashboard and pantry UI are already implemented. This assignment adds authentication behavior to those screens. The existing pages, data displays, filters and shared components are completed baseline work; the checks below verify that the upgrade preserves them.

| Existing feature | Specific new work |
| --- | --- |
| Working Navbar and application routes | Add Sign in/Register/Sign out controls, current-user display and the two auth-page routes |
| Working add/edit item routes | Require a session and return to the intended local page after login |
| Working dashboard and Generate action | Keep dashboard reads public; require sign-in before Generate and handle session expiry |
| Working pantry list, filters and Add item link | Preserve list/filter behavior; route signed-out Add item users through login |
| Existing badges and history table | Keep their props stable for other members; change them only if an integration defect is found |

## 3. Files you may update for this upgrade

Ownership identifies who can edit a file. It does not mean that every listed file needs to be rewritten or changed.

Existing:

- `client/src/App.tsx`, `client/src/main.tsx`, `client/src/index.css`.
- `client/src/components/Navbar.tsx`, `StatusBadge.tsx`, `PurchaseHistoryTable.tsx`, `LoadingMessage.tsx`, `ErrorMessage.tsx`, `EmptyState.tsx`.
- `client/src/pages/DashboardPage.tsx`, `PantryPage.tsx`, `NotFoundPage.tsx`.
- `client/src/features/dashboard/**`, `client/src/features/pantry/**`.
- Client package/lock files, Vite/TypeScript/ESLint config only if a justified change is needed.

New:

- `client/src/components/RequireAuth.tsx`.
- `client/src/features/navigation/returnTo.ts` with named `sanitizeReturnTo(value: string | null | undefined): string`.
- `docs/tasks2-rami.md` for your screenshots/check results during implementation.

Do not edit Maya's pages, Mohammad's transport/types/session provider/mocks, API source or another member's tests. If another owner needs a shared visual change, you implement it without breaking existing props.

## 4. Interfaces and parallel start

Use named `useAuth` from `features/session/useAuth.ts`: `{ status, user, login, logout }`. Status is `checking`, `anonymous` or `authenticated`; authenticated `user` includes `householdRole`. Mohammad supplies AuthProvider; you mount it inside BrowserRouter and outside App exactly once.

Maya supplies default-export `pages/LoginPage.tsx` and `pages/RegisterPage.tsx`, no required props. You own their route wiring. Public pages remain `/`, `/pantry`, `/pantry/:id` and `/shopping-list`. Add `/login` and `/register`. Wrap only `/pantry/new` and `/pantry/:id/edit` in your Outlet-based RequireAuth route.

Preserve shared props: `StatusBadge({ status })`; `PurchaseHistoryTable({ entries, showItemName?: boolean })`. Publish these expectations early so Maya can replace her temporary markup independently.

Start now with the existing routes, responsive/accessibility checks and fixture session states. Until Mohammad's provider or Maya's pages land, use an isolated development/test wrapper in your own folder; do not create competing production implementations in their paths. Full app wiring follows their early interface commits. Your first PR should establish returnTo sanitization and route/component interfaces.

## 5. Step-by-step tasks

### Step 1 - record the existing layout for regression checks

- [ ] Record desktop and 360px screenshots of dashboard, pantry and navigation before editing.
- [ ] Retain current skip navigation, visible keyboard focus, main region, active links and not-found view.
- [ ] Keep CSS changes scoped so Maya's item screens and Mohammad's shopping screen retain their layouts.
- [ ] Keep Vite/React and current dependencies. No Next.js/Tailwind/framework migration for this round.

### Step 2 - implement safe navigation after login

- [ ] Implement `sanitizeReturnTo`; preserve valid local path/query/hash values.
- [ ] Reject absolute URLs, `//host`, backslashes, invalid URL inputs and targets whose pathname is `/login` or `/register`; return `/pantry` instead.
- [ ] RequireAuth renders a loading state during `checking`; it must not briefly redirect while `/auth/me` is still loading.
- [ ] For anonymous users, redirect with `replace` to `/login?returnTo=<encoded current pathname+search+hash>`.
- [ ] Authenticated users render the Outlet. Register/login must stay accessible without a token.
- [ ] Provide Maya the sanitizer export; she consumes it instead of implementing a different redirect policy.

### Step 3 - make navigation reflect the session

- [ ] Anonymous navigation shows Sign in and Register while retaining public product links.
- [ ] Authenticated navigation shows the user's safe name and role plus a keyboard-accessible Sign out button.
- [ ] Sign out calls the shared `logout()`, clears signed-in-only navigation and routes away from an auth-required form. Public browse routes remain available.
- [ ] Do not show or store a token in UI, and do not read sessionStorage directly from Navbar.
- [ ] Keep responsive navigation usable at narrow widths, long names, browser zoom and keyboard-only interaction.

### Step 4 - integrate dashboard and pantry actions

- [ ] Signed-out users can see all existing dashboard data and pantry filter results.
- [ ] Dashboard Generate requires sign-in. Offer a sign-in link returning to `/`; do not issue the write anonymously or automatically generate after login.
- [ ] Pantry Add item directs anonymous users through login and back to `/pantry/new`. Existing item read/detail links stay public.
- [ ] Preserve category + status + name filter combination, clear/reset behavior, no-match state and refresh controls.
- [ ] Disable mutation controls during session checking or a request; retain existing duplicate-click protection and refreshed counts after generation.
- [ ] On a protected-call 401, show an understandable sign-in prompt using shared auth state. On 403, show a permission message and remain signed in. Network/500 errors retain their normal retry behavior.
- [ ] Ignore or cancel stale requests when the component unmounts or the user logs out; an old result must not restore signed-in UI state.

### Step 5 - verify existing shared visuals and publish their interfaces

- [ ] Confirm StatusBadge handles every existing PantryStatus with text labels and readable contrast, including two simultaneous statuses.
- [ ] Confirm PurchaseHistoryTable accepts snapshot rows, optional item name, date-only expiry and Asia/Damascus purchase timestamps.
- [ ] Keep the table horizontally usable at 360px and keyboard focusable where scrolling is needed.
- [ ] Send the agreed props and screenshots in your PR handoff to Maya and Mohammad; you own any necessary changes to these shared files.

## 6. Acceptance checks

| Scenario | Expected result |
| --- | --- |
| Signed out, open dashboard/pantry/item/shopping | Public data still loads |
| Signed out, open `/pantry/1/edit?from=list` | Sign-in route contains the local returnTo; no form flash |
| Session restoration still pending | Loading state; no premature redirect |
| Login with a valid local returnTo | Correct destination; filters/query preserved where applicable |
| Crafted returnTo such as `https://example.com`, `//example.com`, `/login` | Falls back to `/pantry` |
| Signed-out Generate | Sign-in prompt; no POST sent |
| Signed-in Generate twice | Existing no-duplicate behavior and updated count remain correct |
| Protected write returns 403 | Permission message; account stays signed in |
| Milk matches Dairy + USE SOON + mil | Correct single filtered result and both applicable badges |
| Keyboard/360px/200% zoom | Navigation, filters, tables and actions remain reachable |

Run from root: `npm --prefix client run build` and `npm --prefix client run lint`. There is no existing client test script; do not claim `npm test` ran there. Use the existing browser/manual acceptance approach, and coordinate any justified new test dependency through your client manifest ownership.

## 7. Expected result and handoff

Deliver `codex/tasks2-rami` as a focused PR with before/after screenshots, changed routes, safe-return examples, desktop/mobile/keyboard results, exact build/lint output and known gaps. Explain in English how public browsing differs from authenticated writes and why UI visibility does not replace API authorization.

You are finished when the real shared provider and real auth pages are integrated, route refresh/deep links work, dashboard/pantry regressions pass and your screens behave correctly for anonymous, member and admin sessions. Fixture-only demos are the first checkpoint, not final acceptance.
