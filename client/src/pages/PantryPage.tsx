import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/api-client";
import { useAuth } from "../features/session/useAuth";
import type { Category, PantryList, PantryQuery, PantryStatus } from "../types";
import Icon from "../components/Icon";
import ItemGlyph from "../components/ItemGlyph";
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
  const canManage =
    auth.user?.householdRole === "admin" ||
    auth.user?.householdRole === "owner";
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [name, setName] = useState("");
  const categoryId = params.get("category") ?? "";
  function setCategoryId(value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("category", value);
      else next.delete("category");
      return next;
    });
  }
  const status: PantryStatus | "" =
    (["LOW STOCK", "USE SOON", "EXPIRED", "OK"] as const).find(
      (value) => value === params.get("status"),
    ) ?? "";
  function setStatus(value: PantryStatus | "") {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("status", value);
      else next.delete("status");
      return next;
    });
  }
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
    setParams({});
  }

  return (
    <section className="pantry-page">
      <header className="byb-page-header">
        <div>
          <h1>
            <span className="desktop-label">Household </span>Pantry
          </h1>
          <p>Manage your shared inventory and stock levels.</p>
        </div>
      </header>
      <form
        className={"pantry-filters " + (filtersOpen ? "filters-open" : "")}
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="pantry-search-row">
          <label className="pantry-search" htmlFor="pantry-name">
            <span className="byb-sr-only">Search items</span>
            <Icon name="search" />
            <input
              id="pantry-name"
              type="search"
              placeholder="Search items..."
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="byb-button byb-button-secondary pantry-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="pantry-filter-options"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Icon name="filter" />
            <span>Filters</span>
          </button>
        </div>
        <div
          className="pantry-filter-options"
          id="pantry-filter-options"
          hidden={!filtersOpen}
        >
          <label htmlFor="pantry-category">
            <span className="byb-sr-only">Category</span>
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
            <span className="byb-sr-only">Status</span>
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
        </div>
        <div className="pantry-active-filters">
          <span>
            {categories.find((category) => String(category.id) === categoryId)
              ?.name ?? "All categories"}
          </span>
          <span>{status || "All statuses"}</span>
          <button type="button" onClick={clearFilters}>
            Clear all
          </button>
        </div>
        <div className="pantry-category-tabs" aria-label="Filter by category">
          <button
            type="button"
            aria-pressed={!categoryId}
            onClick={() => setCategoryId("")}
          >
            All items
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              aria-pressed={String(category.id) === categoryId}
              onClick={() => setCategoryId(String(category.id))}
            >
              {category.name}
            </button>
          ))}
        </div>
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
            ) : canManage ? (
              <Link className="byb-button" to="/pantry/new">
                Add your first item
              </Link>
            ) : (
              <p className="byb-muted">Your household admin can add items.</p>
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
                  <th scope="col">Category</th>
                  <th scope="col">Stock level</th>
                  <th scope="col">Expiry</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const tone = item.statuses.includes("EXPIRED")
                    ? "expired"
                    : item.statuses.includes("LOW STOCK")
                      ? "low"
                      : item.statuses.includes("USE SOON")
                        ? "soon"
                        : "ok";
                  return (
                    <tr key={item.id} className={"pantry-row tone-" + tone}>
                      <th scope="row" className="pantry-item-cell">
                        <ItemGlyph
                          name={item.name}
                          category={item.categoryName}
                          tone={tone}
                        />
                        <div>
                          <Link to={"/pantry/" + item.id}>{item.name}</Link>
                          <small>
                            {tone === "expired"
                              ? expiryDescription(item.daysUntilExpiry)
                              : tone === "low"
                                ? "Low stock"
                                : tone === "soon"
                                  ? "Use soon"
                                  : "Stocked"}
                          </small>
                        </div>
                        <div className="pantry-mobile-badges">
                          {item.statuses.map((value) => (
                            <StatusBadge key={value} status={value} />
                          ))}
                        </div>
                      </th>
                      <td className="pantry-category-cell">
                        <span>{item.categoryName}</span>
                      </td>
                      <td className="pantry-stock-cell">
                        <span className="pantry-stock-track" aria-hidden="true">
                          <span
                            style={{
                              width:
                                Math.min(
                                  100,
                                  (item.quantity /
                                    Math.max(
                                      item.minimumQuantity,
                                      item.quantity,
                                      1,
                                    )) *
                                    100,
                                ) + "%",
                            }}
                          />
                        </span>
                        <span className="pantry-stock-value">
                          {item.quantity} / {item.minimumQuantity} {item.unit}
                          <span className="byb-sr-only">
                            {" "}
                            (current / minimum)
                          </span>
                        </span>
                      </td>
                      <td className="pantry-expiry-cell">
                        {item.expiryDate ? (
                          <time dateTime={item.expiryDate}>
                            {formatDate(item.expiryDate)}
                          </time>
                        ) : (
                          <span className="byb-muted">—</span>
                        )}
                      </td>
                      <td className="pantry-actions-cell">
                        <Link
                          className="byb-icon-button"
                          to={"/pantry/" + item.id}
                          aria-label={"View " + item.name}
                        >
                          <Icon name="chevron" />
                        </Link>
                        {canManage && (
                          <Link
                            className="byb-icon-button"
                            to={"/pantry/" + item.id + "/edit"}
                            aria-label={"Edit " + item.name}
                          >
                            <Icon name="edit" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    Showing {data.items.length}{" "}
                    {filtered ? "matching" : "household"} items{" "}
                    <span>Stock / minimum to keep</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
