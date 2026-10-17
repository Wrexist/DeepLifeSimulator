/**
 * Living in a home you OWN - the rules, in one place.
 *
 * ── Why this exists (2026-10-17) ──────────────────────────────────────────
 *
 * `currentResidence` had exactly one writer that could turn it ON: the purchase
 * itself (`resolveBuyProperty`, `asResidence`). Two writers turned it OFF -
 * renting the property out (`setRentMode`) and selling it. So:
 *
 *  - a player who bought a house and left "Make this my primary residence" at
 *    its default (OFF) could never move in, and
 *  - a player who rented their home out and then stopped got the property back
 *    as an empty investment, not as their home,
 *
 * and in both cases `computeHousingWellbeing` read them as HOMELESS
 * (-2 health, -4 happiness, -5 energy every week) while they owned a house.
 *
 * This module is the second door: a pure verdict (`canMoveIn`) that the action
 * and the Manage sheet both read, so the button cannot offer what the action
 * refuses, and the list transform (`moveIntoProperty`) both the move-in and the
 * stop-renting paths commit.
 *
 * A tenancy (`state.rental`) is deliberately NOT cleared here. Moving into an
 * owned home ends a lease the same way buying one does: `computeHousingWellbeing`
 * lets ownership win at once (no rent is charged from the next tick on), and
 * `resolveTenancyStep` ends the lease on that tick with its own notice. One path
 * ends a lease on ownership, not two.
 */
import type { GameState, RealEstate } from '@/contexts/game/types';
import { isCommercialCatalogId } from './catalog';
import { computeHousingWellbeing, getRentalTier } from './rentals';

export type ResidenceSlice = Pick<GameState, 'realEstate' | 'rental'>;

/** Where the player lives right now. Primitive fields only - selector-safe. */
export interface CurrentHome {
  /** Name of the OWNED home they live in; '' when none. */
  ownedHomeName: string;
  /** Name of the rental tier they lease; '' when none (or when they own a home). */
  leaseName: string;
  /** True when the weekly homeless penalty applies. */
  homeless: boolean;
}

export function currentHome(state: ResidenceSlice | undefined | null): CurrentHome {
  const owned = (state?.realEstate ?? []).find((p) => p?.owned && p.currentResidence === true);
  if (owned) return { ownedHomeName: owned.name ?? 'your home', leaseName: '', homeless: false };
  const tier = getRentalTier(state?.rental?.tierId);
  // Homelessness is read from the SAME function the weekly tick charges by, so
  // this can never disagree with the penalty it describes.
  return {
    ownedHomeName: '',
    leaseName: tier?.name ?? '',
    homeless: computeHousingWellbeing(state).homeless,
  };
}

/** Can the player move into this owned property? Primitive fields only. */
export interface MoveInVerdict {
  allowed: boolean;
  /** Player-facing reason when refused; '' when allowed. */
  reason: string;
  /** The owned home they would move out of; '' when none. */
  movesOutOf: string;
  /** The rental tier whose lease would end; '' when none. */
  endsLease: string;
}

const refuse = (reason: string): MoveInVerdict => ({ allowed: false, reason, movesOutOf: '', endsLease: '' });

export function canMoveIn(state: ResidenceSlice | undefined | null, propertyId: string | undefined): MoveInVerdict {
  const property = propertyId
    ? (state?.realEstate ?? []).find((p) => p?.id === propertyId && p.owned)
    : undefined;
  if (!property) return refuse('You must own this property to live in it.');
  // The buy sheet already hides the residence toggle for these: the catalogue
  // gives them 0 comfort and 0 energy, so "living in a warehouse" is a dead
  // outcome rather than a choice.
  if (isCommercialCatalogId(property.id)) {
    return refuse(`${property.name} is a commercial property - you cannot live there.`);
  }
  if (property.currentResidence === true) return refuse(`You already live at ${property.name}.`);
  // Refused rather than silently ending the listing: a tenant would lose their
  // home on a tap labelled for something else. Stopping the rental is one tap
  // on the same sheet, and when the player has nowhere else to live it moves
  // them straight back in (`movesBackInOnStopRenting`).
  if (property.status === 'rented') {
    return refuse(`${property.name} is rented out. Stop renting it first, then move in.`);
  }
  const home = currentHome(state);
  return { allowed: true, reason: '', movesOutOf: home.ownedHomeName, endsLease: home.leaseName };
}

/**
 * What moving in changes, in one sentence - shown on the Manage sheet BEFORE
 * the tap and reused in the confirmation after it, so the two cannot differ.
 */
export function moveInConsequence(verdict: MoveInVerdict): string {
  if (!verdict.allowed) return verdict.reason;
  if (verdict.movesOutOf) return `You move out of ${verdict.movesOutOf}.`;
  if (verdict.endsLease) return `Your lease on the ${verdict.endsLease} ends this week - no more rent.`;
  return 'You have nowhere to live right now - moving in stops the weekly health, happiness and energy loss.';
}

/** The confirmation after a successful move - the same three cases, past tense. */
export function moveInResult(propertyName: string, verdict: MoveInVerdict): string {
  if (verdict.movesOutOf) return `You moved into ${propertyName} and out of ${verdict.movesOutOf}.`;
  if (verdict.endsLease) {
    return `You moved into ${propertyName}. Your lease on the ${verdict.endsLease} ends this week - no more rent.`;
  }
  return `You moved into ${propertyName} - no more sleeping rough.`;
}

/**
 * Make `propertyId` the residence. Every other property loses the flag, so only
 * one home ever carries it (the same rule the purchase path applies).
 */
export function moveIntoProperty(properties: RealEstate[], propertyId: string): RealEstate[] {
  return properties.map((p) => {
    if (p.id === propertyId) return { ...p, currentResidence: true, status: 'owner' };
    return p.currentResidence ? { ...p, currentResidence: false } : p;
  });
}

/**
 * Does ending the rental of `propertyId` move the player back in?
 *
 * Only when they have NOWHERE else to live. That case is strictly better for
 * them - it swaps the homeless penalty for the home's own comfort and energy,
 * and costs nothing - so asking would only add a tap. Anyone who already lives
 * somewhere (an owned home or a lease, which may well be the nicer place) keeps
 * living there, and can still move in from the Manage sheet.
 */
export function movesBackInOnStopRenting(state: ResidenceSlice | undefined | null, propertyId: string | undefined): boolean {
  if (!propertyId) return false;
  const property = (state?.realEstate ?? []).find((p) => p?.id === propertyId && p.owned);
  if (!property || property.status !== 'rented') return false;
  if (isCommercialCatalogId(property.id)) return false;
  return currentHome(state).homeless;
}
