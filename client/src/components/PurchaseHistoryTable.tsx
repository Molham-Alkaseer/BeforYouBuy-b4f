import type { ShoppingEntry } from '../types';
import EmptyState from './EmptyState';

interface PurchaseHistoryTableProps {
  entries: ShoppingEntry[];
  showItemName?: boolean;
}

function formatDateOnly(value: string): string {
  // Calendar strings are displayed directly, without a UTC/browser timezone shift.
  const [year, month, day] = value.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

function formatPurchasedAt(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Damascus',
  });
}

export default function PurchaseHistoryTable({ entries, showItemName = false }: PurchaseHistoryTableProps) {
  const purchasedEntries = entries.filter((entry) => entry.status === 'Purchased');

  if (purchasedEntries.length === 0) {
    return <EmptyState message="No purchases recorded yet." />;
  }

  return (
    <div className="byb-table-scroll" role="region" aria-label="Purchase history table" tabIndex={0}>
      <table className="byb-history-table">
        <caption className="byb-sr-only">Purchase history</caption>
        <thead>
          <tr>
            {showItemName && <th scope="col">Item</th>}
            <th scope="col">Purchased on</th>
            <th scope="col">Bought</th>
            <th scope="col">New expiry date</th>
          </tr>
        </thead>
        <tbody>
          {purchasedEntries.map((entry) => (
            <tr key={entry.id}>
              {showItemName && <th scope="row">{entry.name}</th>}
              <td>
                {entry.purchasedAt === null ? 'Not recorded' : (
                  <time dateTime={entry.purchasedAt}>{formatPurchasedAt(entry.purchasedAt)}</time>
                )}
              </td>
              <td>
                {entry.purchasedQuantity === null ? 'Not recorded' : (
                  <>{entry.purchasedQuantity}{entry.unit === null ? '' : ` ${entry.unit}`}</>
                )}
              </td>
              <td>
                {entry.newExpiryDate === null ? 'No expiry date' : (
                  <time dateTime={entry.newExpiryDate}>{formatDateOnly(entry.newExpiryDate)}</time>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
