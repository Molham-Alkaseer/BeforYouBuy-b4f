import { Link } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import type { Dashboard, PantryStatus } from '../../types';

interface DashboardOverviewProps { dashboard: Dashboard }

const statusCards: { status: PantryStatus; description: string }[] = [
  { status: 'LOW STOCK', description: 'Below the minimum you keep' },
  { status: 'USE SOON', description: 'Expire today or within 3 days' },
  { status: 'EXPIRED', description: 'Past their expiry date' },
  { status: 'OK', description: 'Nothing to worry about' },
];

function formatAsOfDate(value: string): string {
  // Interpret date-only input as a local calendar date, never as a UTC instant.
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function expiryDescription(days: number | null): string {
  if (days === null) return 'No expiry date';
  if (days === 0) return 'Expires today';
  const amount = Math.abs(days);
  const unit = amount === 1 ? 'day' : 'days';
  return days < 0 ? `Expired ${amount} ${unit} ago` : `Expires in ${amount} ${unit}`;
}

export default function DashboardOverview({ dashboard }: DashboardOverviewProps) {
  // This maximum scales decorative bars only; all displayed counts come from API.
  const categoryBarMaximum = Math.max(1, ...dashboard.categoryCounts.map((category) => category.count));

  return (
    <div className="dashboard-overview">
      <p className="dashboard-summary">
        <time dateTime={dashboard.asOfDate}>{formatAsOfDate(dashboard.asOfDate)}</time>
        {' · '}{dashboard.totalItems} {dashboard.totalItems === 1 ? 'item' : 'items'} in your pantry
      </p>

      <div className="dashboard-stats" aria-label="Pantry status counts">
        {statusCards.map(({ status, description }) => (
          <section className="dashboard-stat byb-panel" key={status} aria-label={status}>
            <h2 className="dashboard-stat-label"><StatusBadge status={status} /></h2>
            <p className="dashboard-stat-count">{dashboard.statusCounts[status]}</p>
            <p className="dashboard-stat-description">{description}</p>
          </section>
        ))}
      </div>

      <div className="dashboard-content">
        <section className="dashboard-urgent byb-panel" aria-labelledby="dashboard-urgent-title">
          <div className="dashboard-panel-heading">
            <h2 id="dashboard-urgent-title">Use these first</h2>
            <p>Expired and expiring items, soonest first</p>
          </div>
          {dashboard.urgentItems.length === 0 ? (
            <div className="dashboard-empty">
              <EmptyState message="No expired or expiring items need your attention." />
            </div>
          ) : (
            <ul className="dashboard-urgent-list">
              {dashboard.urgentItems.map((item) => (
                <li className="dashboard-urgent-item" key={item.id}>
                  <div className="dashboard-item-name">
                    <Link to={`/pantry/${item.id}`}>{item.name}</Link>
                    <span>{item.categoryName}</span>
                  </div>
                  <div className="dashboard-item-state">
                    <span className="dashboard-item-expiry">{expiryDescription(item.daysUntilExpiry)}</span>
                    <div className="dashboard-item-badges">
                      {item.statuses.map((status) => <StatusBadge key={status} status={status} />)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="dashboard-secondary">
          <section className="dashboard-shopping" aria-labelledby="dashboard-shopping-title">
            <h2 id="dashboard-shopping-title">Pending shopping entries</h2>
            <p className="dashboard-shopping-count">{dashboard.pendingShopping.total}</p>
            <p className="dashboard-shopping-summary">
              {dashboard.pendingShopping.linked} from your pantry
              {' · '}{dashboard.pendingShopping.manual} added by hand
            </p>
            <Link className="byb-button" to="/shopping-list">Open shopping list</Link>
          </section>

          <section className="dashboard-categories byb-panel" aria-labelledby="dashboard-categories-title">
            <h2 id="dashboard-categories-title">Items per category</h2>
            {dashboard.categoryCounts.length === 0 ? (
              <EmptyState message="No categories to display." />
            ) : (
              <ul className="dashboard-category-list">
                {dashboard.categoryCounts.map((category) => (
                  <li key={category.categoryId}>
                    <div className="dashboard-category-label">
                      <span>{category.categoryName}</span>
                      <strong>{category.count}</strong>
                    </div>
                    <div className="dashboard-category-track" aria-hidden="true">
                      <div style={{ width: `${category.count / categoryBarMaximum * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
