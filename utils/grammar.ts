/**
 * Small English helpers for player-facing strings built from data.
 *
 * Two classes of visible error kept recurring where a name or a count is
 * interpolated into fixed copy: "the proud owner of a Exotic Supercar" and
 * "1 weeks remaining" / "Owned 3 property(s)". These are the one place the
 * rule lives, so call sites stop restating it (or skipping it).
 */

/**
 * `name` with the indefinite article it takes: "an Exotic Supercar",
 * "a Sedan". Decided on the first letter, which is right for every name the
 * game currently interpolates; the few English exceptions ("an hour",
 * "a unicorn") do not occur in its catalogues.
 */
export function withArticle(name: string): string {
  const trimmed = (name ?? '').trim();
  return `${/^[aeiou]/i.test(trimmed) ? 'an' : 'a'} ${trimmed}`;
}

/** The singular or plural form for `count`: plural(1, 'week') === 'week'. */
export function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return Math.abs(count) === 1 ? singular : pluralForm;
}

/** `count` followed by the right form: countOf(1, 'week') === '1 week'. */
export function countOf(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${plural(count, singular, pluralForm)}`;
}
