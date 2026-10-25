import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api-client";
import { useAuth } from "../features/session/useAuth";
import { readApiError } from "../features/items/apiError";
import { ShoppingList, ShoppingEntry } from "../types";
import "./shopping-list.css";

export default function ShoppingListPage() {
  const { status, user } = useAuth();
  // Dispose pending form state when the signed-in identity or role changes.
  return <ShoppingListSession key={`${status}:${user?.id}:${user?.householdRole}`} />;
}

function ShoppingListSession() {
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
    navigate('/login?returnTo=%2Fshopping-list');
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

  const renderBadges = (statuses: string[]) => {
    if (!statuses || statuses.length === 0) {
      return (
        <span className="shopping-badge shopping-badge-manual">
          ADDED BY HAND
        </span>
      );
    }
    return statuses.map((status) => {
      let badgeClass = "shopping-badge-ok";
      if (status === "LOW STOCK") badgeClass = "shopping-badge-low";
      if (status === "USE SOON") badgeClass = "shopping-badge-soon";
      if (status === "EXPIRED") badgeClass = "shopping-badge-expired";
      return (
        <span key={status} className={`shopping-badge ${badgeClass}`}>
          {status}
        </span>
      );
    });
  };

  const isExpired = purchasingItem?.pantryStatuses.includes("EXPIRED");

  if (isLoading && !pendingData)
    return <div className="shopping-loading">Loading shopping list...</div>;

  if (error && !pendingData) {
    return (
      <div className="shopping-error">
        <p style={{ marginBottom: "1rem" }}>Error: {error}</p>
          <button onClick={loadData} className="shopping-btn-primary">
            Retry
          </button>
      </div>
    );
  }

  return (
    <div className="shopping-page">
      <div className="shopping-header">
        <div>
          <h1 className="shopping-title">Shopping list</h1>
          <p className="shopping-subtitle">
            {pendingData?.pendingSummary.total} pending entries · pressing
            generate again never adds an item twice
          </p>
        </div>
        {isAdminOrOwner && (
          <button
            onClick={handleGenerate}
            disabled={isAnyActionRunning}
            className="shopping-btn-primary"
          >
            {isGenerating ? "Generating..." : "Generate shopping list"}
          </button>
        )}
      </div>

      {generateMsg && (
        <div
          style={{
            backgroundColor: "#e6f4ea",
            color: "#1e4620",
            padding: "1rem",
            borderRadius: "0.5rem",
            border: "1px solid #cce8d6",
          }}
        >
          {generateMsg}
        </div>
      )}

      {authMessage && (
        <div
          style={{
            backgroundColor: "#fffbeb",
            color: "#713f12",
            padding: "1rem",
            borderRadius: "0.5rem",
            border: "1px solid #fde68a",
            marginBottom: "1rem",
          }}
        >
          {authMessage}
        </div>
      )}

      {error && pendingData && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            padding: "1rem",
            borderRadius: "0.5rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            onClick={loadData}
            style={{
              fontWeight: "bold",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <section className="shopping-panel">
        <div className="shopping-panel-header">
          <h2 className="shopping-panel-title">Pending</h2>
          <p className="shopping-panel-desc">
            Suggested amounts bring each item back to its minimum. Expired stock
            counts as zero.
          </p>
        </div>
        <div className="shopping-list">
          {pendingData?.items.map((item) => (
            <div key={item.id} className="shopping-list-item">
              <div className="shopping-item-info">
                <h3 className="shopping-item-name">{item.name}</h3>
                <p className="shopping-item-meta">
                  {item.pantryItemId ? "From your pantry" : "Not a pantry item"}· created {formatDate(item.createdAt)}
                </p>
              </div>
              <div className="shopping-item-qty">
                <span>
                  Buy {item.quantityToBuy} {item.unit || ""}
                </span>
                <span className="shopping-badges-container">
                  {renderBadges(item.pantryStatuses)}
                </span>
              </div>
              <div className="shopping-item-actions">
                {isAdminOrOwner && <button
                  onClick={() => openPurchasePanel(item)}
                  disabled={isAnyActionRunning}
                  className="shopping-btn-primary shopping-btn-small"
                >
                  Mark purchased
                </button>}
                {isAdminOrOwner && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isAnyActionRunning || !isAuthenticated}
                    className="shopping-btn-link shopping-btn-remove"
                  >
                    {deletingId === item.id ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {pendingData?.items.length === 0 && (
            <div className="shopping-empty">No pending items.</div>
          )}
        </div>
      </section>

      <div className="shopping-grid">
        <section className="shopping-panel shopping-manual-panel">
          <h2 className="shopping-panel-title">Add your own entry</h2>
          <p className="shopping-panel-desc">
            For things that are not pantry items, like birthday candles.
          </p>
          {isAdminOrOwner ? (
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
                <p className="shopping-error-text">{manualError}</p>
              )}
              <button
                type="submit"
                disabled={isAnyActionRunning}
                className="shopping-btn-dark"
              >
                {isSubmittingManual ? "Adding..." : "Add to list"}
              </button>
            </form>
          ) : (
            <div className="shopping-empty">
              Only your household admin can add entries.
            </div>
          )}
        </section>

        {isAdminOrOwner && purchasingItem && (
          <section className="shopping-purchase-panel">
            <h2 className="shopping-panel-title">
              Mark {purchasingItem.name} as purchased
            </h2>

            {isExpired && (
              <p
                className="shopping-purchase-warning"
                style={{ color: "#991b1b", fontWeight: 500 }}
              >
                The old {purchasingItem.name} is expired, so it is discarded.
                The new quantity will be exactly what you bought. A new expiry
                date is required.
              </p>
            )}

            <form onSubmit={handleConfirmPurchase} className="shopping-form">
              <div className="shopping-form-row">
                <div className="shopping-form-group shopping-w-md">
                  <label htmlFor="purchaseQty">Quantity bought</label>
                  <input
                    id="purchaseQty"
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
                    <p className="shopping-error-text">
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
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required={isExpired}
                      className={`shopping-input ${purchaseErrors.newExpiryDate ? "shopping-input-error" : ""}`}
                    />
                    {purchaseErrors.newExpiryDate && (
                      <p className="shopping-error-text">
                        {purchaseErrors.newExpiryDate[0]}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {purchaseErrors.general && (
                <p className="shopping-error-text">
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
          </section>
        )}
      </div>

      <section className="shopping-panel">
        <div className="shopping-panel-header">
          <h2 className="shopping-panel-title">Purchased history</h2>
          <p className="shopping-panel-desc">
            Bought entries stay here with the day they were purchased
          </p>
        </div>
        <div className="shopping-table-scroll" role="region" aria-label="Purchased history" tabIndex={0}>
        <table className="shopping-table">
          <thead>
            <tr>
              <th>ENTRY</th>
              <th>BOUGHT</th>
              <th>CREATED</th>
              <th>PURCHASED</th>
            </tr>
          </thead>
          <tbody>
            {purchasedData?.items.map((item) => (
              <tr key={item.id}>
                <td className="shopping-cell-bold">{item.name}</td>
                <td>
                  {item.purchasedQuantity} {item.unit || ""}
                </td>
                <td className="shopping-cell-meta">
                  {formatDate(item.createdAt)}
                </td>
                <td className="shopping-cell-meta">
                  {item.purchasedAt ? formatDate(item.purchasedAt) : "-"}
                </td>
              </tr>
            ))}
            {purchasedData?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="shopping-empty">
                  No purchase history.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      {!isAuthenticated && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#f1ecde",
            borderRadius: "0.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", color: "#223129" }}>
            Browse as a guest.{" "}
            <button
              onClick={requireSignIn}
              style={{
                background: "none",
                border: "none",
                color: "#2f7056",
                cursor: "pointer",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Sign in
            </button>
            to generate, add, or purchase entries.
          </p>
        </div>
      )}
    </div>
  );
}
