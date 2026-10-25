import { useEffect, useState } from 'react';
import EmptyState from '../../components/EmptyState';
import LoadingMessage from '../../components/LoadingMessage';
import PurchaseHistoryTable from '../../components/PurchaseHistoryTable';
import { readApiError } from './apiError';
import { itemApi } from './itemApi';
import type { ShoppingEntry } from './itemTypes';
import RetryError from './RetryError';

// The history section is always in exactly one of these situations.
type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; entries: ShoppingEntry[] };

interface ItemHistoryProps {
  itemId: number;
  itemName: string;
}

export default function ItemHistory({ itemId, itemName }: ItemHistoryProps) {
  const [state, setState] = useState<HistoryState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0); // goes up by 1 on every "Try again"

  useEffect(() => {
    let cancelled = false; // stops old requests from changing the screen
    setState({ kind: 'loading' });

    async function load() {
      try {
        const list = await itemApi.listShoppingEntries({
          status: 'Purchased',
          pantryItemId: itemId,
        });
        if (!cancelled) {
          setState({ kind: 'ready', entries: list.items });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ kind: 'error', message: readApiError(error).message });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [itemId, attempt]);

  return (
    <section className="item-card" aria-labelledby="item-history-title">
      <h2 id="item-history-title">Purchase history</h2>
      <p>Every time {itemName} was bought and restocked</p>

      {state.kind === 'loading' && (
        <LoadingMessage message="Loading purchase history..." />
      )}

      {state.kind === 'error' && (
        <RetryError
          message={state.message}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      )}

      {state.kind === 'ready' && state.entries.length === 0 && (
        <EmptyState message="No purchases recorded yet." />
      )}

      {state.kind === 'ready' && state.entries.length > 0 && (
        <PurchaseHistoryTable entries={state.entries} />
      )}
    </section>
  );
}