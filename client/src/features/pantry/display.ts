export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function expiryDescription(days: number | null): string {
  if (days === null) return 'No expiry date';
  if (days === 0) return 'Expires today';
  const amount = Math.abs(days);
  return days < 0 ? `Expired ${amount} day${amount === 1 ? '' : 's'} ago` : `Expires in ${amount} day${amount === 1 ? '' : 's'}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
