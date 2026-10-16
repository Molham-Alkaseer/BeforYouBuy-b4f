import { ApiProperty } from "@nestjs/swagger";
import { PantryItem } from "./schemas/pantry-item.schema";
import {
  calculatePantryStatus,
  PANTRY_STATUSES,
  PantryStatus,
} from "./pantry-status";

export class PantryItemResponse {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() categoryId: number;
  @ApiProperty() categoryName: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unit: string;
  @ApiProperty() minimumQuantity: number;
  @ApiProperty({ type: String, format: "date", nullable: true }) expiryDate:
    string | null;
  @ApiProperty({ enum: PANTRY_STATUSES, isArray: true })
  statuses: PantryStatus[];
  @ApiProperty({ type: [String] }) statusReasons: string[];
  @ApiProperty({ type: Number, nullable: true }) daysUntilExpiry: number | null;
}
export class PantryListResponse {
  @ApiProperty({ format: "date" }) asOfDate: string;
  @ApiProperty({ type: [PantryItemResponse] }) items: PantryItemResponse[];
  @ApiProperty() total: number;
}

export function pantryResponse(
  item: PantryItem,
  categoryName: string,
  today: string,
): PantryItemResponse {
  // Allowlist deliberately excludes Mongo metadata and normalizedName.
  return {
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    categoryName,
    quantity: item.quantity,
    unit: item.unit,
    minimumQuantity: item.minimumQuantity,
    expiryDate: item.expiryDate ?? null,
    ...calculatePantryStatus(item, today),
  };
}
