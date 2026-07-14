import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState, Education, Career, Company, ChildInfo } from '@/contexts/game/types';
import {
  X,
  DollarSign,
  Gem,
  Heart,
  Clock,
  Zap,
  Shield,
  Briefcase,
  Skull,
  RefreshCw,
  Save,
  FileText,
  Users,
  Building2,
  GraduationCap,
  Star,
  Award,
  Bug,
  ClipboardCheck,
  FlaskConical,
  Crown,
  Baby,
  Landmark,
  Globe,
  Gift,
  Search,
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Rocket,
  Wrench,
  Trophy,
} from 'lucide-react-native';
import { responsiveFontSize } from '@/utils/scaling';
import LogViewer from '@/components/dev/LogViewer';
import AIDebugMenu from '@/components/debug/AIDebugMenu';
import TestRunner from '@/components/TestRunner';
import { updateMoney, MONEY_CEILING } from '@/contexts/game/actions/MoneyActions';
import { LIFE_SKILL_IDS } from '@/lib/skillTrees/lifeSkillEffects';
import { LIFE_AMBITIONS } from '@/lib/ambitions/catalog';
import { ALL_SIMULATIONS, runAllSimulations, getBaseSimState, type SimResult } from '@/lib/devtools/simulations';

// ---------------------------------------------------------------------------
// Slate-Glass palette (matches SettingsModal's dark glass surfaces).
// ---------------------------------------------------------------------------
const C = {
  bg: 'rgba(2, 6, 23, 0.96)', // slate-950
  panel: 'rgba(15, 23, 42, 0.98)', // slate-900
  card: 'rgba(30, 41, 59, 0.7)', // slate-800
  cardSolid: 'rgba(30, 41, 59, 1)',
  border: 'rgba(51, 65, 85, 0.8)', // slate-700
  borderSoft: 'rgba(51, 65, 85, 0.45)',
  text: '#E2E8F0', // slate-200
  textDim: '#94A3B8', // slate-400
  textFaint: '#64748B', // slate-500
  accent: '#6366F1', // indigo-500
  accentSoft: 'rgba(99, 102, 241, 0.16)',
  green: '#10B981',
  greenSoft: 'rgba(16, 185, 129, 0.16)',
  red: '#EF4444',
  redSoft: 'rgba(239, 68, 68, 0.16)',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  cyan: '#22D3EE',
};

type IconType = React.ComponentType<{ size?: number; color?: string }>;
type Tone = 'money' | 'gem' | 'stat' | 'time' | 'unlock' | 'life' | 'danger' | 'neutral';

const TONE_ACCENT: Record<Tone, string> = {
  money: C.green,
  gem: C.violet,
  stat: '#F472B6',
  time: '#38BDF8',
  unlock: C.accent,
  life: C.amber,
  danger: C.red,
  neutral: C.textDim,
};

interface Btn {
  label: string;
  icon: IconType;
  tone: Tone;
  onPress: () => void;
}
interface Group {
  title: string;
  icon: IconType;
  items: Btn[];
}

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabKey = 'cheats' | 'setups' | 'sims';

