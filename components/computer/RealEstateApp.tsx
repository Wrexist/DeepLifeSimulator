/**
 * RealEstateApp - desktop real-estate screen. "Zillow DNA" pass, on the shared
 * primitives (AppHeader, SegmentedControl, StatStrip, Chip, SectionTitle,
 * EmptyState).
 *
 * Skeleton (intentionally NOT the generic "eyebrow hero + uniform rows" template):
 *   - Browse: a stack of PHOTO LISTING CARDS - real property photo up top with a
 *     price + status overlay, bed/bath/sqft spec strip, and ONE Buy button.
 *   - Portfolio: an equity dashboard (stacked value/mortgage bar + a three-tile
 *     strip) over PHOTO ROWS carrying name, value, status and weekly income.
 *   - Activity: a property-events timeline.
 *   - Listing detail: a full list -> detail sub-page (local useState routing, no new
 *     game mechanics) that surfaces condition (ProgressRing), value trend, tenant,
 *     amenities, neighborhood cycle, and the loud primary CTA. Every row and card
 *     opens it, so nothing carries a second "Details" button beside the tap that
 *     already does the same thing.
 *
 * Real photos live in assets/images/Real Estate/*.png and are wired by property id
 * (catalog) with a name-keyword fallback for legacy-owned properties (§PROPERTY_IMAGES).
 *
 * All existing behaviour is preserved: the 3-tab loop, the mortgage buy flow
 * (BuyPropertyModal) and the full management surface (ManagePropertyModal - rent
 * modes, maintenance, laundering front, sell) are unchanged; every action that used
 * to exist is still reachable, now with a visible button. Slate Glass tokens
 * (emerald identity, Recipe A/B/C, glass elevation helpers) remain the language.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import {
  Home,
  ShoppingBag,
  Activity,
  TrendingUp,
  TrendingDown,
  Building,
  MapPin,
  Bed,
  Bath,
  Ruler,
  Tag,
  ChevronRight,
  Wrench,
  Users,
  KeyRound,
  Sparkles,
  Banknote,
  Layers,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { RealEstate } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { kicker, rhythm, tier1Title } from '@/lib/config/hierarchy';
import { getGlassCard, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import ProgressRing from '@/components/ui/ProgressRing';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import BuyPropertyModal from '@/components/realEstate/BuyPropertyModal';
import ManagePropertyModal from '@/components/realEstate/ManagePropertyModal';

import {
  buyPropertyWithMortgage,
  sellOwnedProperty,
  setPropertyRentMode,
  stopRenting,
  evictTenant,
  maintainProperty,
  toggleLaunderingFront,
  installPropertyDecor,
  addPropertyRoom,
  upgradePropertyTier,
} from '@/contexts/game/actions/RealEstateActions';
import { RentMode } from '@/lib/realEstate/tenancy';
import { PROPERTY_CATALOG, isCommercialCatalogId } from '@/lib/realEstate/catalog';
import { EVICTION_AFTER_WEEKS, getRentalTier } from '@/lib/realEstate/rentals';
import { endRental, listRentalOptions, rentHome } from '@/contexts/game/actions/RentalActions';
import { companyIncomePaidWeekly } from '@/lib/economy/passiveIncome';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';

import { formatMoney } from '@/utils/moneyFormatting';
import { gameAlert } from '@/utils/gameAlert';

// Real Estate identity accent - emerald, the shared `accent.success` token
// (it was a private `#10B981` literal plus an `IDENTITY_RGB` string used to
// build `rgba(...)` templates by hand; `withAlpha` is the one tint helper).
// Used ONLY as translucent tints on large surfaces (hero wash/blob, Recipe C
// icon bubbles, value chip) and as a solid on small CTAs/badges/active-tab
// state. Gains/losses stay accent.success / accent.danger AS DATA.
const IDENTITY = accent.success;

// ─── Real property photos ───────────────────────────────────────────────────
// require() needs static string literals (Metro), so every asset is spelled out.
// (Note: the "Suburaban House.png" filename ships with that spelling.)
const PROPERTY_IMAGES: Record<string, ImageSourcePropType> = {
  'beach villa': require('@/assets/images/Real Estate/Beach Villa.webp'),
  'city apartment': require('@/assets/images/Real Estate/City Apartment.webp'),
  'desert ranch': require('@/assets/images/Real Estate/Desert Ranch.webp'),
  'downtown studio': require('@/assets/images/Real Estate/Downtown Studio.webp'),
  'eco home': require('@/assets/images/Real Estate/Eco Home.webp'),
  'island bungalow': require('@/assets/images/Real Estate/Island Bungalow.webp'),
  'lakeside cottage': require('@/assets/images/Real Estate/Lakeside Cottage.webp'),
  'luxury condo': require('@/assets/images/Real Estate/Luxury Condo.webp'),
  'modern mansion': require('@/assets/images/Real Estate/Modern Mansion.webp'),
  'mountain cabin': require('@/assets/images/Real Estate/Mountain Cabin.webp'),
  'mountain chalet': require('@/assets/images/Real Estate/Mountain Chalet.webp'),
  'office tower': require('@/assets/images/Real Estate/Office Tower.webp'),
  'penthouse suite': require('@/assets/images/Real Estate/Penthouse Suite.webp'),
  'royal palace': require('@/assets/images/Real Estate/Royal Palace.webp'),
  'rural estate': require('@/assets/images/Real Estate/Rural Estate.webp'),
  'sky castle': require('@/assets/images/Real Estate/Sky Castle.webp'),
  'suburban house': require('@/assets/images/Real Estate/Suburaban House.webp'),
  'urban loft': require('@/assets/images/Real Estate/Urban Loft.webp'),
};

// Catalog id -> photo key. Each of the 8 tiers gets a distinct, on-theme photo.
const IMAGE_BY_ID: Record<string, keyof typeof PROPERTY_IMAGES> = {
  'studio-apt': 'downtown studio',
  'city-apt': 'city apartment',
  'duplex': 'urban loft',
  'sub-house': 'suburban house',
  'lux-condo': 'luxury condo',
  'townhouse': 'eco home',
  'mansion': 'modern mansion',
  'penthouse': 'penthouse suite',
  // Commercial / multi-unit tier.
  'retail-strip': 'city apartment',
  'warehouse': 'office tower',
  'office-suite': 'office tower',
  'multi-unit': 'urban loft',
};

// Ordered keyword -> photo key fallback so legacy-owned properties (whatever they
// were named) still get a sensible photo. Most specific first.
const NAME_KEYWORDS: [string, keyof typeof PROPERTY_IMAGES][] = [
  ['penthouse', 'penthouse suite'],
  ['mansion', 'modern mansion'],
  ['palace', 'royal palace'],
  ['castle', 'sky castle'],
  ['villa', 'beach villa'],
  ['bungalow', 'island bungalow'],
  ['cottage', 'lakeside cottage'],
  ['chalet', 'mountain chalet'],
  ['cabin', 'mountain cabin'],
  ['ranch', 'desert ranch'],
  ['estate', 'rural estate'],
  ['loft', 'urban loft'],
  ['brownstone', 'eco home'],
  ['townhouse', 'eco home'],
  ['duplex', 'urban loft'],
  ['office', 'office tower'],
  ['tower', 'office tower'],
  ['eco', 'eco home'],
  ['studio', 'downtown studio'],
  ['condo', 'luxury condo'],
  ['apartment', 'city apartment'],
  ['house', 'suburban house'],
  ['home', 'eco home'],
];

function propertyImage(p: RealEstate): ImageSourcePropType {
  const byId = IMAGE_BY_ID[p.id];
  if (byId) return PROPERTY_IMAGES[byId];
  const n = (p.name || '').toLowerCase();
  for (const [kw, key] of NAME_KEYWORDS) if (n.includes(kw)) return PROPERTY_IMAGES[key];
  return PROPERTY_IMAGES['suburban house'];
}

// A short human "type" label derived from the property name (presentation only).
function propertyTypeLabel(p: RealEstate): string {
  const n = (p.name || '').toLowerCase();
  const table: [string, string][] = [
    ['penthouse', 'Penthouse'], ['mansion', 'Mansion'], ['palace', 'Palace'], ['castle', 'Castle'],
    ['villa', 'Villa'], ['bungalow', 'Bungalow'], ['cottage', 'Cottage'], ['chalet', 'Chalet'],
    ['cabin', 'Cabin'], ['ranch', 'Ranch'], ['estate', 'Estate'], ['loft', 'Loft'],
    ['brownstone', 'Townhouse'], ['townhouse', 'Townhouse'], ['duplex', 'Duplex'], ['office', 'Office'],
    ['tower', 'Tower'], ['studio', 'Studio'], ['condo', 'Condo'], ['apartment', 'Apartment'],
    ['house', 'House'], ['home', 'Home'],
  ];
  for (const [kw, label] of table) if (n.includes(kw)) return label;
  return 'Home';
}

// Deterministic bed / bath / sqft "listing specs" from the property's price tier.
// Presentation only (never stored) - the Zillow-style spec strip that makes a
// listing read as a listing. A pure function of existing data (price).
function listingSpecs(p: RealEstate): { beds: number; baths: number; sqft: number } {
  const price = p.currentValue ?? p.price;
  if (price < 120_000) return { beds: 0, baths: 1, sqft: 520 };
  if (price < 250_000) return { beds: 1, baths: 1, sqft: 780 };
  if (price < 400_000) return { beds: 2, baths: 2, sqft: 1_150 };
  if (price < 650_000) return { beds: 3, baths: 2, sqft: 1_850 };
  if (price < 1_500_000) return { beds: 4, baths: 3, sqft: 2_900 };
  if (price < 5_000_000) return { beds: 5, baths: 5, sqft: 6_400 };
  return { beds: 7, baths: 8, sqft: 12_000 };
}

const CYCLE_COLOR: Record<string, string> = {
  stable: accent.info,
  gentrifying: accent.purple,
  hot: accent.success,
  cooling: accent.warning,
};
const CYCLE_LABEL: Record<string, string> = {
  stable: 'Stable',
  gentrifying: 'Gentrifying',
  hot: 'Hot',
  cooling: 'Cooling',
};
const RENT_MODE_LABEL: Record<string, string> = {
  longTerm: 'Long-term lease',
  airbnb: 'Airbnb',
  commercial: 'Commercial',
};

interface RealEstateAppProps {
  onBack: () => void;
}

type Tab = 'portfolio' | 'rent' | 'browse' | 'activity';
type Route = { kind: 'list' } | { kind: 'detail'; id: string; source: 'portfolio' | 'browse' };

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: Home },
  // Rent sits BEFORE Browse on purpose: the cheapest property is $95,000, which
  // is roughly 16 years of a bottom-rung wage, so for most of a life renting is
  // the only housing a player can actually reach. Putting the unreachable option
  // first would make the screen read as "nothing here for you".
  { id: 'rent',      label: 'Rent',      icon: KeyRound },
  { id: 'browse',    label: 'Browse',    icon: ShoppingBag },
  { id: 'activity',  label: 'Activity',  icon: Activity },
];

/**
 * Buyable catalog - residential ladder + a commercial/multi-unit tier. Lives in
 * lib/realEstate/catalog.ts (data, ground rule #7) so late-game has inventory and
 * commercial rent mode + laundering fronts have real assets. Players who already
 * own catalog entries from the legacy app see them in Portfolio.
 */
