import type { PantryStatus } from '../types';

export default function StatusBadge({ status }: { status: PantryStatus }) {
  return <span className={`byb-badge byb-badge-${status.toLowerCase().replace(' ', '-')}`}>{status}</span>;
}
