const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "2026-10-18" -> "18 Oct 2026".
// The text is split by hand, so the browser's timezone can never shift the day.
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const monthName = MONTHS[month - 1];

  if (!year || !monthName || !day) {
    return date;
  }
  return `${day} ${monthName} ${year}`;
}

// Units are free text; preserve the user's spelling.
export function formatQuantity(quantity: number, unit: string): string {
  return `${quantity} ${unit}`;
}

// Text under the expiry date. Returns null when the item has no expiry date.
export function formatDaysUntil(days: number | null): string | null {
  if (days === null) {
    return null;
  }
  if (days === 0) {
    return 'Expires today';
  }
  if (days === 1) {
    return 'In 1 day';
  }
  if (days > 1) {
    return `In ${days} days`;
  }
  if (days === -1) {
    return 'Expired 1 day ago';
  }
  return `Expired ${-days} days ago`;
}

// "2026-10-09T10:00:00.000Z" -> "9 Oct 2026".
// The day is read in the household's timezone (Asia/Damascus), so it matches the server.
// The month name comes from MONTHS, so it is always written the same way.
export function formatTimestampDate(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Damascus',
  }).formatToParts(date);

  function read(type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find((part) => part.type === type)?.value);
  }

  const day = read('day');
  const monthName = MONTHS[read('month') - 1];
  const year = read('year');

  if (!day || !monthName || !year) {
    return timestamp;
  }
  return `${day} ${monthName} ${year}`;
}
