# Mock demo accounts

These public demo credentials work only when `VITE_USE_MOCKS=true`. The local design preview uses http://127.0.0.1:5174/. They do not create real backend accounts.

| Name | Email | Password | Role |
| --- | --- | --- | --- |
| Molham | molham@example.com | MolhamDemo2026! | Admin |
| Rami | rami@example.com | RamiDemo2026! | Member |
| Mostafa | mostafa@example.com | MostafaDemo2026! | Member |
| Maya | maya@example.com | MayaDemo2026! | Member |
| Mohammad | mohammad@example.com | MohammadDemo2026! | Member |
| Allith | allith@example.com | AllithDemo2026! | Member |

All six belong to the same demo household with 20 pantry items, 7 categories, and sample shopping entries and purchase history. Admins can change items and shopping entries; members have view-only access.

The fixed mock date is **16 October 2026**. It keeps low-stock and expiry examples predictable. The mock API's timestamp is `2026-10-16T09:00:00.000Z` (12:00 in Damascus).

Refresh the page to restore the fixture data. Changes exist only in the current page's in-memory mock state and are not synchronized between browser tabs. The seeded accounts return on every reload. Normal registrations create a separate, initially empty demo household.

The existing generic accounts remain available: `admin@example.com` / `admin123`, `member@example.com` / `member123`, and `owner@example.com` / `owner123`.
