import type { ShoppingEntry } from '../types';
import { formatDate } from '../features/pantry/display';
import EmptyState from './EmptyState';

export default function PurchaseHistoryTable({ entries, showItemName = false }: { entries: ShoppingEntry[]; showItemName?: boolean }) {
  if (!entries.length) return <EmptyState message="No purchases yet." />;
  return <div className="byb-table-scroll" role="region" aria-label="Purchase history" tabIndex={0}>
    <table className="byb-table"><caption className="byb-sr-only">Purchase history snapshots</caption>
      <thead><tr>{showItemName && <th scope="col">Item</th>}<th scope="col">Purchased quantity</th><th scope="col">Purchase date</th><th scope="col">New expiry</th></tr></thead>
      <tbody>{entries.map(entry => <tr key={entry.id}>
        {showItemName && <th scope="row">{entry.name}</th>}
        <td>{entry.purchasedQuantity ?? '—'} {entry.unit}</td>
        <td>{entry.purchasedAt ? <time dateTime={entry.purchasedAt}>{new Date(entry.purchasedAt).toLocaleString('en-GB', { timeZone: 'Asia/Damascus' })}</time> : '—'}</td>
        <td>{entry.newExpiryDate ? <time dateTime={entry.newExpiryDate}>{formatDate(entry.newExpiryDate)}</time> : 'No expiry date'}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
