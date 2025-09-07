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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame, Contract, CrimeSkillId, StreetJob } from '@/contexts/GameContext';
import {
  Briefcase,
  Zap,
  TrendingUp,
  Star,
  Trophy,
  Music,
  Palette,
  BarChart2,
  Handshake,
  X,
  Lock,
  AlertTriangle, // <-- tillagd
} from 'lucide-react-native';
import JailActivities from '@/components/jail/JailActivities';
import JailScreen from '@/components/jail/JailScreen';
import SkillTalentTree from '@/components/SkillTalentTree';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
} from '@/utils/scaling';
import { responsiveDesign, getResponsiveValue, getResponsiveSpacing } from '@/utils/responsiveDesign';
import { useTranslation } from '@/hooks/useTranslation';

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

const CRIME_SKILL_DESCRIPTIONS: Record<CrimeSkillId, string> = {
  stealth: 'Avoid detection during stealth-based crimes',
  hacking: 'Crack systems to enable digital crimes',
  lockpicking: 'Bypass locks to access restricted areas',
};

export default function WorkScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'street' | 'career' | 'hobby' | 'skills'>('street');
  const [workFeedback, setWorkFeedback] = useState<{ [key: string]: string }>({});
  const [showSongs, setShowSongs] = useState(false);
  const [showArt, setShowArt] = useState(false);
  const [showContracts, setShowContracts] = useState<string | null>(null);
  const [showSponsors, setShowSponsors] = useState<string | null>(null);
  const [contractOffers, setContractOffers] = useState<{ hobbyId: string; offers: Contract[] } | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Contract | null>(null);
  const [showLeague, setShowLeague] = useState<string | null>(null);
  const [leagueDivision, setLeagueDivision] = useState(0);
  const [selectedSkillTree, setSelectedSkillTree] = useState<CrimeSkillId | null>(null);
  const [feedbackOpacity] = useState(new Animated.Value(0));
  const [showJailReleaseMessage, setShowJailReleaseMessage] = useState(false);
  const [previousJailWeeks, setPreviousJailWeeks] = useState(0);

  const {
    gameState,
    performStreetJob, // fix: behåll endast denna
    payBail,
    applyForJob,
    quitJob,
    trainHobby,
    enterHobbyTournament,
    uploadSong,
    uploadArtwork,
    playMatch,
    acceptContract,
    extendContract,
    cancelContract,
    buyHobbyUpgrade,
    dive,
    buyItem,
    sellItem,
    buyDarkWebItem,
    buyHack,
    performHack,
    performJailActivity,
    serveJailTime,
    updateStats,
    updateMoney,
    batchUpdateMoney,
    applyPerkEffects,
    nextWeek,
    resolveEvent,
    // performStreetJob: performStreetJobAction, // fix: borttagen dubbel-destrukturering
    gainCriminalXp,
    gainCrimeSkillXp,
    unlockCrimeSkillUpgrade,
  } = useGame();

  const { settings } = gameState;
  const activeSport = gameState.hobbies.find(h => h.contracts && h.contracts.length > 0)?.id;
  const iconColor = settings.darkMode ? '#93C5FD' : '#1E3A8A';
  const bailCost = gameState.jailWeeks * 500;
  const legalStreetJobs = gameState.streetJobs.filter(job => !job.illegal);
  const criminalStreetJobs = gameState.streetJobs.filter(job => job.illegal === true);

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
    const result = performStreetJob(jobId);
    if (result) {
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
  };

  const handlePayBail = () => {
    const result = payBail();
    if (result) {
      Alert.alert('Bail', result.message);
    }
  };

  const handleTrainHobby = (hobbyId: string) => {
    const result = trainHobby(hobbyId);
    if (result) {
      setWorkFeedback({ [hobbyId]: result.message });
      const timeoutId = setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[hobbyId];
          return newFeedback;
        });
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleHobbyTournament = (hobbyId: string) => {
    const result = enterHobbyTournament(hobbyId);
    if (result) {
      setWorkFeedback({ [hobbyId]: result.message });
      const timeoutId = setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[hobbyId];
          return newFeedback;
        });
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleUploadSong = (hobbyId: string) => {
    const result = uploadSong(hobbyId);
    if (result) {
      setWorkFeedback({ [hobbyId]: result.message });
      setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[hobbyId];
          return newFeedback;
        });
      }, 3000);
    }
  };

  const handleUploadArtwork = (hobbyId: string) => {
    const result = uploadArtwork(hobbyId);
    if (result) {
      setWorkFeedback({ [hobbyId]: result.message });
      setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[hobbyId];
          return newFeedback;
        });
      }, 3000);
    }
  };

  const handleAcceptContract = (hobbyId: string, contract: Contract) => {
    const result = acceptContract(hobbyId, contract);
    if (result) {
      setWorkFeedback({ [hobbyId]: result.message });
      setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[hobbyId];
          return newFeedback;
        });
      }, 3000);
    }
    setSelectedOffer(null);
    setContractOffers(null);
  };

  const handlePlayMatch = (hobbyId: string) => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || !hobby.contracts || hobby.contracts.length === 0) return;
    const contract = hobby.contracts[0];
    if (contract.weeksRemaining === 3) {
      Alert.alert('Contract Ending', '3 weeks remaining on contract', [
        {
          text: 'Extend',
          onPress: () => {
            extendContract(hobbyId);
            const res = playMatch(hobbyId);
            if (res) {
              setWorkFeedback({ [hobbyId]: res.message });
              setTimeout(() => {
                setWorkFeedback(prev => {
                  const nf = { ...prev };
                  delete nf[hobbyId];
                  return nf;
                });
              }, 3000);
            }
          },
        },
        {
          text: 'Cancel',
          onPress: () => cancelContract(hobbyId),
          style: 'destructive',
        },
        {
          text: 'Wait',
          onPress: () => {
            const res = playMatch(hobbyId);
            if (res) {
              setWorkFeedback({ [hobbyId]: res.message });
              setTimeout(() => {
                setWorkFeedback(prev => {
                  const nf = { ...prev };
                  delete nf[hobbyId];
                  return nf;
                });
              }, 3000);
            }
          },
        },
      ]);
      return;
    }
    const result = playMatch(hobbyId);
    if (result) {
      setWorkFeedback({ [hobbyId]: result.message });
      setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[hobbyId];
          return newFeedback;
        });
      }, 3000);
    }
  };

  const handleCancelContract = (hobbyId: string) => {
    cancelContract(hobbyId);
    setShowContracts(null);
  };

  const openContractOffers = (hobbyId: string) => {
    const hobby = gameState.hobbies.find(h => h.id === hobbyId);
    if (!hobby || !hobby.divisions) return;
    const multipliers = [2, 1.5, 1];
    const effectiveSkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
    const offers = hobby.divisions.map((div, idx) => {
      const teamObj = div.teams[Math.floor(Math.random() * div.teams.length)];
      const duration = 30 + Math.floor(Math.random() * 39);
      const basePay = 20 + effectiveSkill * 2;
      const matchPay = Math.round(basePay * multipliers[idx]);
      return {
        id: `offer-${Date.now()}-${idx}`,
        team: teamObj.name,
        goal: teamObj.goal,
        matchPay,
        weeksRemaining: duration,
        totalWeeks: duration,
        division: idx,
      } as Contract;
    });
    setSelectedOffer(null);
    setContractOffers({ hobbyId, offers });
  };

  const handleBuyHobbyUpgrade = (hobbyId: string, upgradeId: string) => {
    buyHobbyUpgrade(hobbyId, upgradeId);
  };

  const canPerformJob = (job: StreetJob) => {
    if (gameState.jailWeeks > 0) {
      return false;
    }
    if (gameState.stats.energy < job.energyCost) return false;

    const hasItems =
      !job.requirements ||
      job.requirements.every((req: string) =>
        gameState.items.find(item => item.id === req)?.owned
      );

    const hasDarkItems =
      !job.darkWebRequirements ||
      job.darkWebRequirements.every((req: string) =>
        gameState.darkWebItems.find(item => item.id === req)?.owned
      );

    const meetsLevel =
      !job.criminalLevelReq ||
      gameState.criminalLevel >= job.criminalLevelReq;

    return hasItems && hasDarkItems && meetsLevel;
  };

  const getJailRisk = (job: StreetJob) => {
    if (!job.illegal) return 0;

    let baseRisk = 0;
    switch (job.id) {
      case 'steal_from_cars': baseRisk = 15; break;
      case 'pickpocket_basic': baseRisk = 20; break;
      case 'hack_wifi': baseRisk = 25; break;
      case 'drug_dealing': baseRisk = 35; break;
      case 'steal_cars_basic': baseRisk = 40; break;
      case 'burglary': baseRisk = 45; break;
      case 'cyber_attack': baseRisk = 50; break;
      case 'car_theft': baseRisk = 55; break;
      case 'bank_heist': baseRisk = 70; break;
      default: baseRisk = 30;
    }

    const levelReduction = Math.min(gameState.criminalLevel * 2, 20);
    const rankReduction = Math.min((job.rank - 1) * 3, 15);
    const requirementBonus = canPerformJob(job) ? 10 : 0;

    return Math.max(baseRisk - levelReduction - rankReduction - requirementBonus, 5);
  };

  const availableCrimeJobs = criminalStreetJobs.filter(job => canPerformJob(job));

  const getMissingRequirements = (job: any) => {
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
          <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
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
                {(() => {
                  const missing = getMissingRequirements(job);
                  return missing.length ? `\n\nRequires: ${missing.join(', ')}` : '';
                })()}
              </Text>
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
          </View>

          <View style={styles.crimeJobActionContainer}>
            <TouchableOpacity
              onPress={() => handleStreetJob(job.id)}
              disabled={!canPerformJob(job)}
              style={styles.crimeJobButtonWrapper}
            >
              <LinearGradient
                colors={canPerformJob(job) ? ['#DC2626', '#B91C1C', '#991B1B'] : ['#374151', '#374151']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.crimeJobButton}
              >
                <Text style={[styles.crimeJobButtonText, !canPerformJob(job) && styles.crimeJobButtonTextDisabled]}>
                  {canPerformJob(job) ? 'EXECUTE' : 'LOCKED'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {workFeedback[job.id] && (
              <Animated.View style={[styles.feedbackPopup, { opacity: feedbackOpacity }]}>
                <Text style={styles.feedbackPopupText}>{workFeedback[job.id]}</Text>
              </Animated.View>
            )}
          </View>
        </View>
      );
    }

    // Regular job card
    return (
      <LinearGradient
        key={job.id}
        colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#FFFFFF', '#E5E7EB']}
        style={styles.jobCard}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <Text style={[styles.jobName, settings.darkMode && styles.jobNameDark]}>{job.name}</Text>
            <View style={styles.rankBadge}>
              <Star size={10} color="#F59E0B" />
              <Text style={styles.rankText}>Rank {job.rank}</Text>
            </View>
          </View>
          <View style={styles.workButtonContainer}>
            <TouchableOpacity onPress={() => handleStreetJob(job.id)} disabled={!canPerformJob(job)}>
              <LinearGradient
                colors={canPerformJob(job) ? ['#16A34A', '#4ADE80'] : ['#E5E7EB', '#E5E7EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButton}
              >
                <Text style={[styles.workButtonText, !canPerformJob(job) && styles.disabledButtonText]}>
                  {t('work.work')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            {workFeedback[job.id] && (
              <Animated.View style={[styles.feedbackPopup, { opacity: feedbackOpacity }]}>
                <Text style={styles.feedbackPopupText}>{workFeedback[job.id]}</Text>
              </Animated.View>
            )}
          </View>
        </View>

        <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark]}>
          {job.description}
          {(() => {
            const missing = getMissingRequirements(job);
            return missing.length ? ` Requires: ${missing.join(', ')}` : '';
          })()}
        </Text>

        <View style={styles.jobStats}>
          <View style={styles.statItem}>
            <Zap size={16} color="#EF4444" />
            <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
              -{job.energyCost} Energy
            </Text>
          </View>
          <View style={styles.statItem}>
            <TrendingUp size={16} color="#10B981" />
            <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
              ${Math.floor(job.basePayment * 0.7)}-${Math.floor(job.basePayment * 1.3 * (1 + (job.rank - 1) * 0.3))}$
            </Text>
          </View>
          {job.skill && (
            <View style={styles.statItem}>
              <Star size={16} color="#F59E0B" />
              <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                {job.skill.charAt(0).toUpperCase() + job.skill.slice(1)}
              </Text>
            </View>
          )}
          {job.risks && job.risks.length > 0 && (
            <View style={styles.statItem}>
              <AlertTriangle size={16} color="#EF4444" />
              <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                {job.risks.length} Risk{job.risks.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {job.requirements && (
          <View style={[styles.requirements, job.illegal && { marginBottom: 4 }]}>
            <Text
              style={[
                styles.requirementsTitle,
                settings.darkMode && styles.requirementsTitleDark,
                job.illegal && { fontSize: responsiveFontSize.xs, color: '#DC2626' },
              ]}
            >
              Requirements:
            </Text>
            {job.requirements.map((req: string) => {
              const item = gameState.items.find(i => i.id === req);
              const owned = item?.owned || false;
              return (
                <Text
                  key={req}
                  style={[
                    styles.requirement,
                    settings.darkMode && !owned && styles.requirementDark,
                    owned && styles.metRequirement,
                    job.illegal && { fontSize: responsiveFontSize.xs },
                  ]}
                >
                  {owned ? '✓' : '✗'} {item?.name || req}
                </Text>
              );
            })}
          </View>
        )}

        {job.darkWebRequirements && (
          <View style={[styles.requirements, job.illegal && { marginBottom: 2 }]}>
            <Text
              style={[
                styles.requirementsTitle,
                settings.darkMode && styles.requirementsTitleDark,
                job.illegal && { fontSize: responsiveFontSize.xs, color: '#8B5CF6' },
              ]}
            >
              Onion Gear:{' '}
              {job.darkWebRequirements
                .map((req: string) => {
                  const item = gameState.darkWebItems.find(i => i.id === req);
                  const owned = item?.owned || false;
                  return `${owned ? '✓' : '✗'} ${item?.name || req}`;
                })
                .join(', ')}
            </Text>
          </View>
        )}

        {job.criminalLevelReq && (
          <Text
            style={[
              styles.requirementsTitle,
              settings.darkMode && styles.requirementsTitleDark,
              job.illegal && {
                fontSize: responsiveFontSize.xs,
                color: '#DC2626',
                marginBottom: 2,
              },
            ]}
          >
            Requires Criminal Level {job.criminalLevelReq}
          </Text>
        )}

        <View style={[styles.progressSection, job.illegal && { marginTop: 2, marginBottom: 4 }]}>
          <View style={styles.progressInfo}>
            <Text
              style={[
                styles.progressLabel,
                settings.darkMode && styles.progressLabelDark,
                job.illegal && { fontSize: responsiveFontSize.xs },
              ]}
            >
              Progress to Rank {job.rank + 1}
            </Text>
            <Text
              style={[
                styles.progressPercent,
                settings.darkMode && styles.progressPercentDark,
                job.illegal && { fontSize: responsiveFontSize.xs },
              ]}
            >
              {job.progress}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${job.progress}%` }]} />
          </View>
        </View>
      </LinearGradient>
    );
  }; // <-- fix: stänger renderJobCard korrekt

  const canApplyForCareer = (career: any) => {
    const meetsFitness =
      !career.requirements.fitness ||
      gameState.stats.fitness >= career.requirements.fitness;
    const hasItems =
      !career.requirements.items ||
      career.requirements.items.every((itemId: string) =>
        gameState.items.find(item => item.id === itemId)?.owned
      );
    const hasEducation =
      !career.requirements.education ||
      career.requirements.education.every((educationId: string) =>
        gameState.educations.find(e => e.id === educationId)?.completed
      );
    const pendingApplication = gameState.careers.some(
      (c: any) => c.applied && !c.accepted
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

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#0F172A', '#0F172A'] : ['#FFFFFF', '#FFFFFF']}
      style={styles.background}
    >
      {gameState.jailWeeks > 0 ? (
        <JailScreen />
      ) : (
        <>
          <View style={styles.container}>
            <View style={[styles.tabContainer, settings.darkMode && styles.tabContainerDark]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'street' && styles.activeTab]}
                onPress={() => setActiveTab('street')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'street' && styles.activeTabText,
                    settings.darkMode && styles.tabTextDark,
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
                    settings.darkMode && styles.tabTextDark,
                  ]}
                >
                  {t('work.career')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'hobby' && styles.activeTab]}
                onPress={() => setActiveTab('hobby')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'hobby' && styles.activeTabText,
                    settings.darkMode && styles.tabTextDark,
                  ]}
                >
                  {t('work.hobby')}
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
                    settings.darkMode && styles.tabTextDark,
                  ]}
                >
                  {t('work.crimeJobs')}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
              <View style={styles.scrollContainer}>
                <View style={styles.scrollIndicator}>
                  <View style={styles.scrollBar}>
                    <View style={styles.scrollThumb} />
                  </View>
                </View>
              </View>

              {activeTab === 'street' && (
                <View>
                  <Text
                    style={[
                      styles.sectionDescription,
                      settings.darkMode && styles.sectionDescriptionDark,
                    ]}
                  >
                    Street jobs are a great way to start earning money and build your skills. Each job has ranks that improve with experience.
                  </Text>
                  {legalStreetJobs.map(renderJobCard)}
                </View>
              )}

              {activeTab === 'career' && (
                <View>
                  <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                    Apply for traditional careers that offer steady income and advancement opportunities. Meet the requirements first!
                  </Text>
                  <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>Standard Careers</Text>
                  {basicCareers.map(career => {
                    const requiresEdu = !!(career.requirements && career.requirements.education && career.requirements.education.length > 0);
                    const hasEdu =
                      !requiresEdu ||
                      career.requirements.education?.every((educationId: string) =>
                        !!gameState.educations.find(e => e.id === educationId)?.completed
                      ) || false;

                    return (
                      <LinearGradient
                        key={career.id}
                        colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#FFFFFF', '#E5E7EB']}
                        style={styles.jobCard}
                      >
                        <View style={styles.jobHeader}>
                          <View style={styles.jobInfo}>
                            <Text style={[styles.jobName, settings.darkMode && styles.jobNameDark]}>
                              {career.levels[career.level].name}
                            </Text>
                            {requiresEdu && !hasEdu ? (
                              <View style={styles.lockedSalaryRow}>
                                <Lock size={14} color={settings.darkMode ? '#FCD34D' : '#92400E'} />
                                <Text style={[styles.salaryHidden, settings.darkMode && styles.salaryHiddenDark]}>
                                  Salary hidden until required education is completed
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.salary}>${career.levels[career.level].salary}/week</Text>
                            )}
                          </View>

                          {gameState.currentJob === career.id ? (
                            <TouchableOpacity
                              style={[styles.workButton, styles.quitButton]}
                              onPress={quitJob}
                            >
                              <Text style={[styles.workButtonText, styles.quitButtonText]}>{t('work.quit')}</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.workButton,
                                career.applied && styles.appliedButton,
                                career.accepted && styles.acceptedButton,
                                !canApplyForCareer(career) && styles.disabledButton,
                              ]}
                              onPress={() => applyForJob(career.id)}
                              disabled={career.applied || !canApplyForCareer(career) || (requiresEdu && !hasEdu)}
                            >
                              <Text
                                style={[
                                  styles.workButtonText,
                                  career.applied && styles.appliedButtonText,
                                  career.accepted && styles.acceptedButtonText,
                                  !canApplyForCareer(career) && styles.disabledButtonText,
                                ]}
                              >
                                {career.accepted
                                  ? 'Hired!'
                                  : career.applied
                                  ? 'Applied'
                                  : requiresEdu && !hasEdu
                                  ? 'Requires Education'
                                  : t('work.apply')}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark]}>
                          {career.description}
                        </Text>

                        {(career.requirements.fitness || career.requirements.items || career.requirements.education) && (
                          <View style={styles.requirements}>
                            <Text style={[styles.requirementsTitle, settings.darkMode && styles.requirementsTitleDark]}>
                              Requirements:
                            </Text>
                            {career.requirements.fitness && (
                              <Text
                                style={[
                                  styles.requirement,
                                  settings.darkMode &&
                                    gameState.stats.fitness < career.requirements.fitness &&
                                    styles.requirementDark,
                                  gameState.stats.fitness >= career.requirements.fitness && styles.metRequirement,
                                ]}
                              >
                                {gameState.stats.fitness >= career.requirements.fitness ? '✓' : '✗'}
                                Fitness {career.requirements.fitness}+
                              </Text>
                            )}
                            {career.requirements.items?.map((itemId: string) => {
                              const item = gameState.items.find(i => i.id === itemId);
                              const owned = item?.owned || false;
                              return (
                                <Text
                                  key={itemId}
                                  style={[
                                    styles.requirement,
                                    settings.darkMode && !owned && styles.requirementDark,
                                    owned && styles.metRequirement,
                                  ]}
                                >
                                  {owned ? '✓' : '✗'} {item?.name || itemId}
                                </Text>
                              );
                            })}
                            {career.requirements.education?.map((educationId: string) => {
                              const education = gameState.educations.find(e => e.id === educationId);
                              const completed = education?.completed || false;
                              return (
                                <Text
                                  key={educationId}
                                  style={[
                                    styles.requirement,
                                    settings.darkMode && !completed && styles.requirementDark,
                                    completed && styles.metRequirement,
                                  ]}
                                >
                                  {completed ? '✓' : '✗'} {education?.name || educationId}
                                </Text>
                              );
                            })}
                            {requiresEdu && !hasEdu && (
                              <Text style={[styles.lockedHint, settings.darkMode && styles.lockedHintDark]}>
                                Complete the required education to reveal salary and apply.
                              </Text>
                            )}
                          </View>
                        )}

                        {career.accepted && (
                          career.level === career.levels.length - 1 && career.progress === 100 ? (
                            <View style={styles.progressSection}>
                              <Text style={[styles.maxPromotionText, settings.darkMode && styles.maxPromotionTextDark]}>
                                Max promotion reached
                              </Text>
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
                      </LinearGradient>
                    );
                  })}
                  <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>Advanced Careers</Text>
                  <Text style={[styles.comingSoonText, settings.darkMode && styles.comingSoonTextDark]}>Coming soon</Text>
                </View>
              )}

              {activeTab === 'hobby' && (
                <View>
                  <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                    Practice hobbies to improve skills and compete in tournaments.
                  </Text>
                  {gameState.hobbies.map(hobby => {
                    const hobbySkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
                    const locked =
                      ['football', 'basketball', 'tennis'].includes(hobby.id) &&
                      activeSport &&
                      activeSport !== hobby.id;
                    if (locked) {
                      return (
                        <View
                          key={hobby.id}
                          style={[
                            styles.jobCard,
                            styles.lockedCard,
                            settings.darkMode && styles.lockedCardDark,
                          ]}
                        >
                          <Text style={[styles.jobName, settings.darkMode && styles.jobNameDark]}>
                            {hobby.name}
                          </Text>
                          <Text style={styles.lockedText}>Locked - cancel current contract to switch</Text>
                        </View>
                      );
                    }
                    return (
                      <LinearGradient
                        key={hobby.id}
                        colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#FFFFFF', '#E5E7EB']}
                        style={styles.jobCard}
                      >
                        <View style={styles.jobHeader}>
                          <View style={styles.jobInfo}>
                            <Text style={[styles.jobName, settings.darkMode && styles.jobNameDark]}>
                              {hobby.name}
                            </Text>
                          </View>
                          <View style={styles.iconRow}>
                            {(hobby.id === 'music' || hobby.id === 'art' || hobby.contracts) && (
                              <TouchableOpacity
                                style={[styles.listButton, settings.darkMode && styles.listButtonDark]}
                                onPress={() =>
                                  hobby.id === 'music'
                                    ? setShowSongs(true)
                                    : hobby.id === 'art'
                                    ? setShowArt(true)
                                    : setShowContracts(hobby.id)
                                }
                              >
                                {hobby.id === 'music' ? (
                                  <Music color={iconColor} size={16} />
                                ) : hobby.id === 'art' ? (
                                  <Palette color={iconColor} size={16} />
                                ) : (
                                  <Briefcase color={iconColor} size={16} />
                                )}
                              </TouchableOpacity>
                            )}
                            {hobby.sponsors && (
                              <TouchableOpacity
                                style={[styles.listButton, settings.darkMode && styles.listButtonDark]}
                                onPress={() => setShowSponsors(hobby.id)}
                              >
                                <Handshake color={iconColor} size={16} />
                              </TouchableOpacity>
                            )}
                            {hobby.contracts && hobby.contracts.length > 0 && (
                              <TouchableOpacity
                                style={[styles.listButton, settings.darkMode && styles.listButtonDark]}
                                onPress={() => {
                                  setLeagueDivision(0);
                                  setShowLeague(hobby.id);
                                }}
                              >
                                <BarChart2 color={iconColor} size={16} />
                              </TouchableOpacity>
                            )}
                          </View>
                          {['football', 'basketball', 'tennis'].includes(hobby.id) ? (
                            hobby.contracts && hobby.contracts.length > 0 ? (
                              <>
                                <TouchableOpacity
                                  style={[
                                    styles.workButton,
                                    gameState.stats.energy < hobby.energyCost && styles.disabledButton,
                                  ]}
                                  onPress={() => handleTrainHobby(hobby.id)}
                                  disabled={gameState.stats.energy < hobby.energyCost}
                                >
                                  <Text
                                    style={[
                                      styles.workButtonText,
                                      gameState.stats.energy < hobby.energyCost && styles.disabledButtonText,
                                    ]}
                                  >
                                    Train
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.workButton,
                                    styles.acceptedButton,
                                    gameState.stats.energy < hobby.energyCost + 5 && styles.disabledButton,
                                  ]}
                                  onPress={() => handlePlayMatch(hobby.id)}
                                  disabled={gameState.stats.energy < hobby.energyCost + 5}
                                >
                                  <Text
                                    style={[
                                      styles.workButtonText,
                                      gameState.stats.energy < hobby.energyCost + 5 && styles.disabledButtonText,
                                    ]}
                                  >
                                    Play Next Match
                                  </Text>
                                </TouchableOpacity>
                                {workFeedback[hobby.id] && (
                                  <Animated.View style={[styles.feedbackPopup, { opacity: feedbackOpacity }]}>
                                    <Text style={styles.feedbackPopupText}>{workFeedback[hobby.id]}</Text>
                                  </Animated.View>
                                )}
                              </>
                            ) : (
                              <TouchableOpacity
                                style={[styles.workButton, styles.acceptedButton]}
                                onPress={() => openContractOffers(hobby.id)}
                              >
                                <Text style={styles.workButtonText}>Play</Text>
                              </TouchableOpacity>
                            )
                          ) : (
                            <>
                              <TouchableOpacity
                                style={[
                                  styles.workButton,
                                  gameState.stats.energy < hobby.energyCost && styles.disabledButton,
                                ]}
                                onPress={() => handleTrainHobby(hobby.id)}
                                disabled={gameState.stats.energy < hobby.energyCost}
                              >
                                <Text
                                  style={[
                                    styles.workButtonText,
                                    gameState.stats.energy < hobby.energyCost && styles.disabledButtonText,
                                  ]}
                                >
                                  Train
                                </Text>
                              </TouchableOpacity>
                              {hobby.id === 'music' || hobby.id === 'art' ? (
                                <TouchableOpacity
                                  style={[
                                    styles.workButton,
                                    styles.acceptedButton,
                                    gameState.stats.energy < hobby.energyCost + 10 && styles.disabledButton,
                                  ]}
                                  onPress={() =>
                                    hobby.id === 'music'
                                      ? handleUploadSong(hobby.id)
                                      : handleUploadArtwork(hobby.id)
                                  }
                                  disabled={gameState.stats.energy < hobby.energyCost + 10}
                                >
                                  <Text
                                    style={[
                                      styles.workButtonText,
                                      gameState.stats.energy < hobby.energyCost + 10 && styles.disabledButtonText,
                                    ]}
                                  >
                                    {hobby.id === 'music' ? 'Upload Song' : 'Upload Art'}
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <>
                                  <TouchableOpacity
                                    style={[
                                      styles.workButton,
                                      styles.acceptedButton,
                                      hobbySkill < 50 && styles.disabledButton,
                                    ]}
                                    onPress={() => handleHobbyTournament(hobby.id)}
                                    disabled={hobbySkill < 50}
                                  >
                                    <Text
                                      style={[
                                        styles.workButtonText,
                                        hobbySkill < 50 && styles.disabledButtonText,
                                      ]}
                                    >
                                      Tournament
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              )}
                              {workFeedback[hobby.id] && (
                                <Animated.View style={[styles.feedbackPopup, { opacity: feedbackOpacity }]}>
                                  <Text style={styles.feedbackPopupText}>{workFeedback[hobby.id]}</Text>
                                </Animated.View>
                              )}
                            </>
                          )}
                        </View>

                        <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark]}>
                          {hobby.description}
                        </Text>

                        <View style={styles.jobStats}>
                          <View style={styles.statItem}>
                            <Zap size={16} color="#EF4444" />
                            <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                              -{hobby.energyCost} Energy
                            </Text>
                          </View>
                          <View style={styles.statItem}>
                            <Star size={16} color="#F59E0B" />
                            <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                              Lvl {hobby.skillLevel}
                            </Text>
                          </View>
                          {hobby.id === 'music' || hobby.id === 'art' ? (
                            <View style={styles.statItem}>
                              <Trophy size={16} color="#10B981" />
                              <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                                $
                                {hobby.id === 'music'
                                  ? hobby.songs?.reduce((s, song) => s + song.weeklyIncome, 0) || 0
                                  : hobby.artworks?.reduce((s, art) => s + art.weeklyIncome, 0) || 0}
                                /week
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.statItem}>
                              <Trophy size={16} color="#10B981" />
                              <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                                ${hobby.tournamentReward}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.progressContainer}>
                          <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${hobby.skill}%` }]} />
                          </View>
                        </View>

                        {hobby.upgrades && hobby.upgrades.length > 0 && (
                          <View style={styles.upgradesSection}>
                            {hobby.upgrades.map(up => (
                              <View key={up.id} style={[styles.upgradeRow, settings.darkMode && styles.upgradeRowDark]}>
                                <View style={styles.upgradeInfo}>
                                  <Text style={[styles.upgradeName, settings.darkMode && styles.upgradeNameDark]}>
                                    {up.name} ({up.level}/{up.maxLevel})
                                  </Text>
                                  <Text
                                    style={[styles.upgradeDesc, settings.darkMode && styles.upgradeDescDark]}
                                    numberOfLines={2}
                                  >
                                    {up.description}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={[
                                    styles.upgradeButton,
                                    (up.level >= up.maxLevel || gameState.stats.money < up.cost) && styles.disabledButton,
                                  ]}
                                  onPress={() => handleBuyHobbyUpgrade(hobby.id, up.id)}
                                  disabled={up.level >= up.maxLevel || gameState.stats.money < up.cost}
                                >
                                  <Text
                                    style={[
                                      styles.upgradeButtonText,
                                      (up.level >= up.maxLevel || gameState.stats.money < up.cost) && styles.disabledButtonText,
                                    ]}
                                  >
                                    {up.level >= up.maxLevel ? 'Max' : `$${up.cost}`}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </LinearGradient>
                    );
                  })}
                </View>
              )}

              {activeTab === 'skills' && (
                <View>
                  <Text
                    style={[
                      styles.sectionDescription,
                      settings.darkMode && styles.sectionDescriptionDark,
                    ]}
                  >
                    Crime skills improve your odds in illegal jobs. Each talent gives +5% success rate and +10% payment bonus.
                  </Text>

                  <View style={styles.skillsRow}>
                    {Object.entries(gameState.crimeSkills).map(([id, skill]) => {
                      const threshold = skill.level * 100;
                      const percent = (skill.xp / threshold) * 100;
                      const label = id.charAt(0).toUpperCase() + id.slice(1);
                      const upgrades = CRIME_SKILL_UPGRADES[id as CrimeSkillId];
                      const currentUpgrade = upgrades.find(u => u.level === skill.level);

                      return (
                        <TouchableOpacity
                          key={id}
                          onPress={() => setSelectedSkillTree(id as CrimeSkillId)}
                          style={styles.skillCardCompact}
                        >
                          <LinearGradient
                            colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#FFFFFF', '#E5E7EB']}
                            style={styles.skillCardGradient}
                          >
                            <View style={styles.skillCardHeader}>
                              <Star size={14} color="#F59E0B" />
                              <Text style={[styles.skillCardName, settings.darkMode && styles.skillCardNameDark]}>
                                {label}
                              </Text>
                            </View>

                            <Text style={[styles.skillCardLevel, settings.darkMode && styles.skillCardLevelDark]}>
                              Level {skill.level}
                            </Text>

                            <View style={styles.skillProgressContainer}>
                              <View style={styles.skillProgressBarBg}>
                                <View
                                  style={[
                                    styles.skillProgressBarFill,
                                    { width: `${percent}%` },
                                  ]}
                                />
                              </View>
                            </View>

                            <Text style={[styles.skillCardXP, settings.darkMode && styles.skillCardXPDark]}>
                              {Math.round(percent)}%
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>
                    Crime Jobs (Level {gameState.criminalLevel})
                  </Text>
                  {gameState.streetJobs.filter(job => job.illegal === true).length > 0 ? (
                    gameState.streetJobs.filter(job => job.illegal === true).map(renderJobCard)
                  ) : (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={[styles.jobDescription, settings.darkMode && styles.jobDescriptionDark]}>
                        No crime jobs found. This might be a bug.
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

              <Modal visible={showSongs} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
                    <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>Songs</Text>
                    {(() => {
                      const songs = gameState.hobbies.find(h => h.id === 'music')?.songs || [];
                      if (!songs.length)
                        return (
                          <Text style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                            No songs uploaded yet
                          </Text>
                        );
                      const sorted = [...songs].sort((a, b) => b.weeklyIncome - a.weeklyIncome);
                      return (
                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                          {sorted.map(song => (
                            <Text key={song.id} style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                              {song.grade} - ${song.weeklyIncome}/week
                            </Text>
                          ))}
                        </ScrollView>
                      );
                    })()}
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSongs(false)}>
                      <Text style={styles.modalCloseText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Modal visible={showArt} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
                    <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>Artworks</Text>
                    {(() => {
                      const artworks = gameState.hobbies.find(h => h.id === 'art')?.artworks || [];
                      if (!artworks.length)
                        return (
                          <Text style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                            No art uploaded yet
                          </Text>
                        );
                      const sorted = [...artworks].sort((a, b) => b.weeklyIncome - a.weeklyIncome);
                      return (
                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                          {sorted.map(art => (
                            <Text key={art.id} style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                              {art.grade} - ${art.weeklyIncome}/week
                            </Text>
                          ))}
                        </ScrollView>
                      );
                    })()}
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowArt(false)}>
                      <Text style={styles.modalCloseText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Modal visible={!!showSponsors} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
                    <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>Sponsors</Text>
                    {(() => {
                      const sponsors = gameState.hobbies.find(h => h.id === showSponsors)?.sponsors || [];
                      if (!sponsors.length)
                        return (
                          <Text style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                            No sponsors yet
                          </Text>
                        );
                      const sorted = [...sponsors].sort((a, b) => b.weeklyPay - a.weeklyPay);
                      return (
                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                          {sorted.map(sp => (
                            <Text key={sp.id} style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                              {sp.name} - ${sp.weeklyPay}/week - {sp.weeksRemaining} weeks left
                            </Text>
                          ))}
                        </ScrollView>
                      );
                    })()}
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSponsors(null)}>
                      <Text style={styles.modalCloseText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Modal visible={!!showContracts} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
                    {(() => {
                      const hobby = gameState.hobbies.find(h => h.id === showContracts);
                      const contract = hobby?.contracts?.[0];
                      return contract ? (
                        <View style={styles.contractPaper}>
                          <Text style={styles.contractTitle}>{contract.team}</Text>
                          <Text style={styles.contractLine}>Division: {hobby!.divisions![contract.division].name}</Text>
                          <Text style={styles.contractLine}>Goal: #{contract.goal}</Text>
                          <Text style={styles.contractLine}>Match Pay: ${contract.matchPay}</Text>
                          <Text style={styles.contractLine}>Weeks Remaining: {contract.weeksRemaining}</Text>
                          <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => handleCancelContract(showContracts!)}
                          >
                            <Text style={styles.modalCloseText}>Cancel Contract</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowContracts(null)}>
                            <X size={16} color="#FFFFFF" />
                            <Text style={styles.modalCloseText}>Close</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.contractPaper}>
                          <Text style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>No contracts yet</Text>
                          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowContracts(null)}>
                            <X size={16} color="#FFFFFF" />
                            <Text style={styles.modalCloseText}>Close</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </Modal>

              <Modal visible={!!contractOffers} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
                    {selectedOffer && contractOffers ? (
                      (() => {
                        const hobby = gameState.hobbies.find(h => h.id === contractOffers.hobbyId)!;
                        return (
                          <View style={styles.contractPaper}>
                            <Text style={styles.contractTitle}>{selectedOffer.team}</Text>
                            <Text style={styles.contractLine}>Division: {hobby.divisions![selectedOffer.division].name}</Text>
                            <Text style={styles.contractLine}>Goal: #{selectedOffer.goal}</Text>
                            <Text style={styles.contractLine}>Duration: {selectedOffer.totalWeeks} weeks</Text>
                            <Text style={styles.contractLine}>Pay: ${selectedOffer.matchPay} per match</Text>
                            <TouchableOpacity
                              style={styles.signButton}
                              onPress={() => handleAcceptContract(contractOffers.hobbyId, selectedOffer)}
                            >
                              <Text style={styles.signButtonText}>Sign Contract</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedOffer(null)}>
                              <Text style={styles.modalCloseText}>Back</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()
                    ) : contractOffers ? (
                      (() => {
                        const hobby = gameState.hobbies.find(h => h.id === contractOffers.hobbyId)!;
                        return (
                          <>
                            <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>Choose Contract</Text>
                            {contractOffers.offers.map(offer => (
                              <View key={offer.id} style={styles.offerRow}>
                                <Text style={[styles.modalItem, settings.darkMode && styles.modalItemDark]}>
                                  {offer.team} ({hobby.divisions![offer.division].name}) - Goal #{offer.goal}
                                </Text>
                                <TouchableOpacity style={styles.signButton} onPress={() => setSelectedOffer(offer)}>
                                  <Text style={styles.signButtonText}>Sign</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                            <TouchableOpacity
                              style={styles.modalCloseButton}
                              onPress={() => {
                                setSelectedOffer(null);
                                setContractOffers(null);
                              }}
                            >
                              <Text style={styles.modalCloseText}>Close</Text>
                            </TouchableOpacity>
                          </>
                        );
                      })()
                    ) : null}
                  </View>
                </View>
              </Modal>

              <Modal visible={!!showLeague} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
                    {showLeague && (() => {
                      const hobby = gameState.hobbies.find(h => h.id === showLeague)!;
                      const divisions = hobby.divisions || [];
                      const data =
                        hobby.league && leagueDivision === hobby.league.division
                          ? hobby.league.standings
                          : divisions[leagueDivision].teams.map(t => ({ team: t.name, points: 0, played: 0 }));
                      return (
                        <>
                          <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>League Standings</Text>
                          <View style={styles.divisionTabs}>
                            {divisions.map((d, idx) => (
                              <TouchableOpacity
                                key={d.name}
                                style={[styles.divisionTab, leagueDivision === idx && styles.activeDivisionTab]}
                                onPress={() => setLeagueDivision(idx)}
                              >
                                <Text
                                  style={[styles.divisionTabText, leagueDivision === idx && styles.activeDivisionTabText]}
                                >
                                  {d.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {data
                            .sort((a, b) => b.points - a.points)
                            .map((t, i) => {
                              const isTeam = t.team === hobby.team;
                              return (
                                <Text
                                  key={t.team}
                                  style={[
                                    styles.modalItem,
                                    settings.darkMode && styles.modalItemDark,
                                    isTeam && styles.highlightedTeam,
                                  ]}
                                >
                                  {i + 1}. {t.team} - {t.points} pts ({t.played})
                                </Text>
                              );
                            })}
                          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowLeague(null)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </Modal>
            </ScrollView>
          </View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: 20,
    borderRadius: 8,
    padding: 4,
  },
  tabContainerDark: {
    backgroundColor: '#1F2937',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabTextDark: {
    color: '#D1D5DB',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 22,
  },
  sectionDescriptionDark: {
    color: '#D1D5DB',
  },
  subheader: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
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
  jobCard: {
    padding: getResponsiveValue(12, 16, 20, 24),
    borderRadius: getResponsiveValue(8, 12, 16, 20),
    marginBottom: getResponsiveValue(12, 16, 20, 24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // Crime styles
  crimeJobContainer: {
    marginBottom: getResponsiveValue(16, 20, 24, 28),
    borderRadius: getResponsiveValue(12, 16, 20, 24),
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  crimeJobHeader: {
    padding: getResponsiveValue(16, 20, 24, 28),
  },
  crimeJobHeaderContent: {
    gap: getResponsiveValue(8, 12, 16, 20),
  },
  crimeJobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  crimeJobTitleContainer: {
    flex: 1,
    gap: getResponsiveValue(4, 6, 8, 10),
  },
  crimeJobName: {
    fontSize: getResponsiveValue(18, 20, 22, 24),
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: '#DC2626',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  crimeJobBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: getResponsiveValue(8, 10, 12, 14),
    paddingVertical: getResponsiveValue(2, 4, 6, 8),
    borderRadius: getResponsiveValue(4, 6, 8, 10),
    alignSelf: 'flex-start',
  },
  crimeJobBadgeText: {
    fontSize: getResponsiveValue(10, 12, 14, 16),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  crimeJobRankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: getResponsiveValue(4, 6, 8, 10),
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: getResponsiveValue(8, 10, 12, 14),
    paddingVertical: getResponsiveValue(4, 6, 8, 10),
    borderRadius: getResponsiveValue(6, 8, 10, 12),
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  crimeJobRank: {
    fontSize: getResponsiveValue(12, 14, 16, 18),
    fontWeight: '700',
    color: '#FF6B6B',
  },
  crimeJobDescription: {
    fontSize: getResponsiveValue(12, 14, 16, 18),
    color: '#B0B0B0',
    lineHeight: getResponsiveValue(16, 18, 20, 22),
    fontWeight: '500',
  },
  crimeJobStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#111111',
    padding: getResponsiveValue(12, 16, 20, 24),
    gap: getResponsiveValue(8, 12, 16, 20),
  },
  crimeStatCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1A1A1A',
    borderRadius: getResponsiveValue(8, 10, 12, 14),
    padding: getResponsiveValue(8, 12, 16, 20),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  crimeStatIcon: {
    width: getResponsiveValue(24, 28, 32, 36),
    height: getResponsiveValue(24, 28, 32, 36),
    borderRadius: getResponsiveValue(12, 14, 16, 18),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: getResponsiveValue(4, 6, 8, 10),
  },
  crimeStatLabel: {
    fontSize: getResponsiveValue(10, 12, 14, 16),
    color: '#888888',
    fontWeight: '600',
    marginBottom: getResponsiveValue(2, 4, 6, 8),
  },
  crimeStatValue: {
    fontSize: getResponsiveValue(12, 14, 16, 18),
    color: '#FFFFFF',
    fontWeight: '700',
  },
  crimeStatValueDisabled: {
    opacity: 0.3,
  },
  crimeJobActionContainer: {
    backgroundColor: '#0A0A0A',
    padding: getResponsiveValue(16, 20, 24, 28),
    alignItems: 'center',
  },
  crimeJobButtonWrapper: {
    width: '100%',
  },
  crimeJobButton: {
    paddingVertical: getResponsiveValue(12, 16, 20, 24),
    paddingHorizontal: getResponsiveValue(24, 28, 32, 36),
    borderRadius: getResponsiveValue(8, 10, 12, 14),
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  crimeJobButtonText: {
    fontSize: getResponsiveValue(14, 16, 18, 20),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    marginBottom: responsiveSpacing.sm,
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
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
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
  skillLevelRow: {
    alignItems: 'center',
    marginBottom: 12,
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
  skillCard: {
    marginBottom: responsiveSpacing.md,
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
  skillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  skillCardCompact: {
    flex: 1,
    maxWidth: '32%',
  },
  skillCardGradient: {
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  skillCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  skillCardName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#1F2937',
  },
  skillCardNameDark: {
    color: '#F9FAFB',
  },
  skillCardLevel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    marginBottom: 6,
  },
  skillCardLevelDark: {
    color: '#9CA3AF',
  },
  skillProgressContainer: {
    marginBottom: 4,
  },
  skillProgressBarBg: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  skillProgressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  skillCardXP: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    textAlign: 'center',
  },
  skillCardXPDark: {
    color: '#9CA3AF',
  },
});
