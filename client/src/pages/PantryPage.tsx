import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingMessage from '../components/LoadingMessage';
import PantryFilters from '../features/pantry/PantryFilters';
import type { PantryFilterValues } from '../features/pantry/PantryFilters';
import PantryTable from '../features/pantry/PantryTable';
import { api } from '../services/api-client';
import type { Category, PantryList, PantryQuery } from '../types';
import '../features/pantry/pantry.css';

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message.trim() !== '' ? cause.message : fallback;
}

function formatAsOfDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function PantryPage() {
  const [filters, setFilters] = useState<PantryFilterValues>({ name: '', categoryId: '', status: '' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryVersion, setCategoryVersion] = useState(0);
  const [pantry, setPantry] = useState<PantryList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const latestRequest = useRef(0);

  useEffect(() => {
    let isCurrent = true;
    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoryError(null);
      try {
        const result = await api.listCategories();
        if (isCurrent) setCategories(result.items);
      } catch (cause) {
        if (isCurrent) setCategoryError(errorMessage(cause, 'Please try loading categories again.'));
      } finally {
        if (isCurrent) setCategoriesLoading(false);
      }
    }
    loadCategories();
    return () => { isCurrent = false; };
  }, [categoryVersion]);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    let isCurrent = true;
    const query: PantryQuery = {};
    const name = filters.name.trim();
    if (name !== '') query.name = name;
    if (filters.categoryId !== '') query.categoryId = filters.categoryId;
    if (filters.status !== '') query.status = filters.status;

    async function loadPantry() {
      setIsLoading(true);
      setError(null);
      setPantry(null);
      try {
        const result = await api.listPantry(query);
        if (isCurrent && requestId === latestRequest.current) setPantry(result);
      } catch (cause) {
        if (isCurrent && requestId === latestRequest.current) {
          setError(errorMessage(cause, 'We could not load your pantry. Please try again.'));
        }
      } finally {
        if (isCurrent && requestId === latestRequest.current) setIsLoading(false);
      }
    }
    loadPantry();
    return () => { isCurrent = false; };
  }, [filters, requestVersion]);

  function changeFilters(next: PantryFilterValues) {
    // Invalidate immediately in the event handler, before the next effect starts.
    latestRequest.current += 1;
    setIsLoading(true);
    setError(null);
    setPantry(null);
    setFilters(next);
  }

  function retryPantry() {
    latestRequest.current += 1;
    setIsLoading(true);
    setError(null);
    setPantry(null);
    setRequestVersion((version) => version + 1);
  }

  const hasActiveFilters = filters.name.trim() !== '' || filters.categoryId !== '' || filters.status !== '';

  return (
    <section className="pantry-page" aria-labelledby="pantry-title">
      <div className="pantry-header">
        <div>
          <h1 id="pantry-title">Pantry</h1>
          {!isLoading && pantry !== null && (
            <p className="pantry-summary">
              {pantry.total} {pantry.total === 1 ? 'item' : 'items'}{hasActiveFilters ? ' matching your filters' : ' in your pantry'}
              {' · '}statuses as of <time dateTime={pantry.asOfDate}>{formatAsOfDate(pantry.asOfDate)}</time>
            </p>
          )}
        </div>
        <Link className="byb-button byb-button-primary" to="/pantry/new">Add item</Link>
      </div>

      <PantryFilters
        values={filters}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesUnavailable={categoryError !== null}
        onChange={changeFilters}
        onClear={() => changeFilters({ name: '', categoryId: '', status: '' })}
      />
      {categoryError !== null && (
        <div className="pantry-category-status" id="pantry-category-error">
          <ErrorMessage message={`Categories could not be loaded. ${categoryError}`} />
          <button className="byb-button byb-button-secondary" type="button" onClick={() => setCategoryVersion((version) => version + 1)}>
            Retry categories
          </button>
        </div>
      )}

      <div className="pantry-results" aria-busy={isLoading}>
        {isLoading && <LoadingMessage message="Loading your pantry..." />}
        {!isLoading && error !== null && (
          <div className="pantry-load-error">
            <ErrorMessage message={error} />
            <button className="byb-button byb-button-primary" type="button" onClick={retryPantry}>Try again</button>
          </div>
        )}
        {!isLoading && error === null && pantry !== null && (
          pantry.items.length === 0 ? (
            <EmptyState message={hasActiveFilters ? 'No items match your filters. Try changing or clearing them.' : 'Your pantry is empty. Add an item to get started.'} />
          ) : <PantryTable items={pantry.items} />
        )}
      </div>
    </section>
  );
}
