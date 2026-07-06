import React, { useState, useEffect } from 'react';
import { View,
    Text,
    ScrollView,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Animated } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
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
    const [selectedSkillTree, setSelectedSkillTree] = useState<CrimeSkillId | null>(null);
    const [feedbackOpacity] = useState(new Animated.Value(0));
    // P3-2: dead state — `_showJailReleaseMessage` and `_previousJailWeeks`
    // were never referenced after being renamed by an unused-var lint sweep.
    const [showQuitJobConfirm, setShowQuitJobConfirm] = useState(false);
    // Career id whose in-app "Manage Job" action sheet is open (null = closed).
    const [manageJobId, setManageJobId] = useState<string | null>(null);
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
        saveGame();
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

    // State for negative stats popup

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
            const premiumPct = Math.round(((career.raiseMultiplier ?? 1) - 1) * 100);
            buttonText = premiumPct > 0 ? `Manage Job (+${premiumPct}%)` : 'Manage Job';
            onPress = () => setManageJobId(career.id);
            buttonAccent = 'career';
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

    // Advanced careers now share the JobCard language instead of a bespoke card.
    const renderAdvancedCareerCard = (
        career: AdvancedCareer,
        state: { isLocked: boolean; isApplied: boolean; isAccepted: boolean; lockReqs: string[] },
    ): React.ReactElement => {
        const displayName = career.levels?.[0]?.name ?? career.id;
        const salary = career.levels?.[0]?.salary ?? 0;
        const { isLocked, isApplied, isAccepted, lockReqs } = state;

        const metadata: JobCardMetadata[] = [
            { icon: <Crown size={scale(13)} color="rgba(168, 85, 247, 0.95)" />, value: 'Elite career' },
        ];

        let buttonText: string;
        let onPress: (() => void) | undefined;
        let locked = false;
        let lockReason: string | undefined;

        if (isAccepted) {
            buttonText = 'Working';
            locked = true;
        } else if (isApplied) {
            buttonText = 'Applied';
            locked = true;
        } else if (isLocked) {
            buttonText = 'Locked';
            locked = true;
            lockReason = lockReqs.length > 0 ? `Requires — ${lockReqs.join(' · ')}` : undefined;
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
                saveGame();
                showSuccess(`Applied for ${displayName} — your application is under review.`);
            };
        }

        return (
            <JobCard
                key={career.id}
                accent="career"
                title={displayName}
                description={career.description}
                reward={isLocked ? '— Locked' : `$${salary.toLocaleString()}/wk`}
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
    const advancedIds = ['politician', 'celebrity', 'athlete'];
    const basicCareers = sortedCareers.filter(c => !advancedIds.includes(c.id));

    // Persistent "Current Job" summary so employment state is always visible,
    // not buried inside the Career tab.
    const currentJob = gameState.currentJob
        ? (gameState.careers || []).find(c => c.id === gameState.currentJob)
        : undefined;
    const currentJobLevel = currentJob ? (currentJob.levels?.[currentJob.level] ?? currentJob.levels?.[0]) : undefined;
    const currentJobSalary = currentJobLevel?.salary ?? 0;
    const currentJobRaisePct = currentJob ? Math.round(((currentJob.raiseMultiplier ?? 1) - 1) * 100) : 0;
    const currentJobAtMax = currentJob ? currentJob.level >= (currentJob.levels.length - 1) : false;

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
                        {currentJob && currentJobLevel && (
                            <View style={local.currentJobCard}>
                                <View style={local.currentJobTopRow}>
                                    <View style={local.currentJobIcon}>
                                        <Briefcase size={scale(16)} color="#34D399" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={local.currentJobLabel}>Current Job</Text>
                                        <Text style={local.currentJobTitle} numberOfLines={1}>{currentJobLevel.name}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={local.currentJobSalary}>${currentJobSalary.toLocaleString()}/wk</Text>
                                        {currentJobRaisePct > 0 && (
                                            <Text style={local.currentJobRaise}>+{currentJobRaisePct}% raise</Text>
                                        )}
                                    </View>
                                </View>
                                {!currentJobAtMax && (
                                    <View style={local.currentJobProgressWrap}>
                                        <View style={local.currentJobProgressLabelRow}>
                                            <Text style={local.currentJobProgressLabel}>Progress to promotion</Text>
                                            <Text style={local.currentJobProgressPct}>{currentJob.progress}%</Text>
                                        </View>
                                        <View style={local.currentJobProgressBar}>
                                            <View style={[local.currentJobProgressFill, { width: `${Math.min(100, currentJob.progress)}%` }]} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
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

                                            const lockReqs: string[] = [];
                                            if (isLocked) {
                                                const req = career.unlockRequirements || career.requirements;
                                                if ('education' in req && req.education) lockReqs.push(`Education: ${req.education.join(', ')}`);
                                                if ('experience' in req && req.experience) lockReqs.push(`Experience: ${req.experience} weeks`);
                                                if ('reputation' in req && req.reputation) lockReqs.push(`Reputation: ${req.reputation}+`);
                                                if ('netWorth' in req && req.netWorth) lockReqs.push(`Net Worth: $${req.netWorth.toLocaleString()}+`);
                                            }

                                            return renderAdvancedCareerCard(career, { isLocked, isApplied, isAccepted, lockReqs });
                                        });
                                    })()}
                                </View>
                            )}

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
                                        <View style={{ padding: scale(16), alignItems: 'center' }}>
                                            <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark]}>
                                                No underground jobs available right now — raise your criminal level or check back later.
                                            </Text>
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
                        </ScrollView>
                    </View>
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

            {/* Manage Job — in-app action sheet (replaces the native Alert). */}
            <Modal
                visible={manageJobId !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setManageJobId(null)}
            >
                <TouchableOpacity
                    style={local.sheetOverlay}
                    activeOpacity={1}
                    onPress={() => setManageJobId(null)}
                >
                    <View style={local.sheet}>
                        <View style={local.sheetHandle} />
                        <Text style={local.sheetTitle}>Your Job</Text>
                        <Text style={local.sheetSubtitle}>What would you like to do?</Text>

                        <TouchableOpacity
                            style={local.sheetAction}
                            activeOpacity={0.85}
                            onPress={() => { if (manageJobId) handleAskForRaise(manageJobId); }}
                        >
                            <TrendingUp size={scale(17)} color="#34D399" />
                            <Text style={local.sheetActionText}>Ask for a Raise</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={local.sheetAction}
                            activeOpacity={0.85}
                            onPress={() => { setManageJobId(null); setShowQuitJobConfirm(true); }}
                        >
                            <X size={scale(17)} color="#F87171" />
                            <Text style={[local.sheetActionText, { color: '#F87171' }]}>Quit Job</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={local.sheetCancel}
                            activeOpacity={0.85}
                            onPress={() => setManageJobId(null)}
                        >
                            <Text style={local.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </LinearGradient>
    );
}

