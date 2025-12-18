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
import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import ConfirmDialog from '@/components/ConfirmDialog';
import { useGame, Contract, CrimeSkillId, StreetJob } from '@/contexts/GameContext';
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
  Music,
  Palette,
  BarChart2,
  Handshake,
  X,
  Lock,
  AlertTriangle,
  Heart,
  Smile,
  Check,
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

// Hobby Images
const FootballIcon = require('@/assets/images/Hobby/Football.png');
const BasketballIcon = require('@/assets/images/Hobby/Basketball.png');
const TennisIcon = require('@/assets/images/Hobby/Tennis.png');
const ArtIcon = require('@/assets/images/Hobby/Art.png');
const MusicIcon = require('@/assets/images/Hobby/Music.png');

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


export default function WorkScreen() {
  return (
    <ErrorBoundary>
      <WorkScreenContent />
    </ErrorBoundary>
  );
}

function WorkScreenContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'street' | 'career' | 'hobby' | 'skills'>('street');
  const [workFeedback, setWorkFeedback] = useState<{ [key: string]: string }>({});
  const [showSongs, setShowSongs] = useState(false);
  const [showArt, setShowArt] = useState(false);
  const [showContracts, setShowContracts] = useState<string | null>(null);
  const [showSponsors, setShowSponsors] = useState<string | null>(null);
  const [showPlayPopup, setShowPlayPopup] = useState<string | null>(null);
  const [contractOffers, setContractOffers] = useState<{ hobbyId: string; offers: Contract[] } | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Contract | null>(null);
  const [showLeague, setShowLeague] = useState<string | null>(null);
  const [leagueDivision, setLeagueDivision] = useState(0);
  const [selectedSkillTree, setSelectedSkillTree] = useState<CrimeSkillId | null>(null);
  const [feedbackOpacity] = useState(new Animated.Value(0));
  const [showJailReleaseMessage, setShowJailReleaseMessage] = useState(false);
  const [previousJailWeeks, setPreviousJailWeeks] = useState(0);
  const [showIncomePopup, setShowIncomePopup] = useState(false);
  const [selectedHobbyIncome, setSelectedHobbyIncome] = useState<any>(null);
  const [showTabbedPopup, setShowTabbedPopup] = useState(false);
  const [tabbedPopupActiveTab, setTabbedPopupActiveTab] = useState<'contracts' | 'leagues'>('contracts');
  const [selectedHobbyForPopup, setSelectedHobbyForPopup] = useState<string | null>(null);
  const [showQuitJobConfirm, setShowQuitJobConfirm] = useState(false);
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const {
    gameState,
    setGameState,
    performStreetJob,
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
    saveGame,
  } = useGame();

  const { settings } = gameState;
  const activeSport = gameState.hobbies.find(h => h.contracts && h.contracts.length > 0)?.id;
  // Filter out any creative/hobby jobs that might exist in streetJobs
  const creativeHobbyJobIds = ['guitar', 'music', 'art', 'football', 'basketball', 'tennis'];
  const legalStreetJobs = gameState.streetJobs.filter(job => !job.illegal && !creativeHobbyJobIds.includes(job.id));
  const criminalStreetJobs = gameState.streetJobs.filter(job => job.illegal === true && !creativeHobbyJobIds.includes(job.id));
  
  // State for negative stats popup
  const [showNegativeStatsPopup, setShowNegativeStatsPopup] = useState(false);
  const [selectedJobForStats] = useState<StreetJob | null>(null);

  // Auto-switch to career tab if player doesn't have a job or is coming from tutorial
  useEffect(() => {
    if (!gameState.currentJob && gameState.stats.money < 1000 && !gameState.hasSeenJobTutorial) {
      setActiveTab('career');
      // Mark that we've shown the job tutorial to prevent repeated switching
      setGameState(prev => ({ ...prev, hasSeenJobTutorial: true }));
    }
  }, [gameState.currentJob, gameState.stats.money, gameState.hasSeenJobTutorial, setGameState]);

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
        logger.warn('Failed to calculate action impact:', error);
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
      
      // Return cleanup function
      return () => clearTimeout(timeoutId);
    }
    return undefined;
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
    return undefined;
  };

  const handleIncomePopup = (hobby: any) => {
    setSelectedHobbyIncome(hobby);
    setShowIncomePopup(true);
  };

  const getHobbyIncomeData = (hobby: any) => {
    
    if (hobby.id === 'music') {
      const songs = hobby.songs || [];
      const totalIncome = songs.reduce((sum: number, song: any) => sum + song.weeklyIncome, 0);
      return {
        type: 'music',
        totalIncome,
        items: songs.map((song: any) => ({
          name: `${song.grade} Song`,
          income: song.weeklyIncome,
          grade: song.grade
        }))
      };
    } else if (hobby.id === 'art') {
      const artworks = hobby.artworks || [];
      const totalIncome = artworks.reduce((sum: number, artwork: any) => sum + artwork.weeklyIncome, 0);
      return {
        type: 'art',
        totalIncome,
        items: artworks.map((artwork: any) => ({
          name: `${artwork.grade} Artwork`,
          income: artwork.weeklyIncome,
          grade: artwork.grade
        }))
      };
    } else {
      return {
        type: 'tournament',
        totalIncome: hobby.tournamentReward,
        items: [{
          name: 'Tournament Reward',
          income: hobby.tournamentReward,
          grade: 'Tournament'
        }]
      };
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
    if (!hobby) {
      return;
    }
    
    // Ensure a minimal league/contract exists so we can play immediately
    let contract = hobby.contracts && hobby.contracts[0];
    let created = false;
    if (!contract) {
      const teamName = hobby.team || `${hobby.name} FC`;
      contract = {
        id: `auto_${Date.now()}`,
        team: teamName,
        salary: 100,
        totalWeeks: 6,
        division: 0,
        goal: 3,
        matchPay: 25,
        weeksRemaining: 6,
      } as Contract;
      // Attach minimal contract and league to allow play
      setGameState(prev => ({
        ...prev,
        hobbies: prev.hobbies.map(h => h.id === hobbyId ? {
          ...h,
          team: teamName,
          contracts: [contract!],
          league: h.league || {
            division: 0,
            standings: [
              { team: teamName, points: 0, played: 0 },
              { team: 'Rivals', points: 0, played: 0 },
            ],
            matchesPlayed: 0,
          }
        } : h)
      }));
      created = true;
    }
    
    const contractRef = contract;
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
        { text: 'Skip', style: 'cancel' },
      ]);
      return;
    }
    
    const doPlay = () => {
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
    };
    if (created || !hobby.league || !hobby.league.standings || hobby.league.standings.length < 2) {
      setTimeout(doPlay, 0);
      return;
    }
    doPlay();
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
    
    // Check weekly limit - prevent spamming jobs
    const weeklyJobs = gameState.weeklyStreetJobs || {};
    const timesDoneThisWeek = weeklyJobs[job.id] || 0;
    const maxPerWeek = 3; // Allow each job to be done max 3 times per week
    
    if (timesDoneThisWeek >= maxPerWeek) {
      return false;
    }
    
    // Energy check - use current energy value
    const hasEnoughEnergy = gameState.stats.energy >= job.energyCost;

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
              const isDisabled = gameState.stats.energy < job.energyCost || gameState.jailWeeks > 0 || isAtLimit;
              
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
        <LinearGradient
          colors={['#1E3A8A', '#1E40AF']}
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
            disabled={gameState.stats.energy < job.energyCost || gameState.jailWeeks > 0}
            style={styles.streetJobButtonWrapper}
          >
            <LinearGradient
              colors={gameState.stats.energy >= job.energyCost && gameState.jailWeeks === 0 
                ? ['#2563EB', '#1D4ED8', '#1E40AF'] 
                : ['#374151', '#374151']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.streetJobButton}
            >
              <Text style={[styles.streetJobButtonText, (gameState.stats.energy < job.energyCost || gameState.jailWeeks > 0) && styles.streetJobButtonTextDisabled]}>
                {gameState.stats.energy < job.energyCost || gameState.jailWeeks > 0 ? 'LOCKED' : 'WORK'}
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
    // Check for early career access bonus
    const { hasEarlyCareerAccess } = require('@/lib/prestige/applyUnlocks');
    const unlockedBonuses = gameState.prestige?.unlockedBonuses || [];
    const hasEarlyAccess = hasEarlyCareerAccess(unlockedBonuses);
    const hasEducation =
      hasEarlyAccess ||
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
              {/* Hobby tab hidden for release */}
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

            <ScrollView 
              style={styles.content} 
              contentContainerStyle={{ paddingTop: scale(8) }}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.scrollContainer}>
                <View style={styles.scrollIndicator}>
                  <View style={styles.scrollBar}>
                    <View style={styles.scrollThumb} />
                  </View>
                </View>
              </View>

              {activeTab === 'street' && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Street Jobs</Text>
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
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Careers</Text>
                    <InfoButton
                      title="Career Jobs"
                      content="Apply for traditional careers that offer steady income and advancement opportunities. Each career has requirements like education or fitness levels you must meet first. Work hard to get promoted and earn higher salaries!"
                      size="small"
                      darkMode={settings.darkMode}
                    />
                  </View>
                  <Text style={[styles.subheader, settings.darkMode && styles.subheaderDark]}>Standard Careers</Text>
                  {basicCareers.map(career => {
                    const requiresEdu = !!(career.requirements && career.requirements.education && career.requirements.education.length > 0);
                    const hasEdu =
                      !requiresEdu ||
                      career.requirements.education?.every((educationId: string) =>
                        !!gameState.educations.find(e => e.id === educationId)?.completed
                      ) || false;

                    return (
                      <View key={career.id} style={styles.careerJobContainer}>
                        <BlurView
                          intensity={26}
                          tint={settings.darkMode ? 'dark' : 'light'}
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
                                <Trophy size={16} color={gameState.stats.fitness >= career.requirements.fitness ? '#10B981' : '#EF4444'} />
                              </View>
                              <Text style={styles.careerStatLabel}>Fitness</Text>
                              <Text style={[styles.careerStatValue, { color: gameState.stats.fitness >= career.requirements.fitness ? '#10B981' : '#EF4444' }]}>
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

                        {/* Actions - Glass buttons */}
                        {(() => {
                          const disabledApply = career.applied || !canApplyForCareer(career) || (requiresEdu && !hasEdu);
                          return (
                            <View style={styles.careerJobActionContainer}>
                              {gameState.currentJob === career.id ? (
                                <TouchableOpacity onPress={() => setShowQuitJobConfirm(true)}>
                                  <View style={styles.careerButtonWrapper}>
                                    <BlurView intensity={22} tint={settings.darkMode ? 'dark' : 'light'} style={styles.careerButtonBlur} />
                                    <LinearGradient
                                      colors={['rgba(239, 68, 68, 0.6)', 'rgba(185, 28, 28, 0.35)']}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={[styles.careerJobButton, styles.careerJobButtonQuit]}
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
                                    <BlurView intensity={22} tint={settings.darkMode ? 'dark' : 'light'} style={styles.careerButtonBlur} />
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
                    
                    return unlockedCareers.map((career: any) => {
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
                              const req = career.unlockRequirements;
                              const requirements = [];
                              if (req.education) requirements.push(`Education: ${req.education.join(', ')}`);
                              if (req.experience) requirements.push(`Experience: ${req.experience} weeks`);
                              if (req.reputation) requirements.push(`Reputation: ${req.reputation}+`);
                              if (req.netWorth) requirements.push(`Net Worth: $${req.netWorth.toLocaleString()}+`);
                              Alert.alert('Career Locked', `Requirements:\n${requirements.join('\n')}`);
                            } else if (!isApplied) {
                              // Apply for career
                              setGameState(prev => ({
                                ...prev,
                                careers: [...prev.careers, { ...career, applied: true }],
                              }));
                              saveGame();
                              Alert.alert('Application Submitted', `You've applied for ${career.name}!`);
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
                                {career.name}
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

              {false && (
                <View>
                  {/* Liquid Glass Header */}
                  <View style={styles.liquidGlassHeader}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                      style={styles.headerGlass}
                    >
                      <Text style={styles.liquidGlassTitle}>Creative Pursuits</Text>
                      <Text style={styles.liquidGlassSubtitle}>
                        Develop skills, create art, and build passive income streams
                      </Text>
                    </LinearGradient>
                  </View>

                  {gameState.hobbies && gameState.hobbies.length > 0 ? (
                    <View style={styles.hobbiesContainer}>
                      {gameState.hobbies.map(hobby => {
                        const hobbySkill = (hobby.skillLevel - 1) * 20 + hobby.skill;
                        const locked =
                          ['football', 'basketball', 'tennis'].includes(hobby.id) &&
                          activeSport &&
                          activeSport !== hobby.id;
                        
                        if (locked) {
                          return (
                            <View key={hobby.id} style={styles.lockedGlassCard}>
                              <LinearGradient
                                colors={['rgba(107, 114, 128, 0.3)', 'rgba(75, 85, 99, 0.1)']}
                                style={styles.lockedGlass}
                              >
                                <Text style={styles.lockedHobbyName}>{hobby.name}</Text>
                                <Text style={styles.lockedText}>Locked - cancel current contract to switch</Text>
                              </LinearGradient>
                            </View>
                          );
                        }
                        
                        const isMusic = hobby.id === 'music';
                        const isArt = hobby.id === 'art';
                        const isFootball = hobby.id === 'football';
                        const isBasketball = hobby.id === 'basketball';
                        const isTennis = hobby.id === 'tennis';
                        
                        return (
                          <View key={hobby.id} style={styles.liquidGlassCard}>
                            <LinearGradient
                              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                              style={styles.cardGlass}
                            >
                              {/* Card Header */}
                              <View style={styles.cardHeader}>
                                <View style={styles.iconContainer}>
                                  {isMusic && <Image source={MusicIcon} style={styles.hobbyImage} />}
                                  {isArt && <Image source={ArtIcon} style={styles.hobbyImage} />}
                                  {isFootball && <Image source={FootballIcon} style={styles.hobbyImage} />}
                                  {isBasketball && <Image source={BasketballIcon} style={styles.hobbyImage} />}
                                  {isTennis && <Image source={TennisIcon} style={styles.hobbyImage} />}
                                  {!isMusic && !isArt && !isFootball && !isBasketball && !isTennis && (
                                    <LinearGradient
                                      colors={['#F59E0B', '#D97706']}
                                      style={styles.iconGradient}
                                    >
                                      <Star size={32} color="#FFFFFF" />
                                    </LinearGradient>
                                  )}
                                </View>
                                
                                <View style={styles.hobbyInfo}>
                                  <Text style={styles.hobbyName}>{hobby.name}</Text>
                                  <View style={styles.levelBadge}>
                                    <Text style={styles.levelText}>Level {hobby.skillLevel}</Text>
                                  </View>
                                </View>

                                {/* Action Buttons - Top Right */}
                                <View style={styles.topActionButtons}>
                                  {['football', 'basketball', 'tennis'].includes(hobby.id) ? (
                                    <>
                                      {/* Always-visible Play button (no contract required) */}
                                      <TouchableOpacity
                                        style={styles.compactButton}
                                        onPress={() => handlePlayMatch(hobby.id)}
                                      >
                                        <LinearGradient
                                          colors={['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']}
                                          style={styles.compactButtonGradient}
                                        >
                                          <Text style={styles.compactButtonText}>Play</Text>
                                        </LinearGradient>
                                      </TouchableOpacity>

                                      {hobby.contracts && hobby.contracts.length > 0 ? (
                                        <>
                                        <TouchableOpacity
                                          style={[styles.compactButton, gameState.stats.energy < hobby.energyCost && styles.disabledGlassButton]}
                                          onPress={() => handleTrainHobby(hobby.id)}
                                          disabled={gameState.stats.energy < hobby.energyCost}
                                        >
                                          <LinearGradient
                                            colors={gameState.stats.energy < hobby.energyCost ? ['rgba(107, 114, 128, 0.5)', 'rgba(75, 85, 99, 0.3)'] : ['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                                            style={styles.compactButtonGradient}
                                          >
                                            <Text style={[styles.compactButtonText, gameState.stats.energy < hobby.energyCost && styles.disabledGlassButtonText]}>
                                              Train
                                            </Text>
                                          </LinearGradient>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={[styles.compactButton, gameState.stats.energy < hobby.energyCost + 5 && styles.disabledGlassButton]}
                                          onPress={() => handlePlayMatch(hobby.id)}
                                          disabled={gameState.stats.energy < hobby.energyCost + 5}
                                        >
                                          <LinearGradient
                                            colors={gameState.stats.energy < hobby.energyCost + 5 ? ['rgba(107, 114, 128, 0.5)', 'rgba(75, 85, 99, 0.3)'] : ['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']}
                                            style={styles.compactButtonGradient}
                                          >
                                            <Text style={[styles.compactButtonText, gameState.stats.energy < hobby.energyCost + 5 && styles.disabledGlassButtonText]}>
                                              Play
                                            </Text>
                                          </LinearGradient>
                                        </TouchableOpacity>
                                        </>
                                      ) : null}
                                    </>
                                  ) : (
                                    <>
                                      <TouchableOpacity
                                        style={[styles.compactButton, gameState.stats.energy < hobby.energyCost && styles.disabledGlassButton]}
                                        onPress={() => handleTrainHobby(hobby.id)}
                                        disabled={gameState.stats.energy < hobby.energyCost}
                                      >
                                        <LinearGradient
                                          colors={gameState.stats.energy < hobby.energyCost ? ['rgba(107, 114, 128, 0.5)', 'rgba(75, 85, 99, 0.3)'] : ['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                                          style={styles.compactButtonGradient}
                                        >
                                          <Text style={[styles.compactButtonText, gameState.stats.energy < hobby.energyCost && styles.disabledGlassButtonText]}>
                                            Train
                                          </Text>
                                        </LinearGradient>
                                      </TouchableOpacity>
                                      {hobby.id === 'music' || hobby.id === 'art' ? (
                                        <TouchableOpacity
                                          style={[styles.compactButton, gameState.stats.energy < hobby.energyCost + 10 && styles.disabledGlassButton]}
                                          onPress={() =>
                                            hobby.id === 'music'
                                              ? handleUploadSong(hobby.id)
                                              : handleUploadArtwork(hobby.id)
                                          }
                                          disabled={gameState.stats.energy < hobby.energyCost + 10}
                                        >
                                          <LinearGradient
                                            colors={gameState.stats.energy < hobby.energyCost + 10 ? ['rgba(107, 114, 128, 0.5)', 'rgba(75, 85, 99, 0.3)'] : ['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']}
                                            style={styles.compactButtonGradient}
                                          >
                                            <Text style={[styles.compactButtonText, gameState.stats.energy < hobby.energyCost + 10 && styles.disabledGlassButtonText]}>
                                              Upload
                                            </Text>
                                          </LinearGradient>
                                        </TouchableOpacity>
                                      ) : (
                                        <TouchableOpacity
                                          style={[styles.compactButton, hobbySkill < 50 && styles.disabledGlassButton]}
                                          onPress={() => handleHobbyTournament(hobby.id)}
                                          disabled={hobbySkill < 50}
                                        >
                                          <LinearGradient
                                            colors={hobbySkill < 50 ? ['rgba(107, 114, 128, 0.5)', 'rgba(75, 85, 99, 0.3)'] : ['rgba(168, 85, 247, 0.8)', 'rgba(147, 51, 234, 0.6)']}
                                            style={styles.compactButtonGradient}
                                          >
                                            <Text style={[styles.compactButtonText, hobbySkill < 50 && styles.disabledGlassButtonText]}>
                                              Tournament
                                            </Text>
                                          </LinearGradient>
                                        </TouchableOpacity>
                                      )}
                                    </>
                                  )}
                                </View>
                              </View>



                              {/* Description */}
                              <Text style={styles.glassDescription}>{hobby.description}</Text>

                              {/* Stats Grid */}
                              <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                  <LinearGradient
                                    colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.1)']}
                                    style={styles.statGlass}
                                  >
                                    <Zap size={16} color="#EF4444" />
                                    <Text style={styles.statLabel}>Energy Cost</Text>
                                    <Text style={styles.statValue}>{hobby.energyCost}</Text>
                                  </LinearGradient>
                                </View>
                                
                                <View style={styles.statCard}>
                                  <LinearGradient
                                    colors={['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.1)']}
                                    style={styles.statGlass}
                                  >
                                    <Star size={16} color="#F59E0B" />
                                    <Text style={styles.statLabel}>Skill Level</Text>
                                    <Text style={styles.statValue}>{hobby.skillLevel}</Text>
                                  </LinearGradient>
                                </View>
                                
                                <TouchableOpacity 
                                  style={styles.statCard}
                                  onPress={() => handleIncomePopup(hobby)}
                                >
                                  <LinearGradient
                                    colors={['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.1)']}
                                    style={styles.statGlass}
                                  >
                                    <Trophy size={16} color="#10B981" />
                                    <Text style={styles.statLabel}>Weekly Income</Text>
                                    <Text style={styles.statValue}>
                                      $
                                      {hobby.id === 'music'
                                        ? hobby.songs?.reduce((s, song) => s + song.weeklyIncome, 0) || 0
                                        : hobby.id === 'art'
                                        ? hobby.artworks?.reduce((s, art) => s + art.weeklyIncome, 0) || 0
                                        : hobby.tournamentReward}
                                    </Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>

                              {/* Progress Bar */}
                              <View style={styles.progressSection}>
                                <Text style={styles.progressLabel}>Skill Progress</Text>
                                <View style={styles.glassProgressBar}>
                                  <LinearGradient
                                    colors={['#3B82F6', '#1D4ED8']}
                                    style={[styles.glassProgressFill, { width: `${hobby.skill}%` }]}
                                  />
                                </View>
                                <Text style={styles.progressText}>{hobby.skill}/100</Text>
                              </View>

                              {/* Circle Action Buttons - Positioned under progress bar and over upgrades */}
                              <View style={styles.hobbyActionButtons}>
                                {(hobby.id === 'music' || hobby.id === 'art') && (
                                  <TouchableOpacity
                                    style={styles.hobbyActionButton}
                                    onPress={() =>
                                      hobby.id === 'music'
                                        ? setShowSongs(true)
                                        : setShowArt(true)
                                    }
                                  >
                                    <LinearGradient
                                      colors={['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']}
                                      style={styles.hobbyActionButtonGradient}
                                    >
                                      {hobby.id === 'music' ? (
                                        <Music size={18} color="#FFFFFF" />
                                      ) : (
                                        <Palette size={18} color="#FFFFFF" />
                                      )}
                                    </LinearGradient>
                                  </TouchableOpacity>
                                )}
                                {hobby.sponsors && (
                                  <TouchableOpacity
                                    style={styles.hobbyActionButton}
                                    onPress={() => setShowSponsors(hobby.id)}
                                  >
                                    <LinearGradient
                                      colors={['rgba(168, 85, 247, 0.8)', 'rgba(147, 51, 234, 0.6)']}
                                      style={styles.hobbyActionButtonGradient}
                                    >
                                      <Handshake size={18} color="#FFFFFF" />
                                    </LinearGradient>
                                  </TouchableOpacity>
                                )}
                                {['football', 'basketball', 'tennis'].includes(hobby.id) && (
                                  <TouchableOpacity
                                    style={styles.hobbyActionButton}
                                    onPress={() => {
                                      setSelectedHobbyForPopup(hobby.id);
                                      setTabbedPopupActiveTab('contracts');
                                      setShowTabbedPopup(true);
                                    }}
                                  >
                                    <LinearGradient
                                      colors={['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']}
                                      style={styles.hobbyActionButtonGradient}
                                    >
                                      <Text style={styles.compactButtonText}>Play</Text>
                                    </LinearGradient>
                                  </TouchableOpacity>
                                )}
                                {['football', 'basketball', 'tennis'].includes(hobby.id) && hobby.contracts && hobby.contracts.length > 0 && (
                                  <TouchableOpacity
                                    style={styles.hobbyActionButton}
                                    onPress={() => {
                                      setSelectedHobbyForPopup(hobby.id);
                                      setTabbedPopupActiveTab('leagues');
                                      setShowTabbedPopup(true);
                                    }}
                                  >
                                    <LinearGradient
                                      colors={['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                                      style={styles.hobbyActionButtonGradient}
                                    >
                                      <BarChart2 size={18} color="#FFFFFF" />
                                    </LinearGradient>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* Upgrades Section */}
                              {hobby.upgrades && hobby.upgrades.length > 0 && (
                                <View style={styles.upgradesSection}>
                                  <Text style={styles.upgradesTitle}>Upgrades</Text>
                                  {hobby.upgrades.map(up => (
                                    <TouchableOpacity
                                      key={up.id}
                                      style={[
                                        styles.upgradeButtonFull,
                                        (up.level >= up.maxLevel || gameState.stats.money < up.cost) && styles.disabledUpgradeButtonFull,
                                      ]}
                                      onPress={() => handleBuyHobbyUpgrade(hobby.id, up.id)}
                                      disabled={up.level >= up.maxLevel || gameState.stats.money < up.cost}
                                    >
                                      <LinearGradient
                                        colors={
                                          (up.level >= up.maxLevel || gameState.stats.money < up.cost)
                                            ? ['rgba(107, 114, 128, 0.5)', 'rgba(75, 85, 99, 0.3)']
                                            : ['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']
                                        }
                                        style={styles.upgradeButtonFullGradient}
                                      >
                                        <View style={styles.upgradeButtonContent}>
                                          <View style={styles.upgradeButtonInfo}>
                                            <Text style={[
                                              styles.upgradeButtonName,
                                              (up.level >= up.maxLevel || gameState.stats.money < up.cost) && styles.disabledUpgradeButtonText
                                            ]}>
                                              {up.name} ({up.level}/{up.maxLevel})
                                            </Text>
                                            <Text style={[
                                              styles.upgradeButtonDesc,
                                              (up.level >= up.maxLevel || gameState.stats.money < up.cost) && styles.disabledUpgradeButtonText
                                            ]} numberOfLines={1}>
                                              {up.description}
                                            </Text>
                                          </View>
                                          <Text style={[
                                            styles.upgradeButtonCost,
                                            (up.level >= up.maxLevel || gameState.stats.money < up.cost) && styles.disabledUpgradeButtonText
                                          ]}>
                                            {up.level >= up.maxLevel ? 'MAX' : `$${up.cost}`}
                                          </Text>
                                        </View>
                                      </LinearGradient>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}

                              {/* Feedback */}
                              {workFeedback[hobby.id] && (
                                <Animated.View style={[styles.feedbackBubble, { opacity: feedbackOpacity }]}>
                                  <Text style={styles.feedbackText}>{workFeedback[hobby.id]}</Text>
                                </Animated.View>
                              )}
                            </LinearGradient>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No hobbies available yet</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Income Details Popup */}
              <Modal 
                visible={showIncomePopup} 
                transparent 
                animationType="fade"
                onRequestClose={() => setShowIncomePopup(false)}
              >
                <View style={styles.incomeModalOverlay}>
                  <TouchableOpacity 
                    style={styles.incomeModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowIncomePopup(false)}
                  >
                    <TouchableOpacity 
                      style={styles.incomeModalContainer}
                      activeOpacity={1}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <LinearGradient
                        colors={['rgba(30, 30, 30, 0.6)', 'rgba(20, 20, 20, 0.4)']}
                        style={styles.incomeModalGlass}
                      >
                        {/* Header */}
                        <View style={styles.incomeModalHeader}>
                          <View style={styles.incomeModalIconContainer}>
                            {selectedHobbyIncome?.id === 'music' ? (
                              <Image source={MusicIcon} style={styles.incomeModalHobbyImage} />
                            ) : selectedHobbyIncome?.id === 'art' ? (
                              <Image source={ArtIcon} style={styles.incomeModalHobbyImage} />
                            ) : selectedHobbyIncome?.id === 'football' ? (
                              <Image source={FootballIcon} style={styles.incomeModalHobbyImage} />
                            ) : selectedHobbyIncome?.id === 'basketball' ? (
                              <Image source={BasketballIcon} style={styles.incomeModalHobbyImage} />
                            ) : selectedHobbyIncome?.id === 'tennis' ? (
                              <Image source={TennisIcon} style={styles.incomeModalHobbyImage} />
                            ) : (
                              <LinearGradient
                                colors={['#F59E0B', '#D97706']}
                                style={styles.incomeModalIconGradient}
                              >
                                <Trophy size={32} color="#FFFFFF" />
                              </LinearGradient>
                            )}
                          </View>
                          <View style={styles.incomeModalTitleContainer}>
                            <Text style={styles.incomeModalTitle}>{selectedHobbyIncome?.name || 'Hobby'} Income</Text>
                            <Text style={styles.incomeModalSubtitle}>Weekly Earnings Breakdown</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.incomeModalCloseButton}
                            onPress={() => setShowIncomePopup(false)}
                          >
                            <LinearGradient
                              colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                              style={styles.incomeModalCloseGradient}
                            >
                              <X size={24} color="#FFFFFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>

                        {/* Total Income Display */}
                        <View style={styles.incomeModalTotalContainer}>
                          <LinearGradient
                            colors={['rgba(16, 185, 129, 0.6)', 'rgba(5, 150, 105, 0.4)']}
                            style={styles.incomeModalTotalGlass}
                          >
                            <Text style={styles.incomeModalTotalLabel}>Total Weekly Income</Text>
                            <Text style={styles.incomeModalTotalAmount}>
                              ${selectedHobbyIncome ? getHobbyIncomeData(selectedHobbyIncome).totalIncome : 0}
                            </Text>
                          </LinearGradient>
                        </View>

                        {/* Income Items */}
                        <ScrollView 
                          style={styles.incomeModalItemsContainer} 
                          showsVerticalScrollIndicator={true}
                          contentContainerStyle={{ paddingBottom: 10 }}
                          indicatorStyle="white"
                        >
                          {selectedHobbyIncome && getHobbyIncomeData(selectedHobbyIncome).items.length > 0 ? (
                            getHobbyIncomeData(selectedHobbyIncome).items.map((item: any, index: number) => (
                              <View key={index} style={styles.incomeModalItem}>
                                <LinearGradient
                                  colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
                                  style={styles.incomeModalItemGlass}
                                >
                                  <View style={styles.incomeModalItemInfo}>
                                    <Text style={styles.incomeModalItemName}>{item.name}</Text>
                                    <Text style={styles.incomeModalItemGrade}>{item.grade}</Text>
                                  </View>
                                  <View style={styles.incomeModalItemAmountContainer}>
                                    <Text style={styles.incomeModalItemAmount}>${item.income}</Text>
                                    <Text style={styles.incomeModalItemPeriod}>/week</Text>
                                  </View>
                                </LinearGradient>
                              </View>
                            ))
                          ) : (
                            <View style={styles.incomeModalItem}>
                              <LinearGradient
                                colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
                                style={styles.incomeModalItemGlass}
                              >
                                <View style={styles.incomeModalItemInfo}>
                                  <Text style={styles.incomeModalItemName}>No income sources yet</Text>
                                  <Text style={styles.incomeModalItemGrade}>Start creating content!</Text>
                                </View>
                                <View style={styles.incomeModalItemAmountContainer}>
                                  <Text style={styles.incomeModalItemAmount}>$0</Text>
                                  <Text style={styles.incomeModalItemPeriod}>/week</Text>
                                </View>
                              </LinearGradient>
                            </View>
                          )}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.incomeModalFooter}>
                          <LinearGradient
                            colors={['rgba(59, 130, 246, 0.3)', 'rgba(37, 99, 235, 0.2)']}
                            style={styles.incomeModalFooterGlass}
                          >
                            <Text style={styles.incomeModalFooterText}>
                              💡 Tip: Higher skill levels unlock better rewards!
                            </Text>
                          </LinearGradient>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              </Modal>

              {/* Contracts & Leagues - Modal (inline like Weekly Income) */}
              <Modal 
                visible={!!selectedHobbyForPopup} 
                transparent 
                animationType="fade"
                onRequestClose={() => { setSelectedHobbyForPopup(null); setShowTabbedPopup(false); }}
              >
                <View style={styles.tabbedModalOverlay}>
                  <TouchableOpacity 
                    style={styles.tabbedModalOverlay}
                    activeOpacity={1}
                    onPress={() => { setSelectedHobbyForPopup(null); setShowTabbedPopup(false); }}
                  >
                    <TouchableOpacity 
                      style={styles.tabbedModalContainer}
                      activeOpacity={1}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <LinearGradient
                        colors={['rgba(30, 30, 30, 0.6)', 'rgba(20, 20, 20, 0.4)']}
                        style={styles.tabbedModalGlass}
                      >
                      {/* Header */}
                      <View style={styles.tabbedModalHeader}>
                        <View style={styles.tabbedModalIconContainer}>
                          <LinearGradient
                            colors={['#F59E0B', '#D97706']}
                            style={styles.tabbedModalIconGradient}
                          >
                            <Trophy size={24} color="#FFFFFF" />
                          </LinearGradient>
                        </View>
                        <View style={styles.tabbedModalTitleContainer}>
                          <Text style={styles.tabbedModalTitle}>
                            {selectedHobbyForPopup ? gameState.hobbies.find(h => h.id === selectedHobbyForPopup)?.name : 'Sport'}
                          </Text>
                          <Text style={styles.tabbedModalSubtitle}>Contracts & Leagues</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.tabbedModalCloseButton}
                          onPress={() => { setSelectedHobbyForPopup(null); setShowTabbedPopup(false); }}
                        >
                          <LinearGradient
                            colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                            style={styles.tabbedModalCloseGradient}
                          >
                            <X size={20} color="#FFFFFF" />
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>

                      {/* Tab Navigation */}
                      <View style={styles.tabbedModalTabs}>
                        <TouchableOpacity
                          style={[styles.tabbedModalTab, styles.tabbedModalTabActive]}
                          onPress={() => setTabbedPopupActiveTab('leagues')}
                        >
                          <LinearGradient
                            colors={['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                            style={styles.tabbedModalTabGradient}
                          >
                            <BarChart2 size={16} color={'#FFFFFF'} />
                            <Text style={[styles.tabbedModalTabText, styles.tabbedModalTabTextActive]}>
                              Leagues
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>

                      {/* Tab Content */}
                      <ScrollView 
                        style={styles.tabbedModalContent} 
                        showsVerticalScrollIndicator={true}
                        indicatorStyle="white"
                      >
                        {tabbedPopupActiveTab === 'leagues' && (
                          <View style={styles.tabbedModalTabContent}>
                            <Text style={styles.tabbedModalContentTitle}>League Standings</Text>
                            {/* Team rename input */}
                            {selectedHobbyForPopup && (
                              <View style={{ marginBottom: 10 }}>
                                <Text style={{ color: '#FFFFFF', marginBottom: 6 }}>Rename Your Team</Text>
                                <TextInput
                                  style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8 }}
                                  defaultValue={gameState.hobbies.find(h => h.id === selectedHobbyForPopup)?.team || `${gameState.hobbies.find(h => h.id === selectedHobbyForPopup)?.name} FC`}
                                  onSubmitEditing={(e) => {
                                    const name = e.nativeEvent.text.trim();
                                    if (!name) return;
                                    setGameState(prev => ({
                                      ...prev,
                                      hobbies: prev.hobbies.map(h => h.id === selectedHobbyForPopup ? { ...h, team: name } : h)
                                    }));
                                  }}
                                  returnKeyType="done"
                                />
                              </View>
                            )}
                            {selectedHobbyForPopup && (() => {
                              const hobby = gameState.hobbies.find(h => h.id === selectedHobbyForPopup);
                              return hobby?.contracts && hobby.contracts.length > 0;
                            })() ? (
                              <View style={styles.tabbedModalLeagueInfo}>
                                <Text style={styles.tabbedModalLeagueText}>
                                  You are currently playing in the league. Check your standings and compete for the championship!
                                </Text>
                                <TouchableOpacity
                                  style={styles.tabbedModalLeagueButton}
                                  onPress={() => {
                                    setLeagueDivision(0);
                                    setShowLeague(selectedHobbyForPopup!);
                                    setShowTabbedPopup(false);
                                  }}
                                >
                                  <LinearGradient
                                    colors={['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                                    style={styles.tabbedModalLeagueButtonGradient}
                                  >
                                    <Text style={styles.tabbedModalLeagueButtonText}>View League</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.tabbedModalEmptyState}>
                                <Text style={styles.tabbedModalEmptyText}>Sign a contract first to join leagues</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </ScrollView>
                    </LinearGradient>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            </Modal>

              {/* Sponsors Popup */}
              <Modal 
                visible={!!showSponsors} 
                transparent 
                animationType="fade"
                onRequestClose={() => setShowSponsors(null)}
              >
                <View style={styles.sponsorsModalOverlay}>
                  <TouchableOpacity 
                    style={styles.sponsorsModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSponsors(null)}
                  >
                    <TouchableOpacity 
                      style={styles.sponsorsModalContainer}
                      activeOpacity={1}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <LinearGradient
                        colors={['rgba(30, 30, 30, 0.6)', 'rgba(20, 20, 20, 0.4)']}
                        style={styles.sponsorsModalGlass}
                      >
                        {/* Header */}
                        <View style={styles.sponsorsModalHeader}>
                          <View style={styles.sponsorsModalIconContainer}>
                            {showSponsors && gameState.hobbies.find(h => h.id === showSponsors)?.id === 'music' ? (
                              <Image source={MusicIcon} style={styles.sponsorsModalHobbyImage} />
                            ) : showSponsors && gameState.hobbies.find(h => h.id === showSponsors)?.id === 'art' ? (
                              <Image source={ArtIcon} style={styles.sponsorsModalHobbyImage} />
                            ) : showSponsors && gameState.hobbies.find(h => h.id === showSponsors)?.id === 'football' ? (
                              <Image source={FootballIcon} style={styles.sponsorsModalHobbyImage} />
                            ) : showSponsors && gameState.hobbies.find(h => h.id === showSponsors)?.id === 'basketball' ? (
                              <Image source={BasketballIcon} style={styles.sponsorsModalHobbyImage} />
                            ) : showSponsors && gameState.hobbies.find(h => h.id === showSponsors)?.id === 'tennis' ? (
                              <Image source={TennisIcon} style={styles.sponsorsModalHobbyImage} />
                            ) : (
                              <LinearGradient
                                colors={['#F59E0B', '#D97706']}
                                style={styles.sponsorsModalIconGradient}
                              >
                                <Trophy size={32} color="#FFFFFF" />
                              </LinearGradient>
                            )}
                          </View>
                          <View style={styles.sponsorsModalTitleContainer}>
                            <Text style={styles.sponsorsModalTitle}>
                              {showSponsors ? gameState.hobbies.find(h => h.id === showSponsors)?.name || 'Hobby' : 'Hobby'} Sponsors
                            </Text>
                            <Text style={styles.sponsorsModalSubtitle}>Sponsorship Opportunities</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.sponsorsModalCloseButton}
                            onPress={() => setShowSponsors(null)}
                          >
                            <LinearGradient
                              colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                              style={styles.sponsorsModalCloseGradient}
                            >
                              <X size={24} color="#FFFFFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>

                        {/* Sponsors Content */}
                        <ScrollView 
                          style={styles.sponsorsModalContent} 
                          showsVerticalScrollIndicator={true}
                          indicatorStyle="white"
                        >
                          {showSponsors && (() => {
                            const hobby = gameState.hobbies.find(h => h.id === showSponsors);
                            return hobby?.sponsors && hobby.sponsors.length > 0;
                          })() ? (
                            <View style={styles.sponsorsModalSponsorsList}>
                              {gameState.hobbies.find(h => h.id === showSponsors)?.sponsors?.map((sponsor: any, index: number) => (
                                <View key={index} style={styles.sponsorsModalSponsorItem}>
                                  <LinearGradient
                                    colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
                                    style={styles.sponsorsModalSponsorGlass}
                                  >
                                    <View style={styles.sponsorsModalSponsorInfo}>
                                      <Text style={styles.sponsorsModalSponsorName}>{sponsor.name}</Text>
                                      <Text style={styles.sponsorsModalSponsorDetails}>
                                        ${sponsor.weeklyPayment}/week • {sponsor.duration} weeks
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.sponsorsModalSponsorButton}
                                      onPress={() => {
                                        // Handle sponsor acceptance
                                        setShowSponsors(null);
                                      }}
                                    >
                                      <LinearGradient
                                        colors={['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                                        style={styles.sponsorsModalSponsorButtonGradient}
                                      >
                                        <Text style={styles.sponsorsModalSponsorButtonText}>Accept</Text>
                                      </LinearGradient>
                                    </TouchableOpacity>
                                  </LinearGradient>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <View style={styles.sponsorsModalEmptyState}>
                              <Text style={styles.sponsorsModalEmptyText}>No sponsors available yet</Text>
                              <Text style={styles.sponsorsModalEmptySubtext}>Build your reputation to attract sponsors!</Text>
                            </View>
                          )}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.sponsorsModalFooter}>
                          <LinearGradient
                            colors={['rgba(59, 130, 246, 0.3)', 'rgba(37, 99, 235, 0.2)']}
                            style={styles.sponsorsModalFooterGlass}
                          >
                            <Text style={styles.sponsorsModalFooterText}>
                              💡 Tip: Higher skill levels attract better sponsors!
                            </Text>
                          </LinearGradient>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              </Modal>

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

              {/* Songs Popup - Liquid Glass */}
              <Modal 
                visible={showSongs} 
                transparent 
                animationType="fade"
                onRequestClose={() => setShowSongs(false)}
              >
                <View style={styles.songsModalOverlay}>
                  <TouchableOpacity 
                    style={styles.songsModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSongs(false)}
                  >
                    <TouchableOpacity 
                      style={styles.songsModalContainer}
                      activeOpacity={1}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <LinearGradient
                        colors={['rgba(30, 30, 30, 0.6)', 'rgba(20, 20, 20, 0.4)']}
                        style={styles.songsModalGlass}
                      >
                        {/* Header */}
                        <View style={styles.songsModalHeader}>
                          <View style={styles.songsModalIconContainer}>
                            <Image source={MusicIcon} style={styles.songsModalHobbyImage} />
                          </View>
                          <View style={styles.songsModalTitleContainer}>
                            <Text style={styles.songsModalTitle}>Music Library</Text>
                            <Text style={styles.songsModalSubtitle}>Your Uploaded Songs Collection</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.songsModalCloseButton}
                            onPress={() => setShowSongs(false)}
                          >
                            <LinearGradient
                              colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                              style={styles.songsModalCloseGradient}
                            >
                              <X size={24} color="#FFFFFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>

                        {/* Songs Content */}
                        <ScrollView 
                          style={styles.songsModalContent} 
                          showsVerticalScrollIndicator={true}
                          indicatorStyle="white"
                        >
                          {(() => {
                            const songs = gameState.hobbies.find(h => h.id === 'music')?.songs || [];
                            if (!songs.length) {
                              return (
                                <View style={styles.songsModalEmptyState}>
                                  <Text style={styles.songsModalEmptyText}>No songs uploaded yet</Text>
                                  <Text style={styles.songsModalEmptySubtext}>Upload your first song to start earning!</Text>
                                </View>
                              );
                            }
                            const sorted = [...songs].sort((a, b) => b.weeklyIncome - a.weeklyIncome);
                            return (
                              <View style={styles.songsModalSongsList}>
                                {sorted.map((song, index) => (
                                  <View key={song.id} style={styles.songsModalSongItem}>
                                    <LinearGradient
                                      colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
                                      style={styles.songsModalSongGlass}
                                    >
                                      <View style={styles.songsModalSongInfo}>
                                        <Text style={styles.songsModalSongGrade}>{song.grade}</Text>
                                        <Text style={styles.songsModalSongIncome}>${song.weeklyIncome}/week</Text>
                                      </View>
                                      <View style={styles.songsModalSongRank}>
                                        <Text style={styles.songsModalSongRankText}>#{index + 1}</Text>
                                      </View>
                                    </LinearGradient>
                                  </View>
                                ))}
                              </View>
                            );
                          })()}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.songsModalFooter}>
                          <LinearGradient
                            colors={['rgba(239, 68, 68, 0.3)', 'rgba(220, 38, 38, 0.2)']}
                            style={styles.songsModalFooterGlass}
                          >
                            <Text style={styles.songsModalFooterText}>
                              💡 Tip: Higher grade songs earn more weekly income!
                            </Text>
                          </LinearGradient>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              </Modal>

              {/* Artworks Popup - Liquid Glass */}
              <Modal 
                visible={showArt} 
                transparent 
                animationType="fade"
                onRequestClose={() => setShowArt(false)}
              >
                <View style={styles.artworksModalOverlay}>
                  <TouchableOpacity 
                    style={styles.artworksModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowArt(false)}
                  >
                    <TouchableOpacity 
                      style={styles.artworksModalContainer}
                      activeOpacity={1}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <LinearGradient
                        colors={['rgba(30, 30, 30, 0.6)', 'rgba(20, 20, 20, 0.4)']}
                        style={styles.artworksModalGlass}
                      >
                        {/* Header */}
                        <View style={styles.artworksModalHeader}>
                          <View style={styles.artworksModalIconContainer}>
                            <Image source={ArtIcon} style={styles.artworksModalHobbyImage} />
                          </View>
                          <View style={styles.artworksModalTitleContainer}>
                            <Text style={styles.artworksModalTitle}>Artworks Gallery</Text>
                            <Text style={styles.artworksModalSubtitle}>Your Uploaded Art Collection</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.artworksModalCloseButton}
                            onPress={() => setShowArt(false)}
                          >
                            <LinearGradient
                              colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                              style={styles.artworksModalCloseGradient}
                            >
                              <X size={24} color="#FFFFFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>

                        {/* Artworks Content */}
                        <ScrollView 
                          style={styles.artworksModalContent} 
                          showsVerticalScrollIndicator={true}
                          indicatorStyle="white"
                        >
                          {(() => {
                            const artworks = gameState.hobbies.find(h => h.id === 'art')?.artworks || [];
                            if (!artworks.length) {
                              return (
                                <View style={styles.artworksModalEmptyState}>
                                  <Text style={styles.artworksModalEmptyText}>No art uploaded yet</Text>
                                  <Text style={styles.artworksModalEmptySubtext}>Upload your first artwork to start earning!</Text>
                                </View>
                              );
                            }
                            const sorted = [...artworks].sort((a, b) => b.weeklyIncome - a.weeklyIncome);
                            return (
                              <View style={styles.artworksModalArtworksList}>
                                {sorted.map((art, index) => (
                                  <View key={art.id} style={styles.artworksModalArtworkItem}>
                                    <LinearGradient
                                      colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
                                      style={styles.artworksModalArtworkGlass}
                                    >
                                      <View style={styles.artworksModalArtworkInfo}>
                                        <Text style={styles.artworksModalArtworkGrade}>{art.grade}</Text>
                                        <Text style={styles.artworksModalArtworkIncome}>${art.weeklyIncome}/week</Text>
                                      </View>
                                      <View style={styles.artworksModalArtworkRank}>
                                        <Text style={styles.artworksModalArtworkRankText}>#{index + 1}</Text>
                                      </View>
                                    </LinearGradient>
                                  </View>
                                ))}
                              </View>
                            );
                          })()}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.artworksModalFooter}>
                          <LinearGradient
                            colors={['rgba(139, 92, 246, 0.3)', 'rgba(124, 58, 237, 0.2)']}
                            style={styles.artworksModalFooterGlass}
                          >
                            <Text style={styles.artworksModalFooterText}>
                              💡 Tip: Higher grade artworks earn more weekly income!
                            </Text>
                          </LinearGradient>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </TouchableOpacity>
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

              {/* Play Popup removed: directly open Contracts modal inline */}

              <Modal visible={!!showContracts} transparent animationType="fade">
                <View style={styles.contractModalOverlay}>
                  <View style={styles.contractModalContainer}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']}
                      style={styles.contractModalGlass}
                    >
                      {(() => {
                        const hobby = gameState.hobbies.find(h => h.id === showContracts);
                        const contract = hobby?.contracts?.[0];
                        return contract ? (
                          <View style={styles.contractModalContent}>
                            <View style={styles.contractModalHeader}>
                              <Text style={styles.contractModalTitle}>{contract.team}</Text>
                              <TouchableOpacity 
                                style={styles.contractModalCloseButton}
                                onPress={() => setShowContracts(null)}
                              >
                                <LinearGradient
                                  colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                                  style={styles.contractModalCloseGradient}
                                >
                                  <X size={20} color="#FFFFFF" />
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                            
                            <View style={styles.contractModalBody}>
                              <View style={styles.contractModalInfo}>
                                <Text style={styles.contractModalLabel}>Division</Text>
                                <Text style={styles.contractModalValue}>{hobby!.divisions![contract.division].name}</Text>
                              </View>
                              <View style={styles.contractModalInfo}>
                                <Text style={styles.contractModalLabel}>Goal</Text>
                                <Text style={styles.contractModalValue}>#{contract.goal}</Text>
                              </View>
                              <View style={styles.contractModalInfo}>
                                <Text style={styles.contractModalLabel}>Match Pay</Text>
                                <Text style={styles.contractModalValue}>${contract.matchPay}</Text>
                              </View>
                              <View style={styles.contractModalInfo}>
                                <Text style={styles.contractModalLabel}>Weeks Remaining</Text>
                                <Text style={styles.contractModalValue}>{contract.weeksRemaining}</Text>
                              </View>
                            </View>
                            
                            <TouchableOpacity
                              style={styles.contractModalActionButton}
                              onPress={() => handleCancelContract(showContracts!)}
                            >
                              <LinearGradient
                                colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                                style={styles.contractModalActionGradient}
                              >
                                <Text style={styles.contractModalActionText}>Cancel Contract</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.contractModalContent}>
                            <View style={styles.contractModalHeader}>
                              <Text style={styles.contractModalTitle}>No Contracts</Text>
                              <TouchableOpacity 
                                style={styles.contractModalCloseButton}
                                onPress={() => setShowContracts(null)}
                              >
                                <LinearGradient
                                  colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                                  style={styles.contractModalCloseGradient}
                                >
                                  <X size={20} color="#FFFFFF" />
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                            <View style={styles.contractModalBody}>
                              <Text style={styles.contractModalEmptyText}>No contracts available yet</Text>
                            </View>
                          </View>
                        );
                      })()}
                    </LinearGradient>
                  </View>
                </View>
              </Modal>

              <Modal visible={!!contractOffers} transparent animationType="fade">
                <View style={styles.contractModalOverlay}>
                  <View style={styles.contractModalContainer}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']}
                      style={styles.contractModalGlass}
                    >
                      {selectedOffer && contractOffers ? (
                        (() => {
                          // RC-0 FIX: Add null check to prevent crash if hobby not found
                          const hobby = gameState.hobbies.find(h => h.id === contractOffers.hobbyId);
                          if (!hobby) {
                            return (
                              <View style={styles.contractModalContent}>
                                <Text style={styles.contractModalTitle}>Error: Hobby not found</Text>
                              </View>
                            );
                          }
                          return (
                            <View style={styles.contractModalContent}>
                              <View style={styles.contractModalHeader}>
                                <Text style={styles.contractModalTitle}>{selectedOffer.team}</Text>
                                <TouchableOpacity 
                                  style={styles.contractModalCloseButton}
                                  onPress={() => setSelectedOffer(null)}
                                >
                                  <LinearGradient
                                    colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                                    style={styles.contractModalCloseGradient}
                                  >
                                    <X size={20} color="#FFFFFF" />
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                              
                              <View style={styles.contractModalBody}>
                                <View style={styles.contractModalInfo}>
                                  <Text style={styles.contractModalLabel}>Division</Text>
                                  <Text style={styles.contractModalValue}>{hobby.divisions![selectedOffer.division].name}</Text>
                                </View>
                                <View style={styles.contractModalInfo}>
                                  <Text style={styles.contractModalLabel}>Goal</Text>
                                  <Text style={styles.contractModalValue}>#{selectedOffer.goal}</Text>
                                </View>
                                <View style={styles.contractModalInfo}>
                                  <Text style={styles.contractModalLabel}>Duration</Text>
                                  <Text style={styles.contractModalValue}>{selectedOffer.totalWeeks} weeks</Text>
                                </View>
                                <View style={styles.contractModalInfo}>
                                  <Text style={styles.contractModalLabel}>Pay per Match</Text>
                                  <Text style={styles.contractModalValue}>${selectedOffer.matchPay}</Text>
                                </View>
                              </View>
                              
                              <TouchableOpacity
                                style={styles.contractModalActionButton}
                                onPress={() => handleAcceptContract(contractOffers.hobbyId, selectedOffer)}
                              >
                                <LinearGradient
                                  colors={['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 0.6)']}
                                  style={styles.contractModalActionGradient}
                                >
                                  <Text style={styles.contractModalActionText}>Sign Contract</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          );
                        })()
                      ) : contractOffers ? (
                        (() => {
                          // RC-0 FIX: Add null check to prevent crash if hobby not found
                          const hobby = gameState.hobbies.find(h => h.id === contractOffers.hobbyId);
                          if (!hobby) {
                            return (
                              <View style={styles.contractModalContent}>
                                <Text style={styles.contractModalTitle}>Error: Hobby not found</Text>
                              </View>
                            );
                          }
                          return (
                            <View style={styles.contractModalContent}>
                              <View style={styles.contractModalHeader}>
                                <Text style={styles.contractModalTitle}>Choose Contract</Text>
                                <TouchableOpacity 
                                  style={styles.contractModalCloseButton}
                                  onPress={() => {
                                    setSelectedOffer(null);
                                    setContractOffers(null);
                                  }}
                                >
                                  <LinearGradient
                                    colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                                    style={styles.contractModalCloseGradient}
                                  >
                                    <X size={20} color="#FFFFFF" />
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                              
                              <ScrollView style={styles.contractModalBody}>
                                {contractOffers.offers.map(offer => (
                                  <View key={offer.id} style={styles.contractModalOfferItem}>
                                    <LinearGradient
                                      colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
                                      style={styles.contractModalOfferGlass}
                                    >
                                      <View style={styles.contractModalOfferInfo}>
                                        <Text style={styles.contractModalOfferTeam}>{offer.team}</Text>
                                        <Text style={styles.contractModalOfferDetails}>
                                          {hobby.divisions![offer.division].name} - Goal #{offer.goal}
                                        </Text>
                                        <Text style={styles.contractModalOfferPay}>${offer.matchPay}/match</Text>
                                      </View>
                                      <TouchableOpacity 
                                        style={styles.contractModalOfferButton}
                                        onPress={() => setSelectedOffer(offer)}
                                      >
                                        <LinearGradient
                                          colors={['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']}
                                          style={styles.contractModalOfferButtonGradient}
                                        >
                                          <Text style={styles.contractModalOfferButtonText}>Sign</Text>
                                        </LinearGradient>
                                      </TouchableOpacity>
                                    </LinearGradient>
                                  </View>
                                ))}
                              </ScrollView>
                            </View>
                          );
                        })()
                      ) : null}
                    </LinearGradient>
                  </View>
                </View>
              </Modal>

              <Modal visible={!!showLeague} transparent animationType="fade">
                <View style={styles.leagueModalOverlay}>
                  <View style={styles.leagueModalContainer}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']}
                      style={styles.leagueModalGlass}
                    >
                      {showLeague && (() => {
                        // RC-0 FIX: Add null check to prevent crash if hobby not found
                        const hobby = gameState.hobbies.find(h => h.id === showLeague);
                        if (!hobby) {
                          return (
                            <View style={styles.leagueModalContainer}>
                              <Text style={styles.leagueModalTitle}>Error: Hobby not found</Text>
                            </View>
                          );
                        }
                        const divisions = hobby.divisions || [];
                        const data =
                          hobby.league && leagueDivision === hobby.league.division
                            ? hobby.league.standings
                            : divisions[leagueDivision].teams.map(t => ({ team: t.name, points: 0, played: 0 }));
                        return (
                          <View style={styles.leagueModalContent}>
                            <View style={styles.leagueModalHeader}>
                              <Text style={styles.leagueModalTitle}>League Standings</Text>
                              <TouchableOpacity 
                                style={styles.leagueModalCloseButton}
                                onPress={() => setShowLeague(null)}
                              >
                                <LinearGradient
                                  colors={['rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.6)']}
                                  style={styles.leagueModalCloseGradient}
                                >
                                  <X size={20} color="#FFFFFF" />
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>

                            <View style={styles.leagueModalDivisionTabs}>
                              {divisions.map((d, idx) => (
                                <TouchableOpacity
                                  key={d.name}
                                  style={styles.leagueModalDivisionTab}
                                  onPress={() => setLeagueDivision(idx)}
                                >
                                  <LinearGradient
                                    colors={leagueDivision === idx 
                                      ? ['rgba(59, 130, 246, 0.8)', 'rgba(37, 99, 235, 0.6)']
                                      : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']
                                    }
                                    style={styles.leagueModalDivisionTabGradient}
                                  >
                                    <Text style={[
                                      styles.leagueModalDivisionTabText,
                                      leagueDivision === idx && styles.leagueModalDivisionTabTextActive
                                    ]}>
                                      {d.name}
                                    </Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              ))}
                            </View>

                            <ScrollView style={styles.leagueModalStandings} showsVerticalScrollIndicator={false}>
                              {data
                                .sort((a, b) => b.points - a.points)
                                .map((t, i) => {
                                  const isTeam = t.team === hobby.team;
                                  return (
                                    <View key={t.team} style={styles.leagueModalStandingItem}>
                                      <LinearGradient
                                        colors={isTeam 
                                          ? ['rgba(16, 185, 129, 0.6)', 'rgba(5, 150, 105, 0.4)']
                                          : ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']
                                        }
                                        style={styles.leagueModalStandingGlass}
                                      >
                                        <View style={styles.leagueModalStandingPosition}>
                                          <Text style={[
                                            styles.leagueModalStandingPositionText,
                                            isTeam && styles.leagueModalStandingPositionTextActive
                                          ]}>
                                            {i + 1}
                                          </Text>
                                        </View>
                                        <View style={styles.leagueModalStandingInfo}>
                                          <Text style={[
                                            styles.leagueModalStandingTeam,
                                            isTeam && styles.leagueModalStandingTeamActive
                                          ]}>
                                            {t.team}
                                          </Text>
                                          <Text style={[
                                            styles.leagueModalStandingStats,
                                            isTeam && styles.leagueModalStandingStatsActive
                                          ]}>
                                            {t.points} pts • {t.played} played
                                          </Text>
                                        </View>
                                        {isTeam && (
                                          <View style={styles.leagueModalStandingBadge}>
                                            <Text style={styles.leagueModalStandingBadgeText}>YOU</Text>
                                          </View>
                                        )}
                                      </LinearGradient>
                                    </View>
                                  );
                                })}
                            </ScrollView>
                          </View>
                        );
                      })()}
                    </LinearGradient>
                  </View>
                </View>
              </Modal>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  lockedCareerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(16),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    marginBottom: scale(12),
    gap: scale(12),
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
    padding: scale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    marginBottom: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  careerCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  careerCardActive: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  careerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(8),
  },
  careerName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: scale(4),
  },
  careerNameDark: {
    color: '#FFFFFF',
  },
  careerDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    lineHeight: fontScale(20),
  },
  careerDescriptionDark: {
    color: '#9CA3AF',
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
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    boxShadow: '0px 1px 3px rgba(37, 99, 235, 0.3)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  streetJobHeader: {
    padding: 8,
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
    backgroundColor: '#0A1628',
    padding: 6,
    gap: 4,
  },
  streetStatCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1A2642',
    borderRadius: 4,
    padding: 4,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#2563EB',
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
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    boxShadow: '0px 1px 3px rgba(5, 150, 105, 0.25)',
    shadowColor: 'rgba(5, 150, 105, 0.8)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  careerGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
  },
  careerJobHeader: {
    padding: 8,
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
    backgroundColor: 'rgba(4, 120, 87, 0.12)',
    padding: 6,
    gap: 4,
  },
  careerStatCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 4,
    padding: 4,
    alignItems: 'center',
    borderWidth: 0.75,
    borderColor: 'rgba(16, 185, 129, 0.45)',
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
    backgroundColor: 'rgba(4, 120, 87, 0.10)',
    padding: 8,
    alignItems: 'center',
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
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    boxShadow: '0px 1px 3px rgba(220, 38, 38, 0.3)',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  crimeJobHeader: {
    padding: 8,
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
    backgroundColor: '#111111',
    padding: 6,
    gap: 4,
  },
  crimeStatCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    padding: 4,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#333333',
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
    backgroundColor: '#0A0A0A',
    padding: 8,
    alignItems: 'center',
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
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
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
