import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingMessage from '../../components/LoadingMessage';
import { readApiError } from './apiError';
import { itemApi } from './itemApi';
import type { Category, PantryItem } from './itemTypes';
import { parseRouteId } from './parseRouteId';
import RetryError from './RetryError';
import ItemFormBody from './ItemFormBody';
import './items.css';

// The page is always in exactly one of these situations.
type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; categories: Category[]; item: PantryItem | null };

export default function ItemForm() {
  const { id } = useParams();
  const isEdit = id !== undefined; // /pantry/new has no id, /pantry/:id/edit has one
  const itemId = isEdit ? parseRouteId(id) : null;
  const invalidId = isEdit && itemId === null;

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0); // goes up by 1 on every "Try again"

  useEffect(() => {
    if (invalidId) {
      return;
    }

    let cancelled = false; // stops old requests from changing the screen
    setState({ kind: 'loading' });

    async function load() {
      try {
        const [categoryList, item] = await Promise.all([
          itemApi.listCategories(),
          itemId === null
            ? Promise.resolve(null)
            : itemApi.getPantryItem(itemId),
        ]);
        if (!cancelled) {
          setState({ kind: 'ready', categories: categoryList.items, item });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const apiError = readApiError(error);
        if (apiError.code === 'ITEM_NOT_FOUND') {
          setState({ kind: 'not-found' });
        } else {
          setState({ kind: 'error', message: apiError.message });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [invalidId, itemId, attempt]);

  const backLink = <Link to="/pantry">← Back to pantry</Link>;

  if (invalidId) {
    return (
      <section className="item-page">
        {backLink}
        <ErrorMessage message="This address does not point to a valid item." />
      </section>
    );
  }

  if (state.kind === 'loading') {
    return <LoadingMessage message="Loading the form..." />;
  }

  if (state.kind === 'not-found') {
    return (
      <section className="item-page">
        {backLink}
        <EmptyState message="Item not found." />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="item-page">
        {backLink}
        <RetryError
          message={state.message}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      </section>
    );
  }

  const { categories, item } = state;

  return (
    <section className="item-page">
      {backLink}
      <h1>{isEdit ? `Edit ${item?.name ?? 'item'}` : 'Add item'}</h1>
      <p>
        The same form is used to add and edit an item. Statuses are never typed
        in — they are worked out from what you enter here.
      </p>

      <ItemFormBody
        key={item?.id ?? 'new'}
        categories={categories}
        item={item}
      />
    </section>
  );
}