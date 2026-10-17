const RULES = [
  { label: 'LOW STOCK', text: 'Quantity is below the minimum.' },
  { label: 'USE SOON', text: 'Expires today or in the next 3 days.' },
  { label: 'EXPIRED', text: 'The expiry date is before today.' },
  { label: 'OK', text: 'None of the above applies.' },
];

// Only explains the rules. Statuses are never calculated or sent from here.
export default function StatusRulesPanel() {
  return (
    <aside className="item-rules" aria-labelledby="item-rules-title">
      <h2 id="item-rules-title">How statuses are decided</h2>

      <ul>
        {RULES.map((rule) => (
          <li key={rule.label}>
            {/* TEMPORARY plain label: replace with Rami's StatusBadge when it exists. */}
            <strong className="item-status-label">{rule.label}</strong>
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