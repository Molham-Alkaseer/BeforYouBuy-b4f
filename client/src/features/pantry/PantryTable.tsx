import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';
import type { PantryItem } from '../../types';

interface PantryTableProps { items: PantryItem[] }

function formatExpiryDate(value: string): string {
  const [year, month, day] = value.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

function describeExpiry(days: number): string {
  if (days === 0) return 'Expires today';
  const amount = Math.abs(days);
  const unit = amount === 1 ? 'day' : 'days';
  return days < 0 ? `Expired ${amount} ${unit} ago` : `In ${amount} ${unit}`;
}

export default function PantryTable({ items }: PantryTableProps) {
  return (
    <div className="byb-table-scroll pantry-table-scroll" role="region" aria-label="Pantry items table" tabIndex={0}>
      <table className="pantry-table">
        <caption className="byb-sr-only">Pantry items</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Quantity</th>
            <th scope="col">Minimum</th>
            <th scope="col">Expiry</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <th scope="row">
                <Link to={`/pantry/${item.id}`}>{item.name}</Link>
                <span className="pantry-item-category">{item.categoryName}</span>
              </th>
              <td className="pantry-quantity">{item.quantity} {item.unit}</td>
              <td className="pantry-minimum">{item.minimumQuantity} {item.unit}</td>
              <td>
                {item.expiryDate === null ? 'No expiry date' : (
                  <>
                    <time dateTime={item.expiryDate}>{formatExpiryDate(item.expiryDate)}</time>
                    {item.daysUntilExpiry !== null && (
                      <span className="pantry-expiry-relative">{describeExpiry(item.daysUntilExpiry)}</span>
                    )}
                  </>
                )}
              </td>
              <td>
                <div className="pantry-statuses">
                  {item.statuses.map((status) => <StatusBadge key={status} status={status} />)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
