import type { Category, PantryStatus } from '../../types';

export interface PantryFilterValues {
  name: string;
  categoryId: number | '';
  status: PantryStatus | '';
}

interface PantryFiltersProps {
  values: PantryFilterValues;
  categories: Category[];
  categoriesLoading: boolean;
  categoriesUnavailable: boolean;
  onChange: (values: PantryFilterValues) => void;
  onClear: () => void;
}

export default function PantryFilters({
  values, categories, categoriesLoading, categoriesUnavailable, onChange, onClear,
}: PantryFiltersProps) {
  const hasValues = values.name !== '' || values.categoryId !== '' || values.status !== '';

  return (
    <div className="pantry-filters" role="search" aria-label="Pantry filters">
      <div className="pantry-filter">
        <label htmlFor="pantry-search">Search by name</label>
        <input
          id="pantry-search"
          type="search"
          placeholder="Try “mil”"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </div>
      <div className="pantry-filter">
        <label htmlFor="pantry-category">Category</label>
        <select
          id="pantry-category"
          value={values.categoryId}
          disabled={categoriesLoading || categoriesUnavailable}
          aria-describedby={categoriesUnavailable ? 'pantry-category-error' : undefined}
          onChange={(event) => onChange({
            ...values, categoryId: event.target.value === '' ? '' : Number(event.target.value),
          })}
        >
          <option value="">{categoriesLoading ? 'Loading categories…' : 'All categories'}</option>
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
      </div>
      <div className="pantry-filter">
        <label htmlFor="pantry-status">Status</label>
        <select
          id="pantry-status"
          value={values.status}
          onChange={(event) => onChange({ ...values, status: event.target.value as PantryStatus | '' })}
        >
          <option value="">All statuses</option>
          <option value="LOW STOCK">LOW STOCK</option>
          <option value="USE SOON">USE SOON</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="OK">OK</option>
        </select>
      </div>
      <button className="byb-button byb-button-secondary" type="button" disabled={!hasValues} onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
