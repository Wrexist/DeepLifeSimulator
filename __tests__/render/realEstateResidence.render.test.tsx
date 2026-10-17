/**
 * The two real-estate sheets tell the truth about where you live and what a
 * sale pays (2026-10-17).
 *
 *  - Buy: "Make this my primary residence" defaulted OFF for everyone, so a
 *    player with nowhere to live who bought a house without noticing the toggle
 *    kept taking the homeless penalty in front of it. It now defaults ON when
 *    the player has no home.
 *  - Manage: there was no way to move into a house you already own. The sheet
 *    now has "Make this my home", gated by the same verdict the action uses.
 *  - Sell: the confirm dialog's "Net to you" was value - mortgage; the sale also
 *    takes 6% closing costs and 15% tax on the gain. A $216k quote paid $162k.
 */
import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import BuyPropertyModal from '@/components/realEstate/BuyPropertyModal';
import ManagePropertyModal from '@/components/realEstate/ManagePropertyModal';
import { useGameStateGetter, useSetGameState } from '@/contexts/game/useGameSelector';
import { sellOwnedProperty } from '@/contexts/game/actions/RealEstateActions';
import { COMMERCIAL_CATALOG, RESIDENTIAL_CATALOG } from '@/lib/realEstate/catalog';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import { gameAlert } from '@/utils/gameAlert';
import { createTestGameState } from '../helpers/createTestGameState';
import { renderWithProviders } from './helpers/renderWithProviders';
import type { GameState, Loan, RealEstate } from '@/contexts/game/types';

jest.mock('@/utils/gameAlert', () => ({
  ...jest.requireActual('@/utils/gameAlert'),
  gameAlert: jest.fn(),
}));
const alertMock = gameAlert as jest.MockedFunction<typeof gameAlert>;

type Node = TestRenderer.ReactTestInstance;
const textOf = (n: Node): string => [].concat(n.props.children ?? []).join('');

// ─── Buy sheet ──────────────────────────────────────────────────────────────

function renderBuy(state: GameState, property: RealEstate = RESIDENTIAL_CATALOG[0]) {
  const onConfirm = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <BuyPropertyModal
        visible
        property={property}
        gameState={state}
        weeklyIncome={5000}
        darkMode
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
  });
  const toggle = () =>
    tree.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === 'Make this my primary residence')[0];
  const confirm = () => {
    const button = tree.root.findAll((n) => n.type === TouchableOpacity && n.props.disabled === false)[0];
    act(() => button.props.onPress());
  };
  return { tree, onConfirm, toggle, confirm };
}

const money = { stats: { money: 1_000_000 } };

describe('BuyPropertyModal - the residence toggle defaults to where you need to live', () => {
  it('REGRESSION: with nowhere to live, it defaults ON and the purchase moves you in', () => {
    const homeless = createTestGameState({ ...money, realEstate: [], rental: undefined });
    expect(computeHousingWellbeing(homeless).homeless).toBe(true);

    const { tree, toggle, confirm, onConfirm } = renderBuy(homeless);
    expect(toggle().props.accessibilityState).toEqual({ checked: true });
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ asResidence: true }));
    act(() => tree.unmount());
  });

  it('says what leaving it off costs a homeless buyer', () => {
    const homeless = createTestGameState({ ...money, realEstate: [], rental: undefined });
    const { tree, toggle } = renderBuy(homeless);
    act(() => toggle().props.onPress());
    expect(toggle().props.accessibilityState).toEqual({ checked: false });
    expect(JSON.stringify(tree.toJSON())).toContain('leave this off and you keep sleeping rough');
    act(() => tree.unmount());
  });

  it('stays OFF for a renter, and says the lease ends if they switch it on', () => {
    const renter = createTestGameState({ ...money, realEstate: [], rental: { tierId: 'shared-room', startedWeek: 0 } });
    const { tree, toggle, confirm, onConfirm } = renderBuy(renter);
    expect(toggle().props.accessibilityState).toEqual({ checked: false });
    act(() => toggle().props.onPress());
    expect(JSON.stringify(tree.toJSON())).toContain('Your lease on the Shared Room ends this week - no more rent.');
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ asResidence: true }));
    act(() => tree.unmount());
  });

  it('stays OFF for someone who already lives in a home they own', () => {
    const home: RealEstate = { ...RESIDENTIAL_CATALOG[1], owned: true, status: 'owner', currentResidence: true };
    const owner = createTestGameState({ ...money, realEstate: [home], rental: undefined });
    const { tree, toggle, confirm, onConfirm } = renderBuy(owner);
    expect(toggle().props.accessibilityState).toEqual({ checked: false });
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ asResidence: false }));
    act(() => tree.unmount());
  });

  it('never offers a commercial listing as a home, even to the homeless', () => {
    const homeless = createTestGameState({ stats: { money: 5_000_000 }, realEstate: [], rental: undefined });
    const { tree, toggle, confirm, onConfirm } = renderBuy(homeless, COMMERCIAL_CATALOG[0]);
    expect(toggle()).toBeUndefined();
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ asResidence: false }));
    act(() => tree.unmount());
  });
});

// ─── Manage sheet ───────────────────────────────────────────────────────────

let getState: () => GameState;
function Seed({ seed, children }: { seed: (s: GameState) => GameState; children: React.ReactNode }) {
  const setState = useSetGameState();
  getState = useGameStateGetter();
  useEffect(() => { setState(seed); }, [seed, setState]);
  return <>{children}</>;
}

