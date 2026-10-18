import type { PantryStatus } from '../types';

interface StatusBadgeProps { status: PantryStatus }

const statusClasses: Record<PantryStatus, string> = {
  'LOW STOCK': 'byb-status-low-stock',
  'USE SOON': 'byb-status-use-soon',
  EXPIRED: 'byb-status-expired',
  OK: 'byb-status-ok',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`byb-status-badge ${statusClasses[status]}`}>{status}</span>;
}
