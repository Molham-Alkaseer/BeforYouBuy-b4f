import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api-client";
import { useAuth } from "../features/session/useAuth";
import { readApiError } from "../features/items/apiError";
import { ShoppingList, ShoppingEntry } from "../types";
import Icon from "../components/Icon";
import ItemGlyph from "../components/ItemGlyph";
import Modal from "../components/Modal";
import "./shopping-list.css";

export default function ShoppingListPage({
  historyOnly = false,
}: {
  historyOnly?: boolean;
}) {
  const { status, user } = useAuth();
  // Dispose pending form state when the signed-in identity or role changes.
  return (
    <ShoppingListSession
      historyOnly={historyOnly}
      key={`${status}:${user?.id}:${user?.householdRole}`}
    />
  );
}

function ShoppingListSession({ historyOnly }: { historyOnly: boolean }) {
  const [params, setParams] = useSearchParams();
  const showHistory = historyOnly || params.get("view") === "history";
  const manualOpen = params.get("add") === "manual";
  const closeManual = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("add");
        return next;
      },
      { replace: true },
    );
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const isAuthenticated = status === "authenticated";
  const isAdminOrOwner =
    isAuthenticated &&
    (user?.householdRole === "admin" || user?.householdRole === "owner");

  const [pendingData, setPendingData] = useState<ShoppingList | null>(null);
  const [purchasedData, setPurchasedData] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState<number | "">("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const [purchasingItem, setPurchasingItem] = useState<ShoppingEntry | null>(
    null,
  );
  const [purchaseQty, setPurchaseQty] = useState<number | "">("");
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [purchaseErrors, setPurchaseErrors] = useState<
    Record<string, string[]>
  >({});
  const [isPurchasing, setIsPurchasing] = useState(false);
  const purchaseInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (purchasingItem) purchaseInput.current?.focus();
  }, [purchasingItem]);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pending, purchased] = await Promise.all([
        api.listShoppingEntries({ status: "Pending" }),
        api.listShoppingEntries({ status: "Purchased" }),
      ]);
      setPendingData(pending);
      setPurchasedData(purchased);
    } catch (error) {
      const err = readApiError(error);
      if (err.statusCode === 401) {
        setError("Your session expired. Please sign in again.");
        setAuthMessage("Please sign in to continue shopping.");
      } else {
        setError(err.message || "Failed to load shopping list");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isAnyActionRunning =
    isLoading ||
    isGenerating ||
    isSubmittingManual ||
    isPurchasing ||
    deletingId !== null;

  const requireSignIn = () => {
    navigate("/login?returnTo=%2Fshopping-list");
  };

  const handleGenerate = async () => {
    if (isAnyActionRunning) return;
    if (!isAdminOrOwner) return;
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    setIsGenerating(true);
    setError(null);
    setGenerateMsg(null);
    try {
      const result = await api.generateShoppingList();
      setGenerateMsg(
        `List updated. Added ${result.added}, updated ${result.updated}, unchanged ${result.unchanged}.`,
      );
      await loadData();
    } catch (error) {
      const err = readApiError(error);
      if (err.statusCode === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError(err.message || "Failed to generate list");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnyActionRunning) return;
    if (!isAdminOrOwner) return;
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    if (
      !manualName.trim() ||
      manualQty === "" ||
      !Number.isFinite(manualQty) ||
      manualQty <= 0
    ) {
      setManualError("Enter a name and a quantity greater than 0.");
      return;
    }

    setIsSubmittingManual(true);
    setManualError(null);
    try {
      await api.createManualEntry({
        name: manualName,
        quantityToBuy: Number(manualQty),
      });
      setManualName("");
      setManualQty("");
      closeManual();
      await loadData();
    } catch (error) {
      const err = readApiError(error);
      if (err.statusCode === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setManualError(err.fieldErrors?.name?.[0] || err.message);
      }
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (isAnyActionRunning) return;
    if (!isAdminOrOwner) return;
    if (!window.confirm("Are you sure you want to remove this entry?")) return;
    setDeletingId(id);
    try {
      if (purchasingItem?.id === id) setPurchasingItem(null);
      await api.deleteShoppingEntry(id);
      await loadData();
    } catch (error) {
      const err = readApiError(error);
      if (err.statusCode === 401) {
        setError("Your session expired. Please sign in again.");
      } else if (err.statusCode === 403) {
        setError("You do not have permission to remove this entry.");
      } else {
        alert(err.message);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openPurchasePanel = (item: ShoppingEntry) => {
    if (isAnyActionRunning) return;
    if (!isAdminOrOwner) return;
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    setPurchasingItem(item);
    setPurchaseQty(item.quantityToBuy);
    setPurchaseDate("");
    setPurchaseErrors({});
  };

  const handleConfirmPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnyActionRunning || !purchasingItem) return;
    if (!isAdminOrOwner) return;
    if (!isAuthenticated) {
      requireSignIn();
      return;
    }
    if (
      purchaseQty === "" ||
      !Number.isFinite(purchaseQty) ||
      purchaseQty <= 0
    ) {
      setPurchaseErrors({
        purchasedQuantity: ["Quantity must be greater than 0."],
      });
      return;
    }

    setIsPurchasing(true);
    setPurchaseErrors({});
    try {
      await api.purchaseEntry(purchasingItem.id, {
        purchasedQuantity: Number(purchaseQty),
        newExpiryDate: purchaseDate || undefined,
      });
      setPurchasingItem(null);
      await loadData();
    } catch (error) {
      const err = readApiError(error);
      if (err.statusCode === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setPurchaseErrors(err.fieldErrors);
        } else {
          setPurchaseErrors({ general: [err.message] });
        }
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Damascus",
    });
  };

  const isExpired = purchasingItem?.pantryStatuses.includes("EXPIRED");
  const pendingItems = pendingData?.items ?? [];
  const suggested = pendingItems.filter((item) => item.pantryItemId !== null);
  const manual = pendingItems.filter((item) => item.pantryItemId === null);
  const historyGroups = Object.entries(
    (purchasedData?.items ?? []).reduce<Record<string, ShoppingEntry[]>>(
      (groups, item) => {
        const day = item.purchasedAt
          ? formatDate(item.purchasedAt)
          : "Purchase date unavailable";
        (groups[day] ??= []).push(item);
        return groups;
      },
      {},
    ),
  );

  function renderPending(
    items: ShoppingEntry[],
    title: string,
    icon: "sparkle" | "edit",
  ) {
    return (
      <section className="shopping-group" aria-label={title}>
        <div className="shopping-group-heading">
          <h2>
            <Icon name={icon} />
            {title}
          </h2>
          <span>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="shopping-list">
          {items.map((item) => (
            <article className="shopping-entry" key={item.id}>
              <ItemGlyph name={item.name} />
              <div className="shopping-item-info">
                <h3>{item.name}</h3>
                <p
                  className={
                    item.pantryStatuses.includes("EXPIRED")
                      ? "shopping-expired"
                      : ""
                  }
                >
                  {item.pantryItemId === null
                    ? "Added by hand"
                    : item.pantryStatuses.includes("EXPIRED")
                      ? "Expired stock · replacement needed"
                      : item.pantryStatuses.includes("LOW STOCK")
                        ? "Low stock · suggested replenishment"
                        : "From your pantry"}
                </p>
              </div>
              <div className="shopping-item-qty">
                <small>QUANTITY TO BUY</small>
                <strong>
                  {item.quantityToBuy} <span>{item.unit || ""}</span>
                </strong>
              </div>
              {isAdminOrOwner && (
                <div className="shopping-item-actions">
                  <button
                    onClick={() => openPurchasePanel(item)}
                    disabled={isAnyActionRunning}
                    className="byb-button shopping-purchase-button"
                    aria-label={"Record purchase of " + item.name}
                  >
                    <Icon name="check" />
                    <span>Record purchase</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isAnyActionRunning}
                    className="byb-icon-button shopping-remove"
                    aria-label={"Remove " + item.name}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {!items.length && (
          <p className="shopping-empty">
            {icon === "sparkle"
              ? "No suggested items. Regenerate the list to check your pantry."
              : "No manual entries yet."}
          </p>
        )}
      </section>
    );
  }

  if (isLoading && !pendingData)
    return (
      <p className="byb-message" role="status">
        Loading shopping list…
      </p>
    );
  if (error && !pendingData)
    return (
      <div className="byb-message byb-error" role="alert">
        {error}
        <button onClick={loadData} className="byb-button byb-button-secondary">
          Retry
        </button>
      </div>
    );

  return (
    <section className="shopping-page">
      <header className="byb-page-header">
        <div>
          <h1>{historyOnly ? "Purchase History" : "Shopping List"}</h1>
          <p>
            {historyOnly ? (
              "A record of what your household has bought."
            ) : (
              <>
                <strong>{pendingItems.length} items</strong> pending ·{" "}
                {suggested.length} suggested, {manual.length} manual
              </>
            )}
          </p>
        </div>
        {!historyOnly && isAdminOrOwner && (
          <button
            onClick={handleGenerate}
            disabled={isAnyActionRunning}
            className="byb-button byb-button-secondary shopping-generate"
          >
            <Icon name="sparkle" />
            {isGenerating ? "Updating…" : "Regenerate list"}
          </button>
        )}
      </header>
      {generateMsg && (
        <p className="byb-message" role="status">
          {generateMsg}
        </p>
      )}
      {authMessage && (
        <p className="byb-message" role="alert">
          {authMessage}
        </p>
      )}
      {error && (
        <div className="byb-message byb-error" role="alert">
          {error}
          <button
            onClick={loadData}
            className="byb-button byb-button-secondary"
          >
            Retry
          </button>
        </div>
      )}
      {!historyOnly && (
        <div className="shopping-tabs" aria-label="Shopping list views">
          <button aria-pressed={!showHistory} onClick={() => setParams({})}>
            Pending <span>{pendingItems.length}</span>
          </button>
          <button
            aria-pressed={showHistory}
            onClick={() => setParams({ view: "history" })}
          >
            Purchased history
          </button>
        </div>
      )}
      {showHistory ? (
        <div className="shopping-history">
          {historyGroups.map(([date, items]) => (
            <section key={date} aria-label={date}>
              <h2 className="shopping-history-date">
                <Icon name="calendar" />
                {date}
                <span>
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </h2>
              <div className="shopping-history-group">
                {items.map((item) => (
                  <article className="shopping-history-entry" key={item.id}>
                    <ItemGlyph name={item.name} />
                    <div>
                      <h3>{item.name}</h3>
                      <p>
                        {item.purchasedQuantity} {item.unit || "units"} ·{" "}
                        <span>Purchased</span>
                      </p>
                    </div>
                    <Icon name="check" />
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!historyGroups.length && (
            <div className="byb-panel shopping-empty">
              <Icon name="history" />
              <h2>No purchases yet</h2>
              <p>Items you mark as purchased will appear here.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {renderPending(suggested, "Suggested for Pantry", "sparkle")}
          {renderPending(manual, "Manual Entries", "edit")}
          {isAdminOrOwner && (
            <button
              onClick={() => setParams({ add: "manual" })}
              className="shopping-add-manual"
            >
              <Icon name="plus" />
              Add manual entry
            </button>
          )}
          <p className="shopping-footnote">
            <Icon name="check" />
            Recording a pantry purchase automatically updates its stock level.
          </p>
        </>
      )}
      {isAdminOrOwner && (
        <Modal
          open={manualOpen}
          onClose={closeManual}
          title="Add a manual entry"
          busy={isSubmittingManual}
        >
          <p className="byb-muted">
            For extras outside your pantry, like birthday candles.
          </p>
          <form onSubmit={handleAddManual} className="shopping-form">
            <div className="shopping-form-row">
              <div className="shopping-form-group shopping-flex-1">
                <label htmlFor="manualName">Name</label>
                <input
                  id="manualName"
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="shopping-input"
                  required
                />
              </div>
              <div className="shopping-form-group shopping-w-sm">
                <label htmlFor="manualQty">Quantity</label>
                <input
                  id="manualQty"
                  type="number"
                  min="0"
                  step="any"
                  value={manualQty}
                  onChange={(e) =>
                    setManualQty(e.target.value ? Number(e.target.value) : "")
                  }
                  className="shopping-input"
                  required
                />
              </div>
            </div>
            {manualError && (
              <p className="shopping-error-text" role="alert">
                {manualError}
              </p>
            )}
            <button
              type="submit"
              disabled={isAnyActionRunning}
              className="shopping-btn-dark"
            >
              {isSubmittingManual ? "Adding..." : "Add to list"}
            </button>
          </form>
        </Modal>
      )}
      {isAdminOrOwner && (
        <Modal
          open={Boolean(purchasingItem)}
          onClose={() => setPurchasingItem(null)}
          title={
            "Record purchase" +
            (purchasingItem ? ": " + purchasingItem.name : "")
          }
          busy={isPurchasing}
        >
          {purchasingItem && (
            <>
              {isExpired && (
                <p className="byb-message byb-error">
                  The expired stock will be replaced with the quantity you
                  bought. Please enter a new expiry date.
                </p>
              )}
              <form onSubmit={handleConfirmPurchase} className="shopping-form">
                <div className="shopping-form-row">
                  <div className="shopping-form-group shopping-w-md">
                    <label htmlFor="purchaseQty">Quantity bought</label>
                    <input
                      id="purchaseQty"
                      aria-invalid={Boolean(purchaseErrors.purchasedQuantity)}
                      ref={purchaseInput}
                      type="number"
                      min="0"
                      step="any"
                      value={purchaseQty}
                      onChange={(e) =>
                        setPurchaseQty(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={`shopping-input ${purchaseErrors.purchasedQuantity ? "shopping-input-error" : ""}`}
                      required
                    />
                    {purchaseErrors.purchasedQuantity && (
                      <p className="shopping-error-text" role="alert">
                        {purchaseErrors.purchasedQuantity[0]}
                      </p>
                    )}
                  </div>

                  {purchasingItem.pantryItemId !== null && (
                    <div className="shopping-form-group shopping-flex-1">
                      <label htmlFor="purchaseDate">
                        New expiry date{" "}
                        {isExpired && <span style={{ color: "red" }}>*</span>}
                      </label>
                      <input
                        id="purchaseDate"
                        aria-invalid={Boolean(purchaseErrors.newExpiryDate)}
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        required={isExpired}
                        className={`shopping-input ${purchaseErrors.newExpiryDate ? "shopping-input-error" : ""}`}
                      />
                      {purchaseErrors.newExpiryDate && (
                        <p className="shopping-error-text" role="alert">
                          {purchaseErrors.newExpiryDate[0]}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {purchaseErrors.general && (
                  <p className="shopping-error-text" role="alert">
                    {purchaseErrors.general[0]}
                  </p>
                )}

                <div className="shopping-form-actions">
                  <button
                    type="submit"
                    disabled={isAnyActionRunning}
                    className="shopping-btn-primary"
                  >
                    {isPurchasing ? "Confirming..." : "Confirm purchase"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasingItem(null)}
                    disabled={isAnyActionRunning}
                    className="shopping-btn-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
