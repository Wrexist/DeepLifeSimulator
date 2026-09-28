/** Display an absolute simulation stamp without exposing the age-based clock. */
export function formatLifeWeek(absoluteWeek: number | undefined, lifeStartWeek: number | undefined): string {
  if (absoluteWeek == null || !Number.isFinite(absoluteWeek) || absoluteWeek < 0) return 'Unknown week';
  const start = typeof lifeStartWeek === 'number' && Number.isFinite(lifeStartWeek) && lifeStartWeek >= 0
    ? Math.floor(lifeStartWeek) : 0;
  const offset = Math.floor(absoluteWeek) - start;
  if (offset < 0) return `${-offset} ${offset === -1 ? 'week' : 'weeks'} before this life`;
  return `Week ${offset + 1}`;
}
