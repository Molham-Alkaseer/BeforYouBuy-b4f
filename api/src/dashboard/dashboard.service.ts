import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PantryItem } from '../pantry/schemas/pantry-item.schema';
import { Category } from '../categories/schemas/category.schema';
import { ShoppingEntry } from '../shopping-list/schemas/shopping-entry.schema';
import { PANTRY_CLOCK, PantryClock } from '../pantry/pantry-dependencies';
import { pantryResponse } from '../pantry/pantry-response';
import { DashboardResponse } from './dashboard-response';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel('PantryItem') private readonly items: Model<PantryItem>,
    @InjectModel('Category') private readonly categories: Model<Category>,
    @InjectModel('ShoppingEntry')
    private readonly entries: Model<ShoppingEntry>,
    @Inject(PANTRY_CLOCK) private readonly clock: PantryClock,
  ) {}

  async summary(): Promise<DashboardResponse> {
    const asOfDate = this.clock.today();
    const [stored, categories, pending] = await Promise.all([
      this.items.find().lean().exec(),
      this.categories.find().sort({ id: 1 }).lean().exec(),
      this.entries.find({ status: 'Pending' }).lean().exec(),
    ]);
    const names = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const items = stored.map((item) =>
      pantryResponse(item, names.get(item.categoryId) ?? '', asOfDate),
    );
    const statusCounts: DashboardResponse['statusCounts'] = {
      'LOW STOCK': 0,
      'USE SOON': 0,
      EXPIRED: 0,
      OK: 0,
    };
    const counts = new Map<number, number>();
    for (const item of items) {
      for (const status of item.statuses) statusCounts[status]++;
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    }
    const linked = pending.filter((entry) => entry.pantryItemId != null).length;
    return {
      asOfDate,
      totalItems: items.length,
      statusCounts,
      urgentItems: items
        .filter(
          (item) =>
            item.statuses.includes('EXPIRED') ||
            item.statuses.includes('USE SOON'),
        )
        .sort(
          (a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id - b.id,
        ),
      pendingShopping: {
        total: pending.length,
        linked,
        manual: pending.length - linked,
      },
      categoryCounts: categories.map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        count: counts.get(category.id) ?? 0,
      })),
    };
  }
}