function renderManage(seed: (s: GameState) => GameState, property: RealEstate, mortgageRemaining?: number) {
  return renderWithProviders(
    <Seed seed={seed}>
      <ManagePropertyModal
        visible
        property={property}
        mortgageRemaining={mortgageRemaining}
        availableCash={1_000_000}
        darkMode
        onClose={() => {}}
        onSetRentMode={() => {}}
        onStopRenting={() => {}}
        onEvict={() => {}}
        onMaintain={() => {}}
        onSell={() => {}}
      />
    </Seed>,
  );
}

const house = (over: Partial<RealEstate> = {}): RealEstate => ({
  ...RESIDENTIAL_CATALOG[3],
  owned: true,
  status: 'owner',
  currentValue: RESIDENTIAL_CATALOG[3].price,
  purchasePrice: RESIDENTIAL_CATALOG[3].price,
  condition: 90,
  ...over,
});

beforeEach(() => alertMock.mockClear());

describe('ManagePropertyModal - "Make this my home"', () => {
  it('moves the owner of an empty house in, ending the homeless penalty', () => {
    const home = house({ currentResidence: false });
    const seed = (s: GameState): GameState => ({ ...s, realEstate: [home], rental: undefined });
    const view = renderManage(seed, home);
    expect(computeHousingWellbeing(getState()).homeless).toBe(true);

    const button = () => view.renderer.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === 'Make this my home')[0];
    expect(button().props.disabled).toBe(false);
    expect(JSON.stringify(view.renderer.toJSON())).toContain('moving in stops the weekly health, happiness and energy loss');

    act(() => button().props.onPress());

    expect(getState().realEstate.find((p) => p.id === home.id)!.currentResidence).toBe(true);
    expect(computeHousingWellbeing(getState()).homeless).toBe(false);
    expect(alertMock).toHaveBeenCalledWith('Moved in', `You moved into ${home.name} - no more sleeping rough.`);
    view.unmount();
  });

  it('shows the refusal and a disabled button for a property that is rented out', () => {
    const rentedOut = house({ status: 'rented', rentMode: 'longTerm', rent: 500 });
    const seed = (s: GameState): GameState => ({ ...s, realEstate: [rentedOut], rental: undefined });
    const view = renderManage(seed, rentedOut);
    const button = view.renderer.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === 'Make this my home')[0];
    expect(button.props.disabled).toBe(true);
    const json = JSON.stringify(view.renderer.toJSON());
    expect(json).toContain(`${rentedOut.name} is rented out. Stop renting it first, then move in.`);
    // ...and that stopping the rental moves a homeless owner straight back in.
    expect(json).toContain('stopping the rental moves you back in');
    view.unmount();
  });

  it('warns that renting out your home moves you out', () => {
    const home = house({ currentResidence: true });
    const seed = (s: GameState): GameState => ({ ...s, realEstate: [home], rental: undefined });
    const view = renderManage(seed, home);
    const json = JSON.stringify(view.renderer.toJSON());
    expect(json).toContain('You live here.');
    expect(json).toContain('renting it out moves you out of it');
    view.unmount();
  });
});

describe('ManagePropertyModal - the sale dialog states what the sale pays', () => {
  it('REGRESSION: the $216k-equity sale quotes the $162k it pays, itemised', () => {
    // value 300k, paid 60k, mortgage 84k. value - mortgage = 216k.
    const property = house({ currentValue: 300_000, purchasePrice: 60_000, mortgageId: 'm1' });
    const seed = (s: GameState): GameState => ({ ...s, realEstate: [property], rental: undefined });
    const view = renderManage(seed, property, 84_000);

    const sell = view.renderer.root.findAll(
      (n) => n.type === TouchableOpacity && n.findAll((c) => c.type === Text && textOf(c).startsWith('Sell for')).length > 0,
    )[0];
    act(() => sell.props.onPress());

    const [title, message] = alertMock.mock.calls[0];
    expect(title).toBe('Sell property?');
    expect(message).toBe(
      [
        `${property.name} sells for $300,000.`,
        'Closing costs (6%): -$18,000',
        'Tax on your $240,000 gain (15%): -$36,000',
        'Mortgage payoff: -$84,000',
        'Net to you: $162,000',
      ].join('\n'),
    );

    // And $162,000 is what the sale actually credits.
    const loan: Loan = {
      id: 'm1', name: 'Mortgage', principal: 84_000, remaining: 84_000, rateAPR: 0.06, originalAPR: 0.06,
      interestRate: 0.06, termWeeks: 1560, weeksRemaining: 1560, weeklyPayment: 100, startWeek: 0,
      autoPay: true, type: 'mortgage', onTimePayments: 0, latePayments: 0,
    };
    let state = createTestGameState({ stats: { money: 0 }, realEstate: [property], loans: [loan] });
    sellOwnedProperty((u) => { state = typeof u === 'function' ? u(state) : u; }, property.id);
    expect(state.stats.money).toBe(162_000);
    view.unmount();
  });

  it('says what stays owed after an underwater sale', () => {
    const property = house({ currentValue: 100_000, purchasePrice: 200_000, mortgageId: 'm1' });
    const seed = (s: GameState): GameState => ({ ...s, realEstate: [property], rental: undefined });
    const view = renderManage(seed, property, 200_000);
    const sell = view.renderer.root.findAll(
      (n) => n.type === TouchableOpacity && n.findAll((c) => c.type === Text && textOf(c).startsWith('Sell for')).length > 0,
    )[0];
    act(() => sell.props.onPress());
    const message = alertMock.mock.calls[0][1] ?? '';
    expect(message).not.toContain('Tax on your');
    expect(message).toContain('Mortgage payoff: -$94,000');
    expect(message).toContain('Net to you: $0');
    expect(message).toContain('$106,000 stays owed on the loan.');
    view.unmount();
  });
});
