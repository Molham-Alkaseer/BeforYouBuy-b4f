import StatusBadge from '../../components/StatusBadge';
import type { PantryStatus } from './itemTypes';

const RULES: { status: PantryStatus; text: string }[] = [
  { status: 'LOW STOCK', text: 'Quantity is below the minimum.' },
  { status: 'USE SOON', text: 'Expires today or in the next 3 days.' },
  { status: 'EXPIRED', text: 'The expiry date is before today.' },
  { status: 'OK', text: 'None of the above applies.' },
];

// Only explains the rules. Statuses are never calculated or sent from here.
export default function StatusRulesPanel() {
  return (
    <aside className="item-rules" aria-labelledby="item-rules-title">
      <h2 id="item-rules-title">How statuses are decided</h2>

      <ul>
        {RULES.map((rule) => (
          <li key={rule.status}>
            <StatusBadge status={rule.status} />
            <span>{rule.text}</span>
          </li>
        ))}
      </ul>

      <p>
        An item can be LOW STOCK and USE SOON at once. Items without an expiry
        date are never USE SOON or EXPIRED.
      </p>
    </aside>
  );
}