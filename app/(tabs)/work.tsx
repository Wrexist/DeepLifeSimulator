import React, { useState, useEffect, useRef } from 'react';
import { View,
    Text,
    ScrollView,
    TouchableOpacity,
    Modal,
    Alert,
    Animated } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import ConfirmDialog from '@/components/ConfirmDialog';
import JobCard, { JobCardMetadata } from '@/components/work/JobCard';
import CrimeSkillCard from '@/components/work/CrimeSkillCard';
import { useGame, CrimeSkillId, StreetJob, Career } from '@/contexts/GameContext';
import { useJobActions } from '@/contexts/game/JobActionsContext';
import { useToast } from '@/contexts/ToastContext';
import { getMindsetFeedback } from '@/utils/mindsetFeedback';
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
    Check,
    Eye,
    Brain,
    Target,
    Sparkles,
    Crown,
} from 'lucide-react-native';
import JailScreen from '@/components/jail/JailScreen';
import SkillTalentTree from '@/components/SkillTalentTree';
import InfoButton from '@/components/ui/InfoButton';
import {
    scale,
    fontScale,
    getTabBarSafePadding,
} from '@/utils/scaling';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { logger } from '@/utils/logger';
import { colors as themeColors } from '@/lib/config/theme';
import { styles } from '@/components/work/workScreenStyles';
import { CareerPathCard } from '@/components/CareerPathCard';
import type { AdvancedCareer } from '@/lib/careers/advancedCareers';
const LinearGradient = LinearGradientFallback;
const BlurView = BlurViewFallback;

// Hobbies removed - all hobby images removed

const CRIME_SKILL_UPGRADES: Record<
    CrimeSkillId,
    { id: string; name: string; description: string; cost: number; level: number; effect: string }[]
> = {
    stealth: [
        { id: 'silentStep', name: 'Silent Step', description: 'Learn to move silently', cost: 100, level: 1, effect: '+10% stealth success rate' },
        { id: 'shadowBlend', name: 'Shadow Blend', description: 'Master the art of blending into shadows', cost: 200, level: 2, effect: '+20% stealth success rate' },
        { id: 'ghost', name: 'Ghost', description: 'Become nearly invisible in darkness', cost: 300, level: 3, effect: '+30% stealth success rate' },
        { id: 'nightMaster', name: 'Night Master', description: 'Complete mastery of night operations', cost: 400, level: 4, effect: '+40% stealth success rate' },
        { id: 'shadowLord', name: 'Shadow Lord', description: 'Legendary stealth abilities', cost: 500, level: 5, effect: '+50% stealth success rate' },
    ],
    hacking: [
        { id: 'bruteForce', name: 'Brute Force', description: 'Basic password cracking techniques', cost: 100, level: 1, effect: '+10% hacking success rate' },
        { id: 'backdoor', name: 'Backdoor', description: 'Create hidden system access points', cost: 200, level: 2, effect: '+20% hacking success rate' },
        { id: 'quantumLeap', name: 'Quantum Leap', description: 'Advanced quantum computing techniques', cost: 300, level: 3, effect: '+30% hacking success rate' },
        { id: 'deepSpoof', name: 'Deep Spoof', description: 'Master identity spoofing', cost: 400, level: 4, effect: '+40% hacking success rate' },
        { id: 'aiOverride', name: 'AI Override', description: 'Control AI systems directly', cost: 500, level: 5, effect: '+50% hacking success rate' },
    ],
    lockpicking: [
        { id: 'quickPick', name: 'Quick Pick', description: 'Fast lock picking techniques', cost: 100, level: 1, effect: '+10% lockpicking success rate' },
        { id: 'masterKey', name: 'Master Key', description: 'Create universal keys', cost: 200, level: 2, effect: '+20% lockpicking success rate' },
        { id: 'phantomTouch', name: 'Phantom Touch', description: 'Feel locks without touching them', cost: 300, level: 3, effect: '+30% lockpicking success rate' },
        { id: 'silentDrill', name: 'Silent Drill', description: 'Silent drilling techniques', cost: 400, level: 4, effect: '+40% lockpicking success rate' },
        { id: 'molecularKey', name: 'Molecular Key', description: 'Molecular-level lock manipulation', cost: 500, level: 5, effect: '+50% lockpicking success rate' },
    ],
};

