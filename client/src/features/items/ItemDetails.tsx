import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingMessage from '../../components/LoadingMessage';
import { readApiError } from './apiError';
import { itemApi } from './itemApi';
import { formatDate, formatDaysUntil, formatQuantity } from './itemFormat';
import type { PantryItem } from './itemTypes';
import { parseRouteId } from './parseRouteId';
import RetryError from './RetryError';
import ItemHistory from './ItemHistory';
import UseItemForm from './UseItemForm';
import DeleteItem from './DeleteItem';


// The page is always in exactly one of these situations.
type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; item: PantryItem };

export default function ItemDetails() {
  const { id } = useParams();
  const itemId = id === undefined ? null : parseRouteId(id);
  const invalidId = itemId === null;

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0); // goes up by 1 on every "Try again"

  useEffect(() => {
    if (itemId === null) {
      return;
    }
    const validId = itemId;

    let cancelled = false; // stops old requests from changing the screen
    setState({ kind: 'loading' });

    async function load() {
      try {
        const item = await itemApi.getPantryItem(validId);
        if (!cancelled) {
          setState({ kind: 'ready', item });
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
  }, [itemId, attempt]);

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
    return <LoadingMessage message="Loading the item..." />;
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

  const { item } = state;
  const daysText = formatDaysUntil(item.daysUntilExpiry);

  return (
    <section className="item-page">
      {backLink}

      <header className="item-header">
        <h1>{item.name}</h1>
        <p className="item-category">{item.categoryName}</p>

        {/* TEMPORARY plain labels: replace with Rami's StatusBadge when it exists. */}
        <ul className="item-status-list" aria-label="Statuses">
          {item.statuses.map((status) => (
            <li key={status}>
              <strong className="item-status-label">{status}</strong>
            </li>
          ))}
        </ul>

        <Link to={`/pantry/${item.id}/edit`} className="item-edit-link">
          Edit item
        </Link>

        <DeleteItem key={item.id} item={item} />
      </header>

      <section className="item-card" aria-labelledby="item-info-title">
        <h2 id="item-info-title">Item information</h2>
        <dl className="item-info-grid">
          <div>
            <dt>Quantity</dt>
            <dd>{formatQuantity(item.quantity, item.unit)}</dd>
          </div>
          <div>
            <dt>Minimum to keep</dt>
            <dd>{formatQuantity(item.minimumQuantity, item.unit)}</dd>
          </div>
          <div>
            <dt>Expiry date</dt>
            <dd>
              {item.expiryDate ? formatDate(item.expiryDate) : 'No expiry date'}
              {daysText && <span className="item-days"> {daysText}</span>}
            </dd>
          </div>
        </dl>
      </section>

      <section className="item-card" aria-labelledby="item-why-title">
        <h2 id="item-why-title">Why this status?</h2>
        <p>Worked out just now from the stored data</p>
        <ul className="item-reason-list">
          {item.statusReasons.map((reason, index) => (
            <li key={reason}>
              {item.statuses[index] && (
                <strong className="item-status-label">
                  {item.statuses[index]}
                </strong>
              )}{' '}
              <span>{reason}</span>
            </li>
                    ))}
        </ul>
      </section>

      <UseItemForm
        key={item.id}
        item={item}
        onUsed={(updated) =>
          setState((current) =>
            current.kind === 'ready' && current.item.id === updated.id
              ? { kind: 'ready', item: updated }
              : current,
          )
        }
      />

      <ItemHistory key={item.id} itemId={item.id} itemName={item.name} />    </section>
  );
}