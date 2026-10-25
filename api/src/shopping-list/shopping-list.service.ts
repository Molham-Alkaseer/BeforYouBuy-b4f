import { HttpException, Injectable, Logger } from '@nestjs/common';
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

/** Verified account ID from the request; null only until the shared AuthModule is wired. */
export type ActorId = number | null;

/** Expected business rejections worth a warning; anything else is the global filter's job. */
const LOGGED_REJECTIONS = new Set([
  'PENDING_NAME_CONFLICT',
  'ALREADY_PURCHASED',
  'EXPIRY_REQUIRED',
  'ENTRY_ALREADY_PURCHASED',
]);

type RejectionIds = { entryId?: number | null; pantryItemId?: number | null };

/** Real values read and written inside the purchase transaction, never sent on the wire. */
type Restock = {
  pantryItemId: number;
  stockBefore: number;
  stockAfter: number;
  expiredReplacement: boolean;
};

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

  /**
   * Runs outside WriteService.run, so a transaction retry cannot log twice. The
   * callback fills `ids` with safe numeric IDs; the latest attempt wins.
   */
  private async logRejection<T>(
    operation: string,
    actorId: ActorId,
    ids: RejectionIds,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const body =
        error instanceof HttpException ? error.getResponse() : undefined;
      const code =
        body && typeof body === 'object'
          ? (body as { code?: unknown }).code
          : undefined;
      if (typeof code === 'string' && LOGGED_REJECTIONS.has(code))
        this.logger.warn(
          `Rejected shopping ${operation}; code=${code}, actorId=${actorId}, entryId=${ids.entryId ?? 'none'}, pantryItemId=${ids.pantryItemId ?? 'none'}`,
        );
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

  async addManualEntry(dto: CreateManualEntryDto, actorId: ActorId) {
    const id = await this.ids.next('shopping_entries');
    const today = this.clock.today();
    const ids: RejectionIds = {};
    const result = await this.logRejection('add', actorId, ids, () =>
      this.nameWrite(() =>
        this.writes.run(async (session) => {
          const normalizedName = dto.name.trim().toLowerCase();
          const conflict = await this.entries
            .findOne({ normalizedName, status: EntryStatus.PENDING })
            .select({ id: 1, pantryItemId: 1 })
            .session(session)
            .lean()
            .exec();
          if (conflict) {
            ids.entryId = conflict.id;
            ids.pantryItemId = conflict.pantryItemId;
            throw this.nameConflict();
          }
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
      ),
    );
    this.logger.log(`Created manual shopping entry ${id}; actorId=${actorId}`);
    return result;
  }

  async generateShoppingList(actorId: ActorId) {
    const today = this.clock.today();
    const ids: RejectionIds = {};
    const result = await this.logRejection('generate', actorId, ids, () =>
      this.nameWrite(() =>
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
            if (
              !statuses.includes('LOW STOCK') &&
              !statuses.includes('EXPIRED')
            )
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
            if (conflict) {
              ids.entryId = conflict.id;
              ids.pantryItemId = item.id;
              throw this.nameConflict();
            }
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
      ),
    );
    this.logger.log(
      `Generated shopping list: added=${result.added}, updated=${result.updated}, unchanged=${result.unchanged}, actorId=${actorId}`,
    );
    return result;
  }

  async purchaseEntry(id: number, dto: PurchaseEntryDto, actorId: ActorId) {
    const today = this.clock.today();
    const ids: RejectionIds = { entryId: id };
    const { response, restock } = await this.logRejection(
      'purchase',
      actorId,
      ids,
      () =>
        this.writes.run(async (session) => {
          const entry = await this.entries
            .findOne({ id })
            .session(session)
            .exec();
          if (!entry)
            throw apiError(404, 'ENTRY_NOT_FOUND', 'Shopping entry not found.');
          ids.pantryItemId = entry.pantryItemId;
          if (entry.status === EntryStatus.PURCHASED)
            throw apiError(
              409,
              'ALREADY_PURCHASED',
              'This entry has already been purchased.',
            );
          let pantryItem = null;
          let restock: Restock | null = null;
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
            const expired = calculatePantryStatus(
              item,
              today,
            ).statuses.includes('EXPIRED');
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
            const stockBefore = item.quantity;
            item.quantity = Number(quantity.toPrecision(15));
            restock = {
              pantryItemId: item.id,
              stockBefore,
              stockAfter: item.quantity,
              expiredReplacement: expired,
            };
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
          return {
            response: { entry: this.response(entry, today), pantryItem },
            restock,
          };
        }),
    );
    // Reached only after commit; `stock` stays as the legacy alias of stockAfter.
    this.logger.log(
      restock
        ? `Purchased shopping entry ${id}; pantryItemId=${restock.pantryItemId}, quantity=${dto.purchasedQuantity}, stock=${restock.stockAfter}, stockBefore=${restock.stockBefore}, stockAfter=${restock.stockAfter}, expiredReplacement=${restock.expiredReplacement}, actorId=${actorId}`
        : `Purchased shopping entry ${id}; pantryItemId=manual, quantity=${dto.purchasedQuantity}, stock=unchanged, restock=none, actorId=${actorId}`,
    );
    return response;
  }

  async deleteEntry(id: number, actorId: ActorId): Promise<void> {
    const ids: RejectionIds = { entryId: id };
    const pantryItemId = await this.logRejection('delete', actorId, ids, () =>
      this.writes.run(async (session) => {
        const entry = await this.entries
          .findOne({ id })
          .session(session)
          .exec();
        if (!entry)
          throw apiError(404, 'ENTRY_NOT_FOUND', 'Shopping entry not found.');
        ids.pantryItemId = entry.pantryItemId;
        if (entry.status === EntryStatus.PURCHASED)
          throw apiError(
            409,
            'ENTRY_ALREADY_PURCHASED',
            'Purchase history cannot be deleted.',
          );
        await this.entries.deleteOne({ id }, { session }).exec();
        return entry.pantryItemId;
      }),
    );
    this.logger.log(
      `Deleted Pending shopping entry ${id}; pantryItemId=${pantryItemId ?? 'manual'}, actorId=${actorId}`,
    );
  }
}