const local = StyleSheet.create({
    currentJobCard: {
        marginHorizontal: scale(16),
        marginTop: scale(12),
        marginBottom: scale(4),
        padding: scale(14),
        borderRadius: scale(12),
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        gap: scale(10),
    },
    currentJobTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(11),
    },
    currentJobIcon: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(10),
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentJobLabel: {
        fontSize: fontScale(10.5),
        fontWeight: '700',
        color: 'rgba(52, 211, 153, 0.85)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    currentJobTitle: {
        fontSize: fontScale(16),
        fontWeight: '800',
        color: '#F8FAFC',
        letterSpacing: -0.3,
        marginTop: scale(1),
    },
    currentJobSalary: {
        fontSize: fontScale(15),
        fontWeight: '800',
        color: '#34D399',
        fontVariant: ['tabular-nums'],
    },
    currentJobRaise: {
        fontSize: fontScale(10.5),
        fontWeight: '700',
        color: 'rgba(52, 211, 153, 0.8)',
        marginTop: scale(1),
    },
    currentJobProgressWrap: {
        gap: scale(5),
    },
    currentJobProgressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    currentJobProgressLabel: {
        fontSize: fontScale(11),
        fontWeight: '600',
        color: 'rgba(226, 232, 240, 0.6)',
    },
    currentJobProgressPct: {
        fontSize: fontScale(11),
        fontWeight: '700',
        color: 'rgba(226, 232, 240, 0.8)',
        fontVariant: ['tabular-nums'],
    },
    currentJobProgressBar: {
        height: scale(6),
        borderRadius: scale(3),
        backgroundColor: 'rgba(148, 163, 184, 0.2)',
        overflow: 'hidden',
    },
    currentJobProgressFill: {
        height: '100%',
        borderRadius: scale(3),
        backgroundColor: '#10B981',
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

