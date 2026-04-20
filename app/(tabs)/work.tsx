import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Alert,
    Animated,
    Image,
    TextInput,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import ConfirmDialog from '@/components/ConfirmDialog';
import { useGame, Contract, CrimeSkillId, StreetJob, Career } from '@/contexts/GameContext';
import { useJobActions } from '@/contexts/game/JobActionsContext';
import { useToast } from '@/contexts/ToastContext';
import { getMindsetFeedback } from '@/utils/mindsetFeedback';
import ActionFeedbackModal from '@/components/depth/ActionFeedbackModal';
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
    responsiveFontSize,
    responsiveSpacing,
    responsiveBorderRadius,
    scale,
    fontScale,
} from '@/utils/scaling';
import { getResponsiveValue } from '@/utils/responsiveDesign';
import { useTranslation } from '@/hooks/useTranslation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { logger } from '@/utils/logger';
import { colors as themeColors } from '@/lib/config/theme';
import { CareerPathCard } from '@/components/CareerPathCard';

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


function WorkScreen() {
    return (
        <ErrorBoundary>
            <WorkScreenContent />
        </ErrorBoundary>
    );
}

function WorkScreenContent() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'street' | 'career' | 'skills'>('street');
    const [workFeedback, setWorkFeedback] = useState<{ [key: string]: string }>({});
    // Hobbies removed - unused state variables removed
    const [selectedSkillTree, setSelectedSkillTree] = useState<CrimeSkillId | null>(null);
    const [feedbackOpacity] = useState(new Animated.Value(0));
    const [showJailReleaseMessage, setShowJailReleaseMessage] = useState(false);
    const [previousJailWeeks, setPreviousJailWeeks] = useState(0);
    const [showQuitJobConfirm, setShowQuitJobConfirm] = useState(false);
    const { showSuccess, showError, showWarning, showInfo } = useToast();

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
    // Filter out any creative/hobby jobs that might exist in streetJobs
    const creativeHobbyJobIds = ['guitar', 'music', 'art', 'football', 'basketball', 'tennis'];
    const legalStreetJobs = gameState.streetJobs.filter(job => !job.illegal && !creativeHobbyJobIds.includes(job.id));
    const criminalStreetJobs = gameState.streetJobs.filter(job => job.illegal === true && !creativeHobbyJobIds.includes(job.id));

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

    const [actionFeedbackVisible, setActionFeedbackVisible] = useState(false);
    const [actionImpact, setActionImpact] = useState<any>(null);

    // Hobbies completely removed - no state variables needed

    const handleStreetJob = (jobId: string) => {
        const job = gameState.streetJobs.find(j => j.id === jobId);
        const result = performStreetJob(jobId);
        if (result) {
            // Calculate action impact for depth system
            try {
                const { calculateActionImpact } = require('@/lib/depth/systemInterconnections');
                const { updateSystemUsage } = require('@/lib/depth/discoverySystem');

                // Determine direct effects
                const directEffects: any = {
                    money: result.success ? (job?.basePayment || 0) : 0,
                    happiness: -5,
                    health: -2,
                    energy: -(job?.energyCost || 0),
                };

                // Calculate impact
                const impact = calculateActionImpact(
                    `streetJob_${jobId}`,
                    job?.name || 'Street Job',
                    directEffects,
                    gameState
                );

                // Update system usage for discovery
                updateSystemUsage('streetJobs', gameState);

                // Store impact for modal (only show for successful actions with system effects)
                if (result.success && impact && impact.systemEffects.length > 0) {
                    setActionImpact(impact);
                    // Delay modal slightly to let toast show first
                    setTimeout(() => {
                        setActionFeedbackVisible(true);
                    }, 500);
                }
            } catch (error) {
                // Depth system may not be available, continue without it
                logger.warn('Failed to calculate action impact:', error as any);
            }

            // Show toast notification
            if (result.success) {
                showSuccess(result.message);

                // Show mindset feedback if applicable
                if (job && gameState.mindset?.activeTraitId) {
                    const mindsetFeedback = getMindsetFeedback(
                        gameState,
                        job.basePayment,
                        0,
                        0
                    );
                    if (mindsetFeedback?.message) {
                        if (mindsetFeedback.type === 'bonus') {
                            showSuccess(mindsetFeedback.message);
                        } else if (mindsetFeedback.type === 'penalty') {
                            showWarning(mindsetFeedback.message);
                        } else {
                            showInfo(mindsetFeedback.message);
                        }
                    }
                }
            } else if ('inJail' in result && result.inJail) {
                showError(result.message || 'You were caught!');
            } else {
                showWarning(result.message);
            }

            setWorkFeedback({ [jobId]: result.message });
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
                gameState.items.find(item => item.id === req)?.owned
            );

        const hasDarkItems =
            !job.darkWebRequirements ||
            job.darkWebRequirements.every((req: string) => {
                // Check both darkWebItems and regular items (for compatibility)
                const darkWebItem = gameState.darkWebItems.find(item => item.id === req)?.owned;
                const regularItem = gameState.items.find(item => item.id === req)?.owned;
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
            const item = gameState.items.find(i => i.id === req);
            if (!item?.owned) missing.push(item?.name || req);
        });
        job.darkWebRequirements?.forEach((req: string) => {
            const item = gameState.darkWebItems.find(i => i.id === req);
            if (!item?.owned) missing.push(item?.name || req);
        });
        if (job.criminalLevelReq && gameState.criminalLevel < job.criminalLevelReq) {
            missing.push(`Criminal Level ${job.criminalLevelReq}`);
        }
        return missing;
    };

    const renderJobCard = (job: StreetJob) => {
        if (job.illegal) {
            return (
                <View key={job.id} style={styles.crimeJobContainer}>
                    <BlurView
                        intensity={20}
                        tint="dark"
                        style={styles.crimeJobGlass}
                    />
                    <LinearGradient
                        colors={['rgba(220, 38, 38, 0.15)', 'rgba(185, 28, 28, 0.10)']}
                        style={styles.crimeJobHeader}
                    >
                        <View style={styles.crimeJobHeaderContent}>
                            <View style={styles.crimeJobTitleRow}>
                                <View style={styles.crimeJobTitleContainer}>
                                    <Text style={styles.crimeJobName}>{job.name}</Text>
                                    <View style={styles.crimeJobBadge}>
                                        <Text style={styles.crimeJobBadgeText}>CRIMINAL</Text>
                                    </View>
                                </View>
                                <View style={styles.crimeJobRankContainer}>
                                    <Star size={14} color="#FF6B6B" />
                                    <Text style={styles.crimeJobRank}>Rank {job.rank}</Text>
                                </View>
                            </View>

                            <Text style={styles.crimeJobDescription}>
                                {job.description}
                            </Text>
                            {(() => {
                                const itemReqs = job.requirements || [];
                                const darkReqs = job.darkWebRequirements || [];
                                const hasAnyReq = (itemReqs.length + darkReqs.length + (job.criminalLevelReq ? 1 : 0)) > 0;
                                if (!hasAnyReq) return null;
                                return (
                                    <View style={styles.crimeReqChipsContainer}>
                                        {!!job.criminalLevelReq && (
                                            <View
                                                style={[
                                                    styles.reqChip,
                                                    (gameState.criminalLevel >= (job.criminalLevelReq || 0))
                                                        ? styles.reqChipOwned
                                                        : styles.reqChipMissing,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.reqChipText,
                                                        (gameState.criminalLevel >= (job.criminalLevelReq || 0))
                                                            ? styles.reqChipTextOwned
                                                            : styles.reqChipTextMissing,
                                                    ]}
                                                >
                                                    Criminal Lv {job.criminalLevelReq}+
                                                </Text>
                                            </View>
                                        )}

                                        {itemReqs.map((reqId: string) => {
                                            const item = gameState.items.find(i => i.id === reqId);
                                            const owned = !!item?.owned;
                                            return (
                                                <View key={`req-item-${reqId}`} style={[styles.reqChip, owned ? styles.reqChipOwned : styles.reqChipMissing]}>
                                                    <Text style={[styles.reqChipText, owned ? styles.reqChipTextOwned : styles.reqChipTextMissing]}>
                                                        {item?.name || reqId}
                                                    </Text>
                                                </View>
                                            );
                                        })}

                                        {darkReqs.map((reqId: string) => {
                                            const item = gameState.darkWebItems.find(i => i.id === reqId);
                                            const owned = !!item?.owned;
                                            return (
                                                <View key={`req-dark-${reqId}`} style={[styles.reqChip, owned ? styles.reqChipOwned : styles.reqChipMissing]}>
                                                    <Text style={[styles.reqChipText, owned ? styles.reqChipTextOwned : styles.reqChipTextMissing]}>
                                                        {item?.name || reqId}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                );
                            })()}
                        </View>
                    </LinearGradient>

                    <View style={styles.crimeJobStatsGrid}>
                        <View style={styles.crimeStatCard}>
                            <View style={styles.crimeStatIcon}>
                                <Zap size={16} color="#FF6B6B" />
                            </View>
                            <Text style={styles.crimeStatLabel}>Energy</Text>
                            <Text style={styles.crimeStatValue}>-{job.energyCost}</Text>
                        </View>

                        <View style={styles.crimeStatCard}>
                            <View style={styles.crimeStatIcon}>
                                <TrendingUp size={16} color="#4ADE80" />
                            </View>
                            <Text style={styles.crimeStatLabel}>Reward</Text>
                            <Text style={[styles.crimeStatValue, !canPerformJob(job) && styles.crimeStatValueDisabled]}>
                                ${Math.floor(job.basePayment * 0.7)}-${Math.floor(job.basePayment * 1.3 * (1 + (job.rank - 1) * 0.3))}
                            </Text>
                        </View>

                        {job.skill && (
                            <View style={styles.crimeStatCard}>
                                <View style={styles.crimeStatIcon}>
                                    <Star size={16} color="#FFD93D" />
                                </View>
                                <Text style={styles.crimeStatLabel}>Skill</Text>
                                <Text style={styles.crimeStatValue}>{job.skill.charAt(0).toUpperCase() + job.skill.slice(1)}</Text>
                            </View>
                        )}

                        <View style={styles.crimeStatCard}>
                            <View style={styles.crimeStatIcon}>
                                <AlertTriangle size={16} color="#FF4444" />
                            </View>
                            <Text style={styles.crimeStatLabel}>Risk</Text>
                            <Text style={styles.crimeStatValue}>{getJailRisk(job)}%</Text>
                        </View>

                        {/* Penalties - Direct display */}
                        {(() => {
                            const { happinessPenalty, healthPenalty } = getJobPenalties(job);
                            if (happinessPenalty < 0) {
                                return (
                                    <View style={styles.crimeStatCard}>
                                        <View style={styles.crimeStatIcon}>
                                            <Smile size={16} color="#F59E0B" />
                                        </View>
                                        <Text style={styles.crimeStatLabel}>Happiness</Text>
                                        <Text style={[styles.crimeStatValue, { color: '#EF4444' }]}>{happinessPenalty}</Text>
                                    </View>
                                );
                            }
                            return null;
                        })()}
                        {(() => {
                            const { happinessPenalty, healthPenalty } = getJobPenalties(job);
                            if (healthPenalty < 0) {
                                return (
                                    <View style={styles.crimeStatCard}>
                                        <View style={styles.crimeStatIcon}>
                                            <Heart size={16} color="#EF4444" />
                                        </View>
                                        <Text style={styles.crimeStatLabel}>Health</Text>
                                        <Text style={[styles.crimeStatValue, { color: '#EF4444' }]}>{healthPenalty}</Text>
                                    </View>
                                );
                            }
                            return null;
                        })()}
                    </View>

                    <View style={styles.crimeJobActionContainer}>
                        {(() => {
                            const weeklyJobs = gameState.weeklyStreetJobs || {};
                            const timesDoneThisWeek = weeklyJobs[job.id] || 0;
                            const maxPerWeek = 3;
                            const isAtLimit = timesDoneThisWeek >= maxPerWeek;
                            const isDisabled = (gameState?.stats?.energy ?? 0) < job.energyCost || gameState.jailWeeks > 0 || isAtLimit;

                            return (
                                <>
                                    {isAtLimit && (
                                        <Text style={styles.crimeJobDescription}>
                                            Done {timesDoneThisWeek}/{maxPerWeek} times this week
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        onPress={() => handleStreetJob(job.id)}
                                        disabled={isDisabled}
                                        style={styles.crimeJobButtonWrapper}
                                    >
                                        <LinearGradient
                                            colors={!isDisabled ? ['#DC2626', '#B91C1C', '#991B1B'] : ['#374151', '#374151']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.crimeJobButton}
                                        >
                                            <Text style={[styles.crimeJobButtonText, isDisabled && styles.crimeJobButtonTextDisabled]}>
                                                {isAtLimit ? `LIMIT REACHED (${timesDoneThisWeek}/${maxPerWeek})` : !isDisabled ? 'EXECUTE' : 'LOCKED'}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </>
                            );
                        })()}

                        {workFeedback[job.id] && (
                            <Animated.View style={[styles.feedbackPopup, { opacity: feedbackOpacity }]}>
                                <Text style={styles.feedbackPopupText}>{workFeedback[job.id]}</Text>
                            </Animated.View>
                        )}
                    </View>
                </View>
            );
        }

        // Regular street job card - styled like crime jobs but in blue
        return (
            <View key={job.id} style={styles.streetJobContainer}>
                <BlurView
                    intensity={20}
                    tint="dark"
                    style={styles.streetJobGlass}
                />
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.15)', 'rgba(37, 99, 235, 0.10)']}
                    style={styles.streetJobHeader}
                >
                    <View style={styles.streetJobHeaderContent}>
                        <View style={styles.streetJobTitleRow}>
                            <View style={styles.streetJobTitleContainer}>
                                <Text style={styles.streetJobName}>{job.name}</Text>
                                <View style={styles.streetJobBadge}>
                                    <Text style={styles.streetJobBadgeText}>STREET WORK</Text>
                                </View>
                            </View>
                            <View style={styles.streetJobRankContainer}>
                                <Star size={14} color="#60A5FA" />
                                <Text style={styles.streetJobRank}>Rank {job.rank}</Text>
                            </View>
                        </View>

                        <Text style={styles.streetJobDescription}>
                            {job.description}
                            {(() => {
                                const missing = getMissingRequirements(job);
                                return missing.length ? `\n\nRequires: ${missing.join(', ')}` : '';
                            })()}
                        </Text>
                    </View>
                </LinearGradient>

                <View style={styles.streetJobStatsGrid}>
                    <View style={styles.streetStatCard}>
                        <View style={styles.streetStatIcon}>
                            <Zap size={16} color="#60A5FA" />
                        </View>
                        <Text style={styles.streetStatLabel}>Energy</Text>
                        <Text style={styles.streetStatValue}>-{job.energyCost}</Text>
                    </View>

                    <View style={styles.streetStatCard}>
                        <View style={styles.streetStatIcon}>
                            <TrendingUp size={16} color="#4ADE80" />
                        </View>
                        <Text style={styles.streetStatLabel}>Reward</Text>
                        <Text style={styles.streetStatValue}>
                            ${Math.floor(job.basePayment * 0.7)}-${Math.floor(job.basePayment * 1.3 * (1 + (job.rank - 1) * 0.3))}
                        </Text>
                    </View>

                    {job.skill && (
                        <View style={styles.streetStatCard}>
                            <View style={styles.streetStatIcon}>
                                <Star size={16} color="#FFD93D" />
                            </View>
                            <Text style={styles.streetStatLabel}>Skill</Text>
                            <Text style={styles.streetStatValue}>{job.skill.charAt(0).toUpperCase() + job.skill.slice(1)}</Text>
                        </View>
                    )}

                    {job.risks && job.risks.length > 0 && (
                        <View style={styles.streetStatCard}>
                            <View style={styles.streetStatIcon}>
                                <AlertTriangle size={16} color="#F59E0B" />
                            </View>
                            <Text style={styles.streetStatLabel}>Risks</Text>
                            <Text style={styles.streetStatValue}>{job.risks.length}</Text>
                        </View>
                    )}

                    {/* Penalties - Direct display */}
                    {(() => {
                        const { happinessPenalty, healthPenalty } = getJobPenalties(job);
                        if (happinessPenalty < 0) {
                            return (
                                <View style={styles.streetStatCard}>
                                    <View style={styles.streetStatIcon}>
                                        <Smile size={16} color="#F59E0B" />
                                    </View>
                                    <Text style={styles.streetStatLabel}>Happiness</Text>
                                    <Text style={[styles.streetStatValue, { color: '#EF4444' }]}>{happinessPenalty}</Text>
                                </View>
                            );
                        }
                        return null;
                    })()}
                    {(() => {
                        const { happinessPenalty, healthPenalty } = getJobPenalties(job);
                        if (healthPenalty < 0) {
                            return (
                                <View style={styles.streetStatCard}>
                                    <View style={styles.streetStatIcon}>
                                        <Heart size={16} color="#EF4444" />
                                    </View>
                                    <Text style={styles.streetStatLabel}>Health</Text>
                                    <Text style={[styles.streetStatValue, { color: '#EF4444' }]}>{healthPenalty}</Text>
                                </View>
                            );
                        }
                        return null;
                    })()}
                </View>

                <View style={styles.streetJobActionContainer}>
                    <TouchableOpacity
                        onPress={() => handleStreetJob(job.id)}
                        disabled={(gameState?.stats?.energy ?? 0) < job.energyCost || gameState.jailWeeks > 0}
                        style={styles.streetJobButtonWrapper}
                    >
                        <LinearGradient
                            colors={(gameState?.stats?.energy ?? 0) >= job.energyCost && gameState.jailWeeks === 0
                                ? ['#2563EB', '#1D4ED8', '#1E40AF']
                                : ['#374151', '#374151']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.streetJobButton}
                        >
                            <Text style={[styles.streetJobButtonText, ((gameState?.stats?.energy ?? 0) < job.energyCost || gameState.jailWeeks > 0) && styles.streetJobButtonTextDisabled]}>
                                {(gameState?.stats?.energy ?? 0) < job.energyCost || gameState.jailWeeks > 0 ? 'LOCKED' : 'WORK'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {workFeedback[job.id] && (
                        <Animated.View style={[styles.feedbackPopup, { opacity: feedbackOpacity }]}>
                            <Text style={styles.feedbackPopupText}>{workFeedback[job.id]}</Text>
                        </Animated.View>
                    )}

                    {/* System Interconnection Indicator */}
                    {(() => {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-require-imports
                            const { getSystemInterconnections } = require('@/lib/depth/systemInterconnections');
                            const interconnections = getSystemInterconnections(gameState);
                            const relevantInterconnections = interconnections.filter(
                                (ic: any) => ic.sourceSystem === 'streetJobs' || ic.targetSystem === 'streetJobs'
                            );
                            if (relevantInterconnections.length > 0) {
                                return (
                                    <SystemInterconnectionIndicator
                                        interconnections={relevantInterconnections}
                                        compact={true}
                                        darkMode={settings.darkMode}
                                    />
                                );
                            }
                        } catch {
                            // Depth system may not be available
                        }
                        return null;
                    })()}
                </View>
            </View>
        );
    }; // <-- fix: closes renderJobCard correctly

    const canApplyForCareer = (career: Career) => {
        const meetsFitness =
            !('fitness' in career.requirements && career.requirements.fitness) ||
            (gameState?.stats?.fitness ?? 0) >= career.requirements.fitness;
        const hasItems =
            !('items' in career.requirements && career.requirements.items) ||
            career.requirements.items.every((itemId: string) =>
                gameState.items.find(item => item.id === itemId)?.owned
            );
        // Check for early career access bonus
        const { hasEarlyCareerAccess } = require('@/lib/prestige/applyUnlocks');
        const unlockedBonuses = gameState.prestige?.unlockedBonuses || [];
        const hasEarlyAccess = hasEarlyCareerAccess(unlockedBonuses);
        const hasEducation =
            hasEarlyAccess ||
            !('education' in career.requirements && career.requirements.education) ||
            (career.requirements.education && career.requirements.education.every((educationId: string) =>
                gameState.educations.find(e => e.id === educationId)?.completed
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

    const sortedCareers = [...gameState.careers].sort(
        (a, b) => a.levels[0].salary - b.levels[0].salary
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
                            contentContainerStyle={{ paddingTop: 0 }}
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
                                    {basicCareers.map(career => {
                                        const requiresEdu = !!('education' in career.requirements && career.requirements.education && career.requirements.education.length > 0);
                                        const hasEdu =
                                            !requiresEdu ||
                                            ('education' in career.requirements && career.requirements.education?.every((educationId: string) =>
                                                !!gameState.educations.find(e => e.id === educationId)?.completed
                                            )) || false;

                                        return (
                                            <View key={career.id} style={styles.careerJobContainer}>
                                                <BlurView
                                                    intensity={20}
                                                    tint="dark"
                                                    style={styles.careerGlass}
                                                />
                                                <LinearGradient
                                                    colors={['rgba(16,185,129,0.18)', 'rgba(5,150,105,0.10)']}
                                                    style={styles.careerJobHeader}
                                                >
                                                    <View style={styles.careerJobHeaderContent}>
                                                        <View style={styles.careerJobTitleRow}>
                                                            <View style={styles.careerJobTitleContainer}>
                                                                <Text style={styles.careerJobName}>{career.levels[career.level].name}</Text>
                                                                <View style={styles.careerJobBadge}>
                                                                    <Text style={styles.careerJobBadgeText}>CAREER</Text>
                                                                </View>
                                                            </View>
                                                            <View style={styles.careerJobSalaryContainer}>
                                                                {requiresEdu && !hasEdu ? (
                                                                    <View style={styles.lockedSalaryBadge}>
                                                                        <Lock size={10} color="#F59E0B" />
                                                                        <Text style={styles.lockedSalaryText}>Locked</Text>
                                                                    </View>
                                                                ) : (
                                                                    <>
                                                                        <Text style={styles.careerJobSalaryLabel}>Salary</Text>
                                                                        <Text style={styles.careerJobSalary}>${career.levels[career.level].salary}/wk</Text>
                                                                    </>
                                                                )}
                                                            </View>
                                                        </View>

                                                        <Text style={styles.careerJobDescription}>
                                                            {career.description}
                                                        </Text>
                                                    </View>
                                                </LinearGradient>

                                                <View style={styles.careerJobStatsGrid}>
                                                    {career.requirements.fitness && (
                                                        <View style={styles.careerStatCard}>
                                                            <View style={styles.careerStatIcon}>
                                                                <Trophy size={16} color={(gameState?.stats?.fitness ?? 0) >= career.requirements.fitness ? '#10B981' : '#EF4444'} />
                                                            </View>
                                                            <Text style={styles.careerStatLabel}>Fitness</Text>
                                                            <Text style={[styles.careerStatValue, { color: (gameState?.stats?.fitness ?? 0) >= career.requirements.fitness ? '#10B981' : '#EF4444' }]}>
                                                                {career.requirements.fitness}+
                                                            </Text>
                                                        </View>
                                                    )}

                                                    {requiresEdu && (
                                                        <View style={styles.careerStatCard}>
                                                            <View style={styles.careerStatIcon}>
                                                                <Briefcase size={16} color={hasEdu ? '#10B981' : '#EF4444'} />
                                                            </View>
                                                            <Text style={styles.careerStatLabel}>Education</Text>
                                                            <Text style={[styles.careerStatValue, { color: hasEdu ? '#10B981' : '#EF4444' }]}>
                                                                {hasEdu ? 'Met' : 'Need'}
                                                            </Text>
                                                        </View>
                                                    )}

                                                    <View style={styles.careerStatCard}>
                                                        <View style={styles.careerStatIcon}>
                                                            <Star size={16} color="#FFD93D" />
                                                        </View>
                                                        <Text style={styles.careerStatLabel}>Level</Text>
                                                        <Text style={styles.careerStatValue}>{career.level + 1}</Text>
                                                    </View>

                                                    {/* Penalties - Direct display */}
                                                    {(() => {
                                                        const { happinessPenalty, healthPenalty } = getCareerPenalties();
                                                        if (happinessPenalty < 0) {
                                                            return (
                                                                <View style={styles.careerStatCard}>
                                                                    <View style={styles.careerStatIcon}>
                                                                        <Smile size={16} color="#F59E0B" />
                                                                    </View>
                                                                    <Text style={styles.careerStatLabel}>Happiness</Text>
                                                                    <Text style={[styles.careerStatValue, { color: '#EF4444' }]}>{happinessPenalty}</Text>
                                                                </View>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    {(() => {
                                                        const { happinessPenalty, healthPenalty } = getCareerPenalties();
                                                        if (healthPenalty < 0) {
                                                            return (
                                                                <View style={styles.careerStatCard}>
                                                                    <View style={styles.careerStatIcon}>
                                                                        <Heart size={16} color="#EF4444" />
                                                                    </View>
                                                                    <Text style={styles.careerStatLabel}>Health</Text>
                                                                    <Text style={[styles.careerStatValue, { color: '#EF4444' }]}>{healthPenalty}</Text>
                                                                </View>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </View>

                                                {('fitness' in career.requirements && career.requirements.fitness) ||
                                                    ('items' in career.requirements && career.requirements.items) ||
                                                    ('education' in career.requirements && career.requirements.education) ? (
                                                    <View style={styles.requirements}>
                                                        <Text style={[styles.requirementsTitle, styles.requirementsTitleDark]}>
                                                            Requirements:
                                                        </Text>
                                                        {'fitness' in career.requirements && career.requirements.fitness && (
                                                            <Text
                                                                style={[
                                                                    styles.requirement,
                                                                    (gameState?.stats?.fitness ?? 0) < career.requirements.fitness &&
                                                                    styles.requirementDark,
                                                                    (gameState?.stats?.fitness ?? 0) >= career.requirements.fitness && styles.metRequirement,
                                                                ]}
                                                            >
                                                                {(gameState?.stats?.fitness ?? 0) >= career.requirements.fitness ? '✓' : '✗'}
                                                                Fitness {career.requirements.fitness}+
                                                            </Text>
                                                        )}
                                                        {'items' in career.requirements && career.requirements.items?.map((itemId: string) => {
                                                            const item = gameState.items.find(i => i.id === itemId);
                                                            const owned = item?.owned || false;
                                                            return (
                                                                <Text
                                                                    key={itemId}
                                                                    style={[
                                                                        styles.requirement,
                                                                        !owned && styles.requirementDark,
                                                                        owned && styles.metRequirement,
                                                                    ]}
                                                                >
                                                                    {owned ? '✓' : '✗'} {item?.name || itemId}
                                                                </Text>
                                                            );
                                                        })}
                                                        {'education' in career.requirements && career.requirements.education?.map((educationId: string) => {
                                                            const education = gameState.educations.find(e => e.id === educationId);
                                                            const completed = education?.completed || false;
                                                            return (
                                                                <Text
                                                                    key={educationId}
                                                                    style={[
                                                                        styles.requirement,
                                                                        !completed && styles.requirementDark,
                                                                        completed && styles.metRequirement,
                                                                    ]}
                                                                >
                                                                    {completed ? '✓' : '✗'} {education?.name || educationId}
                                                                </Text>
                                                            );
                                                        })}
                                                        {requiresEdu && !hasEdu && (
                                                            <Text style={[styles.lockedHint, styles.lockedHintDark]}>
                                                                Complete the required education to reveal salary and apply.
                                                            </Text>
                                                        )}
                                                    </View>
                                                ) : null}

                                                {/* Actions - Glass buttons */}
                                                {(() => {
                                                    const disabledApply = career.applied || !canApplyForCareer(career) || (requiresEdu && !hasEdu);
                                                    return (
                                                        <View style={styles.careerJobActionContainer}>
                                                            {gameState.currentJob === career.id ? (
                                                                <TouchableOpacity onPress={() => setShowQuitJobConfirm(true)}>
                                                                    <View style={styles.careerButtonWrapper}>
                                                                        <BlurView intensity={20} tint="dark" style={styles.careerButtonBlur} />
                                                                        <LinearGradient
                                                                            colors={['rgba(239, 68, 68, 0.6)', 'rgba(185, 28, 28, 0.35)']}
                                                                            start={{ x: 0, y: 0 }}
                                                                            end={{ x: 1, y: 1 }}
                                                                            style={[styles.careerJobButton, styles.careerJobButtonQuit] as any}
                                                                        >
                                                                            <Text style={styles.careerJobButtonText}>{t('work.quit')}</Text>
                                                                        </LinearGradient>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            ) : (
                                                                <TouchableOpacity
                                                                    onPress={() => applyForJob(career.id)}
                                                                    disabled={disabledApply}
                                                                >
                                                                    <View style={styles.careerButtonWrapper}>
                                                                        <BlurView intensity={20} tint="dark" style={styles.careerButtonBlur} />
                                                                        <LinearGradient
                                                                            colors={
                                                                                !disabledApply
                                                                                    ? ['rgba(16, 185, 129, 0.35)', 'rgba(5, 150, 105, 0.20)']
                                                                                    : ['rgba(55, 65, 81, 0.25)', 'rgba(55, 65, 81, 0.15)']
                                                                            }
                                                                            start={{ x: 0, y: 0 }}
                                                                            end={{ x: 1, y: 1 }}
                                                                            style={styles.careerJobButton}
                                                                        >
                                                                            <Text style={[styles.careerJobButtonText, disabledApply && styles.careerJobButtonTextDisabled]}>
                                                                                {career.accepted
                                                                                    ? 'Hired!'
                                                                                    : career.applied
                                                                                        ? 'Applied'
                                                                                        : requiresEdu && !hasEdu
                                                                                            ? 'Requires Education'
                                                                                            : t('work.apply')}
                                                                            </Text>
                                                                        </LinearGradient>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    );
                                                })()}

                                                {career.accepted && (
                                                    career.level === career.levels.length - 1 && career.progress === 100 ? (
                                                        <View style={styles.progressSection}>
                                                            <Text style={[styles.maxPromotionText, settings.darkMode && styles.maxPromotionTextDark]}>
                                                                Max promotion reached
                                                            </Text>
                                                        </View>
                                                    ) : career.progress >= 100 ? (
                                                        <View style={styles.progressSection}>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    const result = promoteCareer(career.id);
                                                                    if (result) {
                                                                        if (result.success) {
                                                                            showSuccess(result.message);
                                                                        } else {
                                                                            showWarning(result.message);
                                                                        }
                                                                    }
                                                                }}
                                                                style={styles.promoteButton}
                                                            >
                                                                <LinearGradient
                                                                    colors={['rgba(16, 185, 129, 0.6)', 'rgba(5, 150, 105, 0.4)']}
                                                                    start={{ x: 0, y: 0 }}
                                                                    end={{ x: 1, y: 1 }}
                                                                    style={styles.promoteButtonGradient}
                                                                >
                                                                    <TrendingUp size={16} color="#FFFFFF" />
                                                                    <Text style={styles.promoteButtonText}>Promote Now</Text>
                                                                </LinearGradient>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.progressSection}>
                                                            <View style={styles.progressInfo}>
                                                                <Text style={[styles.progressLabel, settings.darkMode && styles.progressLabelDark]}>
                                                                    Progress to Promotion
                                                                </Text>
                                                                <Text style={[styles.progressPercent, settings.darkMode && styles.progressPercentDark]}>
                                                                    {career.progress}%
                                                                </Text>
                                                            </View>
                                                            <View style={styles.progressBar}>
                                                                <View style={[styles.progressFill, { width: `${career.progress}%` }]} />
                                                            </View>
                                                        </View>
                                                    )
                                                )}
                                            </View>
                                        );
                                    })}
                                    <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>Advanced Careers</Text>
                                    {(() => {
                                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                                        const { ADVANCED_CAREERS, getUnlockedAdvancedCareers, isCareerUnlocked } = require('@/lib/careers/advancedCareers');
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

                                        return unlockedCareers.map((career: Career) => {
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

                                            return (
                                                <TouchableOpacity
                                                    key={career.id}
                                                    style={[
                                                        styles.careerCard,
                                                        settings.darkMode && styles.careerCardDark,
                                                        isAccepted && styles.careerCardActive,
                                                    ]}
                                                    onPress={() => {
                                                        if (isLocked) {
                                                            const req = (career as any).unlockRequirements || (career as any).requirements;
                                                            const requirements = [];
                                                            if ('education' in req && req.education) requirements.push(`Education: ${req.education.join(', ')}`);
                                                            if ('experience' in req && req.experience) requirements.push(`Experience: ${req.experience} weeks`);
                                                            if ('reputation' in req && req.reputation) requirements.push(`Reputation: ${req.reputation}+`);
                                                            if ('netWorth' in req && req.netWorth) requirements.push(`Net Worth: $${req.netWorth.toLocaleString()}+`);
                                                            Alert.alert('Career Locked', `Requirements:\n${requirements.join('\n')}`);
                                                        } else if (!isApplied) {
                                                            // Apply for career
                                                            setGameState(prev => ({
                                                                ...prev,
                                                                careers: [...prev.careers, { ...career, applied: true }],
                                                            }));
                                                            saveGame();
                                                            Alert.alert('Application Submitted', `You've applied for ${(career as any).name || career.id}!`);
                                                        } else if (isAccepted) {
                                                            Alert.alert('Career Active', `You're currently working as ${career.levels[career.level].name}.`);
                                                        } else {
                                                            Alert.alert('Application Pending', 'Your application is being reviewed.');
                                                        }
                                                    }}
                                                    disabled={isLocked}
                                                >
                                                    <View style={styles.careerCardHeader}>
                                                        <View>
                                                            <Text style={[styles.careerName, settings.darkMode && styles.careerNameDark]}>
                                                                {(career as any).name || career.id}
                                                            </Text>
                                                            <Text style={[styles.careerDescription, settings.darkMode && styles.careerDescriptionDark]}>
                                                                {career.description}
                                                            </Text>
                                                        </View>
                                                        {isLocked && <Lock size={scale(20)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />}
                                                        {isAccepted && <Check size={scale(20)} color="#22C55E" />}
                                                    </View>
                                                    <Text style={[styles.careerSalary, settings.darkMode && styles.careerSalaryDark]}>
                                                        ${career.levels[0].salary.toLocaleString()}/year
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

                                    <View style={styles.skillsContainer}>
                                        {Object.entries(gameState.crimeSkills).map(([id, skill]) => {
                                            const threshold = skill.level * 100;
                                            const percent = Math.min(100, (skill.xp / threshold) * 100);
                                            const label = id.charAt(0).toUpperCase() + id.slice(1);
                                            const availablePoints = Math.max(0, skill.level - 1);
                                            const spentPoints = skill.upgrades?.length || 0;
                                            const remainingPoints = availablePoints - spentPoints;

                                            // Skill-specific colors and icons
                                            const skillConfig = {
                                                stealth: {
                                                    icon: Eye,
                                                    colors: ['#0F172A', '#1E293B', '#334155'],
                                                    lightColors: ['#F1F5F9', '#E2E8F0'],
                                                },
                                                hacking: {
                                                    icon: Brain,
                                                    colors: ['#0C4A6E', '#075985', '#0369A1'],
                                                    lightColors: ['#E0F2FE', '#BAE6FD'],
                                                },
                                                lockpicking: {
                                                    icon: Target,
                                                    colors: ['#7C2D12', '#EA580C', '#F97316'],
                                                    lightColors: ['#FFF7ED', '#FFEDD5'],
                                                },
                                            };

                                            const config = skillConfig[id as CrimeSkillId];
                                            const Icon = config.icon;

                                            return (
                                                <TouchableOpacity
                                                    key={id}
                                                    onPress={() => setSelectedSkillTree(id as CrimeSkillId)}
                                                    style={styles.skillCard}
                                                    activeOpacity={0.8}
                                                >
                                                    <LinearGradient
                                                        colors={settings.darkMode ? config.colors : config.lightColors}
                                                        style={styles.skillCardGradient}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 1 }}
                                                    >
                                                        {/* Icon Container */}
                                                        <View style={[
                                                            styles.skillIconContainer,
                                                            settings.darkMode && styles.skillIconContainerDark,
                                                        ]}>
                                                            <Icon size={32} color={settings.darkMode ? '#FFFFFF' : config.colors[1]} />
                                                            {skill.level >= 5 && (
                                                                <View style={styles.skillCrownBadge}>
                                                                    <Crown size={14} color="#FBBF24" />
                                                                </View>
                                                            )}
                                                        </View>

                                                        {/* Skill Info */}
                                                        <View style={styles.skillInfo}>
                                                            <Text style={[styles.skillName, settings.darkMode && styles.skillNameDark]}>
                                                                {label}
                                                            </Text>

                                                            <View style={styles.skillLevelRow}>
                                                                <View style={styles.skillLevelBadge}>
                                                                    <Star size={12} color="#F59E0B" />
                                                                    <Text style={[styles.skillLevelText, settings.darkMode && styles.skillLevelTextDark]}>
                                                                        Level {skill.level}
                                                                    </Text>
                                                                </View>

                                                                {remainingPoints > 0 && (
                                                                    <View style={styles.talentPointsBadge}>
                                                                        <Sparkles size={12} color="#3B82F6" />
                                                                        <Text style={[styles.talentPointsText, settings.darkMode && styles.talentPointsTextDark]}>
                                                                            {remainingPoints} pts
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </View>

                                                            {/* Progress Bar */}
                                                            <View style={styles.skillProgressWrapper}>
                                                                <View style={[
                                                                    styles.skillProgressBarBg,
                                                                    settings.darkMode && styles.skillProgressBarBgDark,
                                                                ]}>
                                                                    <LinearGradient
                                                                        colors={config.colors}
                                                                        style={[styles.skillProgressBarFill, { width: `${percent}%` }] as any}
                                                                        start={{ x: 0, y: 0 }}
                                                                        end={{ x: 1, y: 0 }}
                                                                    />
                                                                </View>
                                                                <Text style={[styles.skillProgressText, settings.darkMode && styles.skillProgressTextDark]}>
                                                                    {skill.xp} / {threshold} XP
                                                                </Text>
                                                            </View>

                                                            {/* Unlocked Talents Count */}
                                                            {spentPoints > 0 && (
                                                                <View style={styles.unlockedTalentsBadge}>
                                                                    <Check size={12} color="#10B981" />
                                                                    <Text style={[styles.unlockedTalentsText, settings.darkMode && styles.unlockedTalentsTextDark]}>
                                                                        {spentPoints} talent{spentPoints > 1 ? 's' : ''} unlocked
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    </LinearGradient>
                                                </TouchableOpacity>
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
                                                No crime jobs available at this time.
                                            </Text>
                                            <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark, { fontSize: 12, marginTop: 8 }]}>
                                                Total jobs: {gameState.streetJobs.length}
                                            </Text>
                                            <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark, { fontSize: 12 }]}>
                                                Jobs with illegal=true: {gameState.streetJobs.filter(job => job.illegal === true).length}
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

            {/* Action Feedback Modal */}
            <ActionFeedbackModal
                visible={actionFeedbackVisible}
                actionImpact={actionImpact}
                darkMode={settings.darkMode}
                onClose={() => {
                    setActionFeedbackVisible(false);
                    setActionImpact(null);
                }}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    backgroundDark: {
        backgroundColor: '#0F172A',
    },
    container: {
        flex: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        margin: responsiveSpacing.lg,
        borderRadius: responsiveBorderRadius.lg,
        padding: responsiveSpacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    tabContainerDark: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    tab: {
        flex: 1,
        paddingVertical: responsiveSpacing.sm,
        alignItems: 'center',
        borderRadius: responsiveBorderRadius.md,
        backgroundColor: 'transparent',
    },
    activeTab: {
        backgroundColor: '#3B82F6',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    tabText: {
        fontSize: responsiveFontSize.sm,
        fontWeight: '600',
        color: '#64748B',
        letterSpacing: 0.3,
    },
    activeTabText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    tabTextDark: {
        color: '#D1D5DB',
        fontWeight: '500',
    },
    content: {
        flex: 1,
        paddingHorizontal: responsiveSpacing.lg,
        paddingTop: responsiveSpacing.sm,
        paddingBottom: responsiveSpacing.lg,
    },
    sectionDescription: {
        fontSize: responsiveFontSize.base,
        color: '#64748B',
        marginBottom: responsiveSpacing.xl,
        lineHeight: 24,
        fontWeight: '500',
    },
    sectionDescriptionDark: {
        color: '#D1D5DB',
        fontWeight: '400',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    sectionTitleDark: {
        color: '#F9FAFB',
    },
    subheader: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 8,
        color: '#1F2937',
    },
    subheaderDark: {
        color: '#F3F4F6',
    },
    comingSoonText: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 10,
    },
    comingSoonTextDark: {
        color: '#D1D5DB',
    },
    lockedCareerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(107, 114, 128, 0.15)',
        borderRadius: 12,
        marginBottom: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(107, 114, 128, 0.3)',
    },
    lockedCareerText: {
        flex: 1,
        fontSize: fontScale(14),
        color: '#6B7280',
        lineHeight: fontScale(20),
    },
    lockedCareerTextDark: {
        color: '#9CA3AF',
    },
    careerCard: {
        padding: responsiveSpacing.lg,
        backgroundColor: '#FFFFFF',
        borderRadius: responsiveBorderRadius.xl,
        marginBottom: responsiveSpacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        // Beautiful light mode shadows
        shadowColor: 'rgba(0,0,0,0.06)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },
    careerCardDark: {
        backgroundColor: '#1F2937',
        borderColor: '#374151',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 1,
    },
    careerCardActive: {
        borderColor: '#22C55E',
        borderWidth: 2,
        shadowColor: 'rgba(34, 197, 94, 0.2)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 4,
    },
    careerCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: scale(8),
    },
    careerName: {
        fontSize: responsiveFontSize.xl,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: responsiveSpacing.xs,
        letterSpacing: -0.5,
        // Light mode: subtle text shadow for emphasis
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    careerNameDark: {
        color: '#F9FAFB',
        textShadowColor: 'transparent',
        fontWeight: '700',
    },
    careerDescription: {
        fontSize: responsiveFontSize.sm,
        color: '#64748B',
        lineHeight: responsiveFontSize.lg,
        fontWeight: '500',
    },
    careerDescriptionDark: {
        color: '#9CA3AF',
        fontWeight: '400',
    },
    careerSalary: {
        fontSize: fontScale(16),
        fontWeight: '600',
        color: '#22C55E',
    },
    careerSalaryDark: {
        color: '#4ADE80',
    },
    jobCard: {
        padding: getResponsiveValue(12, 16, 20, 24),
        borderRadius: getResponsiveValue(8, 12, 16, 20),
        marginBottom: getResponsiveValue(12, 16, 20, 24),
        boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    // Street job styles (blue theme) - Compressed
    streetJobContainer: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    streetJobGlass: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 12,
    },
    streetJobHeader: {
        padding: 10,
        borderRadius: 12,
    },
    streetJobHeaderContent: {
        gap: 4,
    },
    streetJobTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    streetJobTitleContainer: {
        flex: 1,
        gap: 2,
    },
    streetJobName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    streetJobBadge: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        alignSelf: 'flex-start',
    },
    streetJobBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    streetJobRankContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#2563EB',
    },
    streetJobRank: {
        fontSize: 10,
        fontWeight: '600',
        color: '#60A5FA',
    },
    streetJobDescription: {
        fontSize: 10,
        color: '#B0B0B0',
        lineHeight: 14,
        fontWeight: '400',
    },
    streetJobStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        padding: 6,
        gap: 3,
    },
    streetStatCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 4,
        padding: 4,
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    streetStatCardDark: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    streetStatIcon: {
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 1,
    },
    streetStatLabel: {
        fontSize: 9,
        color: '#9CA3AF',
        fontWeight: '600',
        marginBottom: 1,
    },
    streetStatValue: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    streetJobActionContainer: {
        backgroundColor: '#0A1628',
        padding: 8,
        alignItems: 'center',
    },
    streetJobButtonWrapper: {
        width: '100%',
    },
    streetJobButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
        boxShadow: '0px 2px 4px rgba(37, 99, 235, 0.4)',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    streetJobButtonText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    streetJobButtonTextDisabled: {
        opacity: 0.5,
    },
    // Career job styles (green theme) - Compressed
    careerJobContainer: {
        marginBottom: 10,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        borderWidth: 0.5,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        shadowColor: 'rgba(16, 185, 129, 0.15)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 2,
    },
    careerGlass: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 12,
    },
    careerJobHeader: {
        padding: 10,
    },
    careerJobHeaderContent: {
        gap: 4,
    },
    careerJobTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    careerJobTitleContainer: {
        flex: 1,
        gap: 2,
    },
    careerJobName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    careerJobBadge: {
        backgroundColor: '#059669',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        alignSelf: 'flex-start',
    },
    careerJobBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    careerJobSalaryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    lockedSalaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    lockedSalaryText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#F59E0B',
    },
    careerJobSalaryLabel: {
        fontSize: 10,
        color: '#A7F3D0',
        fontWeight: '600',
    },
    careerJobSalary: {
        fontSize: 12,
        fontWeight: '800',
        color: '#34D399',
    },
    careerJobDescription: {
        fontSize: 10,
        color: '#D1FAE5',
        lineHeight: 14,
        fontWeight: '400',
    },
    careerJobStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: 'rgba(4, 120, 87, 0.08)',
        padding: 6,
        gap: 3,
    },
    careerStatCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 4,
        padding: 4,
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    careerStatIcon: {
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 1,
    },
    careerStatLabel: {
        fontSize: 9,
        color: '#CFFAFE',
        fontWeight: '600',
        marginBottom: 1,
    },
    careerStatValue: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    careerJobActionContainer: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        padding: 12,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(16, 185, 129, 0.2)',
    },
    careerButtonWrapper: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
    careerButtonBlur: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    careerJobButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    careerQuitButton: {
        backgroundColor: '#EF4444',
    },
    careerJobButtonDisabled: {
        backgroundColor: '#6EE7B7',
        opacity: 0.6,
    },
    careerJobButtonText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    careerJobButtonTextDisabled: {
        opacity: 0.6,
    },
    careerJobButtonQuit: {
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.8)',
    },
    // Requirement chips (shared)
    crimeReqChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    reqChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    reqChipOwned: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10B981',
    },
    reqChipMissing: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#EF4444',
    },
    reqChipText: {
        fontSize: 10,
        fontWeight: '700',
    },
    reqChipTextOwned: {
        color: '#10B981',
    },
    reqChipTextMissing: {
        color: '#EF4444',
    },
    // Crime styles - Compressed
    crimeJobContainer: {
        marginBottom: 10,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        borderWidth: 0.5,
        borderColor: 'rgba(220, 38, 38, 0.2)',
        shadowColor: 'rgba(220, 38, 38, 0.15)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 2,
    },
    crimeJobGlass: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 12,
    },
    crimeJobHeader: {
        padding: 10,
        borderRadius: 12,
    },
    crimeJobHeaderContent: {
        gap: 4,
    },
    crimeJobTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    crimeJobTitleContainer: {
        flex: 1,
        gap: 2,
    },
    crimeJobName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    crimeJobBadge: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        alignSelf: 'flex-start',
    },
    crimeJobBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    crimeJobRankContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(220, 38, 38, 0.2)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    crimeJobRank: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FF6B6B',
    },
    crimeJobDescription: {
        fontSize: 10,
        color: '#B0B0B0',
        lineHeight: 14,
        fontWeight: '400',
    },
    crimeJobStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: 'rgba(220, 38, 38, 0.05)',
        padding: 6,
        gap: 3,
    },
    crimeStatCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        borderRadius: 4,
        padding: 4,
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(220, 38, 38, 0.2)',
    },
    crimeStatIcon: {
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 1,
    },
    crimeStatLabel: {
        fontSize: 9,
        color: '#888888',
        fontWeight: '600',
        marginBottom: 1,
    },
    crimeStatValue: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    crimeStatValueDisabled: {
        opacity: 0.3,
    },
    crimeJobActionContainer: {
        backgroundColor: 'rgba(220, 38, 38, 0.05)',
        padding: 6,
        alignItems: 'center',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(220, 38, 38, 0.15)',
    },
    crimeJobButtonWrapper: {
        width: '100%',
    },
    crimeJobButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
        boxShadow: '0px 2px 4px rgba(220, 38, 38, 0.4)',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    crimeJobButtonText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    crimeJobButtonTextDisabled: {
        opacity: 0.5,
    },
    jailBox: {
        alignItems: 'center',
        padding: 20,
    },
    bailButtonWrapper: {
        marginTop: 12,
    },
    jobHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: responsiveSpacing.sm,
    },
    jobInfo: {
        flex: 1,
    },
    jobName: {
        fontSize: getResponsiveValue(14, 16, 18, 20),
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: getResponsiveValue(4, 6, 8, 10),
    },
    jobNameDark: {
        color: '#F9FAFB',
    },
    rankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: responsiveSpacing.sm,
        paddingVertical: scale(2),
        borderRadius: responsiveBorderRadius.md,
        alignSelf: 'flex-start',
    },
    rankText: {
        fontSize: responsiveFontSize.sm,
        color: '#92400E',
        marginLeft: responsiveSpacing.xs,
        fontWeight: '500',
    },
    salary: {
        fontSize: responsiveFontSize.lg,
        fontWeight: '600',
        color: '#10B981',
    },
    salaryHidden: {
        fontSize: responsiveFontSize.sm,
        color: '#6B7280',
        marginLeft: scale(6),
    },
    salaryHiddenDark: {
        color: '#E5E7EB',
    },
    workButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    teamSelectContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    workButtonContainer: {
        alignItems: 'flex-end',
        minWidth: 80,
        position: 'relative',
    },
    feedbackPopup: {
        position: 'absolute',
        right: 0,
        bottom: '100%',
        marginBottom: 8,
        backgroundColor: '#3B82F6',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        zIndex: 1,
    },
    feedbackPopupText: {
        color: '#FFFFFF',
        fontSize: 10,
    },
    appliedButton: {
        backgroundColor: '#F59E0B',
    },
    acceptedButton: {
        backgroundColor: '#10B981',
    },
    quitButton: {
        backgroundColor: '#EF4444',
    },
    disabledButton: {
        backgroundColor: '#E5E7EB',
    },
    workButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    appliedButtonText: {
        color: '#FFFFFF',
    },
    acceptedButtonText: {
        color: '#FFFFFF',
    },
    quitButtonText: {
        color: '#FFFFFF',
    },
    disabledButtonText: {
        color: '#9CA3AF',
    },
    jobDescription: {
        fontSize: responsiveFontSize.sm,
        color: '#6B7280',
        marginBottom: responsiveSpacing.sm,
        lineHeight: 16,
    },
    jobDescriptionDark: {
        color: '#D1D5DB',
    },
    perks: {
        marginBottom: 15,
    },
    perk: {
        fontSize: 13,
        color: '#1F2937',
        marginBottom: 2,
    },
    perkDark: {
        color: '#F3F4F6',
    },
    jobStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: responsiveSpacing.sm,
        gap: getResponsiveValue(8, 10, 12, 14),
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    statText: {
        fontSize: 14,
        color: '#374151',
        marginLeft: 4,
    },
    statTextDark: {
        color: '#D1D5DB',
    },
    negativeStatsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: getResponsiveValue(8, 10, 12, 14),
        paddingVertical: getResponsiveValue(8, 10, 12, 14),
        paddingHorizontal: getResponsiveValue(12, 14, 16, 18),
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: getResponsiveValue(8, 10, 12, 14),
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        alignSelf: 'flex-start',
    },
    negativeStatsButtonCircle: {
        width: getResponsiveValue(32, 36, 40, 44),
        height: getResponsiveValue(32, 36, 40, 44),
        borderRadius: getResponsiveValue(16, 18, 20, 22),
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: getResponsiveValue(8, 10, 12, 14),
    },
    negativeStatsButtonText: {
        fontSize: getResponsiveValue(12, 14, 16, 18),
        fontWeight: '600',
        color: '#EF4444',
    },
    negativeStatsButtonTextDark: {
        color: '#F87171',
    },
    negativeStatsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    negativeStatsModalContainer: {
        width: '90%',
        maxWidth: 500,
        borderRadius: getResponsiveValue(16, 20, 24, 28),
        overflow: 'hidden',
    },
    negativeStatsModalContent: {
        padding: getResponsiveValue(20, 24, 28, 32),
    },
    negativeStatsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: getResponsiveValue(20, 24, 28, 32),
    },
    negativeStatsModalIconContainer: {
        width: getResponsiveValue(48, 56, 64, 72),
        height: getResponsiveValue(48, 56, 64, 72),
        borderRadius: getResponsiveValue(24, 28, 32, 36),
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: getResponsiveValue(12, 14, 16, 18),
    },
    negativeStatsModalTitleContainer: {
        flex: 1,
    },
    negativeStatsModalTitle: {
        fontSize: getResponsiveValue(20, 24, 28, 32),
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: getResponsiveValue(4, 6, 8, 10),
    },
    negativeStatsModalTitleDark: {
        color: '#F9FAFB',
    },
    negativeStatsModalSubtitle: {
        fontSize: getResponsiveValue(14, 16, 18, 20),
        fontWeight: '500',
        color: '#6B7280',
    },
    negativeStatsModalSubtitleDark: {
        color: '#9CA3AF',
    },
    negativeStatsModalCloseButton: {
        width: getResponsiveValue(32, 36, 40, 44),
        height: getResponsiveValue(32, 36, 40, 44),
        borderRadius: getResponsiveValue(16, 18, 20, 22),
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    negativeStatsModalBody: {
        marginBottom: getResponsiveValue(20, 24, 28, 32),
    },
    negativeStatsModalDescription: {
        fontSize: getResponsiveValue(14, 16, 18, 20),
        color: '#6B7280',
        marginBottom: getResponsiveValue(16, 20, 24, 28),
        lineHeight: getResponsiveValue(20, 24, 28, 32),
    },
    negativeStatsModalDescriptionDark: {
        color: '#9CA3AF',
    },
    negativeStatsList: {
        gap: getResponsiveValue(12, 14, 16, 18),
    },
    negativeStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: getResponsiveValue(12, 14, 16, 18),
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: getResponsiveValue(8, 10, 12, 14),
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    negativeStatIconContainer: {
        width: getResponsiveValue(36, 40, 44, 48),
        height: getResponsiveValue(36, 40, 44, 48),
        borderRadius: getResponsiveValue(18, 20, 22, 24),
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: getResponsiveValue(12, 14, 16, 18),
    },
    negativeStatInfo: {
        flex: 1,
    },
    negativeStatLabel: {
        fontSize: getResponsiveValue(14, 16, 18, 20),
        fontWeight: '600',
        color: '#374151',
        marginBottom: getResponsiveValue(4, 6, 8, 10),
    },
    negativeStatLabelDark: {
        color: '#D1D5DB',
    },
    negativeStatValue: {
        fontSize: getResponsiveValue(16, 18, 20, 22),
        fontWeight: '700',
        color: '#EF4444',
    },
    negativeStatsWarningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: getResponsiveValue(12, 14, 16, 18),
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: getResponsiveValue(8, 10, 12, 14),
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        marginTop: getResponsiveValue(12, 14, 16, 18),
        gap: getResponsiveValue(8, 10, 12, 14),
    },
    negativeStatsWarningText: {
        flex: 1,
        fontSize: getResponsiveValue(14, 16, 18, 20),
        fontWeight: '600',
        color: '#92400E',
    },
    negativeStatsWarningTextDark: {
        color: '#FCD34D',
    },
    negativeStatsModalCloseButtonBottom: {
        marginTop: getResponsiveValue(8, 10, 12, 14),
    },
    negativeStatsModalCloseButtonGradient: {
        paddingVertical: getResponsiveValue(14, 16, 18, 20),
        paddingHorizontal: getResponsiveValue(24, 28, 32, 36),
        borderRadius: getResponsiveValue(10, 12, 14, 16),
        alignItems: 'center',
    },
    negativeStatsModalCloseButtonText: {
        fontSize: getResponsiveValue(16, 18, 20, 22),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    requirements: {
        marginBottom: responsiveSpacing.sm,
    },
    requirementsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 5,
    },
    requirementsTitleDark: {
        color: '#D1D5DB',
    },
    requirement: {
        fontSize: 12,
        color: '#EF4444',
        marginBottom: 2,
    },
    metRequirement: {
        color: '#10B981',
    },
    requirementDark: {
        color: '#F87171',
    },
    lockedSalaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lockedHint: {
        marginTop: 6,
        color: '#6B7280',
        fontSize: 12,
    },
    lockedHintDark: {
        color: '#E5E7EB',
    },
    listButton: {
        backgroundColor: '#E0E7FF',
        padding: 6,
        borderRadius: 12,
        marginLeft: 8,
    },
    listButtonDark: {
        backgroundColor: '#1E40AF',
    },
    iconRow: {
        flexDirection: 'row',
    },
    lockedText: {
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 8,
    },
    lockedCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 2,
    },
    lockedCardDark: {
        backgroundColor: '#7F1D1D',
        borderColor: '#F87171',
    },
    contractPaper: {
        backgroundColor: '#FEFCE8',
        padding: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    contractTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        fontStyle: 'italic',
        color: '#1F2937',
    },
    contractLine: {
        fontSize: 14,
        marginBottom: 6,
        fontStyle: 'italic',
        color: '#374151',
    },
    signButton: {
        backgroundColor: '#10B981',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginTop: 10,
    },
    signButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    offerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    divisionTabs: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    divisionTab: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginRight: 6,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
    },
    activeDivisionTab: {
        backgroundColor: '#3B82F6',
    },
    divisionTabText: {
        fontSize: 12,
        color: '#1F2937',
    },
    activeDivisionTabText: {
        color: '#F9FAFB',
    },
    highlightedTeam: {
        color: '#3B82F6',
        fontWeight: '700',
    },
    upgradesSection: {
        marginTop: 12,
    },
    upgradeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: 'rgba(107, 114, 128, 0.15)',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(107, 114, 128, 0.3)',
    },
    upgradeRowDark: {
        backgroundColor: '#1F2937',
    },
    upgradeInfo: {
        flex: 1,
        paddingRight: 8,
    },
    upgradeName: {
        color: '#1F2937',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'System',
    },
    upgradeNameDark: {
        color: '#F9FAFB',
    },
    upgradeDesc: {
        color: '#4B5563',
        fontSize: 14,
        fontFamily: 'System',
    },
    upgradeDescDark: {
        color: '#D1D5DB',
    },
    upgradeButton: {
        backgroundColor: '#6366F1',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    upgradeButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
        fontFamily: 'System',
    },
    progressContainer: {
        marginTop: scale(4),
    },
    progressBarBg: {
        height: scale(4),
        backgroundColor: '#E5E7EB',
        borderRadius: scale(2),
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: scale(2),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        width: '85%',
        maxHeight: '80%',
    },
    modalContentDark: {
        backgroundColor: '#1F2937',
    },
    modalList: {
        maxHeight: 200,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#111827',
    },
    modalTitleDark: {
        color: '#F9FAFB',
    },
    modalItem: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    modalItemDark: {
        color: '#D1D5DB',
    },
    modalCloseButton: {
        marginTop: 12,
        alignSelf: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalCloseText: {
        color: '#FFFFFF',
        fontWeight: '600',
        marginLeft: 4,
    },
    modalCloseIcon: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1,
    },
    skillScroll: {
        maxHeight: '70%',
        marginTop: 10,
    },
    skillTreeSection: {
        marginBottom: 16,
    },
    skillTreeSkill: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1F2937',
    },
    skillTreeSkillDark: {
        color: '#F3F4F6',
    },
    skillUpgradeButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    skillUpgradeText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    skillLevelTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSpacing.xs,
    },
    skillLevelLabel: {
        fontWeight: '600',
        marginBottom: 4,
        color: '#1F2937',
    },
    skillLevelLabelDark: {
        color: '#F3F4F6',
    },
    skillLevelConnector: {
        width: 2,
        height: 20,
        backgroundColor: '#9CA3AF',
        alignSelf: 'center',
    },
    skillTreeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    progressSection: {
        marginTop: 10,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: scale(3),
    },
    progressLabel: {
        fontSize: responsiveFontSize.sm,
        color: '#6B7280',
    },
    progressLabelDark: {
        color: '#9CA3AF',
    },
    progressPercent: {
        fontSize: responsiveFontSize.sm,
        fontWeight: '600',
        color: '#3B82F6',
    },
    progressPercentDark: {
        color: '#93C5FD',
    },
    progressBar: {
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 2,
    },
    maxPromotionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#16A34A',
        textAlign: 'center',
    },
    maxPromotionTextDark: {
        color: '#4ADE80',
    },
    promoteButton: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 8,
    },
    promoteButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    promoteButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    scrollContainer: {
        position: 'absolute',
        right: 10,
        top: 20,
        bottom: 20,
        width: 4,
        zIndex: 1,
    },
    scrollIndicator: {
        flex: 1,
        justifyContent: 'center',
    },
    scrollBar: {
        width: 4,
        height: 40,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
    },
    scrollThumb: {
        width: 4,
        height: 20,
        backgroundColor: '#9CA3AF',
        borderRadius: 2,
    },
    bailSection: {
        marginBottom: 20,
    },
    skillTreeContainer: {
        marginBottom: 24,
    },
    currentUpgrade: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        padding: responsiveSpacing.md,
        borderRadius: responsiveBorderRadius.sm,
        marginBottom: responsiveSpacing.md,
        borderLeftWidth: 2,
        borderLeftColor: '#10B981',
    },
    upgradeTitle: {
        fontSize: responsiveFontSize.base,
        fontWeight: '600',
        color: '#10B981',
        marginBottom: responsiveSpacing.xs,
    },
    upgradeTitleDark: {
        color: '#34D399',
    },
    upgradeEffect: {
        fontSize: responsiveFontSize.sm,
        color: '#059669',
    },
    upgradeEffectDark: {
        color: '#10B981',
    },
    upgradesContainer: {
        marginTop: 12,
    },
    upgradeCard: {
        marginBottom: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
    upgradeGradient: {
        padding: 12,
    },
    upgradeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    upgradeLevel: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    upgradeCost: {
        marginTop: 6,
    },
    costText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    unlockedUpgrade: {
        opacity: 0.7,
    },
    availableUpgrade: {
        boxShadow: '0px 2px 4px rgba(59, 130, 246, 0.3)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    lockedUpgrade: {
        opacity: 0.5,
    },
    unlockedText: {
        color: '#FFFFFF',
    },
    skillTreeButton: {
        backgroundColor: '#3B82F6',
        padding: responsiveSpacing.md,
        borderRadius: responsiveBorderRadius.sm,
        alignItems: 'center',
        marginTop: responsiveSpacing.md,
    },
    skillTreeButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: responsiveFontSize.base,
    },
    skillsContainer: {
        gap: responsiveSpacing.md,
        marginBottom: responsiveSpacing.lg,
    },
    skillCard: {
        borderRadius: responsiveBorderRadius.lg,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    skillCardGradient: {
        padding: responsiveSpacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: responsiveSpacing.md,
    },
    skillIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    skillIconContainerDark: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    skillCrownBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#F59E0B',
    },
    skillInfo: {
        flex: 1,
    },
    skillName: {
        fontSize: responsiveFontSize.lg,
        fontWeight: '700',
        color: '#111827',
        marginBottom: responsiveSpacing.xs,
    },
    skillNameDark: {
        color: '#F9FAFB',
    },
    skillLevelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: responsiveSpacing.sm,
        marginBottom: responsiveSpacing.sm,
    },
    skillLevelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    skillLevelText: {
        fontSize: responsiveFontSize.sm,
        fontWeight: '600',
        color: '#92400E',
    },
    skillLevelTextDark: {
        color: '#FBBF24',
    },
    talentPointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    talentPointsText: {
        fontSize: responsiveFontSize.sm,
        fontWeight: '600',
        color: '#1E40AF',
    },
    talentPointsTextDark: {
        color: '#60A5FA',
    },
    skillProgressWrapper: {
        marginBottom: responsiveSpacing.xs,
    },
    skillProgressBarBg: {
        height: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    skillProgressBarBgDark: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    skillProgressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    skillProgressText: {
        fontSize: responsiveFontSize.xs,
        color: '#6B7280',
        fontWeight: '500',
    },
    skillProgressTextDark: {
        color: '#9CA3AF',
    },
    unlockedTalentsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4,
    },
    unlockedTalentsText: {
        fontSize: responsiveFontSize.xs,
        fontWeight: '600',
        color: '#065F46',
    },
    unlockedTalentsTextDark: {
        color: '#10B981',
    },

    // Liquid Glass Hobby Styles - Compact Design
    liquidGlassHeader: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    headerGlass: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(20px)',
    },
    liquidGlassTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'center',
    },
    liquidGlassSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 18,
        textAlign: 'center',
    },
    hobbiesContainer: {
        gap: 8,
    },
    liquidGlassCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(20px)',
    },
    cardGlass: {
        padding: 12,
        borderRadius: 12,
    },
    lockedGlassCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(107, 114, 128, 0.3)',
        backdropFilter: 'blur(20px)',
    },
    lockedGlass: {
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    lockedHobbyName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    hobbyInfo: {
        flex: 1,
        alignItems: 'center',
    },
    hobbyName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
        textAlign: 'center',
    },
    levelBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        alignSelf: 'center',
    },
    levelText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#60A5FA',
        textAlign: 'center',
    },
    hobbyActionButtons: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'flex-end',
        marginTop: 4,
        marginBottom: 4,
        alignItems: 'center',
    },
    hobbyActionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    hobbyActionButtonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    hobbyImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    topActionButtons: {
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
    },
    compactButton: {
        borderRadius: 6,
        overflow: 'hidden',
        minWidth: 60,
        minHeight: 28,
    },
    compactButtonGradient: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 28,
    },
    compactButtonText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
    },
    glassButton: {
        borderRadius: 8,
        overflow: 'hidden',
        width: 90,
        minHeight: 36,
    },
    disabledGlassButton: {
        opacity: 0.5,
    },
    buttonGradient: {
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)',
        minHeight: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glassButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    disabledGlassButtonText: {
        color: 'rgba(255,255,255,0.5)',
    },
    glassDescription: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    statCard: {
        flex: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    statGlass: {
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)',
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
        marginBottom: 2,
        textAlign: 'center',
    },
    statValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    glassProgressBar: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
    },
    glassProgressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    upgradesTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    // New Full-Width Upgrade Buttons
    upgradeButtonFull: {
        marginBottom: 6,
        borderRadius: 8,
        overflow: 'hidden',
    },
    disabledUpgradeButtonFull: {
        opacity: 0.5,
    },
    upgradeButtonFullGradient: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)',
    },
    upgradeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    upgradeButtonInfo: {
        flex: 1,
        marginRight: 8,
    },
    upgradeButtonName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    upgradeButtonDesc: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 12,
    },
    upgradeButtonCost: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    disabledUpgradeButtonText: {
        color: 'rgba(255,255,255,0.5)',
    },
    feedbackBubble: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        padding: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        marginTop: 6,
    },
    feedbackText: {
        fontSize: 11,
        color: '#10B981',
        textAlign: 'center',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },

    // Income Modal Styles - Liquid Glass Design
    incomeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 15,
    },
    incomeModalContainer: {
        width: '92%',
        height: '80%',
        maxWidth: 450,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.4)',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    incomeModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 24,
        minHeight: 400,
    },
    incomeModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    incomeModalIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    incomeModalHobbyImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    incomeModalIconGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
    },
    incomeModalTitleContainer: {
        flex: 1,
    },
    incomeModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    incomeModalSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    incomeModalCloseButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    incomeModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    incomeModalTotalContainer: {
        marginBottom: 25,
        borderRadius: 18,
        overflow: 'hidden',
    },
    incomeModalTotalGlass: {
        padding: 25,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
    },
    incomeModalTotalLabel: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 10,
        textAlign: 'center',
    },
    incomeModalTotalAmount: {
        fontSize: 36,
        fontWeight: '900',
        color: '#10B981',
        textAlign: 'center',
    },
    incomeModalItemsContainer: {
        flex: 1,
        marginBottom: 20,
        maxHeight: 300,
    },
    incomeModalItem: {
        marginBottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
    },
    incomeModalItemGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    incomeModalItemInfo: {
        flex: 1,
    },
    incomeModalItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 5,
    },
    incomeModalItemGrade: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    incomeModalItemAmountContainer: {
        alignItems: 'flex-end',
    },
    incomeModalItemAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10B981',
    },
    incomeModalItemPeriod: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    incomeModalFooter: {
        borderRadius: 15,
        overflow: 'hidden',
    },
    incomeModalFooterGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
    },
    incomeModalFooterText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Tabbed Modal Styles - Liquid Glass Design
    tabbedModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 15,
    },
    tabbedModalContainer: {
        width: '96%',
        height: '96%',
        maxWidth: 560,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.4)',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    tabbedModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 24,
        minHeight: 560,
    },
    tabbedModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    tabbedModalIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        overflow: 'hidden',
    },
    tabbedModalIconGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
    },
    tabbedModalTitleContainer: {
        flex: 1,
    },
    tabbedModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    tabbedModalSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    tabbedModalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    tabbedModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    tabbedModalTabs: {
        flexDirection: 'row',
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    tabbedModalTab: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    tabbedModalTabActive: {
        // Active state handled by gradient colors
    },
    tabbedModalTabGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
    },
    tabbedModalTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    tabbedModalTabTextActive: {
        color: '#FFFFFF',
    },
    tabbedModalContent: {
        flex: 1,
    },
    tabbedModalTabContent: {
        paddingBottom: 10,
    },
    tabbedModalContentTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 16,
        textAlign: 'center',
    },
    tabbedModalItem: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    tabbedModalItemGlass: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tabbedModalItemInfo: {
        flex: 1,
        marginRight: 12,
    },
    tabbedModalItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    tabbedModalItemDetails: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    tabbedModalItemButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    tabbedModalItemButtonGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    tabbedModalItemButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    tabbedModalEmptyState: {
        padding: 40,
        alignItems: 'center',
    },
    tabbedModalEmptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
    tabbedModalLeagueInfo: {
        padding: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        alignItems: 'center',
    },
    tabbedModalLeagueText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    tabbedModalLeagueButton: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    tabbedModalLeagueButtonGradient: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    tabbedModalLeagueButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },

    // Contract Modal Styles - Liquid Glass Design
    contractModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    contractModalContainer: {
        width: '90%',
        maxWidth: 400,
        maxHeight: '80%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    contractModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        padding: 20,
    },
    contractModalContent: {
        flex: 1,
    },
    contractModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    contractModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        flex: 1,
    },
    contractModalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    contractModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    contractModalBody: {
        flex: 1,
        marginBottom: 20,
    },
    contractModalInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    contractModalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    contractModalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    contractModalActionButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 10,
    },
    contractModalActionGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    contractModalActionText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    contractModalEmptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginTop: 20,
    },
    contractModalOfferItem: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    contractModalOfferGlass: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    contractModalOfferInfo: {
        flex: 1,
        marginRight: 12,
    },
    contractModalOfferTeam: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    contractModalOfferDetails: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    contractModalOfferPay: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    contractModalOfferButton: {
        borderRadius: 8,
        overflow: 'hidden',
        minWidth: 60,
    },
    contractModalOfferButtonGradient: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    contractModalOfferButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    // League Modal Styles - Liquid Glass Design
    leagueModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    leagueModalContainer: {
        width: '90%',
        maxWidth: 400,
        maxHeight: '80%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    leagueModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        padding: 20,
    },
    leagueModalContent: {
        flex: 1,
    },
    leagueModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    leagueModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        flex: 1,
    },
    leagueModalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    leagueModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    leagueModalDivisionTabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    leagueModalDivisionTab: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    leagueModalDivisionTabGradient: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    leagueModalDivisionTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    leagueModalDivisionTabTextActive: {
        color: '#FFFFFF',
    },
    leagueModalStandings: {
        flex: 1,
    },
    leagueModalStandingItem: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    leagueModalStandingGlass: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    leagueModalStandingPosition: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    leagueModalStandingPositionText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    leagueModalStandingPositionTextActive: {
        color: '#10B981',
    },
    leagueModalStandingInfo: {
        flex: 1,
    },
    leagueModalStandingTeam: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    leagueModalStandingTeamActive: {
        color: '#10B981',
    },
    leagueModalStandingStats: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    leagueModalStandingStatsActive: {
        color: 'rgba(16, 185, 129, 0.9)',
    },
    leagueModalStandingBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.6)',
    },
    leagueModalStandingBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // Sponsors Modal Styles - Liquid Glass Design
    sponsorsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 15,
    },
    sponsorsModalContainer: {
        width: '92%',
        height: '80%',
        maxWidth: 450,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.4)',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    sponsorsModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 24,
        minHeight: 400,
    },
    sponsorsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    sponsorsModalIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sponsorsModalHobbyImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    sponsorsModalIconGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 35,
    },
    sponsorsModalTitleContainer: {
        flex: 1,
    },
    sponsorsModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    sponsorsModalSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    sponsorsModalCloseButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    sponsorsModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    sponsorsModalContent: {
        flex: 1,
        marginBottom: 20,
        maxHeight: 300,
    },
    sponsorsModalSponsorsList: {
        gap: 15,
    },
    sponsorsModalSponsorItem: {
        marginBottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
    },
    sponsorsModalSponsorGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sponsorsModalSponsorInfo: {
        flex: 1,
    },
    sponsorsModalSponsorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 5,
    },
    sponsorsModalSponsorDetails: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    sponsorsModalSponsorButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    sponsorsModalSponsorButtonGradient: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
    },
    sponsorsModalSponsorButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    sponsorsModalEmptyState: {
        alignItems: 'center',
        padding: 40,
    },
    sponsorsModalEmptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    sponsorsModalEmptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    sponsorsModalFooter: {
        borderRadius: 15,
        overflow: 'hidden',
    },
    sponsorsModalFooterGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
    },
    sponsorsModalFooterText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Artworks Modal Styles - Liquid Glass Design
    artworksModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 15,
    },
    artworksModalContainer: {
        width: '92%',
        height: '80%',
        maxWidth: 450,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.4)',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    artworksModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 24,
        minHeight: 400,
    },
    artworksModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    artworksModalIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    artworksModalHobbyImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    artworksModalTitleContainer: {
        flex: 1,
    },
    artworksModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    artworksModalSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    artworksModalCloseButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    artworksModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    artworksModalContent: {
        flex: 1,
        marginBottom: 20,
        maxHeight: 300,
    },
    artworksModalArtworksList: {
        gap: 15,
    },
    artworksModalArtworkItem: {
        marginBottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
    },
    artworksModalArtworkGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    artworksModalArtworkInfo: {
        flex: 1,
    },
    artworksModalArtworkGrade: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 5,
    },
    artworksModalArtworkIncome: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    artworksModalArtworkRank: {
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.5)',
    },
    artworksModalArtworkRankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    artworksModalEmptyState: {
        alignItems: 'center',
        padding: 40,
    },
    artworksModalEmptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    artworksModalEmptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    artworksModalFooter: {
        borderRadius: 15,
        overflow: 'hidden',
    },
    artworksModalFooterGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
    },
    artworksModalFooterText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Songs Modal Styles - Liquid Glass Design
    songsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 15,
    },
    songsModalContainer: {
        width: '92%',
        height: '80%',
        maxWidth: 450,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.4)',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    songsModalGlass: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 24,
        minHeight: 400,
    },
    songsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    songsModalIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    songsModalHobbyImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    songsModalTitleContainer: {
        flex: 1,
    },
    songsModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    songsModalSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    songsModalCloseButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    songsModalCloseGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    songsModalContent: {
        flex: 1,
        marginBottom: 20,
        maxHeight: 300,
    },
    songsModalSongsList: {
        gap: 15,
    },
    songsModalSongItem: {
        marginBottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
    },
    songsModalSongGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    songsModalSongInfo: {
        flex: 1,
    },
    songsModalSongGrade: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 5,
    },
    songsModalSongIncome: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    songsModalSongRank: {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    songsModalSongRankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    songsModalEmptyState: {
        alignItems: 'center',
        padding: 40,
    },
    songsModalEmptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    songsModalEmptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    songsModalFooter: {
        borderRadius: 15,
        overflow: 'hidden',
    },
    songsModalFooterGlass: {
        padding: 18,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
    },
    songsModalFooterText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Play Modal Styles - Simple & Reliable
    playModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    playModalContainer: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 24,
        paddingBottom: 40,
        paddingHorizontal: 24,
        height: '92%',
        minHeight: 560,
    },
    playModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    playModalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    playModalHobbyImage: {
        width: 70,
        height: 70,
        resizeMode: 'contain',
    },
    playModalIconGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
    },
    playModalTitleSection: {
        marginBottom: 32,
    },
    playModalTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 8,
    },
    playModalSubtitle: {
        fontSize: 18,
        color: '#6B7280',
        fontWeight: '500',
    },
    playModalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playModalContent: {
        flex: 1,
    },
    playModalInfoBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    playModalInfoText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
    },
    playModalInfoSubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    playModalActions: {
        gap: 12,
    },
    playModalActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 12,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    playModalActionButtonSecondary: {
        backgroundColor: '#3B82F6',
    },
    playModalActionButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    playModalFooter: {
        marginTop: 24,
        backgroundColor: '#EFF6FF',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    playModalFooterText: {
        fontSize: 14,
        color: '#1E40AF',
        textAlign: 'center',
        fontWeight: '500',
    },
});

export default React.memo(WorkScreen);

