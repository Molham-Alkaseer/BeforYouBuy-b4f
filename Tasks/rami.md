# Rami — Frontend layout, dashboard and pantry list

## Deliverable and owned files

Implement images 3 and 4 plus the shared sidebar. Own `client/src/pages/{DashboardPage,PantryPage,NotFoundPage}.tsx`, `features/dashboard/**`, `features/pantry/**`, `App.tsx`, `main.tsx`, `index.css`, client configuration/dependencies, and shared components listed in [README.md](README.md). Do not edit Maya's pages, Mohammad's transport/types/mocks, or backend files.

## Required work

1. Build the cream sidebar, logo/title, green active link and bottom description. All six routes must work, including direct URL refresh. At narrow widths, navigation must not hide content. Keep one layout for all pages.
2. Deliver the shared badge, history and message component signatures in the team README. History uses purchased quantity, purchase date and new-expiry snapshots, not current pantry expiry or suggested quantity.
3. Dashboard: call `api.getDashboard()`. Display API asOfDate, totalItems, four overlapping counts, urgent items in returned order, pending total/linked/manual counts and every category count. Link urgent items to details. Do not compute authoritative totals in the browser.
4. Dashboard generate: call `api.generateShoppingList()`, disable while pending, show added/updated/unchanged feedback, then reload dashboard. Provide a shopping-list link.
5. Pantry: call `api.listCategories()` and `api.listPantry({name,categoryId,status})`. Combine all filters, omit blank parameters, URL-encode values, and clear filters. Prevent old search responses overwriting newer results using cancellation or a request counter.
6. Display category, quantities/units, minimum, expiry/no-expiry, API daysUntilExpiry and every returned badge. Names open item details; Add opens the form. Show filtered total and asOfDate.
7. Handle initial loading, API failure/retry, no pantry items, no matching results, invalid route and mobile layouts. Use labelled controls, semantic tables and keyboard focus.

## Start independently

Read [apicontract.md](apicontract.md). Use `dashboard`, `pantry`, `categories` from [mock-data.json](mock-data.json). Locally stub the four API methods inside your feature/test directory until Mohammad's shared adapter is ready; no page-code rewrite should be needed to switch. Your shared components/layout are your responsibility, not a dependency on Maya or Mohammad.

## Acceptance checklist

- [ ] Dashboard: 20 items; LOW STOCK 5, USE SOON 3, EXPIRED 2, OK 12; pending 7 = 6 linked + 1 manual. Counts can overlap.
- [ ] Urgent order: Cream cheese, Yoghurt, Chicken breast, Milk, Spinach.
- [ ] Dairy + USE SOON + `mil` returns only Milk; `zzz` shows a useful empty state; clear restores 20.
- [ ] Milk/Yoghurt each show two badges; Rice has no expiry.
- [ ] Generate displays real counts and refreshes; errors never produce fake success.
- [ ] Shared components satisfy agreed props; navigation works on every route.
- [ ] Show desktop/mobile, keyboard, loading, empty and error states; client build/lint pass.

Submit a focused PR with screenshots, commands/results and a short English demo. Fix your own integration failures; request shared-file changes from the owner.
