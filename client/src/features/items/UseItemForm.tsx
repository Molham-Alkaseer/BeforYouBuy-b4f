import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { readApiError } from './apiError';
import { itemApi } from './itemApi';
import { formatQuantity } from './itemFormat';
import { parseDecimal } from './itemFormValues';
import type { PantryItem } from './itemTypes';
import SessionProblem from './SessionProblem';
import { sessionProblemOf } from './sessionErrors';
import type { SessionProblemKind } from './sessionErrors';

interface UseItemFormProps {
  item: PantryItem;
  onUsed: (updated: PantryItem) => void;
}

// Checks the typed amount. Returns the number, or a message to show.
function readAmount(text: string): { value: number } | { error: string } {
  if (text.trim() === '') {
    return { error: 'Enter the amount used.' };
  }

  const value = parseDecimal(text);
  if (value === null) {
    return { error: 'Amount must be a number. Decimals such as 0.5 are fine.' };
  }
  if (value <= 0) {
    return { error: 'Amount must be greater than 0.' };
  }
  return { value };
}

export default function UseItemForm({ item, onUsed }: UseItemFormProps) {
  const location = useLocation();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [problem, setProblem] = useState<SessionProblemKind | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stops a late answer from changing the screen after the user left it.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setAmount(event.target.value);
    setError('');
    setProblem(null);
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return; // a request is already running
    }

    setMessage('');
    setProblem(null);

    const result = readAmount(amount);
    if ('error' in result) {
      setError(result.error);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // Only the amount is sent. The server works out the new quantity and statuses.
      const updated = await itemApi.usePantryItem(item.id, {
        quantity: result.value,
      });

      if (!isMounted.current) {
        return;
      }
      onUsed(updated); // the page now shows the item the server returned
      setAmount('');
      setMessage(
        `Used ${formatQuantity(result.value, updated.unit)} of ${updated.name}.`,
      );
    } catch (caught) {
      if (!isMounted.current) {
        return;
      }
      // The typed amount stays, and the stock shown above does not change.
      const apiError = readApiError(caught);
      const kind = sessionProblemOf(apiError);
      if (kind) {
        setProblem(kind);
      } else {
        setError(apiError.message);
      }
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }

  const describedBy =
    error !== '' || problem !== null
      ? 'item-use-available item-use-error'
      : 'item-use-available';

  return (
    <section className="item-use-panel" aria-labelledby="item-use-title">
      <h2 id="item-use-title">Use some {item.name}</h2>
      <p>Record what you just used. It comes off the quantity straight away.</p>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="item-use-amount">Amount used ({item.unit})</label>
        <input
          id="item-use-amount"
          name="quantity"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={handleChange}
          aria-invalid={error !== ''}
          aria-describedby={describedBy}
        />
        <p id="item-use-available">
          Available: {formatQuantity(item.quantity, item.unit)}
        </p>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Recording...' : 'Record use'}
        </button>

        {error !== '' && (
          <p id="item-use-error" role="alert" className="item-use-error">
            {error}
          </p>
        )}

        {problem !== null && (
          <SessionProblem
            id="item-use-error"
            kind={problem}
            returnTo={location.pathname}
            className="item-use-error"
          />
        )}

        {message !== '' && (
          <p role="status" className="item-use-success">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}