/**
 * Conglomerate — more than one company of the same type.
 *
 * ## The problem
 *
 * `createCompany` set `id: companyType`, and rejected a second founding with
 * "You already own this company type". So the ceiling was five companies, one
 * per type, and the whole system cost **$12.0M** to own and max out completely —
 * with a ~50-week payback. The deepest money engine in the game was finite and
 * finished early, which is a large part of why the curve flattens around week
 * 900–1,100.
 *
 * ## Why this is balance-safe
 *
 * It cannot inflate income. Company income in `lib/economy/passiveIncome.ts`
 * is capped PER COMPANY by `companyIncomeCap` — $200k/wk base plus $5k per
 * employee (BBQ report 2026-08-21 replaced the old shared $200k pool) — and
 * the five maxed originals already produce ~$238k/wk combined before their own
 * caps. Every subsidiary founded past that point therefore adds **cost and no
 * income** — and trips the existing multi-company efficiency penalty sooner
 * (4+ companies → 90%, 7+ → 80%, 11+ → 70%).
 *
 * That makes the Conglomerate a **sink**, which is precisely what the economy
 * audit found the late game to be missing: not one existing cost scales with
 * wealth. The escalating price is the whole feature.
 *
 * ## Back-compatibility
 *
 * The FIRST company of a type keeps the bare `companyType` as its id, exactly
 * as before. Only the second onward take a `-2`, `-3` suffix. So every existing
 * save's companies, upgrades and Hustle overlays keep resolving, and no
 * migration is needed. `buyCompanyUpgrade` already looks the catalogue up by
 * `company.type` (not by id), so subsidiaries get the right upgrade tree for
 * free.
 */

/** Cost multiplier applied per subsidiary already owned of the same type. */
export const SUBSIDIARY_COST_MULTIPLIER = 2.5;

/**
 * How many companies of ONE type a player may own.
 *
 * Three, not unlimited. At three of each the player is at 15 companies, which
 * is deep into the 11+ efficiency tier (70%), and the third bank alone costs
 * $12.5M. An unbounded count would add a strictly-dominant "found another"
 * button with nothing interesting on the other side of it.
 */
export const MAX_PER_COMPANY_TYPE = 3;

/** How many of this type the player already owns. */
export function countCompaniesOfType(
  companies: readonly { id?: string; type?: string }[] | undefined | null,
  companyType: string
): number {
  if (!Array.isArray(companies)) return 0;
  return companies.filter((c) => {
    if (!c) return false;
    // `type` is the reliable field. Fall back to the id for any legacy record
    // written before `type` was populated — those always used the bare type id.
    return (c.type ?? c.id) === companyType;
  }).length;
}

/**
 * The id the next company of this type should take.
 *
 * The first keeps the bare type (back-compat); later ones are suffixed. Skips
 * any id already present so a save with a gap — a sold subsidiary — cannot mint
 * a duplicate.
 */
export function nextCompanyId(
  companies: readonly { id?: string; type?: string }[] | undefined | null,
  companyType: string
): string {
  const taken = new Set(
    (Array.isArray(companies) ? companies : []).map((c) => c?.id).filter(Boolean) as string[]
  );
  if (!taken.has(companyType)) return companyType;
  for (let n = 2; n <= MAX_PER_COMPANY_TYPE + taken.size + 1; n += 1) {
    const candidate = `${companyType}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Unreachable given the loop bound, but never return a colliding id.
  return `${companyType}-${taken.size + 1}`;
}

/**
 * Price of the next company of this type, before inflation.
 *
 * The first costs base. Each subsequent multiplies by
 * `SUBSIDIARY_COST_MULTIPLIER`, so a second bank is $5M and a third $12.5M.
 */
export function subsidiaryCost(baseCost: number, ownedOfType: number): number {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return 0;
  const n = Number.isFinite(ownedOfType) && ownedOfType > 0 ? Math.floor(ownedOfType) : 0;
  return Math.round(baseCost * Math.pow(SUBSIDIARY_COST_MULTIPLIER, n));
}

/** Can another of this type be founded? */
export function canFoundAnother(
  companies: readonly { id?: string; type?: string }[] | undefined | null,
  companyType: string
): boolean {
  return countCompaniesOfType(companies, companyType) < MAX_PER_COMPANY_TYPE;
}

/**
 * Display name for the nth company of a type - "My Bank", then "My Bank II".
 * Roman numerals stop at III because MAX_PER_COMPANY_TYPE is 3.
 */
export function subsidiaryName(baseName: string, ownedOfType: number): string {
  const suffixes = ['', ' II', ' III', ' IV', ' V'];
  const n = Number.isFinite(ownedOfType) && ownedOfType > 0 ? Math.floor(ownedOfType) : 0;
  return `${baseName}${suffixes[n] ?? ` ${n + 1}`}`;
}
