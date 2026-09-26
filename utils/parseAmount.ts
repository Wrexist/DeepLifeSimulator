/** Parse a complete dollar/coin amount; never silently accept a numeric prefix.
 * The game displays comma thousands groups and a period decimal separator.
 */
export function parseAmount(input: string): number | null {
  const text = input.trim();
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const amount = Number(text.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}
