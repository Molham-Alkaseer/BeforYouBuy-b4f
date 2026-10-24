# API Client Usage & Mock Tests

## 1. Teammate API Usage Example

You can import the shared `api` client anywhere in the project. It automatically switches to mock data if `VITE_USE_MOCKS=true` is in your `.env`.

```typescript
import { api } from "../services/api-client";

async function demoPantryUsage() {
  try {
    const pantry = await api.listPantry({ status: "LOW STOCK" });
    console.log(pantry.items);

    // Example mutation
    const updated = await api.usePantryItem(1, { quantity: 1 });
  } catch (error: any) {
    if (error.code === "NETWORK_ERROR") {
      console.error("Offline:", error.message);
    } else if (error.fieldErrors?.quantity) {
      console.error(
        "Validation failed for quantity:",
        error.fieldErrors.quantity[0],
      );
    } else {
      console.error("API Error:", error.message);
    }
  }
}
```

To test the mock layer locally without a backend:

Ensure .env has VITE_USE_MOCKS=true.

Add Manual Entry Conflict: Try adding an entry named milk (with spaces). It will throw a 409 PENDING_NAME_CONFLICT and show the field error.

Purchase with Expiry Logic: Select the expired Yoghurt. Leave the date blank and submit. You will see a required error. Put 2026-10-25 and it will succeed, moving to the history list.

If you need to reset the data back to baseline during tests, you can import and call resetMockDb() from ../mocks/mock-api.
