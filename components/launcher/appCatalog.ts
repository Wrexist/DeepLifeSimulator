/**
 * The ONE app catalog behind both launchers.
 *
 * `app/(tabs)/computer.tsx` and `app/(tabs)/mobile.tsx` each declared their own
 * ~95%-identical list of the same apps. The two copies had already drifted the
 * way copies do: Bank carried a different gradient on each grid, and the pet
 * app was `paw` on the desktop grid but `pet` on the phone grid — a mismatch
 * papered over with alias entries in three files. This module is the single
 * source both screens (and any test or route table) read.
 *
 * The pet app's canonical id is **`pet`**: nothing persisted in saves stores a
 * launcher app id, analytics maps both spellings to the same `pets` feature,
 * and `pet` is the id the phone grid, `lib/simulation/AppSimulator` and the
 * icon-asset map already used — so `paw` (the desktop grid's private spelling)
 * is the side that got renamed, and the aliases are gone.
 *
 * EAGER IMPORTS ON PURPOSE (do not "optimize" to React.lazy): the R6 lazy
 * conversion of the launchers' sub-app map shipped an "Element type is invalid"
 * launch crash in the production Hermes bundle. Every sub-app here must stay a
 * static import — `__tests__/startup/screenImports.test.ts` pins this file.
 */
import type { ComponentType } from 'react';
import {
  Activity,
  BarChart3,
  Bitcoin,
  Building,
  Car,
  CreditCard,
  Crown,
  Flame,
  Gamepad2,
  Globe,
  GraduationCap,
  Home,
  Mail,
  PawPrint,
  Plane,
  TrendingUp,
  Users,
  Video,
  Vote,
} from 'lucide-react-native';

import SparkApp from '@/components/mobile/Spark/SparkApp';
import ContactsApp from '@/components/mobile/ContactsApp';
import MailApp from '@/components/mobile/Mail/MailApp';
import PulseApp from '@/components/mobile/Pulse/PulseApp';
import StocksApp from '@/components/mobile/StocksApp';
import BankApp from '@/components/mobile/BankApp';
import EducationApp from '@/components/mobile/EducationApp';
import HustleApp from '@/components/mobile/Hustle/HustleApp';
import PetApp from '@/components/mobile/PetApp';
import BitcoinMiningApp from '@/components/computer/BitcoinMiningApp';
import RealEstateApp from '@/components/computer/RealEstateApp';
import OnionApp from '@/components/computer/OnionApp';
import GamingApp from '@/components/computer/GamingApp';
import GamingStreamingApp from '@/components/computer/GamingStreamingApp';
import AdvancedBankApp from '@/components/computer/AdvancedBankApp';
import TravelApp from '@/components/computer/TravelApp';
import PoliticalApp from '@/components/computer/PoliticalApp';
import StatisticsApp from '@/components/computer/StatisticsApp';
import VehicleApp from '@/components/computer/VehicleApp';
import LuxuryApp from '@/components/computer/LuxuryApp';

/** Which launcher is hosting the grid — decides sections, columns and chrome. */
export type LauncherHost = 'phone' | 'computer';

/** Every hosted sub-app takes exactly one prop: the close handler. */
type SubAppComponent = ComponentType<{ onBack: () => void }>;

export interface LauncherApp {
  /**
   * The canonical launcher id — the `?app=` deep-link vocabulary, the
   * `app:<id>` featureUnlocks key, the badge-count key and the icon-asset key.
   * One spelling per app; renames must update all four consumers.
   */
  id: string;
  /** Fallback display name (brand names have no translation key). */
  name: string;
  /** Optional i18n key; resolved at render, falling back to `name`. */
  nameKey?: string;
  /** Lucide glyph used only when no PNG icon asset exists for the id. */
  icon: ComponentType<{ size?: number; color?: string }>;
  /**
   * Which labelled section the DESKTOP launcher files it under. The fiction:
   * everyday apps live on the phone, specialist software on the computer.
   */
  section: LauncherHost;
  /** Whether the phone-only launcher (no computer owned yet) shows it. */
  onPhone: boolean;
  component: SubAppComponent;
  /**
   * Desktop upgrade of the same app, when one exists (Bank's full-service
   * version). Used only on the computer host; the id stays identical.
   */
  desktopComponent?: SubAppComponent;
}

