import { useEffect, useRef, useState } from 'react';
import ErrorMessage from '../components/ErrorMessage';
import LoadingMessage from '../components/LoadingMessage';
import DashboardOverview from '../features/dashboard/DashboardOverview';
import { api } from '../services/api-client';
import type { Dashboard, GenerateResult } from '../types';
import '../features/dashboard/dashboard.css';

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message.trim() !== '' ? cause.message : fallback;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerateResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const isMounted = useRef(false);
  const operationLocked = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);
      setDashboard(null);

      try {
        const result = await api.getDashboard();
        if (isCurrent) setDashboard(result);
      } catch (cause) {
        if (isCurrent) setError(errorMessage(cause, 'We could not load your dashboard. Please try again.'));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => { isCurrent = false; };
  }, [requestVersion]);

  async function refreshDashboard() {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const refreshed = await api.getDashboard();
      if (isMounted.current) setDashboard(refreshed);
    } catch (cause) {
      if (isMounted.current) {
        setRefreshError(errorMessage(cause, 'Please try refreshing the dashboard again.'));
      }
    } finally {
      if (isMounted.current) setIsRefreshing(false);
    }
  }

  async function handleGenerate() {
    // A ref blocks a second click immediately, before React renders disabled=true.
    if (operationLocked.current || isLoading || dashboard === null || refreshError !== null) return;
    operationLocked.current = true;
    setIsGenerating(true);
    setGenerationResult(null);
    setGenerationError(null);

    try {
      const result = await api.generateShoppingList();
      if (!isMounted.current) return;
      setGenerationResult(result);
      await refreshDashboard();
    } catch (cause) {
      if (isMounted.current) {
        setGenerationError(errorMessage(cause, 'We could not generate your shopping list. Please try again.'));
      }
    } finally {
      operationLocked.current = false;
      if (isMounted.current) setIsGenerating(false);
    }
  }

  async function handleRefresh() {
    if (operationLocked.current || refreshError === null) return;
    operationLocked.current = true;
    try {
      // This retry only reads Dashboard; it never repeats the successful mutation.
      await refreshDashboard();
    } finally {
      operationLocked.current = false;
    }
  }

  const isBusy = isLoading || isGenerating || isRefreshing;

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title" aria-busy={isBusy}>
      <div className="dashboard-header">
        <h1 id="dashboard-title">Dashboard</h1>
        <button
          className="byb-button byb-button-primary dashboard-generate-button"
          type="button"
          disabled={isBusy || dashboard === null || refreshError !== null}
          onClick={handleGenerate}
        >
          {isRefreshing ? 'Updating dashboard…' : isGenerating ? 'Generating…' : 'Generate shopping list'}
        </button>
      </div>

      {generationResult !== null && (
        <div className="dashboard-generation-feedback" role="status">
          <span className="dashboard-generation-check" aria-hidden="true">✓</span>
          <p>
            <strong>Shopping list updated.</strong>{' '}
            {generationResult.added} added · {generationResult.updated} updated · {generationResult.unchanged} unchanged
          </p>
        </div>
      )}
      {generationError !== null && (
        <div className="dashboard-generation-error"><ErrorMessage message={generationError} /></div>
      )}
      {isRefreshing && (
        <div className="dashboard-refresh-status"><LoadingMessage message="Updating dashboard counts..." /></div>
      )}
      {refreshError !== null && (
        <div className="dashboard-refresh-error">
          <ErrorMessage message={`Your shopping list was updated, but the dashboard could not be refreshed. ${refreshError}`} />
          <p className="dashboard-stale-note">The figures below are from before the update.</p>
          <button className="byb-button byb-button-secondary" type="button" onClick={handleRefresh}>
            Refresh dashboard
          </button>
        </div>
      )}

      {isLoading && (
        <div className="dashboard-loading"><LoadingMessage message="Loading your dashboard..." /></div>
      )}
      {!isLoading && error !== null && (
        <div className="dashboard-error">
          <ErrorMessage message={error} />
          <button className="byb-button byb-button-primary" type="button" onClick={() => setRequestVersion((version) => version + 1)}>
            Try again
          </button>
        </div>
      )}
      {!isLoading && error === null && dashboard !== null && <DashboardOverview dashboard={dashboard} />}
    </section>
  );
}
