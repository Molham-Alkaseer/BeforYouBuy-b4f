export const PANTRY_STATUSES = [
  "LOW STOCK",
  "USE SOON",
  "EXPIRED",
  "OK",
] as const;
export type PantryStatus = (typeof PANTRY_STATUSES)[number];
export type StatusInput = {
  quantity: number;
  minimumQuantity: number;
  unit: string;
  expiryDate: string | null;
};

/** Compare calendar day numbers independently of the server timezone. */
export function calculatePantryStatus(
  item: StatusInput,
  today: string,
): {
  statuses: PantryStatus[];
  statusReasons: string[];
  daysUntilExpiry: number | null;
} {
  const daysUntilExpiry =
    item.expiryDate == null
      ? null
      : Math.round(
          (Date.parse(item.expiryDate) - Date.parse(today)) / 86400000,
        );
  const statuses: PantryStatus[] = [];
  const statusReasons: string[] = [];
  if (item.quantity < item.minimumQuantity) {
    statuses.push("LOW STOCK");
    statusReasons.push(
      `${Number((item.minimumQuantity - item.quantity).toPrecision(15))} ${item.unit} below minimum`,
    );
  }
  if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
    statuses.push("EXPIRED");
    statusReasons.push(`Expired ${-daysUntilExpiry} days ago`);
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 3) {
    statuses.push("USE SOON");
    statusReasons.push(`Expires in ${daysUntilExpiry} days`);
  }
  if (!statuses.length) {
    statuses.push("OK");
    statusReasons.push("Stock is sufficient and no expiry action is needed");
  }
  return { statuses, statusReasons, daysUntilExpiry };
}
