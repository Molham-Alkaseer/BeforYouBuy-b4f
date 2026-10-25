import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from './FormField';
import { readApiError } from './apiError';
import { itemApi } from './itemApi';
import {
  emptyValues,
  fieldErrorsFromApi,
  toPantryInput,
  validateValues,
  valuesFromItem,
} from './itemFormValues';
import type { FieldErrors, FieldName, FormValues } from './itemFormValues';
import { canWriteItems } from './itemSession';
import type { ItemSession } from './itemSession';
import type { Category, PantryItem } from './itemTypes';
import SessionProblem from './SessionProblem';
import SignInNotice from './SignInNotice';
import { sessionProblemOf } from './sessionErrors';
import type { SessionProblemKind } from './sessionErrors';
import StatusRulesPanel from './StatusRulesPanel';

const UNIT_SUGGESTIONS = [
  'litres',
  'kg',
  'pieces',
  'packs',
  'pots',
  'tubs',
  'bags',
  'blocks',
];

interface ItemFormBodyProps {
  categories: Category[];
  item: PantryItem | null; // null = adding a new item
  session: ItemSession;
}

interface FormProblem {
  kind: SessionProblemKind;
  detail?: string;
}

export default function ItemFormBody({
  categories,
  item,
  session,
}: ItemFormBodyProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<FormValues>(
    item ? valuesFromItem(item) : emptyValues,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverMessage, setServerMessage] = useState('');
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWrite = canWriteItems(session);
  const noCategories = categories.length === 0;
  const problems = Object.keys(errors).length;
  const cancelTo = item ? `/pantry/${item.id}` : '/pantry';

  // These two refs let a late answer know if the user left or signed out meanwhile.
  const isMounted = useRef(true);
  const canWriteRef = useRef(canWrite);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  useEffect(() => {
    canWriteRef.current = canWrite;
  }, [canWrite]);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const field = event.target.name as FieldName;
    const value = event.target.value;

    setValues((current) => ({ ...current, [field]: value }));

    // Typing in a field removes that field's error message.
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !canWrite) {
      return; // a save is already running, or saving is not allowed right now
    }

    setServerMessage('');
    setProblem(null);

    const found = validateValues(values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    const input = toPantryInput(values);
    if (input === null) {
      return;
    }

    setIsSubmitting(true);

    try {
      const saved = item
        ? await itemApi.updatePantryItem(item.id, input)
        : await itemApi.createPantryItem(input);

      if (!isMounted.current) {
        return;
      }

      // Signed out while the request was running: do not act as if all is fine.
      if (!canWriteRef.current) {
        setProblem({
          kind: 'unauthorized',
          detail:
            'Your last change may have been saved. Check the item after you sign in.',
        });
        setIsSubmitting(false);
        return;
      }

      navigate(`/pantry/${saved.id}`);
    } catch (error) {
      if (!isMounted.current) {
        return;
      }
      // The typed values stay exactly as they were. We never navigate on failure.
      const apiError = readApiError(error);
      const kind = sessionProblemOf(apiError);

      if (kind) {
        setProblem({ kind });
      } else {
        setErrors(fieldErrorsFromApi(apiError.fieldErrors));
        setServerMessage(apiError.message);
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className="item-form-layout">
      <form className="item-form" onSubmit={handleSubmit} noValidate>
        {!canWrite && session.status === 'checking' && (
          <p role="status" className="item-session-note">
            Checking your session...
          </p>
        )}

        {!canWrite && session.status === 'anonymous' && (
          <SignInNotice
            className="item-session-note"
            message="Sign in to save changes to items."
            returnTo={location.pathname}
          />
        )}

        {!canWrite && session.status === 'authenticated' && (
          <p role="status" className="item-session-note">
            Your account cannot save items.
          </p>
        )}

        {noCategories && (
          <p role="alert" className="item-error-summary">
            There are no categories yet, so an item cannot be saved. Ask the
            team to add a category first.
          </p>
        )}

        {problem !== null && (
          <SessionProblem
            kind={problem.kind}
            detail={problem.detail}
            returnTo={location.pathname}
            className="item-error-summary"
          />
        )}

        {serverMessage !== '' && (
          <p role="alert" className="item-error-summary">
            {serverMessage}
          </p>
        )}

        {serverMessage === '' && problems > 0 && (
          <p role="alert" className="item-error-summary">
            <strong>This item could not be saved.</strong> Please fix the{' '}
            {problems} {problems === 1 ? 'problem' : 'problems'} marked below.
          </p>
        )}

        <FormField id="item-name" label="Name" error={errors.name}>
          {(inputProps) => (
            <input
              {...inputProps}
              name="name"
              type="text"
              value={values.name}
              onChange={handleChange}
              autoComplete="off"
            />
          )}
        </FormField>

        <FormField id="item-category" label="Category" error={errors.categoryId}>
          {(inputProps) => (
            <select
              {...inputProps}
              name="categoryId"
              value={values.categoryId}
              onChange={handleChange}
              disabled={noCategories}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <div className="item-field-row">
          <FormField id="item-quantity" label="Quantity" error={errors.quantity}>
            {(inputProps) => (
              <input
                {...inputProps}
                name="quantity"
                type="text"
                inputMode="decimal"
                value={values.quantity}
                onChange={handleChange}
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField id="item-unit" label="Unit" error={errors.unit}>
            {(inputProps) => (
              <>
                <input
                  {...inputProps}
                  name="unit"
                  type="text"
                  list="item-unit-suggestions"
                  value={values.unit}
                  onChange={handleChange}
                  autoComplete="off"
                />
                <datalist id="item-unit-suggestions">
                  {UNIT_SUGGESTIONS.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>

          <FormField
            id="item-minimum"
            label="Minimum to keep"
            hint="Below this, the item is LOW STOCK."
            error={errors.minimumQuantity}
          >
            {(inputProps) => (
              <input
                {...inputProps}
                name="minimumQuantity"
                type="text"
                inputMode="decimal"
                value={values.minimumQuantity}
                onChange={handleChange}
                autoComplete="off"
              />
            )}
          </FormField>
        </div>

        <FormField
          id="item-expiry"
          label="Expiry date"
          optional
          hint="Leave empty for items that do not expire, such as rice."
          error={errors.expiryDate}
        >
          {(inputProps) => (
            <input
              {...inputProps}
              name="expiryDate"
              type="date"
              value={values.expiryDate}
              onChange={handleChange}
            />
          )}
        </FormField>

        <div className="item-form-actions">
          <button
            type="submit"
            disabled={noCategories || isSubmitting || !canWrite}
          >
            {isSubmitting ? 'Saving...' : 'Save item'}
          </button>
          <Link to={cancelTo} className="item-cancel-link">
            Cancel
          </Link>
        </div>
      </form>

      <StatusRulesPanel />
    </div>
  );
}