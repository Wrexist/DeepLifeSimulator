import React, { useState, useEffect, useMemo } from 'react';
import { checkCareerRequirements } from '@/lib/careers/careerRequirements';
import { raisePremiumPct } from '@/lib/careers/raisePremium';
import { paidCareerCeiling, paidWeeklyCareerSalary, paidWeeklySalaryForLevel } from '@/lib/careers/weeklySalary';
import { formatMoney } from '@/utils/moneyFormatting';
import { summarizeCriminalRecord, criminalProgress } from '@/lib/crime/criminalRecord';
import { activeLegacyBuffs } from '@/lib/legacy/activeBuffs';
import { View,
    Text,
    ScrollView,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Animated } from 'react-native';
import ConfirmDialog from '@/components/ConfirmDialog';
import JobCard, { JobCardMetadata } from '@/components/work/JobCard';
import PromotionCelebrationModal from '@/components/work/PromotionCelebrationModal';
import TransportCard from '@/components/work/TransportCard';
import { haptic } from '@/utils/haptics';
import { startScooterRental, endScooterRental } from '@/contexts/game/actions/VehicleActions';
import CrimeSkillCard from '@/components/work/CrimeSkillCard';
import ProgressRing from '@/components/ui/ProgressRing';
import SegmentedControl from '@/components/ui/SegmentedControl';
import EmptyState from '@/components/ui/EmptyState';
import ScreenHeader from '@/components/ui/ScreenHeader';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { hitSlopToMinTarget } from '@/utils/touchTargets';
import { useGame, CrimeSkillId, StreetJob, Career } from '@/contexts/GameContext';
import type { PromotionDetails } from '@/contexts/game/types';
import {
    getEntryJobProfile,
    isEntryTierCareer,
    evaluateHiring,
    getJobBoard,
    weeksUntilBoardRefresh,
    growthLabel,
} from '@/lib/careers/jobMarket';
import { useJobActions } from '@/contexts/game/JobActionsContext';
import { getStreetJobEnergyCost, MAX_TOTAL_STREET_JOBS_PER_WEEK } from '@/contexts/game/actions/JobActions';
import { useToast } from '@/contexts/ToastContext';
import { getMindsetAdjustment } from '@/utils/mindsetFeedback';
import SystemInterconnectionIndicator from '@/components/depth/SystemInterconnectionIndicator';
import {
    Briefcase,
    Zap,
    TrendingUp,
    Star,
    Trophy,
    X,
    Lock,
    AlertTriangle,
    Heart,
    Smile,
    Eye,
    Brain,
    Target,
    Sparkles,
    Crown,
} from 'lucide-react-native';
import JailScreen from '@/components/jail/JailScreen';
import SkillTalentTree from '@/components/SkillTalentTree';
import {
    scale,
    fontScale,
    getTabBarSafePadding,
} from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { logger } from '@/utils/logger';
import { colors as themeColors } from '@/lib/config/theme';
import { styles } from '@/components/work/workScreenStyles';
// Static, not the lazy `require` this screen used inside the render callback:
// `advancedCareers.ts` is pure data with no top-level side effects and imports
// nothing but types, so there is no cycle to break and nothing to defer - and
// the catalog is now needed at module scope to derive `advancedIds`.
import {
  ADVANCED_CAREERS,
  getUnlockedAdvancedCareers,
  isAdvancedCareer,
  isCareerUnlocked,
  type AdvancedCareer,
} from '@/lib/careers/advancedCareers';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';
import SectionTitle from '@/components/ui/SectionTitle';
import GradientButton from '@/components/ui/GradientButton';
import Chip from '@/components/ui/Chip';
import { kicker, tier1Title, tier4 } from '@/lib/config/hierarchy';


// Creative/hobby ids that can leak into streetJobs but must not render as street
// work. Hoisted to module scope (and thus a stable identity) - it was a fresh
// array literal every render, which defeated the streetJobs filter memo below.
const CREATIVE_HOBBY_JOB_IDS = ['guitar', 'music', 'art', 'football', 'basketball', 'tennis'];

function WorkScreen() {
    return (
        <ErrorBoundary>
            <WorkScreenContent />
        </ErrorBoundary>
    );
}

