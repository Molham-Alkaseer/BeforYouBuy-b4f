import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api-client';
import type { Dashboard, PantryStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingMessage from '../components/LoadingMessage';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { errorMessage, expiryDescription, formatDate } from '../features/pantry/display';
import '../features/dashboard/dashboard.css';

const statuses: { status: PantryStatus; description: string }[] = [
  { status: 'LOW STOCK', description: 'Below the minimum you keep' },
  { status: 'USE SOON', description: 'Expire today or within 3 days' },
  { status: 'EXPIRED', description: 'Past their expiry date' },
  { status: 'OK', description: 'Nothing to worry about' },
];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [feedback, setFeedback] = useState('');
  const requestId = useRef(0);
  const generationPending = useRef(false);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.getDashboard();
      if (id === requestId.current) setDashboard(result);
    } catch (failure) {
      if (id === requestId.current) setError(errorMessage(failure));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  const invalidateRequest = useCallback(() => { requestId.current++; }, []);
  useEffect(() => { void reload(); return invalidateRequest; }, [reload, invalidateRequest]);

  async function generate() {
    if (generationPending.current) return;
    generationPending.current = true;
    setGenerating(true);
    setGenerationError('');
    setFeedback('');
    try {
      const result = await api.generateShoppingList();
      setFeedback(`Shopping list generated: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged.`);
      await reload();
    } catch (failure) {
      setGenerationError(errorMessage(failure));
    } finally {
      generationPending.current = false;
      setGenerating(false);
    }
  }

  return <section className="dashboard-page">
    <header className="byb-page-header"><div><h1>Dashboard</h1>{dashboard && <p><time dateTime={dashboard.asOfDate}>{formatDate(dashboard.asOfDate)}</time> · {dashboard.totalItems} items in your pantry</p>}</div>
      <button className="byb-button" disabled={generating} onClick={() => void generate()}>{generating ? 'Generating…' : 'Generate shopping list'}</button>
    </header>
    {feedback && <p className="byb-message" role="status">{feedback} <Link to="/shopping-list">Open shopping list</Link></p>}
    {generationError && <ErrorMessage message={generationError} />}
    {loading && <LoadingMessage message="Loading dashboard…" />}
    {error && <div><ErrorMessage message={error} /><button className="byb-button byb-button-secondary" onClick={() => void reload()}>Retry dashboard</button></div>}
    {dashboard && !loading && !error && <>
      <div className="dashboard-stats">{statuses.map(({ status, description }) => <article className="byb-panel" key={status}><StatusBadge status={status} /><strong className="dashboard-count">{dashboard.statusCounts[status]}</strong><p>{description}</p></article>)}</div>
      <p className="dashboard-count-note">An item can have more than one status.</p>
      <div className="dashboard-columns">
        <section className="byb-panel"><h2>Use these first</h2><p className="byb-muted">Expired and expiring items, soonest first</p>
          {dashboard.urgentItems.length === 0 ? <EmptyState message="Nothing urgent. Your pantry is looking good." /> : <ul className="dashboard-urgent">{dashboard.urgentItems.map(item => <li key={item.id}>
            <div><Link to={`/pantry/${item.id}`}>{item.name}</Link><small>{item.categoryName}</small></div>
            <span>{expiryDescription(item.daysUntilExpiry)}</span><div className="byb-badges">{item.statuses.map(status => <StatusBadge key={status} status={status} />)}</div>
          </li>)}</ul>}
        </section>
        <div className="dashboard-side"><section className="byb-panel dashboard-pending"><h2>Pending shopping entries</h2><strong className="dashboard-count">{dashboard.pendingShopping.total}</strong><p>{dashboard.pendingShopping.linked} from your pantry · {dashboard.pendingShopping.manual} added by hand</p><Link className="byb-button byb-button-secondary" to="/shopping-list">Open shopping list</Link></section>
          <section className="byb-panel"><h2>Items per category</h2><ul className="dashboard-categories">{dashboard.categoryCounts.map(category => <li key={category.categoryId}><div><span>{category.categoryName}</span><strong>{category.count}</strong></div><meter min={0} max={Math.max(1, ...dashboard.categoryCounts.map(entry => entry.count))} value={category.count} aria-label={`${category.categoryName}: ${category.count} items`} /></li>)}</ul></section>
        </div>
      </div>
    </>}
  </section>;
}
