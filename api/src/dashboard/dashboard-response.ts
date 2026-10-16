import { ApiProperty } from "@nestjs/swagger";
import { PantryItemResponse } from "../pantry/pantry-response";
import { PantryStatus } from "../pantry/pantry-status";

export class PendingSummaryResponse {
  @ApiProperty() total: number;
  @ApiProperty() linked: number;
  @ApiProperty() manual: number;
}
export class CategoryCountResponse {
  @ApiProperty() categoryId: number;
  @ApiProperty() categoryName: string;
  @ApiProperty() count: number;
}
export class DashboardResponse {
  @ApiProperty({ format: "date" }) asOfDate: string;
  @ApiProperty() totalItems: number;
  @ApiProperty({
    example: { "LOW STOCK": 5, "USE SOON": 3, EXPIRED: 2, OK: 12 },
  })
  statusCounts: Record<PantryStatus, number>;
  @ApiProperty({ type: [PantryItemResponse] })
  urgentItems: PantryItemResponse[];
  @ApiProperty({ type: PendingSummaryResponse })
  pendingShopping: PendingSummaryResponse;
  @ApiProperty({ type: [CategoryCountResponse] })
  categoryCounts: CategoryCountResponse[];
}