/**
 * Order matters twice over: the phone launcher renders `onPhone` entries in
 * this order, and the desktop launcher renders each section's entries in this
 * order. Grids must not reshuffle between sessions, so treat order as part of
 * the contract.
 */
export const APP_CATALOG: readonly LauncherApp[] = [
  // ── Phone — the everyday apps ─────────────────────────────────────────────
  { id: 'tinder', name: 'Spark', icon: Flame, section: 'phone', onPhone: true, component: SparkApp },
  { id: 'contacts', name: 'Contacts', nameKey: 'computer.contacts', icon: Users, section: 'phone', onPhone: true, component: ContactsApp },
  { id: 'mail', name: 'DeepMail', icon: Mail, section: 'phone', onPhone: true, component: MailApp },
  { id: 'social', name: 'Pulse', icon: Activity, section: 'phone', onPhone: true, component: PulseApp },
  { id: 'stocks', name: 'Stocks', nameKey: 'computer.stocks', icon: TrendingUp, section: 'phone', onPhone: true, component: StocksApp },
  { id: 'bank', name: 'Bank', nameKey: 'computer.bank', icon: CreditCard, section: 'phone', onPhone: true, component: BankApp, desktopComponent: AdvancedBankApp },
  // ── Computer, but usable from the phone too ──────────────────────────────
  { id: 'education', name: 'Education', nameKey: 'computer.education', icon: GraduationCap, section: 'computer', onPhone: true, component: EducationApp },
  { id: 'company', name: 'Hustle', icon: Building, section: 'computer', onPhone: true, component: HustleApp },
  // Filed under 'phone' but declared here so the phone launcher keeps its
  // historical order (pet last) - order is part of the contract, see above.
  { id: 'pet', name: 'Pets', nameKey: 'computer.pets', icon: PawPrint, section: 'phone', onPhone: true, component: PetApp },
  // ── Computer only — the specialist half ──────────────────────────────────
  { id: 'bitcoin', name: 'Crypto', nameKey: 'computer.crypto', icon: Bitcoin, section: 'computer', onPhone: false, component: BitcoinMiningApp },
  { id: 'realestate', name: 'Real Estate', nameKey: 'computer.realEstate', icon: Home, section: 'computer', onPhone: false, component: RealEstateApp },
  { id: 'onion', name: 'Dark Web', nameKey: 'computer.darkWeb', icon: Globe, section: 'computer', onPhone: false, component: OnionApp },
  { id: 'gaming', name: 'YouVideo', icon: Gamepad2, section: 'computer', onPhone: false, component: GamingApp },
  { id: 'streaming', name: 'Streaming', icon: Video, section: 'computer', onPhone: false, component: GamingStreamingApp },
  { id: 'travel', name: 'Travel', icon: Plane, section: 'computer', onPhone: false, component: TravelApp },
  // Always listed: politics is a life path you enter FROM this app (Run for
  // Office); the Office tab enforces age/reputation/education.
  { id: 'political', name: 'Political Office', icon: Vote, section: 'computer', onPhone: false, component: PoliticalApp },
  { id: 'statistics', name: 'Statistics', icon: BarChart3, section: 'computer', onPhone: false, component: StatisticsApp },
  { id: 'vehicle', name: 'Garage', icon: Car, section: 'computer', onPhone: false, component: VehicleApp },
  { id: 'luxury', name: 'Luxury', icon: Crown, section: 'computer', onPhone: false, component: LuxuryApp },
];

/** The catalog entries a given host can show. */
export function appsForHost(host: LauncherHost): LauncherApp[] {
  return APP_CATALOG.filter((app) => (host === 'computer' ? true : app.onPhone));
}

/**
 * Resolve an app id (from a tap or a `?app=` deep link) to its component, or
 * null for an id this host cannot open — the caller resets to the grid rather
 * than rendering `undefined` (the P2-15 "Element type is invalid" guard).
 */
export function resolveAppComponent(id: string, host: LauncherHost): SubAppComponent | null {
  const entry = appsForHost(host).find((app) => app.id === id);
  if (!entry) return null;
  return host === 'computer' && entry.desktopComponent ? entry.desktopComponent : entry.component;
}
