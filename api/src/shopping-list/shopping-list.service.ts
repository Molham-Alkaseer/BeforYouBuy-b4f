import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { ShoppingEntry, EntryStatus } from './schemas/shopping-entry.schema';
import { PantryItem } from '../pantry/schemas/pantry-item.schema';
import { Category } from '../categories/schemas/category.schema';
import { ClockService } from '../common/clock/clock.service';
import { IdsService } from '../database/ids.service';
import { WriteService } from '../database/write.service';
import { apiError } from '../common/errors/api-error';
import { calculatePantryStatus } from '../pantry/pantry-status';
import { pantryResponse } from '../pantry/pantry-response';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { PurchaseEntryDto } from './dto/purchase-entry.dto';
import { FindShoppingListQueryDto } from './dto/find-shopping-list-query.dto';

@Injectable()
export class ShoppingListService {
  private readonly logger = new Logger(ShoppingListService.name);
  constructor(
    @InjectModel(ShoppingEntry.name)
    private readonly entries: Model<ShoppingEntry>,
    @InjectModel(PantryItem.name) private readonly items: Model<PantryItem>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    private readonly clock: ClockService,
    private readonly ids: IdsService,
    private readonly writes: WriteService,
  ) {}

  private nameConflict() {
    return apiError(
      409,
      'PENDING_NAME_CONFLICT',
      'A different Pending entry uses this name. Remove or purchase it first.',
      {
        name: [
          'Pending names must be unique, ignoring capitals and surrounding spaces.',
        ],
      },
    );
  }

