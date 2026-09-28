/** Exact study time, shared by the catalogue, enrollment and progress views. */
export function formatStudyDuration(weeks: number): string {
  const count = Number.isFinite(weeks) ? Math.max(0, Math.round(weeks)) : 0;
  return `${count} ${count === 1 ? 'week' : 'weeks'}`;
}
