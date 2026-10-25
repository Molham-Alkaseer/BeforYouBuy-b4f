import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api-client";
import { useAuth } from "../features/session/useAuth";
import type { Category, PantryList, PantryQuery, PantryStatus } from "../types";
import StatusBadge from "../components/StatusBadge";
import LoadingMessage from "../components/LoadingMessage";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import {
  errorMessage,
  expiryDescription,
  formatDate,
} from "../features/pantry/display";
import "../features/pantry/pantry.css";

export default function PantryPage() {
  const auth = useAuth();
  const authStatus = auth.status;
  const addItemTo =
    authStatus !== "anonymous"
      ? "/pantry/new"
      : `/login?${new URLSearchParams({ returnTo: "/pantry/new" })}`;
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<PantryStatus | "">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [data, setData] = useState<PantryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const filtered = Boolean(name.trim() || categoryId || status);

  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    setCategoryError("");
    api
      .listCategories()
      .then((result) => {
        if (!cancelled) setCategories(result.items);
      })
      .catch((failure) => {
        if (!cancelled) setCategoryError(errorMessage(failure));
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryRetry]);

  useEffect(() => {
    // Ignore results from superseded requests, including failures.
    let cancelled = false;
    const query: PantryQuery = {};
    if (name.trim()) query.name = name.trim();
    if (categoryId) query.categoryId = Number(categoryId);
    if (status) query.status = status;
    setLoading(true);
    setError("");
    api
      .listPantry(query)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((failure) => {
        if (!cancelled) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name, categoryId, status, retry]);

  function clearFilters() {
    setName("");
    setCategoryId("");
    setStatus("");
  }

  return (
    <section className="pantry-page">
      <header className="byb-page-header">
        <div>
          <h1>Pantry</h1>
          {data && !loading && !error && (
            <p>
              {data.total} {filtered ? "matching items" : "items"} · statuses as
              of{" "}
              <time dateTime={data.asOfDate}>{formatDate(data.asOfDate)}</time>
            </p>
          )}
        </div>
        <Link className="byb-button" to={addItemTo}>
          Add item
        </Link>
      </header>
      <form
        className="byb-panel pantry-filters"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="pantry-name">
          Search by name
          <input
            id="pantry-name"
            type="search"
            placeholder="Try “mil”"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label htmlFor="pantry-category">
          Category
          <select
            id="pantry-category"
            disabled={categoriesLoading}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">
              {categoriesLoading ? "Loading categories…" : "All categories"}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="pantry-status">
          Status
          <select
            id="pantry-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PantryStatus | "")
            }
          >
            <option value="">All statuses</option>
            {(["LOW STOCK", "USE SOON", "EXPIRED", "OK"] as const).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <button
          className="byb-button byb-button-secondary"
          type="button"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </form>
      {categoryError && (
        <div>
          <ErrorMessage
            message={`Unable to load categories: ${categoryError}`}
          />
          <button
            className="byb-button byb-button-secondary"
            onClick={() => setCategoryRetry((value) => value + 1)}
          >
            Retry categories
          </button>
        </div>
      )}
      {loading ? (
        <LoadingMessage message="Loading pantry…" />
      ) : error ? (
        <div>
          <ErrorMessage message={error} />
          <button
            className="byb-button byb-button-secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry pantry
          </button>
        </div>
      ) : (
        data &&
        (data.items.length === 0 ? (
          <div className="byb-panel">
            <EmptyState
              message={
                filtered
                  ? "No matching items. Try another search or clear your filters."
                  : "Your pantry is empty. Add your first item to get started."
              }
            />
            {filtered ? (
              <button
                className="byb-button byb-button-secondary"
                onClick={clearFilters}
              >
                Show all items
              </button>
            ) : (
              <Link className="byb-button" to="/pantry/new">
                Add your first item
              </Link>
            )}
          </div>
        ) : (
          <div
            className="byb-table-scroll"
            role="region"
            aria-label="Pantry items"
            tabIndex={0}
          >
            <table className="byb-table pantry-table">
              <caption className="byb-sr-only">
                Pantry items and their current stock and expiry statuses
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Minimum</th>
                  <th scope="col">Expiry</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link to={`/pantry/${item.id}`}>{item.name}</Link>
                      <small>{item.categoryName}</small>
                    </th>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td className="byb-muted">
                      {item.minimumQuantity} {item.unit}
                    </td>
                    <td>
                      {item.expiryDate ? (
                        <>
                          <time dateTime={item.expiryDate}>
                            {formatDate(item.expiryDate)}
                          </time>
                          <small>
                            {expiryDescription(item.daysUntilExpiry)}
                          </small>
                        </>
                      ) : (
                        "No expiry date"
                      )}
                    </td>
                    <td>
                      <div className="byb-badges">
                        {item.statuses.map((value) => (
                          <StatusBadge key={value} status={value} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
