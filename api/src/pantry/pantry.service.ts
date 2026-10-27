import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { PantryItem } from './schemas/pantry-item.schema';
import { Category } from '../categories/schemas/category.schema';
import { ShoppingEntry } from '../shopping-list/schemas/shopping-entry.schema';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto';
import { FindPantryQueryDto } from './dto/find-pantry-query.dto';
import {
  HouseholdWrites,
  PANTRY_CLOCK,
  PANTRY_IDS,
  PANTRY_WRITES,
  PantryClock,
  PantryIds,
} from './pantry-dependencies';
import { pantryError } from './pantry-errors';
import { pantryResponse } from './pantry-response';
import { pantryStoredQuery } from './pantry-query';

@Injectable()
export class PantryService {
  private readonly logger = new Logger(PantryService.name);

  // Verified actor identity is supplied by the authenticated controller.
  private actorContext(actorId: number): string {
    return Number.isSafeInteger(actorId) && actorId > 0
      ? `, actorId=${actorId}`
      : '';
  }
  constructor(
    @InjectModel('PantryItem') private readonly items: Model<PantryItem>,
    @InjectModel('Category') private readonly categories: Model<Category>,
    @InjectModel('ShoppingEntry')
    private readonly entries: Model<ShoppingEntry>,
    @Inject(PANTRY_CLOCK) private readonly clock: PantryClock,
    @Inject(PANTRY_IDS) private readonly ids: PantryIds,
    @Inject(PANTRY_WRITES) private readonly writes: HouseholdWrites,
  ) {}

  async findAll(query: FindPantryQueryDto, householdId: number) {
    const asOfDate = this.clock.today();
    const { filter, sort } = pantryStoredQuery(query, asOfDate);
    const [stored, categories] = await Promise.all([
      this.items
        .find({ ...filter, householdId })
        .sort(sort)
        .lean()
        .exec(),
      this.categories.find().lean().exec(),
    ]);
    const names = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const items = stored
      .map((item) =>
        pantryResponse(item, names.get(item.categoryId) ?? '', asOfDate),
      )
      .filter((item) => !query.status || item.statuses.includes(query.status))
      .sort((a, b) => a.id - b.id);
    return { asOfDate, items, total: items.length };
  }

  private async getStored(
    id: number,
    householdId: number,
    session?: ClientSession,
  ) {
    const item = await this.items
      .findOne({ id, householdId })
      .session(session ?? null)
      .lean()
      .exec();
    if (!item)
      throw pantryError(404, 'ITEM_NOT_FOUND', 'Pantry item not found.');
    return item;
  }

  private async enrich(
    item: PantryItem,
    today: string,
    session?: ClientSession,
  ) {
    const category = await this.categories
      .findOne({ id: item.categoryId })
      .session(session ?? null)
      .lean()
      .exec();
    return pantryResponse(item, category?.name ?? '', today);
  }

  async findOne(id: number, householdId: number) {
    const today = this.clock.today();
    return this.enrich(await this.getStored(id, householdId), today);
  }

  private async validateReferences(
    dto: UpdatePantryItemDto,
    session: ClientSession,
    householdId: number,
    id?: number,
  ) {
    if (
      dto.categoryId !== undefined &&
      !(await this.categories
        .exists({ id: dto.categoryId })
        .session(session)
        .exec())
    ) {
      throw pantryError(
        400,
        'INVALID_CATEGORY',
        'The selected category does not exist.',
        { categoryId: ['Choose an existing category.'] },
      );
    }
    if (
      dto.name !== undefined &&
      (await this.items
        .exists({
          householdId,
          normalizedName: dto.name.trim().toLowerCase(),
          ...(id === undefined ? {} : { id: { $ne: id } }),
        })
        .session(session)
        .exec())
    )
      throw this.duplicateName();
  }

  private duplicateName() {
    return pantryError(
      409,
      'DUPLICATE_ITEM_NAME',
      'An item with this name is already in your pantry.',
      { name: ['Names ignore capitals and surrounding spaces.'] },
    );
  }

