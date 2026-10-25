import { Connection } from 'mongoose';

/** Preserve the old shared demo as household 1. New signups never join it. */
export async function migrateLegacyHousehold(
  connection: Connection,
): Promise<void> {
  for (const name of ['pantry_items', 'shopping_entries']) {
    const collection = connection.collection(name);
    await collection.updateMany(
      { householdId: { $exists: false } },
      { $set: { householdId: 1 } },
    );
    // Build the replacement before removing only the known global name index.
    await collection.createIndex(
      { householdId: 1, normalizedName: 1 },
      name === 'pantry_items'
        ? { unique: true }
        : { unique: true, partialFilterExpression: { status: 'Pending' } },
    );
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (
        index.unique &&
        Object.keys(index.key).length === 1 &&
        index.key.normalizedName === 1
      ) {
        try {
          await collection.dropIndex(index.name);
        } catch (error) {
          if (error?.code !== 27) throw error;
        }
      }
    }
  }
}
