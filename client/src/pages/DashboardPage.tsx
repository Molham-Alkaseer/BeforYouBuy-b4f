import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api-client";
import { ApiError, type Dashboard, type PantryStatus } from "../types";
import { useAuth } from "../features/session/useAuth";
import Icon from "../components/Icon";
import ItemGlyph from "../components/ItemGlyph";
import LoadingMessage from "../components/LoadingMessage";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import {
  errorMessage,
  expiryDescription,
  formatDate,
} from "../features/pantry/display";
import "../features/dashboard/dashboard.css";

const statuses: { status: PantryStatus; description: string }[] = [
  { status: "LOW STOCK", description: "Items to restock" },
  { status: "EXPIRED", description: "Needs replacement" },
  { status: "USE SOON", description: "Expires within 3 days" },
  { status: "OK", description: "Items fully stocked" },
];

export default function DashboardPage() {
  const { status, user } = useAuth();
  const userId = user?.id;
  const canManage =
    user?.householdRole === "admin" || user?.householdRole === "owner";
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNeedsSignIn, setGenerationNeedsSignIn] = useState(false);
  const [feedback, setFeedback] = useState("");
  const requestId = useRef(0);
  const generationPending = useRef(false);
  const sessionKeyRef = useRef("");
  useEffect(() => {
    sessionKeyRef.current =
      status === "authenticated" && userId !== undefined
        ? `authenticated:${userId}`
        : status;
  }, [status, userId]);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await api.getDashboard();
      if (id === requestId.current) setDashboard(result);
    } catch (failure) {
      if (id === requestId.current) setError(errorMessage(failure));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  const invalidateRequest = useCallback(() => {
    requestId.current++;
  }, []);
  useEffect(() => {
    void reload();
    return invalidateRequest;
  }, [reload, invalidateRequest]);

  async function generate() {
    if (
      !canManage ||
      status !== "authenticated" ||
      !user ||
      generationPending.current
    )
      return;
    const sessionKey = `authenticated:${user.id}`;
    generationPending.current = true;
    setGenerating(true);
    setGenerationError("");
    setGenerationNeedsSignIn(false);
    setFeedback("");
    try {
      const result = await api.generateShoppingList();
      if (sessionKeyRef.current !== sessionKey) return;
      setFeedback(
        `Shopping list generated: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged.`,
      );
      await reload();
    } catch (failure) {
      const currentSession = sessionKeyRef.current;
      if (
        currentSession !== sessionKey &&
        currentSession.startsWith("authenticated:")
      )
        return;
      if (failure instanceof ApiError && failure.statusCode === 401) {
        setGenerationNeedsSignIn(true);
        setGenerationError(
          "Your session expired. Sign in to generate the shopping list.",
        );
      } else if (failure instanceof ApiError && failure.statusCode === 403) {
        setGenerationError(
          "Your account does not have permission to generate the shopping list.",
        );
      } else {
        setGenerationError(errorMessage(failure));
      }
    } finally {
      generationPending.current = false;
      setGenerating(false);
    }
  }

  const firstName = user?.name.trim().split(/\s+/)[0] || "there";
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Damascus",
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <section className="dashboard-page">
      <header className="byb-page-header">
        <div>
          <h1>
            <span className="dashboard-greeting-desktop">{greeting}, </span>
            <span className="dashboard-greeting-mobile">Hey </span>
            {firstName}
            <span className="dashboard-greeting-mobile">,</span>
          </h1>
          {dashboard && (
            <p className="dashboard-date">
              <Icon name="calendar" />
              <time dateTime={dashboard.asOfDate}>
                {formatDate(dashboard.asOfDate)}
              </time>
              <span className="dashboard-mobile-subtitle">
                Your household at a glance.
              </span>
            </p>
          )}
        </div>
        <Link
          className="byb-button byb-button-secondary dashboard-history"
          to="/history"
        >
          <Icon name="history" />
          History
        </Link>
      </header>
      {feedback && (
        <p className="byb-message" role="status">
          {feedback} <Link to="/shopping-list">Open shopping list</Link>
        </p>
      )}
      {generationError && (
        <div>
          <ErrorMessage message={generationError} />
          {generationNeedsSignIn && (
            <Link to="/login?returnTo=%2F">Sign in</Link>
          )}
        </div>
      )}
      {loading && <LoadingMessage message="Loading dashboard…" />}
      {error && (
        <div>
          <ErrorMessage message={error} />
          <button
            className="byb-button byb-button-secondary"
            onClick={() => void reload()}
          >
            Retry dashboard
          </button>
        </div>
      )}
      {dashboard && !loading && !error && (
        <>
          <div className="dashboard-stats">
            {statuses.map(({ status: itemStatus, description }) => {
              const tone =
                itemStatus === "LOW STOCK"
                  ? "low"
                  : itemStatus === "EXPIRED"
                    ? "expired"
                    : itemStatus === "OK"
                      ? "ok"
                      : "soon";
              return (
                <Link
                  to={"/pantry?status=" + encodeURIComponent(itemStatus)}
                  className={"byb-panel dashboard-stat tone-" + tone}
                  key={itemStatus}
                >
                  <span className="dashboard-stat-icon">
                    <Icon
                      name={
                        tone === "low"
                          ? "pantry"
                          : tone === "expired"
                            ? "trash"
                            : tone === "ok"
                              ? "check"
                              : "hourglass"
                      }
                    />
                  </span>
                  <span className="dashboard-stat-label">
                    <span className="desktop-label">
                      {itemStatus === "OK" ? "Everything OK" : itemStatus}
                    </span>
                    <span className="mobile-label">
                      {tone === "low"
                        ? "Low"
                        : tone === "soon"
                          ? "Soon"
                          : itemStatus}
                    </span>
                  </span>
                  <strong className="dashboard-count">
                    {dashboard.statusCounts[itemStatus]}
                  </strong>
                  <p>{description}</p>
                </Link>
              );
            })}
          </div>
          <p className="dashboard-count-note">
            An item can have more than one status.
          </p>
          <div className="dashboard-layout">
            <div className="dashboard-column">
              <section className="byb-panel dashboard-attention">
                <div className="byb-section-heading">
                  <h2>
                    <span className="desktop-label">Urgent Attention</span>
                    <span className="mobile-label">Urgent Items</span>
                  </h2>
                  <Link to="/pantry">View all</Link>
                </div>
                {dashboard.urgentItems.length === 0 ? (
                  <EmptyState message="Nothing urgent. Your pantry is looking good." />
                ) : (
                  <ul className="dashboard-urgent">
                    {dashboard.urgentItems.slice(0, 4).map((item) => {
                      const tone = item.statuses.includes("EXPIRED")
                        ? "expired"
                        : item.statuses.includes("LOW STOCK")
                          ? "low"
                          : "soon";
                      return (
                        <li key={item.id} className={"urgent-" + tone}>
                          <ItemGlyph
                            name={item.name}
                            category={item.categoryName}
                            tone={tone}
                          />
                          <div className="dashboard-urgent-info">
                            <Link to={"/pantry/" + item.id}>{item.name}</Link>
                            <small>
                              {expiryDescription(item.daysUntilExpiry)}
                            </small>
                          </div>
                          <Link
                            to={"/pantry/" + item.id}
                            className="byb-icon-button"
                            aria-label={"View " + item.name}
                          >
                            <Icon name="chevron" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section className="byb-panel dashboard-categories-panel">
                <div className="byb-section-heading">
                  <h2>
                    <span className="desktop-label">Inventory by Category</span>
                    <span className="mobile-label">By Category</span>
                  </h2>
                </div>
                <ul className="dashboard-categories">
                  {dashboard.categoryCounts.map((category) => (
                    <li key={category.categoryId}>
                      <Link to={"/pantry?category=" + category.categoryId}>
                        <ItemGlyph category={category.categoryName} />
                        <strong>{category.categoryName}</strong>
                        <small>
                          {category.count}{" "}
                          {category.count === 1 ? "item" : "items"}
                        </small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <aside className="dashboard-column">
              <section className="dashboard-pending">
                <div>
                  <h2>Shopping list</h2>
                  <strong>{dashboard.pendingShopping.total} Items</strong>
                  <p>
                    {dashboard.pendingShopping.linked} Suggested from stock
                    <br />
                    <span>
                      {dashboard.pendingShopping.manual} Manual entries
                    </span>
                  </p>
                </div>
                <Link className="byb-button" to="/shopping-list">
                  <span>Go to List</span>
                  <Icon name="arrow" />
                </Link>
              </section>
              {canManage && (
                <section className="dashboard-suggestions">
                  <Icon name="sparkle" />
                  <h2>Missing something?</h2>
                  <p>Instantly generate a list based on your pantry needs.</p>
                  <button
                    className="byb-button"
                    disabled={generating}
                    onClick={() => void generate()}
                  >
                    {generating ? "Generating…" : "Generate Suggestions"}
                  </button>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
