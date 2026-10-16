// TODO: Calculate statuses, reasons and days until expiry from stored quantities and dates.
// LOW STOCK can coexist with USE SOON or EXPIRED. Never persist status labels.
export type PantryStatus = "LOW STOCK" | "USE SOON" | "EXPIRED" | "OK";