  private async nameWrite<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error?.code === 11000 &&
        (error.keyPattern?.normalizedName || error.keyValue?.normalizedName)
      ) {
        throw this.duplicateName();
      }
      throw error;
    }
  }

  async create(dto: CreatePantryItemDto, actorId: number, householdId: number) {
    const today = this.clock.today();
    // Allocation is outside retryable work: failed writes may leave gaps, never reuse IDs.
    const id = await this.ids.next('pantry_items');
    const result = await this.nameWrite(() =>
      this.writes.run(async (session) => {
        await this.validateReferences(dto, session, householdId);
        const [item] = await this.items.create(
          [
            {
              id,
              householdId,
              name: dto.name.trim(),
              normalizedName: dto.name.trim().toLowerCase(),
              categoryId: dto.categoryId,
              quantity: dto.quantity,
              unit: dto.unit.trim(),
              minimumQuantity: dto.minimumQuantity,
              expiryDate: dto.expiryDate ?? null,
            },
          ],
          { session },
        );
        return this.enrich(item, today, session);
      }),
    );
    this.logger.log(
      `Pantry item created: id=${id}${this.actorContext(actorId)}`,
    );
    return result;
  }

  async update(
    id: number,
    dto: UpdatePantryItemDto,
    actorId: number,
    householdId: number,
  ) {
    if (!Object.keys(dto).length)
      throw pantryError(
        400,
        'VALIDATION_ERROR',
        'Provide at least one field to update.',
      );
    const today = this.clock.today();
    const result = await this.nameWrite(() =>
      this.writes.run(async (session) => {
        await this.getStored(id, householdId, session);
        await this.validateReferences(dto, session, householdId, id);
        const changes: Partial<PantryItem> = {};
        for (const key of [
          'categoryId',
          'quantity',
          'minimumQuantity',
          'expiryDate',
        ] as const) {
          if (dto[key] !== undefined)
            (changes as Record<string, unknown>)[key] = dto[key];
        }
        if (dto.name !== undefined) {
          changes.name = dto.name.trim();
          changes.normalizedName = changes.name.toLowerCase();
        }
        if (dto.unit !== undefined) changes.unit = dto.unit.trim();
        const item = await this.items
          .findOneAndUpdate(
            { id, householdId },
            { $set: changes },
            { new: true, runValidators: true, session },
          )
          .lean()
          .exec();
        if (!item)
          throw pantryError(404, 'ITEM_NOT_FOUND', 'Pantry item not found.');
        return this.enrich(item, today, session);
      }),
    );
    this.logger.log(
      `Pantry item updated: id=${id}${this.actorContext(actorId)}`,
    );
    return result;
  }

  async use(
    id: number,
    quantity: number,
    actorId: number,
    householdId: number,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw pantryError(
        400,
        'VALIDATION_ERROR',
        'Used quantity must be a finite positive number.',
        { quantity: ['Enter a number greater than zero.'] },
      );
    }
    const today = this.clock.today();
    let starting: number;
    const result = await this.writes
      .run(async (session) => {
        const current = await this.getStored(id, householdId, session);
        starting = current.quantity;
        if (quantity > current.quantity) {
          throw pantryError(
            400,
            'INSUFFICIENT_STOCK',
            `Only ${current.quantity} ${current.unit} of ${current.name} are available.`,
            {
              quantity: [
                `Use no more than the available quantity: ${current.quantity} ${current.unit}.`,
              ],
            },
          );
        }
        const remaining = Number((current.quantity - quantity).toPrecision(15));
        // Compare-and-set also protects against an overlapping direct stock update.
        const item = await this.items
          .findOneAndUpdate(
            { id, householdId, quantity: current.quantity },
            { $set: { quantity: remaining } },
            { new: true, runValidators: true, session },
          )
          .lean()
          .exec();
        if (!item)
          throw new Error(
            'Shared write boundary failed to isolate the pantry stock update.',
          );
        return this.enrich(item, today, session);
      })
      .catch((error) => {
        if (error?.getResponse?.()?.code === 'INSUFFICIENT_STOCK') {
          this.logger.warn(
            `Pantry use rejected: code=INSUFFICIENT_STOCK, id=${id}${this.actorContext(actorId)}, available=${starting}, requested=${quantity}`,
          );
        }
        throw error;
      });
    this.logger.log(
      `Pantry stock used: id=${id}${this.actorContext(actorId)}, starting=${starting}, quantity=${quantity}, remaining=${result.quantity}`,
    );
    return result;
  }

  async remove(
    id: number,
    actorId: number,
    householdId: number,
  ): Promise<void> {
    await this.writes
      .run(async (session) => {
        const item = await this.getStored(id, householdId, session);
        if (
          await this.entries
            .exists({ householdId, pantryItemId: id, status: 'Pending' })
            .session(session)
            .exec()
        ) {
          throw pantryError(
            409,
            'ITEM_HAS_PENDING_ENTRY',
            `${item.name} cannot be deleted yet. Remove or purchase its pending shopping entry first.`,
          );
        }
        await this.items.deleteOne({ id, householdId }, { session }).exec();
        // Purchased snapshots are deliberately never updated or deleted.
      })
      .catch((error) => {
        if (error?.getResponse?.()?.code === 'ITEM_HAS_PENDING_ENTRY') {
          this.logger.warn(
            `Pantry deletion blocked: code=ITEM_HAS_PENDING_ENTRY, id=${id}${this.actorContext(actorId)}`,
          );
        }
        throw error;
      });
    this.logger.log(
      `Pantry item deleted: id=${id}${this.actorContext(actorId)}`,
    );
  }
}