export default function DevToolsModal({ visible, onClose }: DevToolsModalProps) {
  const { gameState, setGameState, nextWeek, saveGame } = useGame();

  const [tab, setTab] = useState<TabKey>('cheats');
  const [search, setSearch] = useState('');
  const [moneyInput, setMoneyInput] = useState('');
  const [gemInput, setGemInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [statInput, setStatInput] = useState('');
  const [preventDrain, setPreventDrain] = useState(false);

  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showAIDebug, setShowAIDebug] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);

  // Simulation state
  const [simResults, setSimResults] = useState<Record<string, SimResult>>({});
  const [runningSimId, setRunningSimId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [expandedSim, setExpandedSim] = useState<string | null>(null);

  // --- Time-travel loop (drives the REAL nextWeek tick) --------------------
  const [targetWeek, setTargetWeek] = useState<number | null>(null);
  const isProcessingRef = useRef(false);
  const godModeStatsRef = useRef<{ health: number; happiness: number; energy: number; fitness: number } | null>(null);
  const lastWeekRef = useRef<number>(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (gameState?.weeksLived !== undefined && lastWeekRef.current === 0) {
      lastWeekRef.current = gameState.weeksLived || 0;
    }
  }, [gameState?.weeksLived]);

  // God Mode: restore stats after each week advance.
  useEffect(() => {
    if (!preventDrain || !gameState) return;
    if (!godModeStatsRef.current && gameState.stats) {
      godModeStatsRef.current = { health: 100, happiness: 100, energy: 100, fitness: 100 };
    }
    const currentWeek = gameState.weeksLived || 0;
    if (currentWeek !== lastWeekRef.current && godModeStatsRef.current) {
      setGameState((prev) => (prev.stats ? { ...prev, stats: { ...prev.stats, ...godModeStatsRef.current } } : prev));
      lastWeekRef.current = currentWeek;
    }
  }, [gameState?.weeksLived, preventDrain, setGameState, gameState]);

  // Time-travel driver — one real nextWeek() per step.
  useEffect(() => {
    if (targetWeek === null || !gameState) return;
    const currentTotal = gameState.weeksLived || 0;
    if (currentTotal >= targetWeek) {
      setTargetWeek(null);
      isProcessingRef.current = false;
      return;
    }
    if ((gameState.date?.age || 0) >= 100 || gameState.showDeathPopup) {
      setTargetWeek(null);
      isProcessingRef.current = false;
      return;
    }
    const step = () => {
      if (isProcessingRef.current || !mountedRef.current) return;
      isProcessingRef.current = true;
      setTimeout(() => {
        if (!mountedRef.current) return;
        nextWeek();
        isProcessingRef.current = false;
      }, 30);
    };
    step();
  }, [gameState?.weeksLived, targetWeek, nextWeek, gameState]);

  const isSkipping = targetWeek !== null;

  // Simulation summary — declared BEFORE the early `return null` below so this
  // hook is never called conditionally (Rules of Hooks). Depends only on state.
  const simSummary = useMemo(() => {
    const done = Object.values(simResults);
    return { total: ALL_SIMULATIONS.length, ran: done.length, passed: done.filter((r) => r.pass).length, failed: done.filter((r) => !r.pass).length };
  }, [simResults]);

  if (!gameState) return null;

  // -------------------------------------------------------------------------
  // Shared helpers (money-safe, clamped)
  // -------------------------------------------------------------------------
  const save = () => setTimeout(() => saveGame(), 0);
  const patch = (updater: (prev: GameState) => GameState, toast?: string) => {
    setGameState(updater);
    save();
    if (toast) Alert.alert('Dev Tools', toast);
  };
  const clamp100 = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

  // Money via the canonical, mirror-safe, clamped path.
  const addMoney = (amount: number) => {
    if (!Number.isFinite(amount)) return;
    updateMoney(setGameState, amount, 'devtools: grant', false);
    save();
  };
  const setMoney = (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0) return;
    const cur = gameState.stats?.money ?? 0;
    updateMoney(setGameState, Math.min(MONEY_CEILING, amount) - cur, 'devtools: set', false);
    save();
  };
  const addGems = (amount: number) => {
    patch((prev) => ({
      ...prev,
      stats: { ...prev.stats, gems: Math.max(0, Math.min(MONEY_CEILING, (prev.stats?.gems ?? 0) + amount)) },
    }));
  };
  const setGems = (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0) return;
    patch((prev) => ({ ...prev, stats: { ...prev.stats, gems: Math.min(MONEY_CEILING, amount) } }));
  };
  const setStat = (key: 'health' | 'happiness' | 'energy' | 'fitness' | 'reputation', value: number) => {
    patch((prev) => ({ ...prev, stats: { ...prev.stats, [key]: clamp100(value) } }));
  };
  const maxAllStats = () =>
    patch(
      (prev) => ({
        ...prev,
        stats: { ...prev.stats, health: 100, happiness: 100, energy: 100, fitness: 100, reputation: 100 },
      }),
      'All stats maxed to 100.',
    );

  const setAge = (age: number) => {
    if (!Number.isFinite(age) || age < 0 || age > 120) return;
    patch((prev) => {
      const birthYear = prev.date.year - Math.floor(prev.date.age);
      return {
        ...prev,
        date: { ...prev.date, age, year: Math.max(2025, birthYear + Math.floor(age)) },
        weeksLived: Math.max(prev.weeksLived ?? 0, Math.round(age * 52)),
      };
    }, `Age set to ${age}.`);
  };

  const startSkipping = (weeks: number) => {
    if (isSkipping) return;
    setTargetWeek((gameState.weeksLived || 0) + weeks);
  };

  // -------------------------------------------------------------------------
  // Builders for seed data (money-safe; typed where possible)
  // -------------------------------------------------------------------------
  const makeCompany = (id: string, weeklyIncome = 8000): Company => ({
    id,
    name: `Dev Co ${id.slice(-3)}`,
    type: 'factory',
    weeklyIncome,
    baseWeeklyIncome: weeklyIncome,
    upgrades: [],
    employees: 0,
    workerSalary: 0,
    workerMultiplier: 1,
    marketingLevel: 0,
    miners: {},
    warehouseLevel: 0,
    unlockedTechnologies: [],
  });
  const makeCareerLadder = (id: string, topLevel = false): Career => {
    const levels = [1200, 2200, 3600, 5600, 8500, 13000].map((salary, i) => ({
      name: `Level ${i + 1}`,
      salary,
      experienceRequired: 0,
    }));
    return {
      id,
      name: 'Dev Career',
      accepted: true,
      applied: true,
      level: topLevel ? levels.length - 1 : 0,
      progress: topLevel ? 0 : 100,
      performance: 100,
      levels,
    } as unknown as Career;
  };
  const makeSpouse = (): any => ({
    id: `dev-spouse-${Date.now()}`,
    name: 'Alex Rivera',
    type: 'spouse',
    relationshipScore: 90,
    personality: 'supportive',
    gender: 'female',
    age: (gameState.date?.age ?? 30) - 1,
    income: 1500,
    livingTogether: true,
  });
  const makeChild = (age: number, name: string): ChildInfo =>
    ({
      id: `dev-child-${age}-${Date.now()}`,
      name,
      type: 'child',
      relationshipScore: 80,
      personality: 'curious',
      gender: age % 2 === 0 ? 'male' : 'female',
      age,
    } as unknown as ChildInfo);

  // -------------------------------------------------------------------------
  // Cheat actions (Unlocks / Life)
  // -------------------------------------------------------------------------
  const unlockAllLifeSkills = () =>
    patch(
      (prev) => ({ ...prev, unlockedLifeSkills: Array.from(new Set([...(prev.unlockedLifeSkills || []), ...LIFE_SKILL_IDS])) }),
      `Unlocked all ${LIFE_SKILL_IDS.length} life skills.`,
    );
  const grantPrestigePoints = (n: number) =>
    patch(
      (prev) => ({
        ...prev,
        prestige: prev.prestige
          ? { ...prev.prestige, prestigePoints: Math.max(0, (prev.prestige.prestigePoints ?? 0) + n) }
          : prev.prestige,
      }),
      `+${n} prestige points.`,
    );
  const markAchievementsClaimable = () =>
    patch((prev) => {
      try {
        const { achievements } = require('@/src/features/onboarding/achievementsData');
        const existing = new Set((prev.progress?.achievements || []).map((a: { id: string }) => a.id));
        const unlocked = (achievements || [])
          .filter((a: { id: string }) => !existing.has(a.id))
          .map((a: { id: string; title: string; description: string }) => ({ id: a.id, name: a.title, desc: a.description, unlockedAt: prev.weeksLived || 0 }));
        return {
          ...prev,
          progress: { ...prev.progress, achievements: [...(prev.progress?.achievements || []), ...unlocked] },
          // Empty = nothing claimed yet, so every unlocked achievement is claimable.
          claimedProgressAchievements: [],
        };
      } catch {
        return prev;
      }
    }, 'All achievements unlocked & claimable (open the Achievements screen).');
  const giveCompany = () =>
    patch((prev) => ({ ...prev, companies: [...(prev.companies || []), makeCompany(`dev-${Date.now()}`)] }), 'Company granted. Open the Company app.');
  const giveLabAndFunds = () => {
    addMoney(2_000_000);
    patch((prev) => {
      const companies = prev.companies && prev.companies.length ? prev.companies : [makeCompany(`dev-${Date.now()}`)];
      const withLab = companies.map((co, i) =>
        i === 0
          ? { ...co, rdLab: { type: 'basic' as const, researchProjects: [], completedResearch: [] } as any, unlockedTechnologies: co.unlockedTechnologies || [] }
          : co,
      );
      return { ...prev, companies: withLab };
    }, '+$2M and a basic R&D lab on your first company.');
  };
  const addAllEducation = () =>
    patch((prev) => {
      const existing = new Set((prev.educations || []).map((e) => e.id));
      const all: Education[] = [
        { id: 'high_school', name: 'High School Diploma', duration: 104, cost: 0 },
        { id: 'business_degree', name: 'Business Degree', duration: 90, cost: 48000 },
        { id: 'computer_science', name: 'Computer Science', duration: 104, cost: 72000 },
        { id: 'mba', name: 'MBA', duration: 150, cost: 120000 },
        { id: 'medical_school', name: 'Medical School', duration: 180, cost: 150000 },
        { id: 'law_school', name: 'Law School', duration: 156, cost: 132000 },
        { id: 'phd', name: 'PhD', duration: 208, cost: 180000 },
      ]
        .filter((e) => !existing.has(e.id))
        .map((e) => ({ ...e, description: e.name, completed: true, weeksRemaining: 0 }));
      return { ...prev, educations: [...(prev.educations || []), ...all] };
    }, 'All education levels added and completed.');
  const grantTopCareer = () =>
    patch((prev) => ({ ...prev, careers: [...(prev.careers || []).filter((c) => c.id !== 'dev-top'), makeCareerLadder('dev-top', true)], currentJob: 'dev-top' }), 'Top-level career granted.');
  const revive = () =>
    patch(
      (prev) => ({ ...prev, showDeathPopup: false, deathReason: undefined, stats: { ...prev.stats, health: 100, energy: 100 } }),
      'Revived.',
    );
  const togglePrestigeAvailable = () =>
    patch((prev) => ({ ...prev, prestigeAvailable: !prev.prestigeAvailable }), 'Toggled prestige availability.');
  const clearCooldowns = () =>
    patch((prev) => ({ ...prev, lastDiseaseWeek: 0, weeklyPursuitPractice: {} }), 'Cooldowns cleared.');
  const giveSpouseAndKids = () =>
    patch(
      (prev) => ({
        ...prev,
        relationships: [...(prev.relationships || []), makeSpouse() as any],
        family: {
          ...(prev.family || {}),
          children: [...((prev.family && prev.family.children) || []), makeChild(1, 'Baby Sam'), makeChild(8, 'Kid Jordan')],
        },
      }),
      'Spouse + two kids added.',
    );

  // -------------------------------------------------------------------------
  // SECTION 2 — One-tap feature setups (seed a ready-to-test scenario)
  // -------------------------------------------------------------------------
  const setupLuxury = () => {
    addMoney(1_000_000_000);
    Alert.alert('Setup: Luxury', '+$1B granted. Open the Luxury & Collectibles app to buy trophies.');
  };
  const setupFamily = () =>
    patch(
      (prev) => ({
        ...prev,
        relationships: [...(prev.relationships || []), makeSpouse() as any],
        family: {
          ...(prev.family || {}),
          children: [
            ...((prev.family && prev.family.children) || []),
            makeChild(0, 'Baby Riley'),
            makeChild(6, 'Child Max'),
            makeChild(14, 'Teen Casey'),
          ],
        },
      }),
      'Family seeded: spouse + baby (0) + child (6) + teen (14). Open the Family/Parenting screen.',
    );
  const setupRetirement = () =>
    patch(
      (prev) => ({
        ...prev,
        date: { ...prev.date, age: 65 },
        weeksLived: Math.max(prev.weeksLived ?? 0, Math.round(65 * 52)),
        isRetired: false,
        lifetimeStatistics: { ...(prev.lifetimeStatistics as any), highestSalary: 3000, totalWeeksWorked: 35 * 52 },
      }),
      'Age 65 + full 35-year work history. Open Retirement to retire on a pension.',
    );
  const setupCareerSummit = () =>
    patch(
      (prev) => ({
        ...prev,
        careers: [...(prev.careers || []).filter((c) => c.id !== 'dev-summit'), makeCareerLadder('dev-summit', true)],
        currentJob: 'dev-summit',
      }),
      'A career seeded at its TOP level. Open the Work/Career screen.',
    );
  const setupRD = () => {
    addMoney(3_000_000);
    patch((prev) => {
      const base = makeCompany(`dev-rd-${Date.now()}`);
      const co: Company = { ...base, rdLab: { type: 'basic', researchProjects: [], completedResearch: [] } as any };
      return { ...prev, companies: [...(prev.companies || []), co] };
    }, 'Company + basic R&D lab + $3M research funds. Open the R&D screen.');
  };
  const setupAmbition = () =>
    patch((prev) => {
      const ambition = LIFE_AMBITIONS.find((a) => a.id === 'business_empire') ?? LIFE_AMBITIONS[0];
      const milestoneIds = ambition.milestones.map((m) => m.id);
      const allButLast = milestoneIds.slice(0, Math.max(0, milestoneIds.length - 1));
      return {
        ...prev,
        ambitionId: ambition.id,
        ambitionCompletedMilestones: allButLast,
        ambitionRewardClaimed: false,
      };
    }, 'Ambition assigned with all-but-the-last milestone reached. Complete the last one to claim.');
  const setupDarkweb = () =>
    patch((prev) => {
      const dw = prev.darkWeb || initialGameState.darkWeb;
      return {
        ...prev,
        cryptos: (prev.cryptos || []).map((c) => (c.id === 'btc' ? { ...c, owned: (c.owned || 0) + 2 } : c)),
        darkWeb: {
          ...dw,
          cleanBtc: (dw?.cleanBtc || 0) + 1,
          skills: { ...dw?.skills, opsec: { ...(dw?.skills?.opsec || { level: 1, xp: 0, nextLevelXp: 100 }), level: 4 } },
        } as any,
      };
    }, 'BTC granted + opsec skill boosted. Open the Dark Web app.');
  const setupPolitics = () =>
    patch(
      (prev) => ({
        ...prev,
        politics: { ...(prev.politics || initialGameState.politics), careerLevel: 3, approvalRating: 62, electionsWon: 1 } as any,
      }),
      'You now hold office (State Representative). Open the Politics screen.',
    );
  const setupElder = () =>
    patch(
      (prev) => ({
        ...prev,
        date: { ...prev.date, age: 70 },
        weeksLived: Math.max(prev.weeksLived ?? 0, Math.round(70 * 52)),
        isRetired: true,
        pensionWeekly: prev.pensionWeekly && prev.pensionWeekly > 0 ? prev.pensionWeekly : 1200,
        lifetimeStatistics: { ...(prev.lifetimeStatistics as any), highestSalary: 3000, totalWeeksWorked: 40 * 52 },
      }),
      'Age 70, retired. Advance a few weeks to surface elder events.',
    );

  // -------------------------------------------------------------------------
  // SECTION 3 — Simulations
  // -------------------------------------------------------------------------
  const simBase = (): GameState => gameState ?? getBaseSimState();
  const runOne = (id: string) => {
    const sim = ALL_SIMULATIONS.find((s) => s.id === id);
    if (!sim) return;
    setRunningSimId(id);
    setTimeout(() => {
      const r = sim.run(simBase());
      setSimResults((prev) => ({ ...prev, [id]: r }));
      setRunningSimId(null);
    }, 20);
  };
  const runAll = () => {
    setRunningAll(true);
    setTimeout(() => {
      const summary = runAllSimulations(simBase());
      const map: Record<string, SimResult> = {};
      for (const r of summary.results) map[r.id] = r;
      setSimResults(map);
      setRunningAll(false);
    }, 20);
  };

  // (simSummary is memoized above, before the early return, to satisfy the
  // Rules of Hooks.)

  // -------------------------------------------------------------------------
  // Cheat + setup group definitions
  // -------------------------------------------------------------------------
  const cheatGroups: Group[] = [
    {
      title: 'Money & Gems',
      icon: DollarSign,
      items: [
        { label: '+$10K', icon: DollarSign, tone: 'money', onPress: () => addMoney(10_000) },
        { label: '+$1M', icon: DollarSign, tone: 'money', onPress: () => addMoney(1_000_000) },
        { label: '+$1B', icon: DollarSign, tone: 'money', onPress: () => addMoney(1_000_000_000) },
        { label: 'Net Worth +$10M', icon: Trophy, tone: 'money', onPress: () => addMoney(10_000_000) },
        { label: '+100 Gems', icon: Gem, tone: 'gem', onPress: () => addGems(100) },
        { label: '+1000 Gems', icon: Gem, tone: 'gem', onPress: () => addGems(1000) },
      ],
    },
    {
      title: 'Stats',
      icon: Heart,
      items: [
        { label: 'Max All Stats', icon: Heart, tone: 'stat', onPress: maxAllStats },
        { label: 'Max Health', icon: Heart, tone: 'stat', onPress: () => setStat('health', 100) },
        { label: 'Max Happiness', icon: Star, tone: 'stat', onPress: () => setStat('happiness', 100) },
        { label: 'Max Energy', icon: Zap, tone: 'stat', onPress: () => setStat('energy', 100) },
        { label: 'Max Fitness', icon: Heart, tone: 'stat', onPress: () => setStat('fitness', 100) },
        { label: 'Max Reputation', icon: Award, tone: 'stat', onPress: () => setStat('reputation', 100) },
      ],
    },
    {
      title: 'Time',
      icon: Clock,
      items: [
        { label: '+1 Week', icon: Clock, tone: 'time', onPress: () => startSkipping(1) },
        { label: '+4 Weeks', icon: Clock, tone: 'time', onPress: () => startSkipping(4) },
        { label: '+52 Weeks', icon: Clock, tone: 'time', onPress: () => startSkipping(52) },
        { label: '+1 Year (age)', icon: Clock, tone: 'time', onPress: () => setAge(Math.floor((gameState.date?.age ?? 18) + 1)) },
        { label: 'Set Age 18', icon: Clock, tone: 'time', onPress: () => setAge(18) },
        { label: 'Set Age 65', icon: Clock, tone: 'time', onPress: () => setAge(65) },
      ],
    },
    {
      title: 'Unlocks',
      icon: Sparkles,
      items: [
        { label: 'Unlock All Life Skills', icon: Sparkles, tone: 'unlock', onPress: unlockAllLifeSkills },
        { label: '+1000 Prestige Pts', icon: Crown, tone: 'unlock', onPress: () => grantPrestigePoints(1000) },
        { label: 'Achievements Claimable', icon: Award, tone: 'unlock', onPress: markAchievementsClaimable },
        { label: 'Give a Company', icon: Building2, tone: 'unlock', onPress: giveCompany },
        { label: 'Give Lab + Funds', icon: FlaskConical, tone: 'unlock', onPress: giveLabAndFunds },
        { label: 'Add All Education', icon: GraduationCap, tone: 'unlock', onPress: addAllEducation },
        { label: 'Grant Top Career', icon: Briefcase, tone: 'unlock', onPress: grantTopCareer },
      ],
    },
    {
      title: 'Life',
      icon: Users,
      items: [
        { label: 'Revive', icon: Heart, tone: 'life', onPress: revive },
        { label: 'Toggle Prestige Ready', icon: Crown, tone: 'life', onPress: togglePrestigeAvailable },
        { label: 'Clear Cooldowns', icon: RefreshCw, tone: 'life', onPress: clearCooldowns },
        { label: 'Give Spouse + Kids', icon: Users, tone: 'life', onPress: giveSpouseAndKids },
        { label: 'Trigger Death', icon: Skull, tone: 'danger', onPress: () => patch((prev) => ({ ...prev, stats: { ...prev.stats, health: 0 }, showDeathPopup: true, deathReason: 'health' as any })) },
      ],
    },
    {
      title: 'System',
      icon: Wrench,
      items: [
        { label: 'Save Game', icon: Save, tone: 'neutral', onPress: () => saveGame() },
        { label: 'Restart (initial)', icon: RefreshCw, tone: 'danger', onPress: () => Alert.alert('Restart', 'Reset to a fresh life?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => patch(() => initialGameState) }]) },
        { label: 'View Logs', icon: FileText, tone: 'neutral', onPress: () => setShowLogViewer(true) },
        { label: 'AI Debug Suite', icon: Bug, tone: 'neutral', onPress: () => setShowAIDebug(true) },
        { label: 'Comprehensive Tests', icon: ClipboardCheck, tone: 'neutral', onPress: () => setShowTestRunner(true) },
      ],
    },
  ];

  const setupItems: Btn[] = [
    { label: 'Luxury (+$1B)', icon: Gift, tone: 'money', onPress: setupLuxury },
    { label: 'Family / Parenting', icon: Baby, tone: 'life', onPress: setupFamily },
    { label: 'Retirement (age 65)', icon: Clock, tone: 'time', onPress: setupRetirement },
    { label: 'Career Summit', icon: Briefcase, tone: 'unlock', onPress: setupCareerSummit },
    { label: 'R&D (lab + funds)', icon: FlaskConical, tone: 'unlock', onPress: setupRD },
    { label: 'Ambition (near-done)', icon: Crown, tone: 'unlock', onPress: setupAmbition },
    { label: 'Darkweb (BTC + opsec)', icon: Globe, tone: 'gem', onPress: setupDarkweb },
    { label: 'Politics (enter office)', icon: Landmark, tone: 'unlock', onPress: setupPolitics },
    { label: 'Elder Events (age 70)', icon: Clock, tone: 'life', onPress: setupElder },
  ];

  // -------------------------------------------------------------------------
  // Search filtering
  // -------------------------------------------------------------------------
  const q = search.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);
  const filteredCheats = cheatGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => matches(it.label)) }))
    .filter((g) => g.items.length > 0);
  const filteredSetups = setupItems.filter((it) => matches(it.label));

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderButton = (b: Btn, key: string, disabled = false) => {
    const accent = TONE_ACCENT[b.tone];
    const Icon = b.icon;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.chip, { borderColor: `${accent}55`, backgroundColor: `${accent}14`, opacity: disabled ? 0.4 : 1 }]}
        onPress={b.onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={[styles.chipIcon, { backgroundColor: `${accent}22` }]}>
          <Icon size={16} color={accent} />
        </View>
        <Text style={styles.chipLabel} numberOfLines={2}>
          {b.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTabButton = (key: TabKey, label: string, Icon: IconType) => {
    const active = tab === key;
    return (
      <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(key)} activeOpacity={0.8}>
        <Icon size={16} color={active ? C.accent : C.textDim} />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderSimRow = (sim: (typeof ALL_SIMULATIONS)[number]) => {
    const r = simResults[sim.id];
    const running = runningSimId === sim.id || runningAll;
    const expanded = expandedSim === sim.id;
    const statusColor = !r ? C.textFaint : r.pass ? C.green : C.red;
    return (
      <View key={sim.id} style={styles.simCard}>
        <View style={styles.simHeaderRow}>
          <TouchableOpacity style={styles.simTitleWrap} onPress={() => setExpandedSim(expanded ? null : sim.id)} activeOpacity={0.7}>
            {r ? (
              r.pass ? (
                <CheckCircle2 size={18} color={C.green} />
              ) : (
                <XCircle size={18} color={C.red} />
              )
            ) : (
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.simName}>{sim.name}</Text>
              <Text style={styles.simDesc} numberOfLines={expanded ? undefined : 2}>
                {r ? r.message : sim.description}
              </Text>
            </View>
            {r?.details && r.details.length > 0 ? (
              expanded ? <ChevronDown size={16} color={C.textDim} /> : <ChevronRight size={16} color={C.textDim} />
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.runBtn} onPress={() => runOne(sim.id)} disabled={running} activeOpacity={0.8}>
            {running ? <ActivityIndicator size="small" color={C.accent} /> : <Play size={14} color={C.accent} />}
            <Text style={styles.runBtnText}>Run</Text>
          </TouchableOpacity>
        </View>
        {expanded && r?.details && (
          <View style={styles.detailsBox}>
            {r.details.map((d, i) => {
              const pass = d.startsWith('PASS');
              const fail = d.startsWith('FAIL');
              return (
                <Text key={i} style={[styles.detailLine, pass && { color: C.green }, fail && { color: C.red }]}>
                  {d}
                </Text>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.brandIcon}>
                <Shield size={18} color={C.accent} />
              </View>
              <View>
                <Text style={styles.title}>Developer Tools</Text>
                <Text style={styles.subtitle}>DEV BUILD · v{gameState.version ?? '?'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={C.textDim} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {renderTabButton('cheats', 'Cheats', Rocket)}
            {renderTabButton('setups', 'Setups', Wrench)}
            {renderTabButton('sims', 'Simulations', FlaskConical)}
          </View>

          {/* Search (cheats + setups only) */}
          {tab !== 'sims' && (
            <View style={styles.searchRow}>
              <Search size={16} color={C.textFaint} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tools…"
                placeholderTextColor={C.textFaint}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color={C.textFaint} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* ---------------- CHEATS ---------------- */}
            {tab === 'cheats' && (
              <>
                {/* Exact-value inputs */}
                <View style={styles.inputCard}>
                  <Text style={styles.inputCardTitle}>Set exact values</Text>
                  <View style={styles.inputRow}>
                    <TextInput style={styles.input} placeholder="Money $" placeholderTextColor={C.textFaint} keyboardType="numeric" value={moneyInput} onChangeText={setMoneyInput} />
                    <TouchableOpacity style={styles.inputBtn} onPress={() => { const v = parseFloat(moneyInput); if (Number.isFinite(v)) { setMoney(v); setMoneyInput(''); } }}>
                      <Text style={styles.inputBtnText}>Set $</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput style={styles.input} placeholder="Gems" placeholderTextColor={C.textFaint} keyboardType="numeric" value={gemInput} onChangeText={setGemInput} />
                    <TouchableOpacity style={styles.inputBtn} onPress={() => { const v = parseInt(gemInput, 10); if (Number.isFinite(v)) { setGems(v); setGemInput(''); } }}>
                      <Text style={styles.inputBtnText}>Set Gems</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput style={styles.input} placeholder="Age" placeholderTextColor={C.textFaint} keyboardType="numeric" value={ageInput} onChangeText={setAgeInput} />
                    <TouchableOpacity style={styles.inputBtn} onPress={() => { const v = parseInt(ageInput, 10); if (Number.isFinite(v)) { setAge(v); setAgeInput(''); } }}>
                      <Text style={styles.inputBtnText}>Set Age</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput style={styles.input} placeholder="All stats → N (0-100)" placeholderTextColor={C.textFaint} keyboardType="numeric" value={statInput} onChangeText={setStatInput} />
                    <TouchableOpacity style={styles.inputBtn} onPress={() => { const v = parseInt(statInput, 10); if (Number.isFinite(v)) { patch((prev) => ({ ...prev, stats: { ...prev.stats, health: clamp100(v), happiness: clamp100(v), energy: clamp100(v), fitness: clamp100(v), reputation: clamp100(v) } })); setStatInput(''); } }}>
                      <Text style={styles.inputBtnText}>Set Stats</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* God mode */}
                <View style={styles.godRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.godLabel}>God Mode (no stat drain)</Text>
                    <Text style={styles.godDesc}>Locks health/happiness/energy/fitness at 100 across weeks.</Text>
                  </View>
                  <Switch value={preventDrain} onValueChange={setPreventDrain} trackColor={{ false: C.border, true: C.green }} thumbColor="#FFFFFF" />
                </View>

                {isSkipping && (
                  <View style={styles.skipBanner}>
                    <ActivityIndicator size="small" color={C.accent} />
                    <Text style={styles.skipText}>Advancing weeks… (real tick running)</Text>
                  </View>
                )}

                {filteredCheats.map((g) => (
                  <View key={g.title} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <g.icon size={14} color={C.textDim} />
                      <Text style={styles.groupTitle}>{g.title}</Text>
                    </View>
                    <View style={styles.grid}>{g.items.map((it, i) => renderButton(it, `${g.title}-${i}`, isSkipping && g.title === 'Time'))}</View>
                  </View>
                ))}
                {filteredCheats.length === 0 && <Text style={styles.emptyText}>No tools match “{search}”.</Text>}
              </>
            )}

            {/* ---------------- SETUPS ---------------- */}
            {tab === 'setups' && (
              <>
                <Text style={styles.sectionBlurb}>Each button seeds a ready-to-test scenario on your live save, then tells you which screen to open.</Text>
                <View style={styles.grid}>{filteredSetups.map((it, i) => renderButton(it, `setup-${i}`))}</View>
                {filteredSetups.length === 0 && <Text style={styles.emptyText}>No setups match “{search}”.</Text>}
              </>
            )}

            {/* ---------------- SIMULATIONS ---------------- */}
            {tab === 'sims' && (
              <>
                <Text style={styles.sectionBlurb}>Each sim deep-clones your state, runs the REAL game logic end-to-end, and reports PASS/FAIL. Live state is never mutated.</Text>

                <View style={styles.runAllRow}>
                  <TouchableOpacity style={styles.runAllBtn} onPress={runAll} disabled={runningAll} activeOpacity={0.85}>
                    {runningAll ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Play size={16} color="#FFFFFF" />}
                    <Text style={styles.runAllText}>{runningAll ? 'Running…' : 'RUN ALL'}</Text>
                  </TouchableOpacity>
                  {simSummary.ran > 0 && (
                    <View style={styles.summaryPills}>
                      <View style={[styles.pill, { backgroundColor: C.greenSoft, borderColor: `${C.green}55` }]}>
                        <CheckCircle2 size={13} color={C.green} />
                        <Text style={[styles.pillText, { color: C.green }]}>{simSummary.passed}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: C.redSoft, borderColor: `${C.red}55` }]}>
                        <XCircle size={13} color={C.red} />
                        <Text style={[styles.pillText, { color: C.red }]}>{simSummary.failed}</Text>
                      </View>
                      <Text style={styles.pillMuted}>{simSummary.ran}/{simSummary.total}</Text>
                    </View>
                  )}
                </View>

                {ALL_SIMULATIONS.map(renderSimRow)}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Nested dev tools (kept, dev-gated by this modal's own gate) */}
      <LogViewer visible={showLogViewer} onClose={() => setShowLogViewer(false)} />
      <AIDebugMenu visible={showAIDebug} onClose={() => setShowAIDebug(false)} />
      <Modal visible={showTestRunner} transparent animationType="slide" onRequestClose={() => setShowTestRunner(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <TestRunner onClose={() => setShowTestRunner(false)} />
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  panel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: C.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 16px 40px rgba(0,0,0,0.5)' } as any,
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 16 },
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${C.accent}44` },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 10, fontWeight: '600', color: C.textFaint, letterSpacing: 0.5, marginTop: 1 },
  closeBtn: { padding: 6, borderRadius: 8 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderSoft },
  tabActive: { backgroundColor: C.accentSoft, borderColor: `${C.accent}66` },
  tabText: { fontSize: 12, fontWeight: '600', color: C.textDim },
  tabTextActive: { color: C.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.borderSoft },
  searchInput: { flex: 1, color: C.text, fontSize: 14, padding: 0 },
  content: { paddingHorizontal: 12, paddingTop: 12 },
  inputCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.borderSoft, padding: 12, marginBottom: 12 },
  inputCardTitle: { fontSize: 11, fontWeight: '700', color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: C.cardSolid, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6, color: C.text, fontSize: 14 },
  inputBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  inputBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  godRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.borderSoft, padding: 12, marginBottom: 12, gap: 12 },
  godLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  godDesc: { fontSize: 11, color: C.textFaint, marginTop: 2 },
  skipBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentSoft, borderRadius: 10, borderWidth: 1, borderColor: `${C.accent}55`, padding: 10, marginBottom: 12 },
  skipText: { color: C.text, fontSize: 12, fontWeight: '600' },
  group: { marginBottom: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginLeft: 2 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  chipIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { flex: 1, color: C.text, fontSize: 12, fontWeight: '600' },
  sectionBlurb: { color: C.textDim, fontSize: 12, lineHeight: 17, marginBottom: 14 },
  emptyText: { color: C.textFaint, fontSize: 13, textAlign: 'center', marginTop: 20 },
  runAllRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  runAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  runAllText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.4 },
  summaryPills: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillMuted: { color: C.textFaint, fontSize: 12, fontWeight: '600' },
  simCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.borderSoft, padding: 12, marginBottom: 10 },
  simHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  simTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  simName: { color: C.text, fontSize: 14, fontWeight: '700' },
  simDesc: { color: C.textDim, fontSize: 11, lineHeight: 15, marginTop: 2 },
  runBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: `${C.accent}55`, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  runBtnText: { color: C.accent, fontWeight: '700', fontSize: 12 },
  detailsBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.borderSoft, gap: 3 },
  detailLine: { color: C.textDim, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 16 },
});