function WorkScreenContent() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    // Career is the landing tab. Work opened on Street Hustle - the $20-a-tap
    // filler - so the first thing the screen offered was the least valuable
    // thing on it, and the career ladder (the actual progression system) was one
    // tap behind a segment most players never pressed.
    const [activeTab, setActiveTab] = useState<'street' | 'career' | 'skills'>('career');
    const [workFeedback, setWorkFeedback] = useState<{ [key: string]: string }>({});
    const [selectedSkillTree, setSelectedSkillTree] = useState<CrimeSkillId | null>(null);
    const [feedbackOpacity] = useState(new Animated.Value(0));
    // P3-2: dead state - `_showJailReleaseMessage` and `_previousJailWeeks`
    // were never referenced after being renamed by an unused-var lint sweep.
    const [showQuitJobConfirm, setShowQuitJobConfirm] = useState(false);
    // Career id whose in-app "Manage Job" action sheet is open (null = closed).
    const [manageJobId, setManageJobId] = useState<string | null>(null);
    // Promotion payoff. Held in local state (not GameState) because it is a
    // one-shot presentation concern - nothing about it needs to survive a save.
    const [promotionCelebration, setPromotionCelebration] = useState<PromotionDetails | null>(null);
    const { showSuccess, showError, showWarning, showInfo } = useToast();


    const {
        gameState,
        setGameState,
        performStreetJob,
        applyForJob,
        quitJob,
        saveGame,
    } = useGame();

    const { promoteCareer, requestRaise } = useJobActions();

    // Employed-job actions: raise negotiation or quitting. A raise adds a
    // permanent salary premium, gated on performance + an 8-week cooldown;
    // a denial can cost happiness / draw a warning. Opens an in-app action
    // sheet (below) instead of a native Alert, to stay on-brand.
    const handleAskForRaise = React.useCallback((careerId: string) => {
        const r = requestRaise(careerId);
        if (r.approved) showSuccess(r.message);
        else if (r.success) showWarning(r.message);
        else showInfo(r.message);
        // Defer past the commit + parent ref-sync so the raise result is what
        // persists (a synchronous saveGame reads the stale pre-action ref).
        setTimeout(() => { void saveGame(); }, 0);
        setManageJobId(null);
    }, [requestRaise, showSuccess, showWarning, showInfo, saveGame]);

    const { settings } = gameState;
    // Filter out any creative/hobby jobs that might exist in streetJobs.
    // R-perf: memoized so these two scans don't re-run on every render of the
    // work tab (which currently re-renders on every tick); streetJobs rarely changes.
    const { legalStreetJobs, criminalStreetJobs } = React.useMemo(() => {
        const jobs = gameState.streetJobs || [];
        return {
            legalStreetJobs: jobs.filter(job => !job.illegal && !CREATIVE_HOBBY_JOB_IDS.includes(job.id)),
            criminalStreetJobs: jobs.filter(job => job.illegal === true && !CREATIVE_HOBBY_JOB_IDS.includes(job.id)),
        };
    }, [gameState.streetJobs]);

    // Derived from the SAME helper JobActions uses, so the numbers shown here
    // cannot drift from the numbers applied.
    const record = useMemo(
        () => summarizeCriminalRecord(gameState.wantedLevel, gameState.criminalLevel),
        [gameState.wantedLevel, gameState.criminalLevel],
    );

    // Criminal progression. The level GATES street jobs (`criminalLevelReq`),
    // two ambitions and a life ribbon - but nothing displayed it, so hitting a
    // requirement read as an arbitrary refusal.
    const crimeProgress = useMemo(
        () => criminalProgress(gameState.criminalLevel, gameState.criminalXp),
        [gameState.criminalLevel, gameState.criminalXp],
    );

    // Timed legacy buffs. `mentor` is +50% CAREER PROGRESS, which is exactly
    // what this screen is about - and it was invisible, so a player could not
    // tell it was running or when it lapsed.
    const buffs = useMemo(
        () => activeLegacyBuffs(gameState),
        [gameState.legacyBuffs, gameState.weeksLived],
    );

    // State for negative stats popup

    // The one-shot "auto-switch to the career tab" effect that used to live here
    // is gone with the default above. It fired once per life, for a jobless
    // player under $1,000, and burned its `hasSeenJobTutorial` flag doing it -
    // so now that Career IS the landing tab, its first (and only) firing would
    // land on the tab already shown and consume the flag for nothing. What
    // remained was a `setGameState` on every Work open for a broke player: a
    // save-dirtying write and a re-render with no visible effect.

    useEffect(() => {
        let animationRef: Animated.CompositeAnimation | null = null;
        let isMounted = true;

        if (Object.keys(workFeedback).length > 0 && isMounted) {
            feedbackOpacity.setValue(0);
            animationRef = Animated.timing(feedbackOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            });

            animationRef.start(() => {
                if (isMounted) {
                    animationRef = Animated.timing(feedbackOpacity, {
                        toValue: 0,
                        duration: 200,
                        delay: 2500,
                        useNativeDriver: true,
                    });
                    animationRef?.start();
                }
            });
        }

        return () => {
            isMounted = false;
            if (animationRef) {
                animationRef.stop();
                animationRef = null;
            }
        };
    }, [workFeedback, feedbackOpacity]);

    const handleStreetJob = (jobId: string) => {
      // Hard guard: a throw anywhere in this handler used to leave the work
      // screen wedged (stuck toast, no response). Now any unexpected error
      // surfaces a reportable error toast and the game keeps running.
      try {
        const job = gameState.streetJobs.find(j => j.id === jobId);
        const result = performStreetJob(jobId);
        if (result) {
            // Track street-job usage for the discovery system only. The blue
            // depth "System Effects" feedback modal that used to auto-pop here
            // (500ms after the action) was removed - it interrupted the action
            // and made the result feel laggy instead of instant.
            try {
                const { updateSystemUsage } = require('@/lib/depth/discoverySystem');
                // CR: apply the returned state - updateSystemUsage is pure, so discarding it dropped
                // the discovery timesUsed / masteryLevel increments.
                setGameState(prev => updateSystemUsage('streetJobs', prev));
                // Persist AFTER the commit, not in this tick. performStreetJob +
                // updateSystemUsage above go through setGameState, but saveGame
                // reads gameStateRef.current, which is synced to state in a
                // POST-COMMIT effect (in the parent GameActionsProvider). A
                // synchronous saveGame() here persisted the PRE-action state, so
                // a force-kill within ~2 min dropped the job's money / energy /
                // weekly-progress on relaunch. Deferring to a macrotask lets the
                // commit AND that parent ref-sync effect run first (React fires
                // passive effects child-before-parent), so the committed
                // post-action state is what gets saved. The mutated slice spans
                // many fields (stats, weeklyStreetJobs, crimeSkills, discovery),
                // so a setTimeout(0) deferral is used rather than a per-slice effect.
                setTimeout(() => { void saveGame(); }, 0);
            } catch (error) {
                logger.warn('Failed to update system usage:', error as any);
            }

            // Show toast notification. SMOOTHNESS: fold the optional mindset
            // feedback into the SAME toast instead of firing a second one right
            // after - two stacked toasts per job felt spammy.
            if (result.success) {
                let message = result.message ?? '';
                let mindsetPenalty = false;
                if (job && gameState.mindset?.activeTraitId) {
                    const mindset = getMindsetAdjustment(
                        gameState,
                        job.basePayment,
                        0,
                        0
                    );
                    // R4-X1: APPLY the adjustment, don't just narrate it. This
                    // used to call `getMindsetFeedback`, which returns the
                    // message and discards the deltas - so the toast said
                    // "Frugal: You saved a bit extra (+120)" and credited
                    // nothing. This handler is the entire Mindset system's only
                    // consumer, so the choice made on the onboarding Perks
                    // screen (and again at heir selection) did nothing at all
                    // except generate claims about things that had not happened.
                    //
                    // One updater, so the money and the happiness land together
                    // and neither can be lost to a concurrent write. The job's
                    // own payment has already been credited by
                    // `performStreetJob`; these are the deltas ON TOP, exactly
                    // the numbers the message quotes.
                    if (mindset.moneyAdjustment !== 0 || mindset.happinessAdjustment !== 0) {
                        setGameState(prev => ({
                            ...prev,
                            stats: {
                                ...prev.stats,
                                money: Math.max(0, (prev.stats.money ?? 0) + mindset.moneyAdjustment),
                                happiness: Math.max(
                                    0,
                                    Math.min(100, (prev.stats.happiness ?? 0) + mindset.happinessAdjustment),
                                ),
                            },
                        }));
                    }
                    if (mindset.feedback?.message) {
                        message = message
                            ? `${message} · ${mindset.feedback.message}`
                            : mindset.feedback.message;
                        mindsetPenalty = mindset.feedback.type === 'penalty';
                    }
                }
                if (mindsetPenalty) {
                    showWarning(message);
                } else {
                    showSuccess(message);
                }
            } else if ('inJail' in result && result.inJail) {
                showError(result.message || 'You were caught!');
            } else {
                showWarning(result.message ?? '');
            }

            setWorkFeedback({ [jobId]: result.message ?? '' });
            const timeoutId = setTimeout(() => {
                setWorkFeedback(prev => {
                    const newFeedback = { ...prev };
                    delete newFeedback[jobId];
                    return newFeedback;
                });
            }, 3000);
            return () => clearTimeout(timeoutId);
        }
        return undefined;
      } catch (error) {
        logger.error('handleStreetJob crashed:', error as any);
        // showError toasts carry a one-tap "Report" that emails us the details.
        showError('Something went wrong working that job. Tap Report to send us the details.');
        return undefined;
      }
    };

    const getJailRisk = (job: StreetJob) => {
        if (!job.illegal) return 0;

        // Calculate risk the same way as in JobActions.ts
        // Risk = (100 - successChance) / 2
        const baseSuccess = job.baseSuccessRate || 50;
        const skillBonus = job.skill ? (gameState.crimeSkills?.[job.skill]?.level || 0) * 5 : 0;
        const successChance = Math.min(95, baseSuccess + skillBonus);
        const caughtChance = (100 - successChance) / 2;

        // Round to nearest integer for display
        return Math.round(caughtChance);
    };

    const getJobPenalties = (job: StreetJob) => {
        // Calculate penalties the same way as in JobActions.ts
        // Illegal jobs: -7 happiness, -3 health
        // Dangerous jobs (jailWeeks >= 3 or wantedIncrease >= 3): -6 happiness, -4 health
        // Regular street jobs: -5 happiness, -2 health
        const isDangerous = (job.jailWeeks && job.jailWeeks >= 3) || (job.wantedIncrease && job.wantedIncrease >= 3);
        const happinessPenalty = job.illegal ? -7 : (isDangerous ? -6 : -5);
        const healthPenalty = job.illegal ? -3 : (isDangerous ? -4 : -2);
        return { happinessPenalty, healthPenalty };
    };

    const getCareerPenalties = (careerId: string) => {
        // The same numbers the tick charges at entry level
        // (applyCareerSalaryAndPenalty): the career's authored profile where
        // one exists, the uniform -3 happiness / -2 health where none does.
        // This was a hardcoded -3/-2 for every career, which became a lie the
        // moment the profiles went live (2026-08-24).
        const profile = getEntryJobProfile(careerId);
        return {
            happinessPenalty: profile ? (profile.weeklyToll.happiness ?? -3) : -3,
            healthPenalty: profile ? (profile.weeklyToll.health ?? -2) : -2,
        };
    };


    const getMissingRequirements = (job: StreetJob) => {
        const missing: string[] = [];
        job.requirements?.forEach((req: string) => {
            const item = (gameState.items || []).find(i => i.id === req);
            if (!item?.owned) missing.push(item?.name || req);
        });
        job.darkWebRequirements?.forEach((req: string) => {
            const item = (gameState.darkWebItems || []).find(i => i.id === req);
            if (!item?.owned) missing.push(item?.name || req);
        });
        if (job.criminalLevelReq && gameState.criminalLevel < job.criminalLevelReq) {
            missing.push(`Criminal Level ${job.criminalLevelReq}`);
        }
        return missing;
    };

    // P2-14: compute street-job interconnections ONCE per render (memoized on
    // gameState) instead of re-walking the whole interconnection graph + filtering
    // inside renderJobCard for every legal street job on every render.
    const streetJobInterconnections = React.useMemo(() => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getSystemInterconnections } = require('@/lib/depth/systemInterconnections');
            return getSystemInterconnections(gameState).filter(
                (ic: any) => ic.sourceSystem === 'streetJobs' || ic.targetSystem === 'streetJobs'
            );
        } catch {
            return [];
        }
        // R10-perf: depend on the primitives that gate `getActiveSystems` (which
        // systems are unlocked), NOT the whole `gameState` object - that changes
        // identity every decay tick, re-walking the entire interconnection graph
        // each tick while the Work tab is open. The body still reads gameState via
        // closure; only the dep list is narrowed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        gameState.currentJob,
        gameState.careers?.length,
        gameState.relationships?.length,
        gameState.healthActivities?.length,
        gameState.hobbies?.length,
        gameState.educations?.length,
        gameState.travel,
        gameState.criminalLevel,
    ]);

    const renderJobCard = (job: StreetJob) => {
        const lowReward = Math.floor(job.basePayment * 0.7);
        const highReward = Math.floor(job.basePayment * 1.3 * (1 + (job.rank - 1) * 0.3));
        const reward = `$${lowReward}–${highReward}`;
        // Same helper the reducer charges with, so the gate, the label and the
        // charge cannot disagree about a transport-discounted delivery run.
        const jobEnergyCost = getStreetJobEnergyCost(gameState, job);
        const lacksEnergy = (gameState?.stats?.energy ?? 0) < jobEnergyCost;
        const inJail = gameState.jailWeeks > 0;
        const { happinessPenalty, healthPenalty } = getJobPenalties(job);

        const metadata: JobCardMetadata[] = [
            { icon: <Zap size={scale(13)} color="rgba(226, 232, 240, 0.78)" />, value: `${jobEnergyCost} energy` },
            { icon: <Star size={scale(13)} color="rgba(226, 232, 240, 0.78)" />, value: `Rank ${job.rank}` },
        ];
        if (job.skill) {
            metadata.push({
                icon: <Sparkles size={scale(13)} color="rgba(226, 232, 240, 0.78)" />,
                value: job.skill.charAt(0).toUpperCase() + job.skill.slice(1),
            });
        }
        if (happinessPenalty < 0) {
            metadata.push({
                icon: <Smile size={scale(13)} color="rgba(248, 113, 113, 0.92)" />,
                value: `${happinessPenalty}`,
                tone: 'bad',
            });
        }
        if (healthPenalty < 0) {
            metadata.push({
                icon: <Heart size={scale(13)} color="rgba(248, 113, 113, 0.92)" />,
                value: `${healthPenalty}`,
                tone: 'bad',
            });
        }

        const interconnectionFooter = streetJobInterconnections.length > 0 ? (
            <SystemInterconnectionIndicator
                interconnections={streetJobInterconnections}
                compact={true}
                darkMode={settings.darkMode}
            />
        ) : null;

        if (job.illegal) {
            const meetsCriminalLevel = !job.criminalLevelReq || gameState.criminalLevel >= job.criminalLevelReq;
            const missingItems = (job.requirements || []).filter((id: string) => !(gameState.items || []).find(i => i.id === id)?.owned);
            const missingDark = (job.darkWebRequirements || []).filter((id: string) => !(gameState.darkWebItems || []).find(i => i.id === id)?.owned);
            const weeklyJobs = gameState.weeklyStreetJobs || {};
            const timesDoneThisWeek = weeklyJobs[job.id] || 0;
            const maxPerWeek = 3;
            const atLimit = timesDoneThisWeek >= maxPerWeek;
            // The GLOBAL weekly cap the reducer enforces. It used to be invisible
            // here, so at 8/8 every card stayed enabled and every tap bounced off
            // a rejection message. UX-4.
            const atGlobalLimit = streetJobsThisWeek >= MAX_TOTAL_STREET_JOBS_PER_WEEK;
            const locked = lacksEnergy || inJail || atLimit || atGlobalLimit || !meetsCriminalLevel || missingItems.length > 0 || missingDark.length > 0;

            let lockReason: string | undefined;
            if (atLimit) {
                lockReason = `Used ${timesDoneThisWeek}/${maxPerWeek} this week - wait for next week.`;
            } else if (atGlobalLimit) {
                lockReason = `Street-job limit reached (${streetJobsThisWeek}/${MAX_TOTAL_STREET_JOBS_PER_WEEK} this week).`;
            } else if (!meetsCriminalLevel) {
                lockReason = `Requires Criminal Lv ${job.criminalLevelReq}`;
            } else if (missingItems.length > 0) {
                const names = missingItems.map((id: string) => (gameState.items || []).find(i => i.id === id)?.name || id);
                lockReason = `Need ${names.join(', ')}`;
            } else if (missingDark.length > 0) {
                const names = missingDark.map((id: string) => (gameState.darkWebItems || []).find(i => i.id === id)?.name || id);
                lockReason = `Need ${names.join(', ')}`;
            } else if (inJail) {
                lockReason = 'Unavailable while in jail.';
            } else if (lacksEnergy) {
                lockReason = `Needs ${getStreetJobEnergyCost(gameState, job)} energy.`;
            }

            // Risk first, then the weekly usage (the two decision gates), then
            // the descriptive chips - JobCard shows the first 3 and folds the
            // rest behind "+N more".
            const crimeMetadata: JobCardMetadata[] = [
                metadata[0], // energy
                { icon: <AlertTriangle size={scale(13)} color="rgba(251, 191, 36, 0.92)" />, value: `${getJailRisk(job)}% risk`, tone: 'warn' },
                ...(timesDoneThisWeek > 0
                    ? [{ icon: <Star size={scale(13)} color="rgba(226, 232, 240, 0.78)" />, value: `${timesDoneThisWeek}/${maxPerWeek} this wk` }]
                    : []),
                metadata[1], // rank
                ...(job.skill ? [metadata.find(m => m.value.toLowerCase().includes((job.skill || '').toLowerCase()))!].filter(Boolean) : []),
                ...metadata.filter(m => m.tone === 'bad'),
            ];

            return (
                <JobCard
                    key={job.id}
                    accent="crime"
                    title={job.name}
                    description={job.description}
                    reward={reward}
                    metadata={crimeMetadata}
                    buttonText="Execute"
                    onPress={() => handleStreetJob(job.id)}
                    locked={locked}
                    lockReason={lockReason}
                    feedback={workFeedback[job.id]}
                    feedbackOpacity={feedbackOpacity}
                />
            );
        }

        const missing = getMissingRequirements(job);
        const streetWeekly = gameState.weeklyStreetJobs || {};
        const streetDoneThisWeek = streetWeekly[job.id] || 0;
        const streetMaxPerWeek = 3;
        const streetAtLimit = streetDoneThisWeek >= streetMaxPerWeek;
        const atGlobalLimit = streetJobsThisWeek >= MAX_TOTAL_STREET_JOBS_PER_WEEK;
        const locked = lacksEnergy || inJail || missing.length > 0 || streetAtLimit || atGlobalLimit;
        const lockReason = streetAtLimit
            ? `Used ${streetDoneThisWeek}/${streetMaxPerWeek} this week - wait for next week.`
            : atGlobalLimit
            ? `Street-job limit reached (${streetJobsThisWeek}/${MAX_TOTAL_STREET_JOBS_PER_WEEK} this week).`
            : missing.length > 0
                ? `Need ${missing.join(', ')}`
                : inJail
                    ? 'Unavailable while in jail.'
                    : lacksEnergy
                        ? `Needs ${getStreetJobEnergyCost(gameState, job)} energy.`
                        : undefined;

        // Decision-relevant chips lead (energy, weekly usage, risk); the rest
        // fold behind JobCard's "+N more" toggle.
        const streetMetadata: JobCardMetadata[] = [metadata[0]];
        if (streetDoneThisWeek > 0) {
            streetMetadata.push({
                icon: <Star size={scale(13)} color="rgba(226, 232, 240, 0.78)" />,
                value: `${streetDoneThisWeek}/${streetMaxPerWeek} this wk`,
            });
        }
        if (job.risks && job.risks.length > 0) {
            streetMetadata.push({
                icon: <AlertTriangle size={scale(13)} color="rgba(251, 191, 36, 0.92)" />,
                value: `${job.risks.length} risk${job.risks.length > 1 ? 's' : ''}`,
                tone: 'warn',
            });
        }
        streetMetadata.push(...metadata.slice(1));

        return (
            <JobCard
                key={job.id}
                accent="street"
                title={job.name}
                description={job.description}
                reward={reward}
                metadata={streetMetadata}
                buttonText="Work"
                onPress={() => handleStreetJob(job.id)}
                locked={locked}
                lockReason={lockReason}
                feedback={workFeedback[job.id]}
                feedbackOpacity={feedbackOpacity}
                footer={interconnectionFooter}
            />
        );
    };


    const canApplyForCareer = (career: Career) => {
        // Education + fitness + items, evaluated by the SAME helper
        // `applyForJob` uses, so the button and the action can no longer
        // disagree. The `early_career_access` prestige bonus waives the whole
        // block there - it used to waive education only, which is why a player
        // who bought "Unlock all careers from start" still could not apply to
        // the 8 education-gated careers that also want a suit, a computer or a
        // fitness score.
        const requirementCheck = checkCareerRequirements(career.requirements, gameState);
        const pendingApplication = gameState.careers.some(
            (c: Career) => c.applied && !c.accepted
        );
        // Entry-tier jobs carry a hiring bar on top of the career's own
        // `requirements` (which are empty for all eight of them). Enforced here,
        // not just in the card, so the bar is a real gate rather than a label.
        const meetsHiringBar = evaluateHiring(getEntryJobProfile(career.id), gameState).eligible;
        return (
            requirementCheck.met &&
            meetsHiringBar &&
            !career.applied &&
            !gameState.currentJob &&
            !pendingApplication &&
            // Retirement is a one-way latch in applyForJob - without this the
            // button stayed enabled and every tap was silently rejected.
            // 2026-07-28 audit UX-2.
            !gameState.isRetired
        );
    };

    // The promotion is the hero's action now (see the Current Job card), so
    // the handler lives at screen level rather than inside a list card.
    const handlePromote = (careerId: string) => {
        const result = promoteCareer(careerId);
        if (!result) return;
        if (!result.success) {
            showWarning(result.message);
            return;
        }
        // A promotion is the payoff of dozens of weeks of progress, so it gets
        // the full celebration rather than a toast that scrolls away.
        // `promotion` is absent only on legacy/edge paths - fall back to the
        // message so the player is never left with no feedback.
        if (result.promotion) setPromotionCelebration(result.promotion);
        else showSuccess(result.message);
    };

    const renderCareerCard = (career: Career): React.ReactElement => {
        // CareerRequirements types `fitness`/`items` directly, so no `as any`
        // needed (was a rule-2 violation that bypassed the narrowed type).
        // Chip TONES come from the same shared check the Apply button and
        // applyForJob use, so a requirement the prestige bonus waives shows
        // met on the card instead of red next to an enabled button.
        const cardReqCheck = checkCareerRequirements(career.requirements, gameState);
        const requiresFitness = !!career.requirements.fitness;
        const meetsFitness = !cardReqCheck.fitnessShortfall;
        const requiresEdu = !!('education' in career.requirements && career.requirements.education && career.requirements.education.length > 0);
        const hasEdu = cardReqCheck.missingEducation.length === 0;
        const requiresReputation = !!career.requirements.reputation;
        const meetsReputation = !cardReqCheck.reputationShortfall;
        const requiresItems = !!('items' in career.requirements && career.requirements.items && career.requirements.items.length > 0);
        const missingItemNames: string[] = requiresItems
            ? (career.requirements.items ?? [])
                .filter((id) => !(gameState.items || []).find(i => i.id === id)?.owned)
                .map((id) => (gameState.items || []).find(i => i.id === id)?.name || id)
            : [];

        // Guard the level index - a stale/migrated save can carry `level` out of
        // bounds for `levels`, making this undefined and crashing the card.
        const level = career.levels?.[career.level] ?? career.levels?.[0];
        // The career the player holds is the hero above the tabs, never a
        // list card, so this is only ever true for a stale `accepted` flag.
        const isEmployedHere = gameState.currentJob === career.id;
        const { happinessPenalty, healthPenalty } = getCareerPenalties(career.id);

        // What payroll will ACTUALLY pay for this rung, not the listed base.
        // This card showed `levels[level].salary` raw while the promotion modal
        // showed the same rung with the raise premium applied and the Cash Flow
        // panel showed a third figure - one Surgical Director reading $26K,
        // $13000 and $13K across three screens. `paidWeeklySalaryForLevel` is
        // the function the week loop itself pays from.
        const paidWeekly = paidWeeklySalaryForLevel(gameState, career, career.level);
        const reward = requiresEdu && !hasEdu ? '- Locked' : `${formatMoney(paidWeekly)}/wk`;
        // Only entry-tier jobs have a hiring bar; everything else is governed by
        // the career's own `requirements`.
        const entryHiring = isEntryTierCareer(career.id) && !isEmployedHere && !career.accepted
            ? evaluateHiring(getEntryJobProfile(career.id), gameState)
            : null;

        // Chip order = decision relevance (JobCard shows the first 3, rest
        // behind "+N more"): requirements the player FAILS lead, then salary
        // ceiling / level, then met requirements and the weekly toll.
        const failingReqChips: JobCardMetadata[] = [];
        const metReqChips: JobCardMetadata[] = [];
        if (requiresFitness) {
            (meetsFitness ? metReqChips : failingReqChips).push({
                icon: <Trophy size={scale(13)} color={meetsFitness ? 'rgba(52, 211, 153, 0.95)' : 'rgba(248, 113, 113, 0.92)'} />,
                value: `Fitness ${career.requirements.fitness}+`,
                tone: meetsFitness ? 'default' : 'bad',
            });
        }
        if (requiresEdu) {
            (hasEdu ? metReqChips : failingReqChips).push({
                icon: <Briefcase size={scale(13)} color={hasEdu ? 'rgba(52, 211, 153, 0.95)' : 'rgba(248, 113, 113, 0.92)'} />,
                value: hasEdu ? 'Education met' : 'Education needed',
                tone: hasEdu ? 'default' : 'bad',
            });
        }
        // Reputation gate (Politician 20+, Celebrity 30+) - enforced as of
        // 2026-08-23, so the card must say so rather than leaving a disabled
        // Apply button unexplained.
        if (requiresReputation) {
            (meetsReputation ? metReqChips : failingReqChips).push({
                icon: <Star size={scale(13)} color={meetsReputation ? 'rgba(52, 211, 153, 0.95)' : 'rgba(248, 113, 113, 0.92)'} />,
                value: `Reputation ${career.requirements.reputation}+`,
                tone: meetsReputation ? 'default' : 'bad',
            });
        }
        const metadata: JobCardMetadata[] = [...failingReqChips];
        metadata.push({
            icon: <Star size={scale(13)} color="rgba(226, 232, 240, 0.78)" />,
            value: `Lv ${career.level + 1}/${career.levels.length}`,
        });
        // Entry-tier jobs look identical when all you show is a wage, so surface
        // what actually separates them: where the ladder tops out, how fast it
        // climbs, and what a week of it costs you.
        const entryProfile = getEntryJobProfile(career.id);
        if (entryProfile && !isEmployedHere) {
            // Same money as the wage above it - a ceiling in base pay next to a
            // boosted starting wage reads as a career that gets WORSE.
            const ceiling = paidCareerCeiling(gameState, career);
            if (ceiling > paidWeekly) {
                metadata.push({
                    icon: <TrendingUp size={scale(13)} color="rgba(232, 193, 92, 0.95)" />,
                    value: `Tops out ${formatMoney(ceiling)}/wk`,
                });
            }
            metadata.push({
                icon: <Sparkles size={scale(13)} color="rgba(226, 232, 240, 0.78)" />,
                value: growthLabel(entryProfile.growth),
            });
            metadata.push({
                icon: <Zap size={scale(13)} color="rgba(226, 232, 240, 0.78)" />,
                value: `${entryProfile.weeklyToll.energy} energy/wk`,
            });
        }
        metadata.push(...metReqChips);
        if (happinessPenalty < 0) {
            metadata.push({
                icon: <Smile size={scale(13)} color="rgba(248, 113, 113, 0.92)" />,
                value: `${happinessPenalty}`,
                tone: 'bad',
            });
        } else if (happinessPenalty > 0) {
            // A happiness-POSITIVE trade (the musician's +4) is exactly the
            // tradeoff worth advertising against a higher wage elsewhere.
            metadata.push({
                icon: <Smile size={scale(13)} color="rgba(52, 211, 153, 0.95)" />,
                value: `+${happinessPenalty}`,
            });
        }
        if (healthPenalty < 0) {
            metadata.push({
                icon: <Heart size={scale(13)} color="rgba(248, 113, 113, 0.92)" />,
                value: `${healthPenalty}`,
                tone: 'bad',
            });
        } else if (healthPenalty > 0) {
            metadata.push({
                icon: <Heart size={scale(13)} color="rgba(52, 211, 153, 0.95)" />,
                value: `+${healthPenalty}`,
            });
        }

        // Button + lock state. Two button strings for the board ("Apply" /
        // "Work") - every non-actionable state is a DISABLED button whose
        // reason renders as the card's lock-reason line, never a unique label.
        // Promote / Manage moved to the Current Job hero, the one place the
        // held job is shown.
        let buttonText: string;
        let onPress: (() => void) | undefined;
        let locked = false;
        let lockReason: string | undefined;

        if (career.accepted) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = 'You already work here.';
        } else if (career.applied) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = 'Application pending - wait for their answer.';
        } else if (requiresEdu && !hasEdu) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = 'Complete the required education to apply.';
        } else if (requiresFitness && !meetsFitness) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = `Reach Fitness ${career.requirements.fitness} to apply.`;
        } else if (missingItemNames.length > 0) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = `Need ${missingItemNames.join(', ')}.`;
        } else if (entryHiring && !entryHiring.eligible) {
            // Say exactly what is short, so the job reads as a goal rather than
            // an arbitrary "no".
            buttonText = t('work.apply');
            locked = true;
            lockReason = `They want - ${entryHiring.missing.join(' · ')}`;
        } else if (!canApplyForCareer(career)) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = gameState.isRetired
                ? "You've retired - your pension is your income now."
                : gameState.currentJob
                    ? 'Quit your current job to apply.'
                    : 'Another application is pending.';
        } else {
            buttonText = t('work.apply');
            onPress = () => {
                const r = applyForJob(career.id);
                // A rejection used to be silent - the reducer's message was
                // discarded and the tap just buzzed. UX-2.
                if (r && !r.success) showWarning(r.message);
            };
        }

        return (
            <JobCard
                key={career.id}
                accent="career"
                title={level?.name ?? 'Unemployed'}
                description={entryProfile && !isEmployedHere ? entryProfile.vibe : career.description}
                reward={reward}
                metadata={metadata}
                buttonText={buttonText}
                onPress={onPress}
                locked={locked}
                lockReason={lockReason}
            />
        );
    };

    // Advanced careers now share the JobCard language instead of a bespoke card.
    const renderAdvancedCareerCard = (
        career: AdvancedCareer,
        state: { isLocked: boolean; isApplied: boolean; isAccepted: boolean; lockReqs: string[] },
    ): React.ReactElement => {
        const displayName = career.levels?.[0]?.name ?? career.id;
        // Rung 0 is the right rung for a career the player does not hold, but it
        // has to be quoted in the same money as every other card on the screen -
        // `formatMoney` of what payroll would pay, not a raw `toLocaleString` of
        // the listed base.
        const salary = paidWeeklySalaryForLevel(gameState, career, 0);
        const { isLocked, isApplied, isAccepted, lockReqs } = state;

        const metadata: JobCardMetadata[] = [
            { icon: <Crown size={scale(13)} color="rgba(168, 85, 247, 0.95)" />, value: 'Elite career' },
        ];

        let buttonText: string;
        let onPress: (() => void) | undefined;
        let locked = false;
        let lockReason: string | undefined;

        if (isAccepted) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = 'You already work here.';
        } else if (isApplied) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = 'Application pending - wait for their answer.';
        } else if (isLocked) {
            buttonText = t('work.apply');
            locked = true;
            lockReason = lockReqs.length > 0
                ? `Requires - ${lockReqs.join(' · ')}`
                : 'Locked until you meet its requirements.';
        } else {
            buttonText = t('work.apply');
            onPress = () => {
                // Atomic gate: re-check against prev so a same-batch double-tap can't
                // push the same career twice (duplicate rows corrupt downstream finds).
                setGameState(prev => {
                    const careers = prev.careers || [];
                    if (careers.some(c => c.id === career.id)) return prev;
                    return { ...prev, careers: [...careers, { ...career, applied: true }] };
                });
                // Defer past the commit + parent ref-sync so the new application
                // is what persists (a synchronous saveGame reads the stale ref).
                setTimeout(() => { void saveGame(); }, 0);
                showSuccess(`Applied for ${displayName} - your application is under review.`);
            };
        }

        return (
            <JobCard
                key={career.id}
                accent="career"
                title={displayName}
                description={career.description}
                reward={isLocked ? '- Locked' : `${formatMoney(salary)}/wk`}
                metadata={metadata}
                buttonText={buttonText}
                onPress={onPress}
                locked={locked}
                lockReason={lockReason}
            />
        );
    };

    const sortedCareers = [...(gameState.careers || [])].sort(
        (a, b) => (a.levels?.[0]?.salary ?? 0) - (b.levels?.[0]?.salary ?? 0)
    );
    // Careers the "Advanced Careers" section below renders, so they are not also
    // listed under "Standard Careers".
    //
    // This was hand-written as `['politician', 'celebrity', 'athlete']`, which is
    // a DIFFERENT set from the one that section iterates - those three live in
    // `INITIAL_CAREERS`, and `ADVANCED_CAREERS` is ceo / research_scientist /
    // creative_director / investment_banker / surgeon. So the list did both
    // halves of its job wrong: it hid politician, celebrity and athlete from the
    // only screen that can apply for them (all three are live content -
    // achievements read their level, two ambition lines read them, and
    // `lib/events/engine.ts` gates an event on holding one), while the five it
    // was meant to cover rendered twice over.
    const basicCareers = sortedCareers.filter(c => !isAdvancedCareer(c.id));

    // THE JOB BOARD.
    // Every entry-tier career used to render at once: eight near-identical
    // cards separated only by wage, which made the "choice" a max() over one
    // column. Now a rotating shortlist is OPEN at any time, and the rest of the
    // list is the gated/advanced careers you are working toward.
    //
    // A career you already work, applied to, or were accepted into is never
    // hidden by the board - the board only curates what you can newly apply to.
    const boardIds = new Set(getJobBoard(gameState).map(o => o.careerId));
    const boardRefreshWeeks = weeksUntilBoardRefresh(gameState);
    const crimeSkillSummary = Object.entries(gameState.crimeSkills || {})
        .map(([id, skill]) => `${id.charAt(0).toUpperCase()}${skill.level}`)
        .join(' · ');

    const visibleBasicCareers = basicCareers.filter(c => {
        // The held job is the hero above the tabs; listing it again was the
        // audit's "job rendered twice" finding.
        if (gameState.currentJob === c.id) return false;
        if (!isEntryTierCareer(c.id)) return true;
        if (c.accepted || c.applied) return true;
        return boardIds.has(c.id);
    });
    const openingsCount = visibleBasicCareers.filter(
        c => isEntryTierCareer(c.id) && !c.accepted && !c.applied
    ).length;
    // Street jobs done across ALL job types this week. The reducer caps this
    // globally; the screen needs the same number so the cards can lock (and say
    // so) instead of bouncing the player off a rejection. UX-4.
    const streetJobsThisWeek = Object.values(gameState?.weeklyStreetJobs || {}).reduce(
        (sum: number, n) => sum + (typeof n === 'number' ? n : 0),
        0,
    );

    // Persistent "Current Job" summary so employment state is always visible,
    // not buried inside the Career tab.
    const currentJob = gameState.currentJob
        ? (gameState.careers || []).find(c => c.id === gameState.currentJob)
        : undefined;
    const currentJobLevel = currentJob ? (currentJob.levels?.[currentJob.level] ?? currentJob.levels?.[0]) : undefined;
    // The paid figure, not the ladder's listed base. This hero prints the salary
    // and the negotiated premium on the SAME line - "$13,000/wk · Lv 5/8 · +100%"
    // - so showing the base here states the premium and withholds it in one
    // breath. It is also the most prominent income number on the screen, which
    // makes it the one a player checks their paycheck against.
    const currentJobSalary = paidWeeklyCareerSalary(gameState).total;
    const currentJobRaisePct = currentJob ? raisePremiumPct(currentJob.raiseMultiplier) : 0;
    const currentJobAtMax = currentJob ? currentJob.level >= (currentJob.levels.length - 1) : false;
    // The hero's ONE action, from the same predicates the list used to apply
    // per card: full progress + a higher rung = promotion ready; the review /
    // tenure gate can still hold it, in which case the reason is the line.
    const currentJobPromotionReady = !!currentJob && currentJob.progress >= 100 && !currentJobAtMax;
    const currentJobEligibility = currentJob && currentJobPromotionReady
        ? getPromotionEligibility(currentJob, gameState.weeksLived)
        : null;
    const currentJobCanPromote = currentJobPromotionReady && !!currentJobEligibility?.eligible;
    const currentJobGateReason = currentJobPromotionReady && !currentJobEligibility?.eligible
        ? currentJobEligibility?.reason
        : undefined;
    const nextLevelName = currentJob?.levels?.[currentJob.level + 1]?.name;

    // Plain background - the "gradient" this screen shipped with blended
    // #020617 into #020617 (two identical colors), pure decoration cost.
    const workScreenBackground = settings.darkMode
        ? '#020617'
        : themeColors.palette.light50;

    return (
        <View style={[styles.background, { backgroundColor: workScreenBackground }]}>
            {gameState.jailWeeks > 0 ? (
                <JailScreen />
            ) : (
                <>
                    <ScreenHeader
                        title="Work"
                        icon={<Briefcase size={scale(18)} color="#34D399" />}
                        tint="#34D399"
                    />
                    {/* One page-level scroll: the Current Job card and the
                        Street/Career/Crime sub-tabs scroll away with the list
                        instead of pinning a cramped inner scroll region. */}
                    <ScrollView
                        style={styles.container}
                        contentContainerStyle={{ paddingBottom: getTabBarSafePadding(insets.bottom) }}
                        showsVerticalScrollIndicator={true}
                    >
                        {currentJob && currentJobLevel && (
                            /* THE dominant element when employed: the job the player
                               holds, with its ONE action. A promotion the player can
                               take right now is the most consequential thing on the
                               screen, so it is the only saturated button; otherwise a
                               quiet Manage chip (raise and quit live in its sheet). The
                               held career no longer repeats as a list card below - that
                               card was this content a second time. */
                            <View style={local.heroCard}>
                                <View style={local.heroRow}>
                                    <ProgressRing
                                        value={currentJobAtMax ? 100 : currentJob.progress}
                                        size={86}
                                        state={currentJobAtMax ? 'done' : 'active'}
                                        label={currentJobAtMax ? 'Fully promoted' : `Promotion progress ${currentJob.progress}%`}
                                    >
                                        <View style={[local.heroRingIcon, { borderColor: currentJobAtMax ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)', backgroundColor: currentJobAtMax ? 'rgba(16,185,129,0.14)' : 'rgba(59,130,246,0.14)' }]}>
                                            <Briefcase size={scale(24)} color={currentJobAtMax ? '#34D399' : '#60A5FA'} />
                                        </View>
                                    </ProgressRing>

                                    <View style={local.heroRight}>
                                        <Text style={local.heroLabel}>Current Job</Text>
                                        <Text style={local.heroTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                                            {currentJobLevel.name}
                                        </Text>
                                        {/* The paid figure leads the meta line: it is the number the
                                            job is about, and it used to be smaller here than on every
                                            listing below. */}
                                        <Text style={local.heroMeta} numberOfLines={1}>
                                            {formatMoney(currentJobSalary)}/wk · Lv {currentJob.level + 1}/{currentJob.levels.length}
                                            {currentJobRaisePct > 0 ? ` · +${currentJobRaisePct}%` : ''}
                                        </Text>
                                        <Text
                                            style={[local.heroStageSub, currentJobGateReason ? local.heroStageGated : null]}
                                            numberOfLines={2}
                                        >
                                            {currentJobAtMax
                                                ? 'Top of the ladder'
                                                : currentJobCanPromote
                                                    ? 'Promotion ready'
                                                    : currentJobGateReason ?? `${Math.max(0, 100 - currentJob.progress)}% to next level`}
                                        </Text>
                                    </View>
                                </View>
                                {currentJobCanPromote ? (
                                    <GradientButton
                                        label={nextLevelName ? `Promote to ${nextLevelName}` : 'Promote'}
                                        onPress={() => handlePromote(currentJob.id)}
                                        colors={['#34D399', '#10B981', '#047857']}
                                        glow="#10B981"
                                        accessibilityLabel={nextLevelName ? `Promote to ${nextLevelName}` : 'Take the promotion'}
                                    />
                                ) : (
                                    <View style={local.heroActionRow}>
                                        <Chip
                                            label="Manage"
                                            size="md"
                                            onPress={() => setManageJobId(currentJob.id)}
                                            accessibilityLabel="Manage your job: ask for a raise or quit"
                                        />
                                    </View>
                                )}
                            </View>
                        )}
                        <SegmentedControl
                            style={local.workTabs}
                            segments={[
                                { key: 'career', label: t('work.career') },
                                { key: 'street', label: t('work.street') },
                                { key: 'skills', label: t('work.crimeJobs') },
                            ]}
                            value={activeTab}
                            onChange={setActiveTab}
                        />

                        <View style={local.tabContent}>
                            {buffs.length > 0 && (
                                <View style={local.buffRow}>
                                    {buffs.map((b) => (
                                        <View key={b.id} style={local.buffChip}>
                                            <Text style={local.buffChipText}>
                                                {b.label} · {b.effect} · {b.weeksLeft}w left
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {activeTab === 'street' && (
                                <View>
                                    <SectionTitle title="Street Jobs" subtitle="Quick gigs paid on the spot - each job ranks up and pays more with repetition." />
                                    {/* BOTH weekly caps the reducer enforces, in ONE line.
                                        Stated up front so the player never discovers a
                                        limit by being refused (UX-4); per-job usage also
                                        appears as a chip on the card once it starts. */}
                                    <Text style={[local.boardNote, settings.darkMode && local.boardNoteDark]}>
                                        Street work: {streetJobsThisWeek}/{MAX_TOTAL_STREET_JOBS_PER_WEEK} this week · max 3 per job
                                    </Text>
                                    {/* ONE crime-standing card: criminal level + progress
                                        and the record's real costs together. It was two
                                        stacked cards saying halves of the same thing.

                                        `wantedLevel` was read in three places in
                                        JobActions and displayed in NONE - its worst
                                        effect is a background check that quietly costs up
                                        to 30% on LEGITIMATE career applications. Shown
                                        whenever the player has done any illegal work,
                                        which is exactly when the gates start mattering;
                                        clean players see nothing. */}
                                    {(gameState.criminalXp ?? 0) > 0 || record.criminalLevel > 1 || record.wantedLevel > 0 ? (
                                        <View style={local.progressCard}>
                                            <Text style={local.progressTitle}>
                                                Criminal level {crimeProgress.level}
                                                {record.band !== 'clean' ? ` · ${record.bandLabel}` : ''}
                                                {record.wantedLevel > 0 ? ` · wanted ${record.wantedLevel}` : ''}
                                            </Text>
                                            <View style={local.progressTrack}>
                                                <View style={[local.progressFill, { width: `${Math.round(crimeProgress.fraction * 100)}%` }]} />
                                            </View>
                                            <Text style={local.recordLine}>
                                                {crimeProgress.xp}/{crimeProgress.xpForNext} XP · {crimeProgress.jobsToNextLevel} more illegal job{crimeProgress.jobsToNextLevel === 1 ? '' : 's'} to level {crimeProgress.level + 1}
                                            </Text>
                                            {record.wantedLevel > 0 || record.criminalLevel > 0 ? (
                                                <>
                                                    {record.arrestBonusPct > 0 && (
                                                        <Text style={local.recordLine}>+{record.arrestBonusPct}% chance of being caught on illegal work</Text>
                                                    )}
                                                    {record.hiringPenaltyPct > 0 && (
                                                        <Text style={local.recordLine}>−{record.hiringPenaltyPct}% on legitimate job applications (background check)</Text>
                                                    )}
                                                    {record.raisesCrisisRate && (
                                                        <Text style={local.recordLine}>Bad luck events are far more likely while you are wanted</Text>
                                                    )}
                                                </>
                                            ) : null}
                                        </View>
                                    ) : null}
                                    {/* Transport gates delivery work, so it belongs
                                        above the gig list rather than buried in a
                                        vehicles screen the player has no money for. */}
                                    <TransportCard
                                        gameState={gameState}
                                        onRent={(planId) => {
                                            const result = startScooterRental(gameState, setGameState, planId);
                                            if (result.success) {
                                                haptic.success();
                                                showSuccess(result.message);
                                                setTimeout(() => { void saveGame(); }, 0);
                                            } else {
                                                showWarning(result.message);
                                            }
                                        }}
                                        onEndRental={() => {
                                            const result = endScooterRental(gameState, setGameState);
                                            if (result.success) {
                                                haptic.medium();
                                                showSuccess(result.message);
                                                setTimeout(() => { void saveGame(); }, 0);
                                            } else {
                                                showWarning(result.message);
                                            }
                                        }}
                                    />
                                    {legalStreetJobs.length > 0 ? (
                                        legalStreetJobs.map(renderJobCard)
                                    ) : (
                                        <EmptyState
                                            compact
                                            icon={<Zap size={22} color={settings.darkMode ? '#94A3B8' : '#64748B'} />}
                                            observation="No gigs on the board this week"
                                            nudge="Quick jobs rotate as the weeks pass - advance the week and check back."
                                        />
                                    )}
                                </View>
                            )}

                            {activeTab === 'career' && (
                                <View>
                                    {/* No compact CareerPathCard here any more: the hero
                                        Current Job card 100px above already shows the same
                                        job, salary and promotion progress. */}
                                    <SectionTitle title="Careers" subtitle="Meet a career’s requirements, apply, and climb its ladder for bigger salaries." />
                                    <CollapsibleSection
                                        id="work.standardCareers"
                                        title="Standard Careers"
                                        compact
                                        summary={`${visibleBasicCareers.length} listed`}
                                    >
                                    {openingsCount > 0 && (
                                        <Text style={[local.boardNote, settings.darkMode && local.boardNoteDark]}>
                                            {openingsCount} {openingsCount === 1 ? 'opening' : 'openings'} on the board
                                            {' · '}new listings in {boardRefreshWeeks} {boardRefreshWeeks === 1 ? 'week' : 'weeks'}
                                        </Text>
                                    )}
                                    {visibleBasicCareers.length > 0 ? (
                                        visibleBasicCareers.map(career => renderCareerCard(career))
                                    ) : (
                                        <EmptyState
                                            compact
                                            icon={<Briefcase size={22} color={settings.darkMode ? '#94A3B8' : '#64748B'} />}
                                            observation="No open positions right now"
                                            nudge={`The job board rotates - new listings in ${boardRefreshWeeks} ${boardRefreshWeeks === 1 ? 'week' : 'weeks'}.`}
                                        />
                                    )}
                                    </CollapsibleSection>
                                    <CollapsibleSection
                                        id="work.advancedCareers"
                                        title="Advanced Careers"
                                        compact
                                        summary={`${(ADVANCED_CAREERS as AdvancedCareer[]).length} listed`}
                                    >
                                    {(() => {
                                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                                        const { calculateNetWorth } = require('@/lib/statistics/statisticsTracker');
                                        // Shared gate input: live claimed-achievement store + consolidated net worth.
                                        const advCareerGate = {
                                            education: gameState.educations || [],
                                            claimedAchievements: gameState.claimedProgressAchievements || [],
                                            stats: gameState.stats,
                                            weeksLived: gameState.weeksLived,
                                            netWorth: calculateNetWorth(gameState),
                                        };
                                        // Render EVERY advanced career, locked ones included.
                                        //
                                        // This used to pre-filter with `getUnlockedAdvancedCareers`, which
                                        // returns only unlocked entries - so the `isLocked` line below was
                                        // always false and the whole requirement formatter was unreachable
                                        // dead code. A player who had unlocked none saw one generic
                                        // sentence, and the five best careers in the game (CEO topping out
                                        // at $24,000/wk, Investment Banker, Surgeon, Research Scientist,
                                        // Creative Director) were invisible with no hint of what to do.
                                        // A locked goal you can see is a goal; one you cannot is nothing.
                                        // 2026-07-30 audit GP-10.
                                        void getUnlockedAdvancedCareers; // still exported for other callers

                                        return (ADVANCED_CAREERS as AdvancedCareer[])
                                            .filter((career: AdvancedCareer) => career.id !== gameState.currentJob)
                                            .map((career: AdvancedCareer) => {
                                            // A career the player has already applied to or holds lives in
                                            // `gameState.careers` with their real level, progress and raise
                                            // premium - so render THAT, through the same card every other
                                            // career uses. The catalog stub below can only describe rung 0,
                                            // and rendering both put "Surgical Director $26K/wk" and
                                            // "Resident $1,150/wk" on one screen for the same job. It also
                                            // left the promote and Manage Job controls on a card that the
                                            // `advancedIds` filter is now, correctly, removing from the
                                            // Standard list.
                                            const held = gameState.careers.find(c => c.id === career.id);
                                            if (held) return renderCareerCard(held);

                                            const isLocked = !isCareerUnlocked(career, advCareerGate);
                                            const isApplied = false;
                                            const isAccepted = false;

                                            const lockReqs: string[] = [];
                                            if (isLocked) {
                                                const req = career.unlockRequirements || career.requirements;
                                                if ('education' in req && req.education) lockReqs.push(`Education: ${req.education.join(', ')}`);
                                                if ('experience' in req && req.experience) lockReqs.push(`Experience: ${req.experience} weeks`);
                                                if ('reputation' in req && req.reputation) lockReqs.push(`Reputation: ${req.reputation}+`);
                                                if ('netWorth' in req && req.netWorth) lockReqs.push(`Net Worth: $${req.netWorth.toLocaleString()}+`);
                                                // Never printed before, because this whole block was
                                                // unreachable - two of the five careers are gated on a
                                                // claimed achievement and the player was never told.
                                                if ('achievements' in req && req.achievements && req.achievements.length > 0) {
                                                    lockReqs.push(`Achievement: ${req.achievements.join(', ')}`);
                                                }
                                            }

                                            return renderAdvancedCareerCard(career, { isLocked, isApplied, isAccepted, lockReqs });
                                        });
                                    })()}
                                    </CollapsibleSection>
                                </View>
                            )}

                            {activeTab === 'skills' && (
                                <View>
                                    <SectionTitle title="Crime Skills" subtitle="Illegal jobs level these skills, and their talents add success and payout bonuses." />

                                    <CollapsibleSection
                                        id="work.crimeSkills"
                                        title="Your Skills"
                                        compact
                                        summary={crimeSkillSummary}
                                    >
                                    <View>
                                        {Object.entries(gameState.crimeSkills || {}).map(([id, skill]) => {
                                            const skillId = id as CrimeSkillId;
                                            const threshold = skill.level * 100;
                                            const label = id.charAt(0).toUpperCase() + id.slice(1);
                                            const availablePoints = Math.max(0, skill.level - 1);
                                            const spentPoints = skill.upgrades?.length || 0;
                                            const remainingPoints = availablePoints - spentPoints;

                                            const skillMeta: Record<CrimeSkillId, { icon: typeof Eye; treeName: string; accent: [string, string]; totalNodes: number }> = {
                                                stealth: { icon: Eye, treeName: 'Shadow Arts', accent: ['#475569', '#94A3B8'], totalNodes: 5 },
                                                hacking: { icon: Brain, treeName: 'Digital Dominion', accent: ['#0369A1', '#38BDF8'], totalNodes: 5 },
                                                lockpicking: { icon: Target, treeName: 'Lock Mastery', accent: ['#EA580C', '#FB923C'], totalNodes: 5 },
                                            };
                                            const meta = skillMeta[skillId];

                                            return (
                                                <CrimeSkillCard
                                                    key={id}
                                                    icon={meta.icon}
                                                    name={label}
                                                    treeName={meta.treeName}
                                                    level={skill.level}
                                                    xp={skill.xp}
                                                    xpThreshold={threshold}
                                                    pointsAvailable={remainingPoints}
                                                    unlockedCount={spentPoints}
                                                    totalCount={meta.totalNodes}
                                                    accent={meta.accent}
                                                    onPress={() => setSelectedSkillTree(skillId)}
                                                />
                                            );
                                        })}
                                    </View>
                                    </CollapsibleSection>

                                    <CollapsibleSection
                                        id="work.crimeJobs"
                                        title={`Crime Jobs (Level ${gameState.criminalLevel})`}
                                        compact
                                        summary={`${criminalStreetJobs.length} available`}
                                    >
                                    {/* Crime jobs share the street-work weekly caps -
                                        same single-line statement as the Street tab. */}
                                    <Text style={[local.boardNote, settings.darkMode && local.boardNoteDark]}>
                                        Street work: {streetJobsThisWeek}/{MAX_TOTAL_STREET_JOBS_PER_WEEK} this week · max 3 per job
                                    </Text>
                                    {criminalStreetJobs.length > 0 ? (
                                        criminalStreetJobs.map(renderJobCard)
                                    ) : (
                                        <EmptyState
                                            compact
                                            icon={<Lock size={22} color={settings.darkMode ? '#94A3B8' : '#64748B'} />}
                                            observation="No underground jobs available right now"
                                            nudge="Raise your criminal level to unlock more work, or check back later."
                                        />
                                    )}
                                    </CollapsibleSection>
                                </View>
                            )}

                        </View>
                    </ScrollView>

                    {selectedSkillTree && (
                        <SkillTalentTree
                            skillId={selectedSkillTree}
                            visible={!!selectedSkillTree}
                            onClose={() => setSelectedSkillTree(null)}
                        />
                    )}
                </>
            )}

            {/* Quit Job Confirmation Dialog */}
            <ConfirmDialog
                visible={showQuitJobConfirm}
                title="Quit Job?"
                message="Are you sure you want to quit your current job? You&apos;ll lose your salary and will need to reapply if you want to work here again."
                confirmText="Quit Job"
                cancelText="Cancel"
                onConfirm={() => {
                    quitJob();
                    setShowQuitJobConfirm(false);
                }}
                onCancel={() => setShowQuitJobConfirm(false)}
                type="warning"
            />

            {/* Manage Job - in-app action sheet (replaces the native Alert). */}
            <Modal
                visible={manageJobId !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setManageJobId(null)}
            >
                <TouchableOpacity
                    style={local.sheetOverlay}
                    activeOpacity={1}
                    accessible={false}
                    importantForAccessibility="no"
                    onPress={() => setManageJobId(null)}
                >
                    <View style={local.sheet} accessibilityViewIsModal>
                        <View style={local.sheetHandle} />
                        <Text style={local.sheetTitle}>Your Job</Text>
                        <Text style={local.sheetSubtitle}>What would you like to do?</Text>

                        <TouchableOpacity
                            style={local.sheetAction}
                            activeOpacity={0.85}
                            onPress={() => { if (manageJobId) handleAskForRaise(manageJobId); }}
                            accessibilityRole="button"
                            accessibilityLabel="Ask for a raise"
                        >
                            <TrendingUp size={scale(17)} color="#34D399" />
                            <Text style={local.sheetActionText}>Ask for a Raise</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={local.sheetAction}
                            activeOpacity={0.85}
                            onPress={() => { setManageJobId(null); setShowQuitJobConfirm(true); }}
                            accessibilityRole="button"
                            accessibilityLabel="Quit job"
                        >
                            <X size={scale(17)} color="#F87171" />
                            <Text style={[local.sheetActionText, { color: '#F87171' }]}>Quit Job</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={local.sheetCancel}
                            activeOpacity={0.85}
                            onPress={() => setManageJobId(null)}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                        >
                            <Text style={local.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <PromotionCelebrationModal
                visible={promotionCelebration !== null}
                promotion={promotionCelebration}
                onClose={() => setPromotionCelebration(null)}
            />

        </View>
    );
}

const local = StyleSheet.create({
    buffRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(6),
        marginBottom: scale(10),
    },
    buffChip: {
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.40)',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        borderRadius: 999,
        paddingHorizontal: scale(10),
        paddingVertical: scale(4),
    },
    buffChipText: {
        fontSize: fontScale(11),
        fontWeight: '700',
        color: '#C084FC',
    },
    progressCard: {
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.35)',
        backgroundColor: 'rgba(148, 163, 184, 0.10)',
        borderRadius: scale(10),
        padding: scale(10),
        marginBottom: scale(8),
        gap: scale(4),
    },
    progressTitle: {
        fontSize: fontScale(12),
        fontWeight: '800',
        color: 'rgba(203, 213, 225, 0.95)',
    },
    progressTrack: {
        height: scale(5),
        borderRadius: 999,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#94A3B8',
    },
    recordLine: {
        fontSize: fontScale(11),
        fontWeight: '600',
        color: 'rgba(148, 163, 184, 0.95)',
    },
    boardNote: {
        fontSize: fontScale(12),
        fontWeight: '600',
        color: 'rgba(71, 85, 105, 0.9)',
        marginBottom: scale(8),
        marginTop: scale(-2),
    },
    boardNoteDark: {
        color: 'rgba(148, 163, 184, 0.85)',
    },
    // One-line section subtitles - replaced the three InfoButton "?" modals.
    sectionSub: {
        fontSize: fontScale(12),
        fontWeight: '500',
        color: 'rgba(71, 85, 105, 0.9)',
        marginTop: scale(-4),
        marginBottom: scale(10),
        lineHeight: fontScale(16),
    },
    sectionSubDark: {
        color: 'rgba(148, 163, 184, 0.85)',
    },
    workTabs: {
        marginHorizontal: scale(16),
        marginTop: scale(12),
        marginBottom: scale(4),
    },
    // Horizontal padding for the tab content, now that the whole page (hero +
    // sub-tabs + list) lives in one ScrollView. Matches the old inner-scroll
    // padding (responsiveSpacing.lg == scale(24)); the page ScrollView owns the
    // bottom safe-area padding.
    tabContent: {
        paddingHorizontal: scale(24),
        paddingTop: scale(8),
    },
    // Current Job hero - reference-style ring card.
    heroCard: {
        gap: scale(12),
        marginHorizontal: scale(16),
        marginTop: scale(12),
        marginBottom: scale(6),
        padding: scale(16),
        paddingRight: scale(18),
        borderRadius: scale(16),
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        ...getPlatformShadows(6, 0.25, 4, 14),
    },
    heroRingIcon: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(13),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(16),
    },
    heroActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    heroRight: {
        flex: 1,
        gap: scale(4),
    },
    heroLabel: {
        ...kicker,
        color: 'rgba(226, 232, 240, 0.5)',
    },
    heroTitle: {
        ...tier1Title,
        color: '#F8FAFC',
    },
    heroStageSub: {
        ...tier4,
        color: 'rgba(226, 232, 240, 0.55)',
    },
    /** Full progress but held by a review / tenure gate: the reason is the line. */
    heroStageGated: {
        color: 'rgba(251, 191, 36, 0.92)',
    },
    heroMeta: {
        fontSize: fontScale(16),
        lineHeight: fontScale(21),
        fontWeight: '600',
        color: '#E2E8F0',
        fontVariant: ['tabular-nums'],
    },
    // Promotion-gated footer - full progress but locked on performance/experience.
    cardLockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        paddingVertical: scale(4),
        paddingHorizontal: scale(2),
    },
    cardLockText: {
        flex: 1,
        fontSize: fontScale(11.5),
        fontWeight: '600',
        color: 'rgba(251, 191, 36, 0.92)',
    },
    // Action sheet
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: scale(16),
        paddingTop: scale(10),
        paddingBottom: scale(34),
        gap: scale(10),
    },
    sheetHandle: {
        alignSelf: 'center',
        width: scale(38),
        height: scale(4),
        borderRadius: scale(2),
        backgroundColor: 'rgba(148, 163, 184, 0.4)',
        marginBottom: scale(8),
    },
    sheetTitle: {
        fontSize: fontScale(18),
        fontWeight: '800',
        color: '#F8FAFC',
        letterSpacing: -0.3,
    },
    sheetSubtitle: {
        fontSize: fontScale(13),
        color: 'rgba(226, 232, 240, 0.6)',
        marginBottom: scale(4),
    },
    sheetAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
        paddingVertical: scale(14),
        paddingHorizontal: scale(14),
        borderRadius: scale(12),
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    sheetActionText: {
        fontSize: fontScale(15),
        fontWeight: '700',
        color: '#F8FAFC',
    },
    sheetCancel: {
        alignItems: 'center',
        paddingVertical: scale(13),
        marginTop: scale(2),
    },
    sheetCancelText: {
        fontSize: fontScale(14),
        fontWeight: '700',
        color: 'rgba(226, 232, 240, 0.55)',
    },
});


export default React.memo(WorkScreen);

