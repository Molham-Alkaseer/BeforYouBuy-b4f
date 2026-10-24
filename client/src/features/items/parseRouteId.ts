// Turns the :id from the address into a number.
// Returns null when it is not a positive whole number (for example "abc", "0", "-3", "1.5").
export function parseRouteId(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}