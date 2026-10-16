import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto'
import { PurchaseEntryDto } from './dto/purchase-entry.dto';
import { EntryStatus } from './schemas/shopping-entry.schema';
import * as mockData from './mocks/shoppind-list.mocks.json';

@Injectable()
export class ShoppingListService {
  private pendingEntries = [...mockData.shoppingPending.items];
  private pantryItems = [...mockData.pantry.items];
  private nextId = 300; 

  generateShoppingList() {
    let addedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    const eligiblePantryItems = this.pantryItems.filter(item => 
      item.statuses.includes('LOW STOCK') || item.statuses.includes('EXPIRED')
    );

    for (const pantryItem of eligiblePantryItems) {
      const isExpired = pantryItem.statuses.includes('EXPIRED');
      const effectiveQuantity = isExpired ? 0 : pantryItem.quantity;
      const suggestedBuyQuantity = Math.max(1, pantryItem.minimumQuantity - effectiveQuantity);

      const existingEntry = this.pendingEntries.find(
        entry => entry.pantryItemId === pantryItem.id && entry.status === EntryStatus.PENDING
      );

      if (existingEntry) {
        if (existingEntry.quantityToBuy !== suggestedBuyQuantity) {
          existingEntry.quantityToBuy = suggestedBuyQuantity;
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else {
        const nameConflict = this.pendingEntries.find(
          entry => entry.name.toLowerCase() === pantryItem.name.toLowerCase() && entry.status === EntryStatus.PENDING
        );

        if (nameConflict) {
          continue; 
        }

        this.pendingEntries.push({
          id: this.nextId++,
          name: pantryItem.name,
          quantityToBuy: suggestedBuyQuantity,
          unit: pantryItem.unit,
          pantryItemId: pantryItem.id,
          status: EntryStatus.PENDING,
          createdAt: new Date().toISOString(),
          purchasedAt: null,
          purchasedQuantity: null,
          newExpiryDate: null,
          pantryStatuses: pantryItem.statuses 
        } as any);
        addedCount++;
      }
    }

    console.log(`Generated list: ${addedCount} added, ${updatedCount} updated, ${unchangedCount} unchanged.`);

    return this.pendingEntries.filter(entry => entry.status === EntryStatus.PENDING);
  }

  addManualEntry(dto: CreateManualEntryDto) {
    const normalizedName = dto.name.toLowerCase().trim();

    const existingEntry = this.pendingEntries.find(
      entry => entry.name.toLowerCase().trim() === normalizedName && entry.status === EntryStatus.PENDING
    );

    if (existingEntry) {
      throw new ConflictException(`An item with the name '${dto.name}' is already in the pending list.`);
    }

    const newEntry = {
      id: this.nextId++,
      name: dto.name.trim(),
      quantityToBuy: dto.quantityToBuy,
      unit: null,          
      pantryItemId: null,  
      status: EntryStatus.PENDING,
      createdAt: new Date().toISOString(),
      purchasedAt: null,
      purchasedQuantity: null,
      newExpiryDate: null,
      pantryStatuses: []
    };

    this.pendingEntries.push(newEntry as any);
    return newEntry;
  }

  findAll(status?: EntryStatus, pantryItemId?: number) {
    let filtered = this.pendingEntries;

    if (status) {
      filtered = filtered.filter(entry => entry.status === status);
    }
    if (pantryItemId) {
      filtered = filtered.filter(entry => entry.pantryItemId === pantryItemId);
    }

    filtered.sort((a, b) => {
      if (a.status === EntryStatus.PENDING && b.status === EntryStatus.PENDING) {
        const dateDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return dateDiff !== 0 ? dateDiff : a.id - b.id;
      } else if (a.status === EntryStatus.PURCHASED && b.status === EntryStatus.PURCHASED) {
        const dateDiff = new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
        return dateDiff !== 0 ? dateDiff : a.id - b.id;
      }
      return 0;
    });

    const allPending = this.pendingEntries.filter(e => e.status === EntryStatus.PENDING);
    const pendingSummary = {
      total: allPending.length,
      linked: allPending.filter(e => e.pantryItemId !== null).length,
      manual: allPending.filter(e => e.pantryItemId === null).length,
    };

    return {
      items: filtered,
      total: filtered.length,
      pendingSummary,
    };
  }

  purchaseEntry(id: number, dto: PurchaseEntryDto) {
    const entry = this.pendingEntries.find(e => e.id === id);

    if (!entry) {
      throw new NotFoundException(`Shopping entry with id ${id} not found.`);
    }

    if (entry.status === EntryStatus.PURCHASED) {
      throw new ConflictException(`Entry ${id} has already been purchased.`);
    }

    if (entry.pantryItemId !== null) {
      const pantryItem = this.pantryItems.find(p => p.id === entry.pantryItemId);
      
      if (pantryItem) {
        const isExpired = pantryItem.statuses.includes('EXPIRED');

        if (isExpired) {
          if (!dto.newExpiryDate) {
            throw new ConflictException('A new expiry date is required when purchasing to replace an expired item.');
          }
          pantryItem.quantity = dto.purchasedQuantity; 
          pantryItem.expiryDate = dto.newExpiryDate;
        } else {
          pantryItem.quantity += dto.purchasedQuantity;
          if (dto.newExpiryDate) {
            pantryItem.expiryDate = dto.newExpiryDate;
          }
        }
      }
    }

    entry.status = EntryStatus.PURCHASED;
    entry.purchasedAt = new Date().toISOString() as any;
    entry.purchasedQuantity = dto.purchasedQuantity;
    entry.newExpiryDate = dto.newExpiryDate || null;

    console.log(`Successfully purchased entry ${id}. Restocked quantity: ${dto.purchasedQuantity}`);

    return entry;
  }

  deleteEntry(id: number) {
    const entryIndex = this.pendingEntries.findIndex(e => e.id === id);

    if (entryIndex === -1) {
      throw new NotFoundException(`Shopping entry with id ${id} not found.`);
    }

    const entry = this.pendingEntries[entryIndex];

    if (entry.status === EntryStatus.PURCHASED) {
      throw new ConflictException(`Cannot delete entry ${id} because it has already been purchased.`);
    }

    this.pendingEntries.splice(entryIndex, 1);
  }
}