const CATALOG: RealEstate[] = PROPERTY_CATALOG;

function formatSignedMoney(n: number): string {
  return `${n >= 0 ? '+' : '-'}${formatMoney(Math.abs(n))}`;
}

function RealEstateAppInner({ onBack }: RealEstateAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [route, setRoute] = useState<Route>({ kind: 'list' });
  const [buyTarget, setBuyTarget] = useState<RealEstate | null>(null);
  const [manageTarget, setManageTarget] = useState<RealEstate | null>(null);

  const cash = gameState.stats?.money ?? 0;
  const weeksLived = gameState.weeksLived ?? 0;
  const ownedProperties = useMemo(
    () => (gameState.realEstate ?? []).filter((p) => p.owned),
    [gameState.realEstate]
  );
  const mortgageById = useMemo(() => {
    const map = new Map<string, number>();
    for (const loan of gameState.loans ?? []) {
      if (loan.type === 'mortgage') map.set(loan.id, loan.remaining);
    }
    return map;
  }, [gameState.loans]);

  const mortgageOf = useCallback(
    (p: RealEstate) => (p.mortgageId ? mortgageById.get(p.mortgageId) ?? 0 : 0),
    [mortgageById]
  );

  const totalValue = useMemo(
    () => ownedProperties.reduce((s, p) => s + (p.currentValue ?? p.price), 0),
    [ownedProperties]
  );
  const totalMortgages = useMemo(
    () => ownedProperties.reduce((s, p) => s + mortgageOf(p), 0),
    [ownedProperties, mortgageOf]
  );
  const totalEquity = Math.max(0, totalValue - totalMortgages);

  // Approximate weekly income from owned-and-rented properties (using last week's rent).
  const weeklyRentEstimate = useMemo(() => {
    return ownedProperties
      .filter((p) => p.status === 'rented' && p.tenant)
      .reduce((s, p) => s + (p.tenant?.weeklyRent ?? 0), 0);
  }, [ownedProperties]);

  // Extra portfolio aggregates the old UI never surfaced.
  const portfolioStats = useMemo(() => {
    let rented = 0, vacant = 0, residences = 0, appreciation = 0, needsWork = 0;
    for (const p of ownedProperties) {
      if (p.status === 'rented' && p.tenant) rented += 1;
      if (p.status === 'rented' && !p.tenant) vacant += 1;
      if (p.currentResidence) residences += 1;
      appreciation += (p.currentValue ?? p.price) - (p.purchasePrice ?? p.price);
      if ((p.condition ?? 90) < 40) needsWork += 1;
    }
    return { rented, vacant, residences, appreciation, needsWork };
  }, [ownedProperties]);

  // Weekly income for loan DTI gating - approximation that mirrors AdvancedBankApp.
  const weeklyIncome = useMemo(() => {
    let income = 0;
    // R3-M3: political salaries are ANNUAL; every other ladder is weekly. This
    // read them all as weekly, so an elected player's borrowing capacity was
    // inflated 52x at the DTI gate. One shared helper now encodes the rule.
    income += weeklyCareerSalary(gameState);
    // Company income through the same helper the paycheck uses - the stored
    // `weeklyIncome` is the base before the ceiling and the net-worth soft cap,
    // so summing it inflated borrowing capacity for a large portfolio.
    income += companyIncomePaidWeekly(gameState);
    income += weeklyRentEstimate;
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies, weeklyRentEstimate]);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  // Catalog filtered to properties NOT yet owned.
  const browseList = useMemo(
    () => CATALOG.filter((c) => !ownedProperties.some((o) => o.id === c.id)),
    [ownedProperties]
  );
  const browseRange = useMemo(() => {
    if (browseList.length === 0) return null;
    const prices = browseList.map((p) => p.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [browseList]);

  // Portfolio activity timeline. Primary source is the persisted, capped
  // realEstateActivity slice the weekly tick now writes (tenant in/out,
  // neighborhood shift, maintenance alert). We keep the eventLog keyword filter
  // as a fallback so real-estate event-card choices still surface. Merged and
  // sorted newest-first.
  const activity = useMemo(() => {
    const fromSlice = (gameState.realEstateActivity ?? []).map((a) => ({
      description: a.label,
      week: a.week,
      category: a.kind,
    }));
    const fromLog = (gameState.eventLog ?? [])
      .filter((e: any) =>
        typeof e?.description === 'string' &&
        /property|tenant|neighborhood|maintenance|mortgage|rent|tenan|condition|lease/i.test(e.description)
      )
      .map((e: any) => ({
        description: e.description,
        week: e.weeksLived ?? e.week ?? 0,
        category: e.category,
      }));
    return [...fromSlice, ...fromLog]
      .sort((a, b) => (b.week ?? 0) - (a.week ?? 0))
      .slice(0, 20);
  }, [gameState.realEstateActivity, gameState.eventLog]);

  // Resolve the property backing the current detail sub-page (null-safe: a sold
  // property drops out of ownedProperties and we fall back to the list).
  const detailProperty = useMemo<RealEstate | null>(() => {
    if (route.kind !== 'detail') return null;
    if (route.source === 'portfolio') return ownedProperties.find((p) => p.id === route.id) ?? null;
    return CATALOG.find((p) => p.id === route.id) ?? null;
  }, [route, ownedProperties]);

  const inDetail = route.kind === 'detail' && !!detailProperty;

  const goBack = useCallback(() => {
    if (route.kind === 'detail') setRoute({ kind: 'list' });
    else onBack();
  }, [route.kind, onBack]);

  const openDetail = useCallback((id: string, source: 'portfolio' | 'browse') => {
    setRoute({ kind: 'detail', id, source });
  }, []);

  // ── Small building blocks ─────────────────────────────────────────────────

  const SpecStrip = ({ p }: { p: RealEstate }) => {
    const s = listingSpecs(p);
    return (
      <View style={styles.specStrip}>
        <View style={styles.specItem}>
          <Bed size={scale(13)} color={theme.textMuted} />
          <Text style={[styles.specText, { color: theme.textSecondary }]}>
            {s.beds === 0 ? 'Studio' : `${s.beds} bd`}
          </Text>
        </View>
        <View style={[styles.specDot, { backgroundColor: theme.border }]} />
        <View style={styles.specItem}>
          <Bath size={scale(13)} color={theme.textMuted} />
          <Text style={[styles.specText, { color: theme.textSecondary }]}>{s.baths} ba</Text>
        </View>
        <View style={[styles.specDot, { backgroundColor: theme.border }]} />
        <View style={styles.specItem}>
          <Ruler size={scale(13)} color={theme.textMuted} />
          <Text style={[styles.specText, { color: theme.textSecondary }]}>{s.sqft.toLocaleString()} sqft</Text>
        </View>
      </View>
    );
  };

  const CycleChip = ({ cycle }: { cycle: string }) => (
    <Chip label={CYCLE_LABEL[cycle]} tint={CYCLE_COLOR[cycle]} />
  );

  const OwnedBadges = ({ p }: { p: RealEstate }) => (
    <View style={styles.badgeRow}>
      {p.currentResidence && (
        <Chip label="Residence" tone="info" icon={<KeyRound size={scale(11)} color={accent.info} />} />
      )}
      {p.status === 'rented' && p.rentMode && (
        <Chip label={RENT_MODE_LABEL[p.rentMode]} tone="success" icon={<Users size={scale(11)} color={accent.success} />} />
      )}
      {p.status === 'rented' && !p.tenant && (
        <Chip label="Vacant" tone="warning" icon={<Users size={scale(11)} color={accent.warning} />} />
      )}
      {p.launderingFront && (
        <Chip label="Front" tint={accent.purple} icon={<Building size={scale(11)} color={accent.purple} />} />
      )}
      {p.mortgageId && (
        <Chip label={`Mortgage ${formatMoney(mortgageOf(p))}`} icon={<Banknote size={scale(11)} color={theme.textMuted} />} />
      )}
    </View>
  );

  /**
   * Owned property row. It carried ~7 text lines and up to 7 chips - value,
   * equity, gain, a sparkline, a condition bar and the whole badge set - which
   * is the detail sub-page rendered twice at a third of the size. A row is now
   * photo + name + value + ONE status chip + the weekly income it earns; the
   * rest is one tap away, where it already lived. Tapping opens that detail
   * page, whose loud CTA is Manage, so the row's own Manage button (a second
   * door to the same handler) is gone.
   */
  const PortfolioRow = ({ p }: { p: RealEstate }) => {
    const value = p.currentValue ?? p.price;
    // Only a unit with an actual TENANT earns - a vacant rented-mode unit
    // falling back to asking rent painted phantom income in earning-green.
    const weeklyIncomeRow = p.status === 'rented' && p.tenant ? (p.tenant.weeklyRent ?? p.rent ?? 0) : 0;
    const status: { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' } =
      p.status === 'rented' && !p.tenant
        ? { label: 'Vacant', tone: 'warning' }
        : p.status === 'rented' && p.rentMode
        ? { label: RENT_MODE_LABEL[p.rentMode], tone: 'success' }
        : p.currentResidence
        ? { label: 'Your home', tone: 'info' }
        : { label: 'Idle', tone: 'neutral' };

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openDetail(p.id, 'portfolio')}
        style={[getGlassCard(darkMode, 6), styles.rowCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${formatMoney(value)}, ${status.label}. Open to manage`}
      >
        <View style={styles.rowInner}>
          <View style={styles.rowThumbWrap}>
            <Image source={propertyImage(p)} style={styles.rowThumb} resizeMode="cover" />
          </View>

          <View style={styles.rowBody}>
            <View style={styles.rowTopLine}>
              <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
              <ChevronRight size={scale(16)} color={theme.textMuted} />
            </View>
            <Text style={[styles.rowValue, { color: theme.text }]} numberOfLines={1}>{formatMoney(value)}</Text>
            {weeklyIncomeRow > 0 ? (
              <Text style={[styles.rowIncome, { color: IDENTITY }]}>{formatMoney(weeklyIncomeRow)}/wk rent</Text>
            ) : null}
            <View style={styles.badgeRow}>
              <Chip label={status.label} tone={status.tone} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Buyable property PHOTO LISTING CARD (browse list). Big photo + price overlay.
  const ListingCard = ({ p }: { p: RealEstate }) => {
    const value = p.currentValue ?? p.price;
    return (
      <View style={[getGlassCard(darkMode, 6), styles.listingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.listingInner}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openDetail(p.id, 'browse')}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${formatMoney(value)}, view listing`}
          >
            <View style={styles.photoWrap}>
              <Image source={propertyImage(p)} style={styles.photo} resizeMode="cover" />
              <View pointerEvents="none" style={[styles.photoPill, styles.photoPillTL]}>
                <Tag size={scale(11)} color={IDENTITY} />
                <Text style={[styles.photoPillText, { color: '#fff' }]}>For sale</Text>
              </View>
              <View pointerEvents="none" style={[styles.photoPill, styles.photoPillTR]}>
                <Building size={scale(11)} color="#fff" />
                <Text style={[styles.photoPillText, { color: '#fff' }]}>{propertyTypeLabel(p)}</Text>
              </View>
              <View pointerEvents="none" style={[styles.pricePill]}>
                <Text style={styles.pricePillText}>{formatMoney(value)}</Text>
              </View>
            </View>

            <View style={styles.listingBody}>
              <View style={styles.rowTopLine}>
                <Text style={[styles.listingName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                <ChevronRight size={scale(16)} color={theme.textMuted} />
              </View>
              <SpecStrip p={p} />
              <View style={styles.amenityRow}>
                {isCommercialCatalogId(p.id) ? (
                  <AmenityChip icon={Building} label="Commercial · rent & fronts" />
                ) : (
                  <>
                    {/* Comfort/energy only pay out while this is your residence - label it so. */}
                    <AmenityChip icon={Sparkles} label={`+${p.weeklyHappiness} comfort (as home)`} />
                    <AmenityChip icon={Activity} label={`+${p.weeklyEnergy} energy (as home)`} />
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* One button. The card itself already opens the listing detail, so a
              separate "Details" control was a second door to the same room. */}
          <View style={styles.listingFooter}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setBuyTarget(p)}
              style={[styles.tintedBtn, { flex: 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${p.name}`}
            >
              <Tag size={scale(14)} color={IDENTITY} />
              <Text style={styles.tintedBtnText}>Buy this home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ── Tab bodies ────────────────────────────────────────────────────────────

  const renderPortfolio = () => {
    const equityFrac = totalValue > 0 ? totalEquity / totalValue : 1;
    // The one property the landlord should act on this week, if any. A unit
    // below the maintenance line loses value every tick and a listed unit with
    // no tenant earns nothing, so either outranks the equity number as the
    // thing the screen is about. Repairs first: decay is a cost, vacancy is
    // only a missed gain. Same thresholds `portfolioStats` counts with, so the
    // lead and the "rented · vacant" sub-line can never disagree.
    const leadProperty =
      ownedProperties.find((p) => (p.condition ?? 90) < 40) ??
      ownedProperties.find((p) => p.status === 'rented' && !p.tenant) ??
      null;
    const leadNeedsWork = !!leadProperty && (leadProperty.condition ?? 90) < 40;
    // The lead leaves the list while it leads (the Health cures / Work held-job
    // precedent): its row opens the same detail page either way, and a second
    // door to the same room is the duplication Program 3 removed.
    const listProperties = leadProperty ? ownedProperties.filter((p) => p.id !== leadProperty.id) : ownedProperties;
    return (
      <View>
        {leadProperty && (
          <View
            style={[
              getGlassCard(darkMode, 12),
              styles.heroCard,
              styles.leadCard,
              { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
            ]}
          >
            <View style={styles.leadInner}>
              <Text style={[styles.leadKicker, { color: theme.textMuted }]}>Needs attention</Text>
              {/* Semantic colour only: danger for decay (a cost), warning for
                  vacancy (a missed gain) - the tones the row's own chip uses. */}
              <Text
                style={[styles.leadTitle, { color: leadNeedsWork ? accent.danger : accent.warning }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              >
                {leadNeedsWork
                  ? `${leadProperty.name} is at ${Math.round(leadProperty.condition ?? 90)}% condition`
                  : `${leadProperty.name} has no tenant`}
              </Text>
              <Text style={[styles.leadSub, { color: theme.textSecondary }]}>
                {leadNeedsWork
                  ? 'Value and rent fall every week it goes unrepaired. Open it to book maintenance.'
                  : 'Listed but earning nothing. Open it to change the rent mode or find a tenant.'}
              </Text>
              <PortfolioRow p={leadProperty} />
            </View>
          </View>
        )}

      <View style={{ gap: responsiveSpacing.lg }}>
        <EconomyEventBanner context="generic" />

        {/* Recipe B hero - equity dashboard (one per screen). */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <View pointerEvents="none" style={styles.heroBlob} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            <View style={styles.heroRow}>
              <View style={[getGlassIconContainer(darkMode, 44), styles.heroBubble]}>
                <Building size={scale(22)} color={IDENTITY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Portfolio equity</Text>
                <Text style={[styles.heroValue, { color: theme.text }]} numberOfLines={1}>
                  {formatMoney(totalEquity)}
                </Text>
                <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                  {ownedProperties.length} {ownedProperties.length === 1 ? 'property' : 'properties'} · Value{' '}
                  {formatMoney(totalValue)}
                </Text>
              </View>
            </View>

            {ownedProperties.length > 0 && (
              <>
                {/* Stacked value = equity + mortgage bar. */}
                <View style={styles.equityBar}>
                  <View style={{ flex: Math.max(0.001, equityFrac), backgroundColor: IDENTITY }} />
                  <View style={{ flex: Math.max(0.001, 1 - equityFrac), backgroundColor: darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)' }} />
                </View>
                <View style={styles.equityLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: IDENTITY }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Equity {formatMoney(totalEquity)}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.3)' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Mortgage {formatMoney(totalMortgages)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Three numbers a landlord decides on. Rented/vacant is the sub-line
            under Owned; a property needing work is the LEAD above the hero, not
            a count here - a count that is zero most of the time does not earn
            a permanent tile, and when it is not zero it is the one thing the
            screen is about. */}
        <StatStrip
          items={[
            { label: 'Weekly rent', value: formatMoney(weeklyRentEstimate), tint: IDENTITY },
            {
              label: 'Owned',
              value: ownedProperties.length,
              sub: ownedProperties.length > 0 ? `${portfolioStats.rented} rented · ${portfolioStats.vacant} vacant` : undefined,
            },
            {
              label: 'Appreciation',
              value: formatSignedMoney(portfolioStats.appreciation),
              tint: portfolioStats.appreciation >= 0 ? accent.success : accent.danger,
            },
          ]}
        />
        {/* Skipped entirely when the lead was the only property: a heading over
            nothing is worse than no heading. The empty state still keys off
            ownership, so a lead never reads as "you own nothing". */}
        {ownedProperties.length === 0 || listProperties.length > 0 ? (
          <View style={{ gap: responsiveSpacing.sm }}>
            <SectionTitle title={leadProperty ? 'Other properties' : 'Your properties'} />
            {ownedProperties.length === 0 ? (
              <EmptyState
                icon={<Building size={scale(22)} color={IDENTITY} />}
                observation="You don't own any property yet."
                nudge="Buying is the only way to earn rent instead of paying it."
                ctaLabel="Browse listings"
                onCtaPress={() => { setActiveTab('browse'); setRoute({ kind: 'list' }); }}
              />
            ) : (
              listProperties.map((p) => <PortfolioRow key={p.id} p={p} />)
            )}
          </View>
        ) : null}
      </View>
      </View>
    );
  };

  const handleRent = useCallback((tierId: string) => {
    const result = rentHome(setGameState, gameState, tierId);
    gameAlert(result.success ? 'Moved in' : 'Cannot rent that', result.message);
    if (result.success) void saveGame();
  }, [gameState, setGameState, saveGame]);

  const handleEndRental = useCallback(() => {
    const result = endRental(setGameState, gameState);
    gameAlert(result.success ? 'Moved out' : 'Not renting', result.message);
    if (result.success) void saveGame();
  }, [gameState, setGameState, saveGame]);

  const renderRent = () => {
    const options = listRentalOptions(gameState);
    const currentTier = getRentalTier(gameState.rental?.tierId);
    const missedWeeks = gameState.rental?.missedWeeks ?? 0;
    const ownsHome = (gameState.realEstate ?? []).some((p) => p.owned && p.currentResidence);

    return (
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle title="Where you live" />

        <View style={[getGlassCard(darkMode, 6), styles.rentStatusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.rentStatusTitle, { color: theme.text }]}>
            {ownsHome ? 'You own your home' : currentTier ? currentTier.name : 'Nowhere to live'}
          </Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            {ownsHome
              ? 'Owning beats renting - no rent, and your home still keeps you well.'
              : currentTier
              ? `${formatMoney(currentTier.weeklyRent)}/wk · +${currentTier.health} health · +${currentTier.happiness} happiness · +${currentTier.energy} energy each week.`
              : 'Sleeping rough costs you health, happiness and energy every week. Even a shared room helps.'}
          </Text>
          {/* The eviction clock, on the screen rather than only in a toast a
              player may have dismissed. Someone about to lose their home should
              be able to SEE how close they are, and how to stop it. */}
          {missedWeeks > 0 && currentTier && !ownsHome ? (
            <Text style={[styles.rentReason, { color: accent.warning }]}>
              {missedWeeks >= EVICTION_AFTER_WEEKS - 1
                ? `Final notice - ${missedWeeks} weeks behind. Clear what you owe or you lose this place next week.`
                : `${missedWeeks} week${missedWeeks === 1 ? '' : 's'} behind on rent. ${EVICTION_AFTER_WEEKS - missedWeeks} more and you are evicted.`}
            </Text>
          ) : null}
          {currentTier && !ownsHome ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleEndRental}
              style={styles.tintedBtn}
              accessibilityRole="button"
              accessibilityLabel="Move out"
            >
              <Text style={styles.tintedBtnText}>Move out</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {ownsHome ? null : (
          <>
            <SectionTitle title="Available to rent" />
            {options.map(({ tier, current, allowed, reason }) => (
              <View
                key={tier.id}
                style={[getGlassCard(darkMode, 6), styles.rentCard, { backgroundColor: theme.surface, borderColor: current ? IDENTITY : theme.border }]}
              >
                <View style={styles.rentCardHead}>
                  <Text style={[styles.rentName, { color: theme.text }]}>{tier.name}</Text>
                  <Text style={[styles.rentPrice, { color: IDENTITY }]}>{formatMoney(tier.weeklyRent)}/wk</Text>
                </View>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{tier.description}</Text>
                <View style={styles.rentStats}>
                  <Text style={[styles.rentStat, { color: theme.textSecondary }]}>+{tier.health} health</Text>
                  <Text style={[styles.rentStat, { color: theme.textSecondary }]}>+{tier.happiness} happiness</Text>
                  <Text style={[styles.rentStat, { color: theme.textSecondary }]}>+{tier.energy} energy</Text>
                </View>
                {current ? (
                  <Text style={[styles.rentStat, { color: IDENTITY }]}>You live here</Text>
                ) : (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={!allowed}
                      onPress={() => handleRent(tier.id)}
                      style={[styles.tintedBtn, !allowed && { opacity: 0.45 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Rent the ${tier.name}`}
                      // Without this a screen reader announces an ordinary
                      // button: the dimming is the ONLY signal that it will not
                      // respond, and the refusal reason below is a separate text
                      // node the control is not associated with.
                      accessibilityState={{ disabled: !allowed }}
                      accessibilityHint={!allowed && reason ? reason : undefined}
                    >
                      <KeyRound size={scale(14)} color={IDENTITY} />
                      <Text style={styles.tintedBtnText}>Move in</Text>
                    </TouchableOpacity>
                    {!allowed && reason ? (
                      <Text style={[styles.rentReason, { color: theme.textMuted }]}>{reason}</Text>
                    ) : null}
                  </>
                )}
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderBrowse = () => (
    <View style={{ gap: responsiveSpacing.sm }}>
      <View style={styles.browseHeader}>
        <SectionTitle title="Homes for sale" />
        {browseRange && (
          <View style={[styles.rangePill, { backgroundColor: theme.surfaceElevated }]}>
            <Tag size={scale(11)} color={theme.textMuted} />
            <Text style={[styles.rangeText, { color: theme.textSecondary }]}>
              {browseList.length} · {formatMoney(browseRange.min)}–{formatMoney(browseRange.max)}
            </Text>
          </View>
        )}
      </View>
      {browseList.length === 0 ? (
        <EmptyState
          icon={<Building size={scale(22)} color={IDENTITY} />}
          observation="You own every listing."
          nudge="New listings drop as the neighborhoods cycle. Until then, improve and rent out what you already hold."
          ctaLabel="Manage portfolio"
          onCtaPress={() => { setActiveTab('portfolio'); setRoute({ kind: 'list' }); }}
        />
      ) : (
        browseList.map((p) => <ListingCard key={p.id} p={p} />)
      )}
    </View>
  );

  const renderActivity = () => (
    <View style={{ gap: responsiveSpacing.sm }}>
      <SectionTitle title="Recent activity" />
      {activity.length === 0 ? (
        <EmptyState
          icon={<Activity size={scale(22)} color={IDENTITY} />}
          observation="Nothing has happened to your properties yet."
          nudge="Cycle shifts, tenants moving in and out, and maintenance alerts all land here."
        />
      ) : (
        activity.map((e: any, idx: number) => (
          <View
            key={`re-act-${idx}`}
            style={[getGlassCard(darkMode, 6), styles.activityRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[getGlassIconContainer(darkMode, 34), styles.activityBubble]}>
              <Activity size={scale(15)} color={IDENTITY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activityText, { color: theme.textSecondary }]} numberOfLines={3}>
                {e.description}
              </Text>
              <View style={styles.activityMeta}>
                <Text style={[styles.activityWeek, { color: theme.textMuted }]}>
                  Week {e.weeksLived ?? e.week ?? '?'}
                </Text>
                {e.category ? (
                  <View style={[styles.catChip, { backgroundColor: theme.surfaceElevated }]}>
                    <Text style={[styles.catChipText, { color: theme.textMuted }]}>{String(e.category)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );

  // ── Listing detail sub-page ───────────────────────────────────────────────

  const renderDetail = (p: RealEstate, source: 'portfolio' | 'browse') => {
    const value = p.currentValue ?? p.price;
    const basis = p.purchasePrice ?? p.price;
    const gain = value - basis;
    const up = gain >= 0;
    const gainPct = basis > 0 ? (gain / basis) * 100 : 0;
    const equity = Math.max(0, value - mortgageOf(p));
    const condition = p.condition ?? (p.owned ? 90 : 100);
    const conditionColor = condition >= 70 ? accent.success : condition >= 40 ? accent.warning : accent.danger;
    const cycle = p.marketCycle ?? 'stable';
    const ownedWeeks = p.purchasedWeek != null ? Math.max(0, weeksLived - p.purchasedWeek) : null;
    const specs = listingSpecs(p);

    return (
      <View style={{ gap: responsiveSpacing.md }}>
        {/* Hero photo with overlays. */}
        <View style={[getGlassCard(darkMode, 12), styles.detailHeroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={styles.detailHeroInner}>
            <Image source={propertyImage(p)} style={styles.detailPhoto} resizeMode="cover" />
            <View pointerEvents="none" style={[styles.photoPill, styles.photoPillTL]}>
              {p.owned ? <KeyRound size={scale(11)} color={IDENTITY} /> : <Tag size={scale(11)} color={IDENTITY} />}
              <Text style={[styles.photoPillText, { color: '#fff' }]}>{p.owned ? 'Owned' : 'For sale'}</Text>
            </View>
            <View pointerEvents="none" style={[styles.photoPill, styles.photoPillTR]}>
              <Building size={scale(11)} color="#fff" />
              <Text style={[styles.photoPillText, { color: '#fff' }]}>{propertyTypeLabel(p)}</Text>
            </View>
            <View pointerEvents="none" style={styles.detailPricePill}>
              <Text style={styles.detailPriceText}>{formatMoney(value)}</Text>
            </View>
          </View>
        </View>

        {/* Title + neighborhood + primary CTA (the ONE loud CTA for this view). */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <Text style={[styles.detailTitle, { color: theme.text }]}>{p.name}</Text>
          <View style={styles.metaLine}>
            <MapPin size={scale(13)} color={theme.textMuted} />
            <Text style={[styles.detailMeta, { color: theme.textMuted }]}>
              {p.neighborhood ?? (p.owned ? 'Your portfolio' : 'Available now')}
            </Text>
            {p.owned && <CycleChip cycle={cycle} />}
          </View>
          <SpecStrip p={p} />

          {source === 'browse' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setBuyTarget(p)}
              style={styles.ctaWrap}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${p.name}`}
            >
              <View style={[styles.cta, { backgroundColor: IDENTITY }]}>
                <Tag size={scale(16)} color="#fff" />
                <Text style={styles.ctaText}>Buy this home · {formatMoney(value)}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setManageTarget(p)}
              style={styles.ctaWrap}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${p.name}`}
            >
              <View style={[styles.cta, { backgroundColor: IDENTITY }]}>
                <Wrench size={scale(16)} color="#fff" />
                <Text style={styles.ctaText}>Manage property</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Owned: condition ring + value trend + tenant. */}
        {p.owned && (
          <View style={[getGlassCard(darkMode, 6), styles.detailBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.detailBlockRow}>
              <ProgressRing
                value={condition}
                size={80}
                strokeWidth={8}
                ambient={false}
                accentColor={conditionColor}
                positiveColor={conditionColor}
                surfaceColor={theme.surface}
                borderColor={theme.border}
                inkColor={theme.text}
                trackColor={theme.surfaceElevated}
                label={`Condition ${Math.round(condition)} percent`}
              >
                <Wrench size={scale(20)} color={conditionColor} />
              </ProgressRing>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.detailStatLabel, { color: theme.textMuted }]}>
                  Condition {Math.round(condition)}% · since you bought
                </Text>
                <View style={styles.detailTrendRow}>
                  {up ? <TrendingUp size={scale(13)} color={accent.success} /> : <TrendingDown size={scale(13)} color={accent.danger} />}
                  <Text style={[styles.detailTrendText, { color: up ? accent.success : accent.danger }]}>
                    {formatSignedMoney(gain)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
                  </Text>
                  <ValueTrend from={basis} to={value} width={scale(72)} height={scale(22)} />
                </View>
              </View>
            </View>
            <StatStrip
              items={[
                { label: 'Market value', value: formatMoney(value) },
                { label: 'Equity', value: formatMoney(equity), tint: accent.success },
                ...(p.mortgageId ? [{ label: 'Mortgage owed', value: formatMoney(mortgageOf(p)) }] : []),
              ]}
            />
            {ownedWeeks != null && (
              <Text style={[styles.detailFoot, { color: theme.textMuted }]}>
                Owned {ownedWeeks} {ownedWeeks === 1 ? 'week' : 'weeks'} · bought for {formatMoney(basis)}
              </Text>
            )}
          </View>
        )}

        {/* Tenant card. */}
        {p.owned && p.tenant && (
          <View style={[getGlassCard(darkMode, 6), styles.detailBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.detailBlockHeader}>
              <Users size={scale(15)} color={IDENTITY} />
              <Text style={[styles.detailBlockTitle, { color: theme.text }]}>Current tenant</Text>
            </View>
            <Text style={[styles.tenantName, { color: theme.text }]}>{p.tenant.name}</Text>
            <View style={styles.satBarWrap}>
              <Text style={[styles.satLabel, { color: theme.textMuted }]}>Satisfaction</Text>
              <View style={[styles.satTrack, { backgroundColor: theme.surfaceElevated }]}>
                <View style={[styles.satFill, {
                  width: `${Math.max(3, Math.min(100, p.tenant.satisfaction))}%`,
                  backgroundColor: p.tenant.satisfaction >= 60 ? accent.success : p.tenant.satisfaction >= 30 ? accent.warning : accent.danger,
                }]} />
              </View>
              <Text style={[styles.satPct, { color: theme.textSecondary }]}>{Math.round(p.tenant.satisfaction)}%</Text>
            </View>
            <Text style={[styles.detailFoot, { color: theme.textMuted }]}>
              {formatMoney(p.tenant.weeklyRent)}/wk · tenant since week {p.tenant.movedInWeek}
            </Text>
          </View>
        )}

        {/* Amenities / what you get. */}
        <View style={[getGlassCard(darkMode, 6), styles.detailBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.detailBlockHeader}>
            <Sparkles size={scale(15)} color={IDENTITY} />
            <Text style={[styles.detailBlockTitle, { color: theme.text }]}>Highlights</Text>
          </View>
          <View style={styles.amenityGrid}>
            <AmenityChip icon={Bed} label={`${specs.beds === 0 ? 'Studio' : `${specs.beds} bedroom`}`} />
            <AmenityChip icon={Bath} label={`${specs.baths} bath`} />
            <AmenityChip icon={Ruler} label={`${specs.sqft.toLocaleString()} sqft`} />
            {!isCommercialCatalogId(p.id) && p.weeklyHappiness > 0 && (
              <AmenityChip icon={Sparkles} label={`+${p.weeklyHappiness} comfort (as home)`} />
            )}
            {!isCommercialCatalogId(p.id) && p.weeklyEnergy > 0 && (
              <AmenityChip icon={Activity} label={`+${p.weeklyEnergy} energy (as home)`} />
            )}
            {p.upgradeLevel > 0 && <AmenityChip icon={Layers} label={`Upgrade tier ${p.upgradeLevel}`} />}
            {(p.interior?.length ?? 0) > 0 && <AmenityChip icon={Layers} label={`${p.interior.length} furnishings`} />}
            {(p.rooms?.length ?? 0) > 0 && <AmenityChip icon={Home} label={`${p.rooms!.length} rooms added`} />}
          </View>
          {p.owned && <OwnedBadges p={p} />}
        </View>
      </View>
    );
  };

  // ── Screen ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <AppHeader
        title={inDetail ? detailProperty?.name ?? 'Listing' : 'Real Estate'}
        onBack={goBack}
        backLabel={inDetail ? 'Back to listings' : 'Back'}
        right={<CashChip value={formatMoney(cash)} tint={IDENTITY} />}
      />

      {!inDetail && (
        <SegmentedControl
          segments={TABS.map((t) => ({ key: t.id, label: t.label, icon: t.icon }))}
          value={activeTab}
          onChange={(id) => { setActiveTab(id); setRoute({ kind: 'list' }); }}
          activeColor={IDENTITY}
          style={styles.tabs}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {inDetail && detailProperty
          ? renderDetail(detailProperty, (route as Extract<Route, { kind: 'detail' }>).source)
          : activeTab === 'portfolio'
          ? renderPortfolio()
          : activeTab === 'rent'
          ? renderRent()
          : activeTab === 'browse'
          ? renderBrowse()
          : renderActivity()}
      </ScrollView>

      <BuyPropertyModal
        visible={!!buyTarget}
        property={buyTarget}
        gameState={gameState}
        weeklyIncome={weeklyIncome}
        darkMode={darkMode}
        onClose={() => setBuyTarget(null)}
        onConfirm={(spec) => {
          if (buyTarget) {
            const result = buyPropertyWithMortgage(gameState, setGameState, {
              property: buyTarget,
              tier: spec.tier,
              term: spec.term,
              weeklyIncome,
              asResidence: spec.asResidence,
            });
            // Signing a mortgage is a life milestone - celebrate it (and explain
            // rejections, which previously vanished into the log).
            gameAlert(result.success ? 'Sold!' : 'Purchase', result.message);
            // On success the catalog detail would still read "For sale" with a
            // live Buy CTA (its source is the immutable CATALOG). Drop back to the
            // list so the now-owned property reflects its portfolio state.
            if (result.success) setRoute({ kind: 'list' });
            queueSave();
          }
          setBuyTarget(null);
        }}
      />

      <ManagePropertyModal
        visible={!!manageTarget}
        // Resolve the LIVE property so the Improve flow (and any tick) reflects
        // freshly-installed decor / rooms / upgrade tier without reopening.
        property={manageTarget ? (ownedProperties.find((p) => p.id === manageTarget.id) ?? manageTarget) : null}
        mortgageRemaining={
          manageTarget?.mortgageId ? mortgageById.get(manageTarget.mortgageId) : undefined
        }
        availableCash={cash}
        darkMode={darkMode}
        onClose={() => setManageTarget(null)}
        onSetRentMode={(mode: RentMode, weeklyRent) => {
          if (manageTarget) {
            setPropertyRentMode(setGameState, manageTarget.id, mode, weeklyRent);
            queueSave();
          }
          setManageTarget(null);
        }}
        onStopRenting={() => {
          if (manageTarget) {
            stopRenting(setGameState, manageTarget.id);
            queueSave();
          }
          setManageTarget(null);
        }}
        onEvict={() => {
          if (!manageTarget) return;
          /**
           * F8. This fired on a single tap of an icon-only button, with no
           * confirmation. Eviction is not reversible: `kickTenant` clears the
           * tenant and resets `weeksVacant`, so the rent stops and the property
           * has to find a new tenant from scratch. Every other destructive
           * action in this file at least reports its outcome; this one just
           * silently emptied the unit.
           */
          const tenantName = manageTarget.tenant?.name ?? 'your tenant';
          gameAlert(
            'Evict tenant?',
            `${tenantName} will be removed from ${manageTarget.name ?? 'this property'} and the rent stops immediately. You will have to wait for a new tenant.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Evict',
                style: 'destructive',
                onPress: () => {
                  evictTenant(setGameState, manageTarget.id);
                  queueSave();
                },
              },
            ],
          );
        }}
        onMaintain={() => {
          if (manageTarget) {
            const r = maintainProperty(gameState, setGameState, manageTarget.id);
            if (!r.success) gameAlert('Maintenance', r.message);
            queueSave();
          }
        }}
        onSell={() => {
          if (manageTarget) {
            sellOwnedProperty(setGameState, manageTarget.id);
            queueSave();
          }
          setManageTarget(null);
          setRoute({ kind: 'list' });
        }}
        onToggleLaunderingFront={() => {
          if (manageTarget) {
            toggleLaunderingFront(setGameState, manageTarget.id);
            queueSave();
          }
        }}
        onInstallDecor={(decorId) => {
          if (manageTarget) {
            const r = installPropertyDecor(gameState, setGameState, manageTarget.id, decorId);
            if (!r.success) gameAlert('Improve', r.message);
            queueSave();
          }
        }}
        onAddRoom={(roomId) => {
          if (manageTarget) {
            const r = addPropertyRoom(gameState, setGameState, manageTarget.id, roomId);
            if (!r.success) gameAlert('Improve', r.message);
            queueSave();
          }
        }}
        onUpgrade={() => {
          if (manageTarget) {
            const r = upgradePropertyTier(gameState, setGameState, manageTarget.id);
            if (!r.success) gameAlert('Improve', r.message);
            queueSave();
          }
        }}
      />
    </View>
  );
}

// ── Presentational leaf components ──────────────────────────────────────────

// 2-point value trend segment (purchase -> current). Never fabricates history -
// draws exactly the two values the state carries.
function ValueTrend({ from, to, width, height }: { from: number; to: number; width: number; height: number }) {
  const up = to >= from;
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  const range = max - min || 1;
  const pad = 3;
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const color = up ? accent.success : accent.danger;
  const x2 = Math.max(pad, width - pad);
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Polyline
        points={`${pad},${y(from)} ${x2},${y(to)}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={x2} cy={y(to)} r={2.4} fill={color} />
    </Svg>
  );
}

function AmenityChip({ icon: Icon, label }: { icon: React.ComponentType<{ size: number; color: string }>; label: string }) {
  return <Chip label={label} tint={IDENTITY} icon={<Icon size={scale(12)} color={IDENTITY} />} />;
}

export default function RealEstateApp(props: RealEstateAppProps) {
  return (
    <ErrorBoundary>
      <RealEstateAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { marginHorizontal: responsiveSpacing.md, marginBottom: responsiveSpacing.sm },

  // Empty-state card.
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
  },

  // Recipe B hero.
  heroCard: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius['2xl'],
  },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
  },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: withAlpha(IDENTITY, 0.1),
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  heroBubble: {
    backgroundColor: withAlpha(IDENTITY, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(IDENTITY, 0.3),
  },
  heroLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },

  // Portfolio lead - the one property to act on, above the equity hero.
  // `rhythm.major` below it is the hierarchy change: everything after is
  // "the rest of the portfolio". The wrapped PortfolioRow keeps its own tap
  // (detail page -> Manage), so the lead adds no second handler.
  leadCard: { marginBottom: rhythm.major },
  leadInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  leadKicker: { ...kicker },
  leadTitle: { ...tier1Title },
  leadSub: { fontSize: responsiveFontSize.sm },
  heroValue: { fontSize: responsiveFontSize['3xl'], fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 4, fontVariant: ['tabular-nums'] },
  equityBar: {
    flexDirection: 'row',
    height: scale(10),
    borderRadius: scale(5),
    overflow: 'hidden',
  },
  equityLegend: { flexDirection: 'row', gap: responsiveSpacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: scale(9), height: scale(9), borderRadius: scale(5) },
  legendText: { fontSize: responsiveFontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // KPI strip.

  // Portfolio photo row.
  rowCard: { borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
  rowInner: { flexDirection: 'row', gap: responsiveSpacing.md, borderRadius: responsiveBorderRadius.xl, overflow: 'hidden', padding: responsiveSpacing.md },
  rowThumbWrap: { width: scale(104), height: scale(96), borderRadius: responsiveBorderRadius.lg, overflow: 'hidden' },
  rowThumb: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing.xs },
  rowName: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '600' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  rowValue: { fontSize: responsiveFontSize.lg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowIncome: { fontSize: responsiveFontSize.xs, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },

  // Badges / chips.
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs, marginTop: 2 },

  // Tinted / ghost buttons.
  tintedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: withAlpha(IDENTITY, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(IDENTITY, 0.3),
  },
  tintedBtnText: { color: IDENTITY, fontWeight: '600', fontSize: responsiveFontSize.sm },

  // Browse listing card.
  browseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing.sm },
  rangePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: responsiveSpacing.sm, paddingVertical: 4, borderRadius: responsiveBorderRadius.full },
  rangeText: { fontSize: responsiveFontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
  listingCard: { borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
  listingInner: { borderRadius: responsiveBorderRadius.xl, overflow: 'hidden' },
  photoWrap: { width: '100%', height: scale(200), backgroundColor: 'rgba(0,0,0,0.06)' },
  photo: { width: '100%', height: '100%' },
  photoPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: scale(8),
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoPillTL: { top: scale(10), left: scale(10) },
  photoPillTR: { top: scale(10), right: scale(10) },
  photoPillText: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  pricePill: {
    position: 'absolute',
    left: scale(10),
    bottom: scale(10),
    paddingHorizontal: scale(10),
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  pricePillText: { color: '#fff', fontSize: responsiveFontSize.lg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  listingBody: { padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  listingName: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '600' },
  specStrip: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm, flexWrap: 'wrap' },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  specDot: { width: scale(3), height: scale(3), borderRadius: scale(2) },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  listingFooter: { flexDirection: 'row', gap: responsiveSpacing.sm, paddingHorizontal: responsiveSpacing.md, paddingBottom: responsiveSpacing.md },

  // Detail sub-page.
  detailHeroCard: { borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'] },
  detailHeroInner: { borderRadius: responsiveBorderRadius['2xl'], overflow: 'hidden' },
  detailPhoto: { width: '100%', height: scale(220) },
  detailPricePill: {
    position: 'absolute',
    left: scale(12),
    bottom: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: 6,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  detailPriceText: { color: '#fff', fontSize: responsiveFontSize['2xl'], fontWeight: '600', fontVariant: ['tabular-nums'] },
  detailTitle: { fontSize: responsiveFontSize.xl, fontWeight: '700' },
  detailMeta: { fontSize: responsiveFontSize.sm },
  ctaWrap: {
    borderRadius: responsiveBorderRadius.full,
    ...getPlatformShadows(5, 0.3, 2, 8),
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
  },
  ctaText: { color: '#fff', fontSize: responsiveFontSize.md, fontWeight: '600' },
  rentStatusCard: { padding: scale(14), borderRadius: scale(14), borderWidth: 1, gap: scale(6) },
  rentStatusTitle: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  rentCard: { padding: scale(14), borderRadius: scale(14), borderWidth: 1, gap: scale(8) },
  rentCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rentName: { fontSize: responsiveFontSize.md, fontWeight: '600', flex: 1 },
  rentPrice: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  rentStats: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) },
  rentStat: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  rentReason: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  detailBlock: { borderWidth: 1, borderRadius: responsiveBorderRadius.xl, padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  detailBlockRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  detailBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  detailBlockTitle: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  detailStatLabel: { fontSize: responsiveFontSize.sm },
  detailTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  detailTrendText: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  detailFoot: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  tenantName: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  satBarWrap: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  satLabel: { fontSize: responsiveFontSize.xs },
  satTrack: { flex: 1, height: scale(7), borderRadius: scale(4), overflow: 'hidden' },
  satFill: { height: '100%', borderRadius: scale(4) },
  satPct: { fontSize: responsiveFontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: scale(34), textAlign: 'right' },

  // Activity timeline.
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  activityBubble: {
    backgroundColor: withAlpha(IDENTITY, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(IDENTITY, 0.3),
  },
  activityText: { fontSize: responsiveFontSize.sm },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs, marginTop: 4 },
  activityWeek: { fontSize: responsiveFontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
  catChip: { paddingHorizontal: responsiveSpacing.xs, paddingVertical: 2, borderRadius: responsiveBorderRadius.sm },
  catChipText: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
});