// Creative/hobby ids that can leak into streetJobs but must not render as street
// work. Hoisted to module scope (and thus a stable identity) — it was a fresh
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
    const [activeTab, setActiveTab] = useState<'street' | 'career' | 'skills'>('street');
    const [workFeedback, setWorkFeedback] = useState<{ [key: string]: string }>({});
    // Hobbies removed - unused state variables removed
    const [selectedSkillTree, setSelectedSkillTree] = useState<CrimeSkillId | null>(null);
    const [feedbackOpacity] = useState(new Animated.Value(0));
    // P3-2: dead state — `_showJailReleaseMessage` and `_previousJailWeeks`
    // were never referenced after being renamed by an unused-var lint sweep.
    const [showQuitJobConfirm, setShowQuitJobConfirm] = useState(false);
    const { showSuccess, showError, showWarning } = useToast();

    const {
        gameState,
        setGameState,
        performStreetJob,
        applyForJob,
        quitJob,
        // Hobbies removed - hobby actions no longer available
        saveGame,
    } = useGame();

    const { promoteCareer } = useJobActions();

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

    // State for negative stats popup
    const [showNegativeStatsPopup, setShowNegativeStatsPopup] = useState(false);
    const [selectedJobForStats] = useState<StreetJob | null>(null);

    // Auto-switch to career tab if player doesn't have a job or is coming from tutorial
    useEffect(() => {
        if (!gameState.currentJob && (gameState?.stats?.money ?? 0) < 1000 && !gameState.hasSeenJobTutorial) {
            setActiveTab('career');
            // Mark that we've shown the job tutorial to prevent repeated switching
            setGameState(prev => ({ ...prev, hasSeenJobTutorial: true }));
        }
    }, [gameState.currentJob, gameState?.stats?.money, gameState.hasSeenJobTutorial, setGameState]);

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

    // Hobbies completely removed - no state variables needed

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
            // (500ms after the action) was removed — it interrupted the action
            // and made the result feel laggy instead of instant.
            try {
                const { updateSystemUsage } = require('@/lib/depth/discoverySystem');
                // CR: apply the returned state — updateSystemUsage is pure, so discarding it dropped
                // the discovery timesUsed / masteryLevel increments.
                setGameState(prev => updateSystemUsage('streetJobs', prev));
                saveGame();
            } catch (error) {
                logger.warn('Failed to update system usage:', error as any);
            }

            // Show toast notification. SMOOTHNESS: fold the optional mindset
            // feedback into the SAME toast instead of firing a second one right
            // after — two stacked toasts per job felt spammy.
            if (result.success) {
                let message = result.message ?? '';
                let mindsetPenalty = false;
                if (job && gameState.mindset?.activeTraitId) {
                    const mindsetFeedback = getMindsetFeedback(
                        gameState,
                        job.basePayment,
                        0,
                        0
                    );
                    if (mindsetFeedback?.message) {
                        message = message
                            ? `${message} · ${mindsetFeedback.message}`
                            : mindsetFeedback.message;
                        mindsetPenalty = mindsetFeedback.type === 'penalty';
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

    const handlePayBail = () => {
        // payBail functionality removed or moved elsewhere
        Alert.alert('Bail', 'Bail functionality is not available in this context');
    };

    // Hobbies completely removed - no handler functions needed

    const canPerformJob = (job: StreetJob) => {
        if (gameState.jailWeeks > 0) {
            return false;
        }

        // Check weekly limit - prevent spamming jobs
        const weeklyJobs = gameState.weeklyStreetJobs || {};
        const timesDoneThisWeek = weeklyJobs[job.id] || 0;
        const maxPerWeek = 3; // Allow each job to be done max 3 times per week

        if (timesDoneThisWeek >= maxPerWeek) {
            return false;
        }

        // Energy check - use current energy value
        const hasEnoughEnergy = (gameState?.stats?.energy ?? 0) >= job.energyCost;

        if (!hasEnoughEnergy) return false;

        const hasItems =
            !job.requirements ||
            job.requirements.every((req: string) =>
                (gameState.items || []).find(item => item.id === req)?.owned
            );

        const hasDarkItems =
            !job.darkWebRequirements ||
            job.darkWebRequirements.every((req: string) => {
                // Check both darkWebItems and regular items (for compatibility)
                const darkWebItem = (gameState.darkWebItems || []).find(item => item.id === req)?.owned;
                const regularItem = (gameState.items || []).find(item => item.id === req)?.owned;
                return darkWebItem || regularItem;
            });

        const meetsLevel =
            !job.criminalLevelReq ||
            gameState.criminalLevel >= job.criminalLevelReq;

        return hasItems && hasDarkItems && meetsLevel;
    };

    const getJailRisk = (job: StreetJob) => {
        if (!job.illegal) return 0;

        // Calculate risk the same way as in JobActions.ts
        // Risk = (100 - successChance) / 2
        const baseSuccess = job.baseSuccessRate || 50;
        const skillBonus = job.skill ? (gameState.crimeSkills[job.skill]?.level || 0) * 5 : 0;
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

    const getCareerPenalties = () => {
        // Career jobs have lighter penalties than street jobs
        // Careers: -3 happiness, -2 health
        return { happinessPenalty: -3, healthPenalty: -2 };
    };


    const availableCrimeJobs = criminalStreetJobs.filter(job => canPerformJob(job));

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
        // systems are unlocked), NOT the whole `gameState` object — that changes
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
        const lacksEnergy = (gameState?.stats?.energy ?? 0) < job.energyCost;
        const inJail = gameState.jailWeeks > 0;
        const { happinessPenalty, healthPenalty } = getJobPenalties(job);

        const metadata: JobCardMetadata[] = [
            { icon: <Zap size={scale(13)} color="rgba(226, 232, 240, 0.78)" />, value: `${job.energyCost} energy` },
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
            const locked = lacksEnergy || inJail || atLimit || !meetsCriminalLevel || missingItems.length > 0 || missingDark.length > 0;

            let lockReason: string | undefined;
            if (atLimit) {
                lockReason = `Used ${timesDoneThisWeek}/${maxPerWeek} this week — wait for next week.`;
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
                lockReason = `Needs ${job.energyCost} energy.`;
            }

            const buttonText = atLimit
                ? 'Limit reached'
                : locked
                    ? 'Locked'
                    : 'Execute';

            // insert risk metadata for crimes
            const crimeMetadata: JobCardMetadata[] = [
                metadata[0], // energy
                metadata[1], // rank
                { icon: <AlertTriangle size={scale(13)} color="rgba(251, 191, 36, 0.92)" />, value: `${getJailRisk(job)}% risk`, tone: 'warn' },
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
                    buttonText={buttonText}
                    onPress={() => handleStreetJob(job.id)}
                    locked={locked}
                    lockReason={lockReason}
                    feedback={workFeedback[job.id]}
                    feedbackOpacity={feedbackOpacity}
                />
            );
        }

        const missing = getMissingRequirements(job);
        const locked = lacksEnergy || inJail || missing.length > 0;
        const lockReason = missing.length > 0
            ? `Need ${missing.join(', ')}`
            : inJail
                ? 'Unavailable while in jail.'
                : lacksEnergy
                    ? `Needs ${job.energyCost} energy.`
                    : undefined;

        const streetMetadata: JobCardMetadata[] = [...metadata];
        if (job.risks && job.risks.length > 0) {
            streetMetadata.splice(2, 0, {
                icon: <AlertTriangle size={scale(13)} color="rgba(251, 191, 36, 0.92)" />,
                value: `${job.risks.length} risk${job.risks.length > 1 ? 's' : ''}`,
                tone: 'warn',
            });
        }

        return (
            <JobCard
                key={job.id}
                accent="street"
                title={job.name}
                description={job.description}
                reward={reward}
                metadata={streetMetadata}
                buttonText={locked ? 'Locked' : 'Work'}
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
        const meetsFitness =
            !('fitness' in career.requirements && career.requirements.fitness) ||
            (gameState?.stats?.fitness ?? 0) >= career.requirements.fitness;
        const hasItems =
            !('items' in career.requirements && career.requirements.items) ||
            career.requirements.items.every((itemId: string) =>
                (gameState.items || []).find(item => item.id === itemId)?.owned
            );
        // Check for early career access bonus
        const { hasEarlyCareerAccess } = require('@/lib/prestige/applyUnlocks');
        const unlockedBonuses = gameState.prestige?.unlockedBonuses || [];
        const hasEarlyAccess = hasEarlyCareerAccess(unlockedBonuses);
        const hasEducation =
            hasEarlyAccess ||
            !('education' in career.requirements && career.requirements.education) ||
            (career.requirements.education && career.requirements.education.every((educationId: string) =>
                (gameState.educations || []).find(e => e.id === educationId)?.completed
            ));
        const pendingApplication = gameState.careers.some(
            (c: Career) => c.applied && !c.accepted
        );
        return (
            meetsFitness &&
            hasItems &&
            hasEducation &&
            !career.applied &&
            !gameState.currentJob &&
            !pendingApplication
        );
    };

    const renderCareerCard = (career: Career): React.ReactElement => {
        // CareerRequirements types `fitness`/`items` directly, so no `as any`
        // needed (was a rule-2 violation that bypassed the narrowed type).
        const requiresFitness = !!career.requirements.fitness;
        const meetsFitness = !requiresFitness || (gameState?.stats?.fitness ?? 0) >= (career.requirements.fitness ?? 0);
        const requiresEdu = !!('education' in career.requirements && career.requirements.education && career.requirements.education.length > 0);
        const hasEdu =
            !requiresEdu ||
            ('education' in career.requirements && (career.requirements.education ?? []).every((eid: string) =>
                !!(gameState.educations || []).find(e => e.id === eid)?.completed
            ));
        const requiresItems = !!('items' in career.requirements && career.requirements.items && career.requirements.items.length > 0);
        const missingItemNames: string[] = requiresItems
            ? (career.requirements.items ?? [])
                .filter((id) => !(gameState.items || []).find(i => i.id === id)?.owned)
                .map((id) => (gameState.items || []).find(i => i.id === id)?.name || id)
            : [];

        // Guard the level index — a stale/migrated save can carry `level` out of
        // bounds for `levels`, making this undefined and crashing the card.
        const level = career.levels?.[career.level] ?? career.levels?.[0];
        const isEmployedHere = gameState.currentJob === career.id;
        const canPromote = isEmployedHere && career.progress >= 100 && career.level < career.levels.length - 1;
        const atMaxLevel = isEmployedHere && career.level === career.levels.length - 1 && career.progress === 100;
        const { happinessPenalty, healthPenalty } = getCareerPenalties();

        const reward = requiresEdu && !hasEdu ? '— Locked' : `$${level?.salary ?? 0}/wk`;

        const metadata: JobCardMetadata[] = [];
        if (requiresFitness) {
            metadata.push({
                icon: <Trophy size={scale(13)} color={meetsFitness ? 'rgba(52, 211, 153, 0.95)' : 'rgba(248, 113, 113, 0.92)'} />,
                value: `Fitness ${career.requirements.fitness}+`,
                tone: meetsFitness ? 'default' : 'bad',
            });
        }
        if (requiresEdu) {
            metadata.push({
                icon: <Briefcase size={scale(13)} color={hasEdu ? 'rgba(52, 211, 153, 0.95)' : 'rgba(248, 113, 113, 0.92)'} />,
                value: hasEdu ? 'Education met' : 'Education needed',
                tone: hasEdu ? 'default' : 'bad',
            });
        }
        metadata.push({
            icon: <Star size={scale(13)} color="rgba(226, 232, 240, 0.78)" />,
            value: `Lv ${career.level + 1}/${career.levels.length}`,
        });
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

        // Button + lock state per employment phase
        let buttonText: string;
        let onPress: (() => void) | undefined;
        let locked = false;
        let lockReason: string | undefined;
        let buttonAccent: 'career' | 'crime' | undefined;

        if (canPromote) {
            buttonText = 'Promote now';
            onPress = () => {
                const result = promoteCareer(career.id);
                if (result) {
                    if (result.success) showSuccess(result.message);
                    else showWarning(result.message);
                }
            };
        } else if (isEmployedHere) {
            buttonText = atMaxLevel ? 'Quit (max level)' : 'Quit';
            onPress = () => setShowQuitJobConfirm(true);
            buttonAccent = 'crime';
        } else if (career.accepted) {
            buttonText = 'Hired';
            locked = true;
        } else if (career.applied) {
            buttonText = 'Applied';
            locked = true;
        } else if (requiresEdu && !hasEdu) {
            buttonText = 'Requires education';
            locked = true;
            lockReason = 'Complete the required education to apply.';
        } else if (requiresFitness && !meetsFitness) {
            buttonText = 'Requires fitness';
            locked = true;
            lockReason = `Reach Fitness ${career.requirements.fitness} to apply.`;
        } else if (missingItemNames.length > 0) {
            buttonText = 'Locked';
            locked = true;
            lockReason = `Need ${missingItemNames.join(', ')}.`;
        } else if (!canApplyForCareer(career)) {
            buttonText = 'Unavailable';
            locked = true;
            lockReason = gameState.currentJob ? 'Quit your current job to apply.' : 'Another application is pending.';
        } else {
            buttonText = t('work.apply');
            onPress = () => applyForJob(career.id);
        }

        // Footer: progress bar when employed and not yet promoting; max-level note; quit link when promoting
        let footer: React.ReactNode = null;
        if (isEmployedHere) {
            if (atMaxLevel) {
                footer = (
                    <Text style={[styles.maxPromotionText, settings.darkMode && styles.maxPromotionTextDark, { textAlign: 'center' }]}>
                        Max promotion reached
                    </Text>
                );
            } else if (canPromote) {
                footer = (
                    <TouchableOpacity onPress={() => setShowQuitJobConfirm(true)} style={{ alignSelf: 'center', paddingVertical: 4 }}>
                        <Text style={{ color: 'rgba(248, 113, 113, 0.85)', fontSize: fontScale(12), fontWeight: '600' }}>
                            Quit instead
                        </Text>
                    </TouchableOpacity>
                );
            } else {
                footer = (
                    <View>
                        <View style={styles.progressInfo}>
                            <Text style={[styles.progressLabel, settings.darkMode && styles.progressLabelDark]}>
                                Progress to promotion
                            </Text>
                            <Text style={[styles.progressPercent, settings.darkMode && styles.progressPercentDark]}>
                                {career.progress}%
                            </Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${career.progress}%` }]} />
                        </View>
                    </View>
                );
            }
        }

        return (
            <JobCard
                key={career.id}
                accent="career"
                buttonAccent={buttonAccent}
                title={level?.name ?? 'Unemployed'}
                description={career.description}
                reward={reward}
                metadata={metadata}
                buttonText={buttonText}
                onPress={onPress}
                locked={locked}
                lockReason={lockReason}
                footer={footer}
            />
        );
    };

    const sortedCareers = [...(gameState.careers || [])].sort(
        (a, b) => (a.levels?.[0]?.salary ?? 0) - (b.levels?.[0]?.salary ?? 0)
    );
    const advancedIds = ['politician', 'celebrity', 'athlete'];
    const basicCareers = sortedCareers.filter(c => !advancedIds.includes(c.id));

    const workScreenGradient = settings.darkMode
        ? [themeColors.palette.dark900, themeColors.palette.dark900]
        : [themeColors.palette.light50, themeColors.palette.light100];

    return (
        <LinearGradient
            colors={workScreenGradient}
            style={styles.background}
        >
            {gameState.jailWeeks > 0 ? (
                <JailScreen />
            ) : (
                <>
                    <View style={styles.container}>
                        <View style={[styles.tabContainer, styles.tabContainerDark]}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'street' && styles.activeTab]}
                                onPress={() => setActiveTab('street')}
                            >
                                <Text
                                    style={[
                                        styles.tabText,
                                        activeTab === 'street' && styles.activeTabText,
                                        styles.tabTextDark,
                                    ]}
                                >
                                    {t('work.street')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'career' && styles.activeTab]}
                                onPress={() => setActiveTab('career')}
                            >
                                <Text
                                    style={[
                                        styles.tabText,
                                        activeTab === 'career' && styles.activeTabText,
                                        styles.tabTextDark,
                                    ]}
                                >
                                    {t('work.career')}
                                </Text>
                            </TouchableOpacity>
                            {/* Hobby tab hidden for release */}
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'skills' && styles.activeTab]}
                                onPress={() => setActiveTab('skills')}
                            >
                                <Text
                                    style={[
                                        styles.tabText,
                                        activeTab === 'skills' && styles.activeTabText,
                                        styles.tabTextDark,
                                    ]}
                                >
                                    {t('work.crimeJobs')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={{ paddingTop: 0, paddingBottom: getTabBarSafePadding(insets.bottom) }}
                            showsVerticalScrollIndicator={true}
                        >
                            {activeTab === 'street' && (
                                <View>
                                    <View style={styles.sectionHeader}>
                                        <Text style={[styles.sectionTitle, styles.sectionTitleDark]}>Street Jobs</Text>
                                        <InfoButton
                                            title="Street Jobs"
                                            content="Street jobs are a great way to start earning money and build your skills. Each job has ranks that improve with experience. Work more to level up and earn better pay!"
                                            size="small"
                                            darkMode={settings.darkMode}
                                        />
                                    </View>
                                    {legalStreetJobs.map(renderJobCard)}
                                </View>
                            )}

                            {activeTab === 'career' && (
                                <View>
                                    {/* Career Path Visualization - Shows current career progression */}
                                    {gameState.currentJob && (
                                        <CareerPathCard compact={true} />
                                    )}

                                    <View style={styles.sectionHeader}>
                                        <Text style={[styles.sectionTitle, styles.sectionTitleDark]}>Careers</Text>
                                        <InfoButton
                                            title="Career Jobs"
                                            content="Apply for traditional careers that offer steady income and advancement opportunities. Each career has requirements like education or fitness levels you must meet first. Work hard to get promoted and earn higher salaries!"
                                            size="small"
                                            darkMode={settings.darkMode}
                                        />
                                    </View>
                                    <Text style={[styles.subheader, styles.subheaderDark]}>Standard Careers</Text>
                                    {basicCareers.map(career => renderCareerCard(career))}
                                    <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>Advanced Careers</Text>
                                    {(() => {
                                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                                        const { getUnlockedAdvancedCareers, isCareerUnlocked } = require('@/lib/careers/advancedCareers');
                                        const unlockedCareers = getUnlockedAdvancedCareers({
                                            education: gameState.educations || [],
                                            achievements: gameState.achievements || [],
                                            stats: gameState.stats,
                                            weeksLived: gameState.weeksLived,
                                            companies: gameState.companies || [],
                                            realEstate: gameState.realEstate || [],
                                        });

                                        if (unlockedCareers.length === 0) {
                                            return (
                                                <View style={styles.lockedCareerContainer}>
                                                    <Lock size={scale(24)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                                                    <Text style={[styles.lockedCareerText, settings.darkMode && styles.lockedCareerTextDark]}>
                                                        Complete education, gain experience, and build reputation to unlock advanced careers.
                                                    </Text>
                                                </View>
                                            );
                                        }

                                        return unlockedCareers.map((career: AdvancedCareer) => {
                                            // Advanced careers carry no top-level `name`; the
                                            // human title is the entry-level label.
                                            const displayName = career.levels?.[0]?.name ?? career.id;
                                            const isLocked = !isCareerUnlocked(career, {
                                                education: gameState.educations || [],
                                                achievements: gameState.achievements || [],
                                                stats: gameState.stats,
                                                weeksLived: gameState.weeksLived,
                                                companies: gameState.companies || [],
                                                realEstate: gameState.realEstate || [],
                                            });
                                            const isApplied = gameState.careers.some(c => c.id === career.id && c.applied);
                                            const isAccepted = gameState.careers.some(c => c.id === career.id && c.accepted);
                                            // Only an un-applied, unlocked card does anything on tap. Applied /
                                            // working / locked states are shown inline (badge + requirements)
                                            // instead of firing a blocking Alert on every tap.
                                            const actionable = !isLocked && !isApplied && !isAccepted;

                                            const lockReqs: string[] = [];
                                            if (isLocked) {
                                                const req = career.unlockRequirements || career.requirements;
                                                if ('education' in req && req.education) lockReqs.push(`Education: ${req.education.join(', ')}`);
                                                if ('experience' in req && req.experience) lockReqs.push(`Experience: ${req.experience} weeks`);
                                                if ('reputation' in req && req.reputation) lockReqs.push(`Reputation: ${req.reputation}+`);
                                                if ('netWorth' in req && req.netWorth) lockReqs.push(`Net Worth: $${req.netWorth.toLocaleString()}+`);
                                            }

                                            return (
                                                <TouchableOpacity
                                                    key={career.id}
                                                    style={[
                                                        styles.careerCard,
                                                        settings.darkMode && styles.careerCardDark,
                                                        isAccepted && styles.careerCardActive,
                                                    ]}
                                                    onPress={actionable ? () => {
                                                        setGameState(prev => ({
                                                            ...prev,
                                                            careers: [...prev.careers, { ...career, applied: true }],
                                                        }));
                                                        saveGame();
                                                        showSuccess(`Applied for ${displayName} — your application is under review.`);
                                                    } : undefined}
                                                    disabled={!actionable}
                                                    activeOpacity={actionable ? 0.7 : 1}
                                                >
                                                    <View style={styles.careerCardHeader}>
                                                        <View style={{ flex: 1, paddingRight: scale(8) }}>
                                                            <Text style={[styles.careerName, settings.darkMode && styles.careerNameDark]}>
                                                                {displayName}
                                                            </Text>
                                                            <Text style={[styles.careerDescription, settings.darkMode && styles.careerDescriptionDark]}>
                                                                {career.description}
                                                            </Text>
                                                        </View>
                                                        {/* Inline status — replaces the Active/Pending/Locked alerts. */}
                                                        {isAccepted ? (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: scale(8), backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
                                                                <Check size={scale(13)} color="#22C55E" />
                                                                <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#22C55E' }}>Working</Text>
                                                            </View>
                                                        ) : isApplied ? (
                                                            <View style={{ paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: scale(8), backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                                                                <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#F59E0B' }}>Applied</Text>
                                                            </View>
                                                        ) : isLocked ? (
                                                            <Lock size={scale(20)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                                                        ) : null}
                                                    </View>

                                                    {isLocked && lockReqs.length > 0 && (
                                                        <Text style={[styles.careerDescription, settings.darkMode && styles.careerDescriptionDark, { marginTop: scale(4), fontStyle: 'italic' }]}>
                                                            Requires — {lockReqs.join(' · ')}
                                                        </Text>
                                                    )}

                                                    <Text style={[styles.careerSalary, settings.darkMode && styles.careerSalaryDark]}>
                                                        ${(career.levels?.[0]?.salary ?? 0).toLocaleString()}/year
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        });
                                    })()}
                                </View>
                            )}

                            {/* Hobbies completely removed */}

                            {/* Hobbies removed - All hobby-related Modals removed */}

                            {activeTab === 'skills' && (
                                <View>
                                    <View style={styles.sectionHeader}>
                                        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Crime Skills</Text>
                                        <InfoButton
                                            title="Crime Skills"
                                            content="Crime skills improve your odds in illegal jobs. Each skill has talents you can unlock that give +5% success rate and +10% payment bonus. Level up your skills by doing illegal jobs and unlock powerful abilities!"
                                            size="small"
                                            darkMode={settings.darkMode}
                                        />
                                    </View>

                                    <View>
                                        {Object.entries(gameState.crimeSkills).map(([id, skill]) => {
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

                                    <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>
                                        Crime Jobs (Level {gameState.criminalLevel})
                                    </Text>
                                    {criminalStreetJobs.length > 0 ? (
                                        criminalStreetJobs.map(renderJobCard)
                                    ) : (
                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                            <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark]}>
                                                No underground jobs available right now — raise your criminal level or check back later.
                                            </Text>
                                            {__DEV__ && (
                                                <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark, { fontSize: 12, marginTop: 8 }]}>
                                                    [dev] total={gameState.streetJobs.length} illegal={gameState.streetJobs.filter(job => job.illegal === true).length}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {selectedSkillTree && (
                                <SkillTalentTree
                                    skillId={selectedSkillTree}
                                    visible={!!selectedSkillTree}
                                    onClose={() => setSelectedSkillTree(null)}
                                />
                            )}

                            {/* Hobbies removed - Songs, Artworks, Sponsors, and Contracts Modals removed */}

                            {/* Contracts Modal removed - hobbies no longer exist */}

                            {/* Hobbies removed - Contract Offers and League Modals removed */}
                        </ScrollView>
                    </View>
                </>
            )}

            {/* Negative Stats Popup */}
            <Modal
                visible={showNegativeStatsPopup}
                transparent
                animationType="fade"
                onRequestClose={() => setShowNegativeStatsPopup(false)}
            >
                <View style={styles.negativeStatsModalOverlay}>
                    <TouchableOpacity
                        style={styles.negativeStatsModalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowNegativeStatsPopup(false)}
                    >
                        <TouchableOpacity
                            style={styles.negativeStatsModalContainer}
                            activeOpacity={1}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <LinearGradient
                                colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
                                style={styles.negativeStatsModalContent}
                            >
                                {selectedJobForStats && (() => {
                                    const { happinessPenalty, healthPenalty } = getJobPenalties(selectedJobForStats);
                                    const isDangerous = (selectedJobForStats.jailWeeks && selectedJobForStats.jailWeeks >= 3) ||
                                        (selectedJobForStats.wantedIncrease && selectedJobForStats.wantedIncrease >= 3);

                                    return (
                                        <>
                                            <View style={styles.negativeStatsModalHeader}>
                                                <View style={styles.negativeStatsModalIconContainer}>
                                                    <AlertTriangle size={32} color="#EF4444" />
                                                </View>
                                                <View style={styles.negativeStatsModalTitleContainer}>
                                                    <Text style={[styles.negativeStatsModalTitle, settings.darkMode && styles.negativeStatsModalTitleDark]}>
                                                        Job Penalties
                                                    </Text>
                                                    <Text style={[styles.negativeStatsModalSubtitle, settings.darkMode && styles.negativeStatsModalSubtitleDark]}>
                                                        {selectedJobForStats.name}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={styles.negativeStatsModalCloseButton}
                                                    onPress={() => setShowNegativeStatsPopup(false)}
                                                >
                                                    <X size={24} color={settings.darkMode ? '#F9FAFB' : '#1F2937'} />
                                                </TouchableOpacity>
                                            </View>

                                            <View style={styles.negativeStatsModalBody}>
                                                <Text style={[styles.negativeStatsModalDescription, settings.darkMode && styles.negativeStatsModalDescriptionDark]}>
                                                    This job will have the following negative effects on your stats:
                                                </Text>

                                                <View style={styles.negativeStatsList}>
                                                    {happinessPenalty < 0 && (
                                                        <View style={styles.negativeStatItem}>
                                                            <View style={styles.negativeStatIconContainer}>
                                                                <AlertTriangle size={20} color="#EF4444" />
                                                            </View>
                                                            <View style={styles.negativeStatInfo}>
                                                                <Text style={[styles.negativeStatLabel, settings.darkMode && styles.negativeStatLabelDark]}>
                                                                    Happiness
                                                                </Text>
                                                                <Text style={styles.negativeStatValue}>
                                                                    {happinessPenalty}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}

                                                    {healthPenalty < 0 && (
                                                        <View style={styles.negativeStatItem}>
                                                            <View style={styles.negativeStatIconContainer}>
                                                                <AlertTriangle size={20} color="#EF4444" />
                                                            </View>
                                                            <View style={styles.negativeStatInfo}>
                                                                <Text style={[styles.negativeStatLabel, settings.darkMode && styles.negativeStatLabelDark]}>
                                                                    Health
                                                                </Text>
                                                                <Text style={styles.negativeStatValue}>
                                                                    {healthPenalty}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}

                                                    {selectedJobForStats.illegal && (
                                                        <View style={styles.negativeStatItem}>
                                                            <View style={[styles.negativeStatIconContainer, { backgroundColor: 'rgba(220, 38, 38, 0.2)' }]}>
                                                                <AlertTriangle size={20} color="#DC2626" />
                                                            </View>
                                                            <View style={styles.negativeStatInfo}>
                                                                <Text style={[styles.negativeStatLabel, settings.darkMode && styles.negativeStatLabelDark]}>
                                                                    Illegal Activity
                                                                </Text>
                                                                <Text style={[styles.negativeStatValue, { color: '#DC2626' }]}>
                                                                    Risk of jail time
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}

                                                    {selectedJobForStats.wantedIncrease && selectedJobForStats.wantedIncrease > 0 && (
                                                        <View style={styles.negativeStatItem}>
                                                            <View style={[styles.negativeStatIconContainer, { backgroundColor: 'rgba(220, 38, 38, 0.2)' }]}>
                                                                <AlertTriangle size={20} color="#DC2626" />
                                                            </View>
                                                            <View style={styles.negativeStatInfo}>
                                                                <Text style={[styles.negativeStatLabel, settings.darkMode && styles.negativeStatLabelDark]}>
                                                                    Wanted Level
                                                                </Text>
                                                                <Text style={[styles.negativeStatValue, { color: '#DC2626' }]}>
                                                                    +{selectedJobForStats.wantedIncrease}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}

                                                    {selectedJobForStats.jailWeeks && selectedJobForStats.jailWeeks > 0 && (
                                                        <View style={styles.negativeStatItem}>
                                                            <View style={[styles.negativeStatIconContainer, { backgroundColor: 'rgba(220, 38, 38, 0.2)' }]}>
                                                                <AlertTriangle size={20} color="#DC2626" />
                                                            </View>
                                                            <View style={styles.negativeStatInfo}>
                                                                <Text style={[styles.negativeStatLabel, settings.darkMode && styles.negativeStatLabelDark]}>
                                                                    Jail Time (if caught)
                                                                </Text>
                                                                <Text style={[styles.negativeStatValue, { color: '#DC2626' }]}>
                                                                    {selectedJobForStats.jailWeeks} week{selectedJobForStats.jailWeeks > 1 ? 's' : ''}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    )}
                                                </View>

                                                {isDangerous && (
                                                    <View style={styles.negativeStatsWarningBox}>
                                                        <AlertTriangle size={20} color="#F59E0B" />
                                                        <Text style={[styles.negativeStatsWarningText, settings.darkMode && styles.negativeStatsWarningTextDark]}>
                                                            This is a dangerous job with high risks!
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            <TouchableOpacity
                                                style={styles.negativeStatsModalCloseButtonBottom}
                                                onPress={() => setShowNegativeStatsPopup(false)}
                                            >
                                                <LinearGradient
                                                    colors={settings.darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#2563EB']}
                                                    style={styles.negativeStatsModalCloseButtonGradient}
                                                >
                                                    <Text style={styles.negativeStatsModalCloseButtonText}>Got it</Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </>
                                    );
                                })()}
                            </LinearGradient>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            </Modal>

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

        </LinearGradient>
    );
}


export default React.memo(WorkScreen);