  private async nameWrite<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error?.code === 11000 && error.keyPattern?.normalizedName)
        throw this.nameConflict();
      throw error;
    }
  }

  private response(entry: ShoppingEntry, today: string, linked?: PantryItem) {
    return {
      id: entry.id,
      name: entry.name,
      quantityToBuy: entry.quantityToBuy,
      unit: entry.unit ?? null,
      pantryItemId: entry.pantryItemId ?? null,
      status: entry.status,
      createdAt: new Date(entry.createdAt).toISOString(),
      purchasedAt: entry.purchasedAt
        ? new Date(entry.purchasedAt).toISOString()
        : null,
      purchasedQuantity: entry.purchasedQuantity ?? null,
      newExpiryDate: entry.newExpiryDate ?? null,
      pantryStatuses:
        entry.status === EntryStatus.PENDING && linked
          ? calculatePantryStatus(linked, today).statuses
          : [],
    };
  }

  async findAll(
    query: FindShoppingListQueryDto = {},
    session?: ClientSession,
    today = this.clock.today(),
  ) {
    const filter = {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.pantryItemId === undefined
        ? {}
        : { pantryItemId: query.pantryItemId }),
    };
    // Session operations are deliberately sequential; a transaction cannot run them in parallel.
    const stored = await this.entries
      .find(filter)
      .session(session ?? null)
      .lean()
      .exec();
    const pantry = await this.items
      .find()
      .session(session ?? null)
      .lean()
      .exec();
    const pending = await this.entries
      .find({ status: EntryStatus.PENDING })
      .session(session ?? null)
      .lean()
      .exec();
    const linkedById = new Map(pantry.map((item) => [item.id, item]));
    stored.sort((a, b) => {
      if (a.status !== b.status)
        return a.status === EntryStatus.PENDING ? -1 : 1;
      return a.status === EntryStatus.PENDING
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
            a.id - b.id
        : new Date(b.purchasedAt).getTime() -
            new Date(a.purchasedAt).getTime() || b.id - a.id;
    });
    const items = stored.map((entry) =>
      this.response(entry, today, linkedById.get(entry.pantryItemId)),
    );
    const linked = pending.filter(
      (entry) => entry.pantryItemId !== null,
    ).length;
    return {
      asOfDate: today,
      items,
      total: items.length,
      pendingSummary: {
        total: pending.length,
        linked,
        manual: pending.length - linked,
      },
    };
  }

  async addManualEntry(dto: CreateManualEntryDto) {
    const id = await this.ids.next('shopping_entries');
    const today = this.clock.today();
    const result = await this.nameWrite(() =>
      this.writes.run(async (session) => {
        const normalizedName = dto.name.trim().toLowerCase();
        if (
          await this.entries
            .exists({ normalizedName, status: EntryStatus.PENDING })
            .session(session)
            .exec()
        )
          throw this.nameConflict();
        const [entry] = await this.entries.create(
          [
            {
              id,
              name: dto.name.trim(),
              normalizedName,
              quantityToBuy: dto.quantityToBuy,
              unit: null,
              pantryItemId: null,
              status: EntryStatus.PENDING,
              createdAt: this.clock.now(),
              purchasedAt: null,
              purchasedQuantity: null,
              newExpiryDate: null,
            },
          ],
          { session },
        );
        return this.response(entry, today);
      }),
    );
    this.logger.log(`Created manual shopping entry ${id}`);
    return result;
  }

  async generateShoppingList() {
    const today = this.clock.today();
    const result = await this.nameWrite(() =>
      this.writes.run(async (session) => {
        const pantry = await this.items
          .find()
          .sort({ id: 1 })
          .session(session)
          .lean()
          .exec();
        const pending = await this.entries
          .find({ status: EntryStatus.PENDING })
          .session(session)
          .exec();
        let added = 0,
          updated = 0,
          unchanged = 0;
        for (const item of pantry) {
          const { statuses } = calculatePantryStatus(item, today);
          if (!statuses.includes('LOW STOCK') && !statuses.includes('EXPIRED'))
            continue;
          const effectiveQuantity = statuses.includes('EXPIRED')
            ? 0
            : item.quantity;
          const quantityToBuy = Number(
            Math.max(1, item.minimumQuantity - effectiveQuantity).toPrecision(
              15,
            ),
          );
          const normalizedName = item.name.trim().toLowerCase();
          const existing = pending.find(
            (entry) => entry.pantryItemId === item.id,
          );
          const conflict = pending.find(
            (entry) =>
              entry.normalizedName === normalizedName &&
              entry.id !== existing?.id,
          );
          if (conflict) throw this.nameConflict();
          if (existing) {
            if (
              existing.name !== item.name ||
              existing.unit !== item.unit ||
              existing.quantityToBuy !== quantityToBuy
            ) {
              existing.name = item.name;
              existing.normalizedName = normalizedName;
              existing.unit = item.unit;
              existing.quantityToBuy = quantityToBuy;
              await existing.save({ session });
              updated++;
            } else unchanged++;
          } else {
            // These allocations are part of the SAME transaction, so retries cannot leak side effects.
            const id = await this.ids.next('shopping_entries', session);
            const [entry] = await this.entries.create(
              [
                {
                  id,
                  name: item.name,
                  normalizedName,
                  quantityToBuy,
                  unit: item.unit,
                  pantryItemId: item.id,
                  status: EntryStatus.PENDING,
                  createdAt: this.clock.now(),
                  purchasedAt: null,
                  purchasedQuantity: null,
                  newExpiryDate: null,
                },
              ],
              { session },
            );
            pending.push(entry);
            added++;
          }
        }
        return {
          added,
          updated,
          unchanged,
          pending: await this.findAll(
            { status: EntryStatus.PENDING },
            session,
            today,
          ),
        };
      }),
    );
    this.logger.log(
      `Generated shopping list: added=${result.added}, updated=${result.updated}, unchanged=${result.unchanged}`,
    );
    return result;
  }

  async purchaseEntry(id: number, dto: PurchaseEntryDto) {
    const today = this.clock.today();
    const result = await this.writes.run(async (session) => {
      const entry = await this.entries.findOne({ id }).session(session).exec();
      if (!entry)
        throw apiError(404, 'ENTRY_NOT_FOUND', 'Shopping entry not found.');
      if (entry.status === EntryStatus.PURCHASED)
        throw apiError(
          409,
          'ALREADY_PURCHASED',
          'This entry has already been purchased.',
        );
      let pantryItem = null;
      if (entry.pantryItemId === null) {
        if (dto.newExpiryDate !== undefined)
          throw apiError(
            400,
            'VALIDATION_ERROR',
            'Manual entries cannot have an expiry date.',
            {
              newExpiryDate: ['Omit the expiry date for a manual entry.'],
            },
          );
      } else {
        const item = await this.items
          .findOne({ id: entry.pantryItemId })
          .session(session)
          .exec();
        if (!item)
          throw apiError(
            404,
            'ITEM_NOT_FOUND',
            'Linked pantry item not found.',
          );
        const expired = calculatePantryStatus(item, today).statuses.includes(
          'EXPIRED',
        );
        if (expired && dto.newExpiryDate === undefined)
          throw apiError(
            400,
            'EXPIRY_REQUIRED',
            'A new expiry date is required to replace expired stock.',
            {
              newExpiryDate: [
                'Provide a valid expiry date for the replacement stock.',
              ],
            },
          );
        const quantity = expired
          ? dto.purchasedQuantity
          : item.quantity + dto.purchasedQuantity;
        if (!Number.isFinite(quantity))
          throw apiError(
            400,
            'VALIDATION_ERROR',
            'The resulting stock quantity is too large.',
            {
              purchasedQuantity: ['Choose a smaller quantity.'],
            },
          );
        item.quantity = Number(quantity.toPrecision(15));
        if (dto.newExpiryDate !== undefined)
          item.expiryDate = dto.newExpiryDate;
        await item.save({ session });
        entry.name = item.name;
        entry.normalizedName = item.normalizedName;
        entry.unit = item.unit;
        entry.newExpiryDate = item.expiryDate;
        const category = await this.categories
          .findOne({ id: item.categoryId })
          .session(session)
          .lean()
          .exec();
        pantryItem = pantryResponse(item, category?.name ?? '', today);
      }
      entry.status = EntryStatus.PURCHASED;
      entry.purchasedAt = this.clock.now();
      entry.purchasedQuantity = dto.purchasedQuantity;
      await entry.save({ session });
      return { entry: this.response(entry, today), pantryItem };
    });
    this.logger.log(
      `Purchased shopping entry ${id}; pantryItemId=${result.entry.pantryItemId ?? 'manual'}, quantity=${dto.purchasedQuantity}, stock=${result.pantryItem?.quantity ?? 'unchanged'}`,
    );
    return result;
  }

  async deleteEntry(id: number): Promise<void> {
    await this.writes.run(async (session) => {
      const entry = await this.entries.findOne({ id }).session(session).exec();
      if (!entry)
        throw apiError(404, 'ENTRY_NOT_FOUND', 'Shopping entry not found.');
      if (entry.status === EntryStatus.PURCHASED)
        throw apiError(
          409,
          'ENTRY_ALREADY_PURCHASED',
          'Purchase history cannot be deleted.',
        );
      await this.entries.deleteOne({ id }, { session }).exec();
    });
    this.logger.log(`Deleted Pending shopping entry ${id}`);
  }
}
