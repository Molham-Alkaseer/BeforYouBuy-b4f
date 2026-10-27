# B Buy design update

## Reference and branding

The three-page `uxpilot-export-10-26-26.pdf` provides the desktop dashboard, pantry, and shopping layouts. The seven-page `uxpilot-export-10-26-26 (1).pdf` provides the mobile layouts, including item details, add item, sign-in, and history. Its stretched export dimensions are not used as phone viewport dimensions.

The chosen brand is **B Buy**, as confirmed by Molham. The text wordmark uses the heading font from the PDFs. The actual household name, item data, category counts, dates, and permissions continue to come from the application.

## Shared style

| Element | Value |
| --- | --- |
| Headings and wordmark | Plus Jakarta Sans, weights 500–800 |
| Body and controls | Inter, weights 400–700 |
| Page background | `#F9F7F2` |
| Primary green | `#0B3D2E` |
| Main text | `#1F2937` |
| Card background | White |
| Border | `#E5E7EB` |
| Low-stock accent | `#F59E0B` |
| Expired accent | `#F43F46` |
| Stocked accent | `#10B981` |
| Suggestion panel | `#FEF3C7` |

Font files are served locally from `client/public/fonts`, with their SIL Open Font License files. No runtime Google Fonts request is needed. Shared tokens, buttons, navigation, dialogs, and typography are in `client/src/index.css`; page-specific styles stay in their feature directories.

Global CSS loads before page CSS so responsive overrides apply consistently. SVG icons share one local component. They provide category and action illustrations without introducing another dependency.

## Layout and behavior

- Desktop: horizontal navigation, four dashboard status cards, independent two-column dashboard panels, pantry table, and grouped shopping cards.
- Phone (700px and below): bottom navigation with an admin add button, two-column status cards, stacked pantry/shopping cards, horizontally scrollable category filters, and single-column forms. Content clears the bottom navigation and safe area.
- The dashboard status/category links open matching pantry filters. Category and status changes remain in the URL; Clear all removes them.
- Shopping has Pending and Purchased history views. `/history` provides a dedicated history page for the mobile navigation. History groups actual purchases by household-local date.
- Manual-entry and purchase forms use native dialogs with keyboard focus containment, Escape dismissal, labeled close buttons, and disabled dismissal during submission.
- Route changes return to the top of the page. Filtering does not reset scroll position.
- Registration, family management, validation messages, empty states, and missing/error states extend the same visual language.

Backend endpoints, household isolation, admin/owner write permissions, and member view-only access are unchanged. The reference's sample prices, Apple sign-in, and settings/privacy links are not rendered as pretend working features; they have no corresponding implementation in this project.

## Verification

Completed on 26 October 2026:

- Frontend production build: passed.
- Frontend ESLint: passed.
- Existing frontend-client and session-client integration suites: **32 tests passed, 2 suites**. These exercise the actual HTTP adapters and Nest API using disposable test databases.
- Visual browser checks at desktop 1440px, tablet 768px, and phone 390px/320px widths. The 320px check found and resolved an unwanted minimum-page-width scrollbar.
- Checked desktop dashboard, pantry, and shopping; phone dashboard, pantry, item details, item form, shopping, history, login, registration, and family layout.
- Verified dashboard filter links, Clear all, mobile category filtering, item creation, stock usage, invalid purchase quantity feedback, purchase recording, manual-entry creation, and purchase history.
- Verified a member account has four mobile navigation destinations and no admin add, generation, purchase, or removal controls.
- Browser console: no application warnings/errors in the checked flows.

UI write checks ran on a separate mock-data preview at port 5174, not the household database. Screenshots therefore show sample names, quantities, and the fixture date. Preview images are kept under ignored `.local/design-preview/`.
