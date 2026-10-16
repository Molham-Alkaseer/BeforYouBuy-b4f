import { FilterQuery } from "mongoose";
import { FindPantryQueryDto } from "./dto/find-pantry-query.dto";
import { PantryItem } from "./schemas/pantry-item.schema";

/** Stored predicates are only a prefilter. Current statuses are always calculated afterwards. */
export function pantryStoredQuery(query: FindPantryQueryDto, today: string) {
  const filter: FilterQuery<PantryItem> = {};
  if (query.categoryId !== undefined) filter.categoryId = query.categoryId;
  if (query.name?.trim())
    filter.name = {
      $regex: query.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  if (query.status === "USE SOON") {
    const through = new Date(Date.parse(today) + 3 * 86400000)
      .toISOString()
      .slice(0, 10);
    filter.expiryDate = { $gte: today, $lte: through };
  } else if (query.status === "EXPIRED") {
    filter.expiryDate = { $ne: null, $lt: today };
  }
  const sort: Record<string, 1> = filter.expiryDate
    ? { expiryDate: 1, id: 1 }
    : { id: 1 };
  return { filter, sort };
}
