/**
 * YouVideo App Component
 * 
 * Complete video creation platform with recording, rendering, and uploading
 * Includes energy costs, realistic view simulation, and subscriber growth
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft,
  Play,
  Users,
  TrendingUp,
  DollarSign,
  Gamepad2,
  Star,
  Crown,
  Clock,
  Video,
  Upload,
  Settings,
  Zap,
  Eye,
  Heart,
  MessageCircle,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';


const { width: screenWidth } = Dimensions.get('window');

// Simple scaling functions
const scale = (size: number): number => {
  const width = screenWidth;
  const baseWidth = 390;
  const scaleFactor = Math.min(Math.max(width / baseWidth, 0.8), 1.2);
  return Math.round(size * scaleFactor);
};

const fontScale = (size: number): number => {
  const width = screenWidth;
  const baseWidth = 390;
  const scaleFactor = Math.min(Math.max(width / baseWidth, 0.9), 1.1);
  return Math.round(size * scaleFactor);
};

// Available video types with reduced energy costs
const AVAILABLE_VIDEOS = [
  { id: 'minecraft', name: 'Minecraft Video', baseViewers: 50, baseEarnings: 2, required: 0, cost: 150, energyCost: 20, description: 'Creative sandbox gameplay' },
  { id: 'amongus', name: 'Among Us Video', baseViewers: 80, baseEarnings: 3, required: 0, cost: 80, energyCost: 25, description: 'Social deduction gameplay' },
  { id: 'fortnite', name: 'Fortnite Video', baseViewers: 120, baseEarnings: 4, required: 100, cost: 50, energyCost: 30, description: 'Battle royale gameplay' },
  { id: 'valorant', name: 'Valorant Video', baseViewers: 150, baseEarnings: 5, required: 200, cost: 75, energyCost: 35, description: 'Tactical shooter gameplay' },
  { id: 'league', name: 'League of Legends Video', baseViewers: 200, baseEarnings: 6, required: 500, cost: 100, energyCost: 40, description: 'MOBA gameplay' },
];

// Upgrade Store Items
const UPGRADE_STORE = {
  // Computer Hardware
  gpu: {
    id: 'gpu',
    name: 'Graphics Card',
    category: 'hardware',
    description: 'Reduces rendering time and energy cost',
    baseCost: 500,
    maxLevel: 5,
    effects: {
      energyReduction: [0.05, 0.10, 0.15, 0.20, 0.25], // 5% to 25% reduction
      renderTimeReduction: [0.10, 0.20, 0.30, 0.40, 0.50], // 10% to 50% faster
      qualityBonus: [0.02, 0.05, 0.08, 0.12, 0.15], // 2% to 15% quality boost
    }
  },
  cpu: {
    id: 'cpu',
    name: 'Processor',
    category: 'hardware',
    description: 'Reduces overall processing time',
    baseCost: 400,
    maxLevel: 5,
    effects: {
      energyReduction: [0.03, 0.07, 0.12, 0.18, 0.25], // 3% to 25% reduction
      processingTimeReduction: [0.15, 0.25, 0.35, 0.45, 0.55], // 15% to 55% faster
      qualityBonus: [0.01, 0.03, 0.06, 0.10, 0.15], // 1% to 15% quality boost
    }
  },
  ram: {
    id: 'ram',
    name: 'RAM Memory',
    category: 'hardware',
    description: 'Allows longer videos with better quality',
    baseCost: 300,
    maxLevel: 5,
    effects: {
      maxVideoLength: [5, 10, 15, 20, 30], // 5 to 30 minutes
      qualityBonus: [0.03, 0.06, 0.10, 0.15, 0.20], // 3% to 20% quality boost
      energyReduction: [0.02, 0.05, 0.08, 0.12, 0.18], // 2% to 18% reduction
    }
  },
  storage: {
    id: 'storage',
    name: 'Storage Drive',
    category: 'hardware',
    description: 'More storage = more videos can be queued',
    baseCost: 200,
    maxLevel: 5,
    effects: {
      maxQueuedVideos: [3, 5, 8, 12, 20], // 3 to 20 queued videos
      uploadSpeed: [0.05, 0.12, 0.20, 0.30, 0.40], // 5% to 40% faster uploads
      energyReduction: [0.01, 0.03, 0.06, 0.10, 0.15], // 1% to 15% reduction
    }
  },

  // Recording Equipment
  microphone: {
    id: 'microphone',
    name: 'Professional Microphone',
    category: 'equipment',
    description: 'Better audio = more views/subscribers',
    baseCost: 250,
    maxLevel: 5,
    effects: {
      viewMultiplier: [1.05, 1.12, 1.20, 1.30, 1.45], // 5% to 45% more views
      subscriberBonus: [0.02, 0.05, 0.08, 0.12, 0.18], // 2% to 18% more subs
      qualityBonus: [0.05, 0.10, 0.15, 0.20, 0.25], // 5% to 25% quality boost
    }
  },
  webcam: {
    id: 'webcam',
    name: 'HD Webcam',
    category: 'equipment',
    description: 'Face cam = higher engagement',
    baseCost: 200,
    maxLevel: 5,
    effects: {
      viewMultiplier: [1.08, 1.15, 1.25, 1.35, 1.50], // 8% to 50% more views
      engagementBonus: [0.10, 0.20, 0.30, 0.40, 0.50], // 10% to 50% engagement
      qualityBonus: [0.03, 0.07, 0.12, 0.18, 0.25], // 3% to 25% quality boost
    }
  },
  captureCard: {
    id: 'captureCard',
    name: 'Capture Card',
    category: 'equipment',
    description: 'Better quality = higher CPM',
    baseCost: 350,
    maxLevel: 5,
    effects: {
      cpmBonus: [0.05, 0.12, 0.20, 0.30, 0.40], // 5% to 40% higher CPM
      qualityBonus: [0.08, 0.15, 0.25, 0.35, 0.45], // 8% to 45% quality boost
      viewMultiplier: [1.03, 1.08, 1.15, 1.25, 1.35], // 3% to 35% more views
    }
  },
  lighting: {
    id: 'lighting',
    name: 'Professional Lighting',
    category: 'equipment',
    description: 'Professional setup = better retention',
    baseCost: 150,
    maxLevel: 5,
    effects: {
      retentionBonus: [0.05, 0.12, 0.20, 0.30, 0.40], // 5% to 40% better retention
      qualityBonus: [0.02, 0.05, 0.08, 0.12, 0.18], // 2% to 18% quality boost
      viewMultiplier: [1.02, 1.05, 1.08, 1.12, 1.18], // 2% to 18% more views
    }
  },

  // Software & Skills
  videoEditing: {
    id: 'videoEditing',
    name: 'Video Editing Software',
    category: 'software',
    description: 'Better editing = higher quality scores',
    baseCost: 400,
    maxLevel: 5,
    effects: {
      qualityBonus: [0.10, 0.20, 0.30, 0.40, 0.50], // 10% to 50% quality boost
      viewMultiplier: [1.05, 1.12, 1.20, 1.30, 1.40], // 5% to 40% more views
      energyReduction: [0.02, 0.05, 0.08, 0.12, 0.18], // 2% to 18% reduction
    }
  },
  thumbnails: {
    id: 'thumbnails',
    name: 'Thumbnail Design',
    category: 'software',
    description: 'Better thumbnails = more clicks',
    baseCost: 300,
    maxLevel: 5,
    effects: {
      clickThroughRate: [0.05, 0.12, 0.20, 0.30, 0.40], // 5% to 40% more clicks
      viewMultiplier: [1.08, 1.15, 1.25, 1.35, 1.45], // 8% to 45% more views
      qualityBonus: [0.03, 0.07, 0.12, 0.18, 0.25], // 3% to 25% quality boost
    }
  },
  seo: {
    id: 'seo',
    name: 'SEO Skills',
    category: 'software',
    description: 'Better titles/descriptions = more discoverability',
    baseCost: 250,
    maxLevel: 5,
    effects: {
      discoverability: [0.10, 0.20, 0.30, 0.40, 0.50], // 10% to 50% more discoverable
      viewMultiplier: [1.03, 1.08, 1.15, 1.25, 1.35], // 3% to 35% more views
      qualityBonus: [0.02, 0.05, 0.08, 0.12, 0.18], // 2% to 18% quality boost
    }
  },

  // Channel Perks
  verifiedBadge: {
    id: 'verifiedBadge',
    name: 'Verified Badge',
    category: 'perks',
    description: 'Increases trust and views',
    baseCost: 1000,
    maxLevel: 1,
    effects: {
      viewMultiplier: [1.25], // 25% more views
      trustBonus: [0.30], // 30% trust bonus
      qualityBonus: [0.15], // 15% quality boost
    }
  },
  customEmotes: {
    id: 'customEmotes',
    name: 'Custom Emotes',
    category: 'perks',
    description: 'Better community engagement',
    baseCost: 800,
    maxLevel: 1,
    effects: {
      engagementBonus: [0.40], // 40% engagement bonus
      subscriberBonus: [0.25], // 25% more subscribers
      qualityBonus: [0.10], // 10% quality boost
    }
  },
  memberships: {
    id: 'memberships',
    name: 'Channel Memberships',
    category: 'perks',
    description: 'Additional revenue streams',
    baseCost: 1200,
    maxLevel: 1,
    effects: {
      revenueBonus: [0.35], // 35% more revenue
      subscriberBonus: [0.20], // 20% more subscribers
      qualityBonus: [0.12], // 12% quality boost
    }
  }
};

interface GamingAppProps {
  onBack: () => void;
}

export default function GamingApp({ onBack }: GamingAppProps) {
  const { gameState, updateGameState, updateMoney } = useGame();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'videos' | 'stats' | 'studio' | 'store'>('videos');
  const [videoTitle, setVideoTitle] = useState('');
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [renderingProgress, setRenderingProgress] = useState(0);
  const [uploadingProgress, setUploadingProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'recording' | 'rendering' | 'uploading'>('idle');
  
  // Modal states
  const [showVideoNotOwnedModal, setShowVideoNotOwnedModal] = useState(false);
  const [showNotEnoughEnergyModal, setShowNotEnoughEnergyModal] = useState(false);
  const [showVideoUploadedModal, setShowVideoUploadedModal] = useState(false);
  const [showVideoPurchasedModal, setShowVideoPurchasedModal] = useState(false);
  const [showInsufficientFundsModal, setShowInsufficientFundsModal] = useState(false);
  const [showMaxLevelModal, setShowMaxLevelModal] = useState(false);
  const [showUpgradePurchasedModal, setShowUpgradePurchasedModal] = useState(false);
  const [modalData, setModalData] = useState<any>({});

  const recordingAnimation = useRef(new Animated.Value(0)).current;
  const renderingAnimation = useRef(new Animated.Value(0)).current;
  const uploadingAnimation = useRef(new Animated.Value(0)).current;

  // Get settings for dark/light mode
  const settings = gameState.settings;
  const isDarkMode = settings.darkMode;

  // Helper function to format game date
  const formatGameDate = () => {
    const { date } = gameState;
    
    // Handle the game date structure properly
    const month = date.month || 'Jan';
    const year = date.year || 2024;
    const week = date.week || 1;
    
    // Calculate approximate day based on week (1-4 weeks per month)
    const day = Math.min(28, Math.max(1, week * 7));
    
    // Format as "Week X, Month Year" for clarity
    return `Week ${week}, ${month} ${year}`;
  };

  // Initialize gaming data if it doesn't exist
  useEffect(() => {
    if (!gameState.gamingStreaming) {
      updateGameState(prev => ({
        ...prev,
        gamingStreaming: {
          followers: 0,
          subscribers: 0,
          totalViews: 0,
          totalEarnings: 0,
          experience: 0,
          gamesPlayed: [],
          ownedGames: [],
          equipment: {},
          pcUpgradeLevels: {},
          pcComponents: {},
          videos: [],
          videoTitleCounters: {},
          streamHistory: [],
          bestStream: null,
          streamHours: 0,
          totalSubEarnings: 0,
          totalDonations: 0,
          upgrades: {},
          videoRecordingState: {
            isRecording: false,
            recordProgress: 0,
            renderProgress: 0,
            uploadProgress: 0,
            currentPhase: 'idle',
            videoTitle: '',
            videoGame: '',
            isRendering: false,
            isUploading: false,
          },
          streamingState: {
            isStreaming: false,
            streamProgress: 0,
            selectedGame: null,
            streamDuration: 0,
            currentViewers: 0,
            currentEarnings: 0,
            streamStartTime: 0,
            streamPauseTime: 0,
            totalPausedTime: 0,
            isPaused: false,
            streamQuality: 'medium',
            chatEnabled: true,
            donationsEnabled: true,
            subsEnabled: true,
            streamTitle: '',
            streamDescription: '',
            streamTags: [],
            streamCategory: 'gaming',
            streamLanguage: 'en',
            streamAgeRestriction: false,
            streamMonetization: true,
            streamAds: true,
            streamSchedule: [],
            streamNotifications: true,
            streamAnalytics: {
              peakViewers: 0,
              averageViewers: 0,
              totalChatMessages: 0,
              totalEmotes: 0,
              totalShares: 0,
              totalClips: 0,
              streamRating: 0,
              streamFeedback: [],
            },
          },
        },
      }));
    }
  }, [gameState.gamingStreaming, updateGameState]);

  const videoData = gameState.gamingStreaming || {
    followers: 0,
    subscribers: 0,
    totalViews: 0,
    totalEarnings: 0,
    experience: 0,
    gamesPlayed: [],
    ownedGames: [],
    equipment: {},
    pcUpgradeLevels: {},
    pcComponents: {},
    videos: [],
    videoTitleCounters: {},
    streamHistory: [],
    bestStream: null,
    streamHours: 0,
    totalSubEarnings: 0,
    totalDonations: 0,
    upgrades: {},
    videoRecordingState: {
      isRecording: false,
      recordProgress: 0,
      renderProgress: 0,
      uploadProgress: 0,
      currentPhase: 'idle',
      videoTitle: '',
      videoGame: '',
      isRendering: false,
      isUploading: false,
    },
    streamingState: {
      isStreaming: false,
      streamProgress: 0,
      selectedGame: null,
      streamDuration: 0,
      currentViewers: 0,
      currentEarnings: 0,
      streamStartTime: 0,
      streamPauseTime: 0,
      totalPausedTime: 0,
      isPaused: false,
      streamQuality: 'medium',
      chatEnabled: true,
      donationsEnabled: true,
      subsEnabled: true,
      streamTitle: '',
      streamDescription: '',
      streamTags: [],
      streamCategory: 'gaming',
      streamLanguage: 'en',
      streamAgeRestriction: false,
      streamMonetization: true,
      streamAds: true,
      streamSchedule: [],
      streamNotifications: true,
      streamAnalytics: {
        peakViewers: 0,
        averageViewers: 0,
        totalChatMessages: 0,
        totalEmotes: 0,
        totalShares: 0,
        totalClips: 0,
        streamRating: 0,
        streamFeedback: [],
      },
    },
  };

  // Calculate upgrade modifiers for video creation
  // NOTE: This function should only be called in event handlers or effects, not during render
  const calculateUpgradeModifiers = () => {
    const currentUpgrades = videoData.upgrades || {};
    let modifiers = {
      energyReduction: 0,
      renderTimeReduction: 0,
      processingTimeReduction: 0,
      uploadSpeed: 0,
      qualityBonus: 0,
      viewMultiplier: 1,
      cpmBonus: 0,
      subscriberBonus: 0,
      engagementBonus: 0,
      retentionBonus: 0,
      clickThroughRate: 0,
      discoverability: 0,
      trustBonus: 0,
      revenueBonus: 0,
    };

    // Apply all active upgrade effects
    Object.entries(currentUpgrades).forEach(([upgradeId, level]) => {
      const upgrade = UPGRADE_STORE[upgradeId as keyof typeof UPGRADE_STORE];
      if (!upgrade || level === 0) return;

      const levelIndex = level - 1; // Convert to 0-based index
      
      Object.entries(upgrade.effects).forEach(([effectKey, effectValues]) => {
        if (Array.isArray(effectValues) && effectValues[levelIndex] !== undefined) {
          const effect = effectValues[levelIndex];
          
          switch (effectKey) {
            case 'energyReduction':
              modifiers.energyReduction += effect;
              break;
            case 'renderTimeReduction':
              modifiers.renderTimeReduction += effect;
              break;
            case 'processingTimeReduction':
              modifiers.processingTimeReduction += effect;
              break;
            case 'uploadSpeed':
              modifiers.uploadSpeed += effect;
              break;
            case 'qualityBonus':
              modifiers.qualityBonus += effect;
              break;
            case 'viewMultiplier':
              modifiers.viewMultiplier *= effect;
              break;
            case 'cpmBonus':
              modifiers.cpmBonus += effect;
              break;
            case 'subscriberBonus':
              modifiers.subscriberBonus += effect;
              break;
            case 'engagementBonus':
              modifiers.engagementBonus += effect;
              break;
            case 'retentionBonus':
              modifiers.retentionBonus += effect;
              break;
            case 'clickThroughRate':
              modifiers.clickThroughRate += effect;
              break;
            case 'discoverability':
              modifiers.discoverability += effect;
              break;
            case 'trustBonus':
              modifiers.trustBonus += effect;
              break;
            case 'revenueBonus':
              modifiers.revenueBonus += effect;
              break;
          }
        }
      });
    });

    // Cap reductions at 90% to prevent negative values
    modifiers.energyReduction = Math.min(modifiers.energyReduction, 0.9);
    modifiers.renderTimeReduction = Math.min(modifiers.renderTimeReduction, 0.9);
    modifiers.processingTimeReduction = Math.min(modifiers.processingTimeReduction, 0.9);
    modifiers.uploadSpeed = Math.min(modifiers.uploadSpeed, 0.9);

    return modifiers;
  };

  // Calculate realistic video views based on subscribers and time
  const calculateVideoViews = (baseViewers: number, quality: number, subscribers: number) => {
    const modifiers = calculateUpgradeModifiers();
    
    // Base views increase with subscribers
    const subscriberMultiplier = 1 + (subscribers / 1000) * 0.5;
    let views = Math.floor(baseViewers * subscriberMultiplier * quality);
    
    // Apply upgrade view multiplier
    views = Math.floor(views * modifiers.viewMultiplier);
    
    // Add random variance
    views = Math.floor(views * (0.8 + Math.random() * 0.4));
    
    // Simulate viral potential (rare but possible)
    if (Math.random() < 0.05) { // 5% chance
      views = Math.floor(views * (2 + Math.random() * 3)); // 2x to 5x boost
    }
    
    return Math.max(1, views);
  };

  // Calculate earnings based on views (pay per view system)
  const calculateVideoEarnings = (views: number, quality: number, subscribers: number) => {
    const modifiers = calculateUpgradeModifiers();
    
    // Base CPM (Cost Per Mille) - how much you earn per 1000 views
    let baseCPM = 2.0; // $2 per 1000 views base
    
    // Quality bonus
    baseCPM += quality * 0.5;
    
    // Subscriber bonus (more subscribers = better monetization)
    const subscriberBonus = Math.min(3.0, subscribers / 5000); // Max +$3 CPM
    baseCPM += subscriberBonus;
    
    // Apply upgrade CPM bonus
    baseCPM += baseCPM * modifiers.cpmBonus;
    
    // Apply upgrade revenue bonus
    baseCPM += baseCPM * modifiers.revenueBonus;
    
    // Calculate earnings
    const earnings = (views / 1000) * baseCPM;
    
    // Add some randomness
    const finalEarnings = earnings * (0.8 + Math.random() * 0.4);
    
    return Math.round(finalEarnings * 100) / 100; // Round to 2 decimal places
  };

  // Calculate subscriber gain based on views
  const calculateSubscriberGain = (views: number, quality: number, currentSubscribers: number) => {
    const modifiers = calculateUpgradeModifiers();
    
    // Base conversion rate: 0.1% to 0.3% of viewers become subscribers
    let baseRate = 0.001 + (quality * 0.0002);
    
    // Diminishing returns as subscribers grow
    const diminishingFactor = Math.max(0.3, 1 - (currentSubscribers / 100000));
    baseRate *= diminishingFactor;
    
    // Apply upgrade subscriber bonus
    baseRate += baseRate * modifiers.subscriberBonus;
    
    // Apply upgrade engagement bonus
    baseRate += baseRate * modifiers.engagementBonus;
    
    // Calculate subscribers gained
    const subscribersGained = Math.floor(views * baseRate);
    
    // Add some randomness
    return Math.floor(subscribersGained * (0.7 + Math.random() * 0.6));
  };

  const startVideoCreation = (videoId: string) => {
    const video = AVAILABLE_VIDEOS.find(v => v.id === videoId);
    if (!video) return;

    if (!videoData.ownedGames.includes(videoId) && video.cost > 0) {
      setModalData({ videoName: video.name, videoCost: video.cost });
      setShowVideoNotOwnedModal(true);
      return;
    }

    // Check energy with upgrade energy reduction
    const modifiers = calculateUpgradeModifiers();
    const effectiveEnergyCost = Math.ceil(video.energyCost * (1 - modifiers.energyReduction));
    
    if (gameState.stats.energy < effectiveEnergyCost) {
      setModalData({ requiredEnergy: effectiveEnergyCost, currentEnergy: gameState.stats.energy });
      setShowNotEnoughEnergyModal(true);
      return;
    }

    setSelectedVideo(videoId);
    setVideoTitle(`${video.name} - ${formatGameDate()}`);
    setActiveTab('studio');
  };

  const startRecording = () => {
    if (!selectedVideo || !videoTitle.trim()) return;
    
    setIsRecording(true);
    setCurrentPhase('recording');
    setRecordingProgress(0);
    
    // Animate recording progress
    Animated.timing(recordingAnimation, {
      toValue: 1,
      duration: 5000, // 5 seconds to record
      useNativeDriver: false,
    }).start();
    
    // Simulate recording progress with real-time energy drain
    const interval = setInterval(() => {
      setRecordingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          finishRecording();
          return 100;
        }
        
        // Drain energy in real-time with upgrade energy reduction
        const video = AVAILABLE_VIDEOS.find(v => v.id === selectedVideo);
        if (video) {
          const modifiers = calculateUpgradeModifiers();
          const effectiveEnergyCost = video.energyCost * (1 - modifiers.energyReduction);
          const energyPerTick = effectiveEnergyCost / 50; // 50 ticks over 5 seconds
          
          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            updateGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                energy: Math.max(0, prev.stats.energy - energyPerTick),
              },
            }));
          }, 0);
        }
        
        return Math.min(100, Math.round((prev + 2) * 100) / 100);
      });
    }, 100);
  };

  const finishRecording = () => {
    setIsRecording(false);
    setCurrentPhase('rendering');
    setIsRendering(true);
    setRenderingProgress(0);
    
    // Animate rendering progress with upgrade time reduction
    const modifiers = calculateUpgradeModifiers();
    const renderDuration = 8000 * (1 - modifiers.renderTimeReduction - modifiers.processingTimeReduction);
    
    Animated.timing(renderingAnimation, {
      toValue: 1,
      duration: Math.max(2000, renderDuration), // Minimum 2 seconds
      useNativeDriver: false,
    }).start();
    
    // Simulate rendering progress with real-time energy drain
    const interval = setInterval(() => {
      setRenderingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          finishRendering();
          return 100;
        }
        
        // Drain energy in real-time during rendering with upgrade energy reduction
        const video = AVAILABLE_VIDEOS.find(v => v.id === selectedVideo);
        if (video) {
          const effectiveEnergyCost = (video.energyCost / 2) * (1 - modifiers.energyReduction);
          const actualDuration = Math.max(2000, renderDuration);
          const ticks = Math.ceil(actualDuration / 120);
          const energyPerTick = effectiveEnergyCost / ticks;
          
          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            updateGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                energy: Math.max(0, prev.stats.energy - energyPerTick),
              },
            }));
          }, 0);
          
          // Calculate progress increment based on actual duration
          const progressIncrement = 100 / ticks;
          return Math.min(100, Math.round((prev + progressIncrement) * 100) / 100);
        }
        
        // Fallback if no video found
        return prev + 1.5;
      });
    }, 120);
  };

  const finishRendering = () => {
    setIsRendering(false);
    setCurrentPhase('uploading');
    setIsUploading(true);
    setUploadingProgress(0);
    
    // Animate uploading progress with upgrade upload speed
    const modifiers = calculateUpgradeModifiers();
    const uploadDuration = 6000 * (1 - modifiers.uploadSpeed);
    
    Animated.timing(uploadingAnimation, {
      toValue: 1,
      duration: Math.max(2000, uploadDuration), // Minimum 2 seconds
      useNativeDriver: false,
    }).start();
    
    // Simulate uploading progress with real-time energy drain
    const interval = setInterval(() => {
      setUploadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          finishUpload();
          return 100;
        }
        
        // Drain energy in real-time during uploading with upgrade energy reduction
        const video = AVAILABLE_VIDEOS.find(v => v.id === selectedVideo);
        if (video) {
          const effectiveEnergyCost = (video.energyCost / 4) * (1 - modifiers.energyReduction);
          const actualDuration = Math.max(2000, uploadDuration);
          const ticks = Math.ceil(actualDuration / 120);
          const energyPerTick = effectiveEnergyCost / ticks;
          
          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            updateGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                energy: Math.max(0, prev.stats.energy - energyPerTick),
              },
            }));
          }, 0);
          
          // Calculate progress increment based on actual duration
          const progressIncrement = 100 / ticks;
          return Math.min(100, Math.round((prev + progressIncrement) * 100) / 100);
        }
        
        // Fallback if no video found
        return prev + 2;
      });
    }, 120);
  };

  const finishUpload = () => {
    setIsUploading(false);
    setCurrentPhase('idle');
    
    if (!selectedVideo) return;
    
    const video = AVAILABLE_VIDEOS.find(v => v.id === selectedVideo);
    if (!video) return;
    
    // Calculate video performance with upgrade bonuses
    const modifiers = calculateUpgradeModifiers();
    let quality = 0.5 + Math.random() * 0.5; // 0.5 to 1.0 quality
    
    // Apply upgrade quality bonuses
    quality += modifiers.qualityBonus;
    
    // Cap quality at 1.0
    quality = Math.min(1.0, quality);
    const views = calculateVideoViews(video.baseViewers, quality, videoData.subscribers);
    const earnings = calculateVideoEarnings(views, quality, videoData.subscribers);
    const subscribersGained = calculateSubscriberGain(views, quality, videoData.subscribers);
    
    // Create video object
    const newVideo = {
      id: Date.now().toString(),
      title: videoTitle,
      game: video.name,
      quality: Math.round(quality * 100) / 100,
      views,
      earnings,
      subscribersGained,
      uploadedAt: Date.now(), // Keep timestamp for sorting, but display will use game date
      duration: '5:00',
      likes: Math.floor(views * 0.05), // 5% like rate
      comments: Math.floor(views * 0.01), // 1% comment rate
    };
    
    // Update game state
    updateGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        videos: [newVideo, ...(prev.gamingStreaming!.videos || [])].slice(0, 50), // Keep last 50 videos
        totalViews: prev.gamingStreaming!.totalViews + views,
        totalEarnings: prev.gamingStreaming!.totalEarnings + earnings,
        subscribers: prev.gamingStreaming!.subscribers + subscribersGained,
        followers: prev.gamingStreaming!.followers + Math.floor(subscribersGained * 2),
        experience: prev.gamingStreaming!.experience + Math.floor(views / 10),
      },
      stats: {
        ...prev.stats,
        money: prev.stats.money + earnings,
      },
    }));
    
    // Reset state
    setSelectedVideo(null);
    setVideoTitle('');
    setRecordingProgress(0);
    setRenderingProgress(0);
    setUploadingProgress(0);
    
    setModalData({ 
      videoTitle, 
      views, 
      earnings, 
      subscribersGained, 
      energyUsed: video.energyCost 
    });
    setShowVideoUploadedModal(true);
  };

  const buyVideo = (videoId: string) => {
    const video = AVAILABLE_VIDEOS.find(v => v.id === videoId);
    if (!video) return;

    if (gameState.stats.money >= video.cost) {
      // Use centralized money handling - don't update dailySummary for video purchases
      updateMoney(-video.cost, `Buy ${video.name}`, false);
      
      updateGameState(prev => ({
        ...prev,
        gamingStreaming: {
          ...prev.gamingStreaming!,
          ownedGames: [...prev.gamingStreaming!.ownedGames, videoId],
        },
      }));

      setModalData({ videoName: video.name });
      setShowVideoPurchasedModal(true);
    } else {
      setModalData({ videoName: video.name, videoCost: video.cost });
      setShowInsufficientFundsModal(true);
    }
  };

  const renderVideosTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Available Video Types</Text>
      {AVAILABLE_VIDEOS.map((video) => {
        const isOwned = videoData.ownedGames.includes(video.id);
        const canCreate = isOwned || video.cost === 0;
        const hasEnergy = gameState.stats.energy >= video.energyCost;
        
        return (
          <View key={video.id} style={styles.videoCard}>
            <View style={styles.videoInfo}>
              <Text style={styles.videoName}>{video.name}</Text>
              <Text style={styles.videoDescription}>{video.description}</Text>
              <View style={styles.videoStatsRow}>
                <Text style={styles.videoStats}>
                  Base Viewers: {video.baseViewers} | Weekly Earnings: ${video.baseEarnings}
                </Text>
                <View style={styles.energyCostRow}>
                  <Zap size={scale(14)} color="#F59E0B" />
                  <Text style={styles.energyCost}>
                    Energy Cost: {video.energyCost}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.videoActions}>
              {canCreate ? (
                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.createButton,
                    !hasEnergy && styles.disabledButton
                  ]}
                  onPress={() => startVideoCreation(video.id)}
                  disabled={!hasEnergy}
                >
                  <Video size={scale(16)} color="white" />
                  <Text style={styles.buttonText}>
                    {hasEnergy ? 'Create' : 'No Energy'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.buyButton]}
                  onPress={() => buyVideo(video.id)}
                  disabled={gameState.stats.money < video.cost}
                >
                  <Text style={styles.buttonText}>Buy ${video.cost}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderStatsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Channel Statistics</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Users size={scale(24)} color="#8B5CF6" />
          <Text style={styles.statValue}>{videoData.followers.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        
        <View style={styles.statCard}>
          <Star size={scale(24)} color="#F59E0B" />
          <Text style={styles.statValue}>{videoData.subscribers.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Subscribers</Text>
        </View>
        
        <View style={styles.statCard}>
          <TrendingUp size={scale(24)} color="#10B981" />
          <Text style={styles.statValue}>{videoData.totalViews.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Views</Text>
        </View>
        
        <View style={styles.statCard}>
          <DollarSign size={scale(24)} color="#EF4444" />
          <Text style={styles.statValue}>${videoData.totalEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        
        <View style={styles.statCard}>
          <Crown size={scale(24)} color="#8B5CF6" />
          <Text style={styles.statValue}>{videoData.experience.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Experience</Text>
        </View>
        
        <View style={styles.statCard}>
          <Video size={scale(24)} color="#6B7280" />
          <Text style={styles.statValue}>{videoData.videos?.length || 0}</Text>
          <Text style={styles.statLabel}>Videos Uploaded</Text>
        </View>
      </View>

      {/* Uploaded Videos Section */}
      <Text style={styles.sectionTitle}>Recent Videos</Text>
      {videoData.videos && videoData.videos.length > 0 ? (
        videoData.videos.slice(0, 10).map((video: any) => (
          <View key={video.id} style={styles.uploadedVideoCard}>
            <View style={styles.videoHeader}>
              <Text style={styles.videoTitle}>{video.title}</Text>
              <Text style={styles.videoDate}>
                {formatGameDate()}
              </Text>
            </View>
            <View style={styles.videoMetrics}>
              <View style={styles.metric}>
                <Eye size={scale(16)} color="#6B7280" />
                <Text style={styles.metricText}>{video.views.toLocaleString()}</Text>
              </View>
              <View style={styles.metric}>
                <Heart size={scale(16)} color="#EF4444" />
                <Text style={styles.metricText}>{video.likes.toLocaleString()}</Text>
              </View>
              <View style={styles.metric}>
                <MessageCircle size={scale(16)} color="#10B981" />
                <Text style={styles.metricText}>{video.comments.toLocaleString()}</Text>
              </View>
              <View style={styles.metric}>
                <DollarSign size={scale(16)} color="#F59E0B" />
                <Text style={styles.metricText}>${video.earnings.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.noVideosText}>No videos uploaded yet. Start creating!</Text>
      )}
    </ScrollView>
  );

  const renderStudioTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Video Studio</Text>
      
      {selectedVideo ? (
        <View style={styles.studioContent}>
          <View style={styles.videoSelection}>
            <Text style={styles.selectedVideoText}>
              Selected: {AVAILABLE_VIDEOS.find(v => v.id === selectedVideo)?.name}
            </Text>
          </View>
          
          <View style={styles.titleInput}>
            <Text style={styles.inputLabel}>Video Title:</Text>
            <TextInput
              style={styles.textInput}
              value={videoTitle}
              onChangeText={setVideoTitle}
              placeholder="Enter video title..."
              placeholderTextColor="#9CA3AF"
            />
          </View>
          
          {currentPhase === 'idle' && (
            <TouchableOpacity
              style={[styles.button, styles.createButton]}
              onPress={startRecording}
              disabled={!videoTitle.trim()}
            >
              <Play size={scale(20)} color="white" />
              <Text style={styles.buttonText}>Start Recording</Text>
            </TouchableOpacity>
          )}
          
          {currentPhase === 'recording' && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressTitle}>Recording Video...</Text>
              <View style={styles.energyDisplay}>
                <Zap size={scale(16)} color="#F59E0B" />
                <Text style={styles.energyText}>
                  Energy: {Math.max(0, Math.floor(gameState.stats.energy))} ⚡
                </Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    { width: recordingAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })}
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{Math.round(recordingProgress)}%</Text>
            </View>
          )}
          
          {currentPhase === 'rendering' && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressTitle}>Rendering Video...</Text>
              <View style={styles.energyDisplay}>
                <Zap size={scale(16)} color="#F59E0B" />
                <Text style={styles.energyText}>
                  Energy: {Math.max(0, Math.floor(gameState.stats.energy))} ⚡
                </Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    styles.renderingFill,
                    { width: renderingAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })}
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{Math.round(renderingProgress)}%</Text>
            </View>
          )}
          
          {currentPhase === 'uploading' && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressTitle}>Uploading to YouVideo...</Text>
              <View style={styles.energyDisplay}>
                <Zap size={scale(16)} color="#F59E0B" />
                <Text style={styles.energyText}>
                  Energy: {Math.max(0, Math.floor(gameState.stats.energy))} ⚡
                </Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    styles.uploadingFill,
                    { width: uploadingAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })}
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadingProgress)}%</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setSelectedVideo(null);
              setVideoTitle('');
              setCurrentPhase('idle');
              setIsRecording(false);
              setIsRendering(false);
              setIsUploading(false);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.studioEmpty}>
          <Video size={scale(64)} color="#6B7280" />
          <Text style={styles.studioEmptyText}>Select a video type to start creating</Text>
          <Text style={styles.studioEmptySubtext}>Go to Videos tab to choose what to create</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderStoreTab = () => {
    const currentUpgrades = videoData.upgrades || {};
    
    const purchaseUpgrade = (upgradeId: string) => {
      const upgrade = UPGRADE_STORE[upgradeId as keyof typeof UPGRADE_STORE];
      if (!upgrade) return;
      
      const currentLevel = currentUpgrades[upgradeId] || 0;
      if (currentLevel >= upgrade.maxLevel) {
        setShowMaxLevelModal(true);
        return;
      }
      
      const cost = upgrade.baseCost * (currentLevel + 1);
      if (gameState.stats.money >= cost) {
        // Use centralized money handling - don't update dailySummary for upgrade purchases
        updateMoney(-cost, `Buy ${upgrade.name} upgrade`, false);
        
        updateGameState(prev => ({
          ...prev,
          gamingStreaming: {
            ...prev.gamingStreaming!,
            upgrades: {
              ...prev.gamingStreaming!.upgrades,
              [upgradeId]: (currentLevel + 1)
            }
          }
        }));
        
        setModalData({ upgradeName: upgrade.name, newLevel: currentLevel + 1 });
        setShowUpgradePurchasedModal(true);
      } else {
        setModalData({ upgradeName: upgrade.name, cost });
        setShowInsufficientFundsModal(true);
      }
    };

    const getUpgradeEffect = (upgradeId: string, effectKey: string) => {
      const upgrade = UPGRADE_STORE[upgradeId as keyof typeof UPGRADE_STORE];
      if (!upgrade) return 0;
      
      const currentLevel = currentUpgrades[upgradeId] || 0;
      const effects = upgrade.effects[effectKey as keyof typeof upgrade.effects];
      
      if (Array.isArray(effects)) {
        return effects[currentLevel] || 0;
      }
      return 0;
    };

    const renderUpgradeCard = (upgradeId: string) => {
      const upgrade = UPGRADE_STORE[upgradeId as keyof typeof UPGRADE_STORE];
      if (!upgrade) return null;
      
      const currentLevel = currentUpgrades[upgradeId] || 0;
      const nextLevel = currentLevel + 1;
      const canUpgrade = nextLevel <= upgrade.maxLevel;
      const cost = canUpgrade ? upgrade.baseCost * nextLevel : 0;
      const hasFunds = gameState.stats.money >= cost;
      
      return (
        <View key={upgradeId} style={styles.upgradeCard}>
          <View style={styles.upgradeHeader}>
            <Text style={styles.upgradeName}>{upgrade.name}</Text>
            <View style={styles.upgradeLevelContainer}>
              <Text style={styles.upgradeLevel}>
                Level {currentLevel}/{upgrade.maxLevel}
              </Text>
              {!canUpgrade && (
                <View style={styles.maxLevelIndicator}>
                  <Text style={styles.maxLevelIndicatorText}>MAX</Text>
                </View>
              )}
            </View>
          </View>
          
          <Text style={styles.upgradeDescription}>{upgrade.description}</Text>
          
          <View style={styles.upgradeEffects}>
            {Object.entries(upgrade.effects).map(([effectKey, effectValues]) => {
              const currentEffect = Array.isArray(effectValues) ? effectValues[currentLevel - 1] || 0 : effectValues;
              // Only show next effect if we can actually upgrade and the next level exists
              const nextEffect = canUpgrade && Array.isArray(effectValues) ? effectValues[nextLevel - 1] || 0 : null;
              
              if (effectKey === 'energyReduction') {
                return (
                  <Text key={effectKey} style={[
                    styles.effectText,
                    currentEffect > 0 && styles.activeEffectText
                  ]}>
                    Energy Reduction: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'viewMultiplier') {
                return (
                  <Text key={effectKey} style={[
                    styles.effectText,
                    currentEffect > 1 && styles.activeEffectText
                  ]}>
                    View Multiplier: {Math.round((currentEffect - 1) * 100)}%
                    {nextEffect !== null && ` → ${Math.round((nextEffect - 1) * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'qualityBonus') {
                return (
                  <Text key={effectKey} style={[
                    styles.effectText,
                    currentEffect > 0 && styles.activeEffectText
                  ]}>
                    Quality Bonus: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'cpmBonus') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    CPM Bonus: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'subscriberBonus') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Subscriber Bonus: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'engagementBonus') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Engagement Bonus: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'retentionBonus') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Retention Bonus: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'clickThroughRate') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Click Rate: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'discoverability') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Discoverability: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              } else if (effectKey === 'trustBonus') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Trust Bonus: {Math.round(currentEffect * 100)}%
                  </Text>
                );
              } else if (effectKey === 'revenueBonus') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Revenue Bonus: {Math.round(currentEffect * 100)}%
                  </Text>
                );
              } else if (effectKey === 'maxVideoLength') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Max Length: {currentEffect}min
                    {nextEffect !== null && ` → ${nextEffect}min`}
                  </Text>
                );
              } else if (effectKey === 'maxQueuedVideos') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Max Queued: {currentEffect}
                    {nextEffect !== null && ` → ${nextEffect}`}
                  </Text>
                );
              } else if (effectKey === 'renderTimeReduction' || effectKey === 'processingTimeReduction' || effectKey === 'uploadSpeed') {
                return (
                  <Text key={effectKey} style={styles.effectText}>
                    Speed Bonus: {Math.round(currentEffect * 100)}%
                    {nextEffect !== null && ` → ${Math.round(nextEffect * 100)}%`}
                  </Text>
                );
              }
              
              return null;
            })}
          </View>
          
          {canUpgrade ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.upgradeButton,
                !hasFunds && styles.disabledButton
              ]}
              onPress={() => purchaseUpgrade(upgradeId)}
              disabled={!hasFunds}
            >
              <Text style={styles.buttonText}>
                {hasFunds ? `Upgrade to Lv${nextLevel} - $${cost}` : `Need $${cost}`}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.maxLevelBadge}>
              <Text style={styles.maxLevelText}>MAX LEVEL</Text>
            </View>
          )}
        </View>
      );
    };

    const categories = {
      hardware: ['gpu', 'cpu', 'ram', 'storage'],
      equipment: ['microphone', 'webcam', 'captureCard', 'lighting'],
      software: ['videoEditing', 'thumbnails', 'seo'],
      perks: ['verifiedBadge', 'customEmotes', 'memberships']
    };

    return (
      <ScrollView style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Upgrade Store</Text>
        <Text style={styles.storeDescription}>
          Upgrade your equipment and skills to improve video quality, reduce energy costs, and increase views!
        </Text>
        
        {/* Active Upgrades Summary */}
        {Object.keys(currentUpgrades).length > 0 && (
          <View style={styles.activeUpgradesSummary}>
            <Text style={styles.activeUpgradesTitle}>Active Upgrades:</Text>
            <View style={styles.activeUpgradesList}>
              {Object.entries(currentUpgrades).map(([upgradeId, level]) => {
                const upgrade = UPGRADE_STORE[upgradeId as keyof typeof UPGRADE_STORE];
                if (!upgrade) return null;
                
                return (
                  <View key={upgradeId} style={styles.activeUpgradeItem}>
                    <Text style={styles.activeUpgradeName}>{upgrade.name} Lv.{level}</Text>
                    <Text style={styles.activeUpgradeEffects}>
                      {Object.entries(upgrade.effects).map(([effectKey, effectValues]) => {
                        if (Array.isArray(effectValues) && effectValues[level - 1] !== undefined) {
                          const effect = effectValues[level - 1];
                          if (effectKey === 'energyReduction') {
                            return `Energy -${Math.round(effect * 100)}% `;
                          } else if (effectKey === 'viewMultiplier') {
                            return `Views +${Math.round((effect - 1) * 100)}% `;
                          } else if (effectKey === 'qualityBonus') {
                            return `Quality +${Math.round(effect * 100)}% `;
                          }
                        }
                        return '';
                      })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        
        {Object.entries(categories).map(([category, upgradeIds]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)} Upgrades
            </Text>
            {upgradeIds.map(renderUpgradeCard)}
          </View>
        ))}
      </ScrollView>
    );
  };

  // Create styles function that can access isDarkMode
  const getStyles = () => StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(16),
      paddingTop: scale(20),
      paddingBottom: scale(12),
    },
    backButton: {
      padding: scale(8),
      marginRight: scale(12),
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: fontScale(24),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      marginLeft: scale(12),
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: scale(16),
      marginBottom: scale(16),
    },
    tab: {
      flex: 1,
      paddingVertical: scale(12),
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: '#8B5CF6',
    },
    tabText: {
      fontSize: fontScale(16),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      fontWeight: '500',
    },
    activeTabText: {
      color: '#8B5CF6',
      fontWeight: 'bold',
    },
    tabContent: {
      flex: 1,
      paddingHorizontal: scale(16),
    },
    sectionTitle: {
      fontSize: fontScale(20),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      marginBottom: scale(16),
    },
    videoCard: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(16),
      marginBottom: scale(12),
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
      shadowColor: isDarkMode ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0 : 0.1,
      shadowRadius: isDarkMode ? 0 : 4,
      elevation: isDarkMode ? 0 : 2,
    },
    videoInfo: {
      flex: 1,
    },
    videoName: {
      fontSize: fontScale(18),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      marginBottom: scale(4),
    },
    videoDescription: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#D1D5DB' : '#6B7280',
      marginBottom: scale(8),
    },
    videoStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    videoStats: {
      fontSize: fontScale(12),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
    },
    energyCost: {
      fontSize: fontScale(12),
      color: '#F59E0B',
      fontWeight: '600',
      marginLeft: scale(4),
    },
    energyCostRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    videoActions: {
      marginLeft: scale(12),
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(16),
      paddingVertical: scale(8),
      borderRadius: scale(8),
      minWidth: scale(80),
      justifyContent: 'center',
    },
    createButton: {
      backgroundColor: '#10B981',
    },
    buyButton: {
      backgroundColor: '#8B5CF6',
    },
    disabledButton: {
      backgroundColor: isDarkMode ? '#6B7280' : '#9CA3AF',
      opacity: 0.6,
    },
    buttonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: fontScale(14),
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statCard: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(16),
      width: '48%',
      alignItems: 'center',
      marginBottom: scale(12),
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
      shadowColor: isDarkMode ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0 : 0.1,
      shadowRadius: isDarkMode ? 0 : 4,
      elevation: isDarkMode ? 0 : 2,
    },
    statValue: {
      fontSize: fontScale(24),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      marginTop: scale(8),
      marginBottom: scale(4),
    },
    statLabel: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
    },
    uploadedVideoCard: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(16),
      marginBottom: scale(12),
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
      shadowColor: isDarkMode ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0 : 0.1,
      shadowRadius: isDarkMode ? 0 : 4,
      elevation: isDarkMode ? 0 : 2,
    },
    videoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: scale(12),
    },
    videoTitle: {
      fontSize: fontScale(16),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      flex: 1,
    },
    videoDate: {
      fontSize: fontScale(12),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
    },
    videoMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    metric: {
      alignItems: 'center',
    },
    metricText: {
      fontSize: fontScale(12),
      color: isDarkMode ? '#D1D5DB' : '#4B5563',
      marginTop: scale(4),
    },
    noVideosText: {
      fontSize: fontScale(16),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: scale(20),
    },
    studioContent: {
      alignItems: 'center',
    },
    videoSelection: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(8),
      padding: scale(12),
      marginBottom: scale(16),
      width: '100%',
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
    },
    selectedVideoText: {
      fontSize: fontScale(16),
      color: isDarkMode ? 'white' : '#1F2937',
      textAlign: 'center',
      fontWeight: '600',
    },
    titleInput: {
      width: '100%',
      marginBottom: scale(20),
    },
    inputLabel: {
      fontSize: fontScale(14),
      color: isDarkMode ? 'white' : '#1F2937',
      marginBottom: scale(8),
    },
    textInput: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(8),
      padding: scale(12),
      color: isDarkMode ? 'white' : '#1F2937',
      fontSize: fontScale(16),
      borderWidth: 1,
      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
    },
    progressContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: scale(20),
    },
    progressTitle: {
      fontSize: fontScale(18),
      color: isDarkMode ? 'white' : '#1F2937',
      marginBottom: scale(12),
      fontWeight: '600',
    },
    energyDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(12),
    },
    energyText: {
      fontSize: fontScale(14),
      color: isDarkMode ? 'white' : '#1F2937',
      marginLeft: scale(8),
      fontWeight: '600',
    },
    progressBar: {
      width: '100%',
      height: scale(20),
      backgroundColor: isDarkMode ? '#374151' : '#E5E7EB',
      borderRadius: scale(10),
      overflow: 'hidden',
      marginBottom: scale(8),
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#10B981',
      borderRadius: scale(10),
    },
    renderingFill: {
      backgroundColor: '#F59E0B',
    },
    uploadingFill: {
      backgroundColor: '#8B5CF6',
    },
    progressText: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
    },
    cancelButton: {
      backgroundColor: '#EF4444',
      paddingHorizontal: scale(24),
      paddingVertical: scale(12),
      borderRadius: scale(8),
      marginTop: scale(16),
    },
    cancelButtonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: fontScale(16),
    },
    studioEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(60),
    },
    studioEmptyText: {
      fontSize: fontScale(18),
      color: isDarkMode ? 'white' : '#1F2937',
      marginTop: scale(16),
      marginBottom: scale(8),
      textAlign: 'center',
    },
    studioEmptySubtext: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
    },
    // Upgrade Store Styles
    upgradeCard: {
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(16),
      marginBottom: scale(12),
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
      shadowColor: isDarkMode ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0 : 0.1,
      shadowRadius: isDarkMode ? 0 : 4,
      elevation: isDarkMode ? 0 : 2,
    },
    upgradeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: scale(8),
    },
    upgradeName: {
      fontSize: fontScale(18),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
    },
    upgradeLevel: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#8B5CF6' : '#4B5563',
      fontWeight: '600',
    },
    upgradeLevelContainer: {
      alignItems: 'flex-end',
    },
    maxLevelIndicator: {
      backgroundColor: '#10B981',
      paddingHorizontal: scale(8),
      paddingVertical: scale(4),
      borderRadius: scale(6),
      marginTop: scale(4),
    },
    maxLevelIndicatorText: {
      color: 'white',
      fontSize: fontScale(10),
      fontWeight: 'bold',
    },
    upgradeDescription: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#D1D5DB' : '#6B7280',
      marginBottom: scale(12),
    },
    upgradeEffects: {
      marginBottom: scale(12),
    },
    effectText: {
      fontSize: fontScale(13),
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      marginBottom: scale(4),
    },
    activeEffectText: {
      color: isDarkMode ? '#10B981' : '#059669',
      fontWeight: '600',
    },
    upgradeButton: {
      backgroundColor: '#8B5CF6',
    },
    maxLevelBadge: {
      backgroundColor: '#6B7280',
      paddingHorizontal: scale(12),
      paddingVertical: scale(6),
      borderRadius: scale(8),
      marginTop: scale(12),
    },
    maxLevelText: {
      color: 'white',
      fontSize: fontScale(14),
      fontWeight: 'bold',
    },
    categorySection: {
      marginBottom: scale(20),
    },
    categoryTitle: {
      fontSize: fontScale(18),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      marginBottom: scale(12),
    },
    storeDescription: {
      fontSize: fontScale(14),
      color: isDarkMode ? '#D1D5DB' : '#6B7280',
      marginBottom: scale(16),
      textAlign: 'center',
    },
    // Active Upgrades Summary Styles
    activeUpgradesSummary: {
      backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
      borderRadius: scale(12),
      padding: scale(16),
      marginBottom: scale(20),
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
    },
    activeUpgradesTitle: {
      fontSize: fontScale(16),
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : '#1F2937',
      marginBottom: scale(12),
      textAlign: 'center',
    },
    activeUpgradesList: {
      gap: scale(8),
    },
    activeUpgradeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: scale(8),
      paddingHorizontal: scale(12),
      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderRadius: scale(8),
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? 'transparent' : '#E5E7EB',
    },
    activeUpgradeName: {
      fontSize: fontScale(14),
      fontWeight: '600',
      color: isDarkMode ? 'white' : '#1F2937',
    },
    activeUpgradeEffects: {
      fontSize: fontScale(12),
      color: isDarkMode ? '#10B981' : '#059669',
      fontWeight: '500',
    },
  });

  // Get styles instance
  const styles = getStyles();

  // Add modal styles
  const modalStyles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalContainerDark: {
      backgroundColor: '#1F2937',
    },
    modalGradient: {
      padding: 24,
      borderRadius: 16,
    },
    modalHeader: {
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1F2937',
      textAlign: 'center',
    },
    modalTitleDark: {
      color: '#FFFFFF',
    },
    modalContent: {
      marginBottom: 24,
    },
    modalMessage: {
      fontSize: 16,
      color: '#374151',
      textAlign: 'center',
      lineHeight: 24,
    },
    modalMessageDark: {
      color: '#D1D5DB',
    },
    modalSubtext: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 20,
    },
    modalSubtextDark: {
      color: '#9CA3AF',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    modalButtonGradient: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },

    // Rich Modal Styles
    richModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    richModalContainer: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    richModalGradient: {
      padding: 32,
      borderRadius: 20,
      alignItems: 'center',
    },
    successAnimationContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    successIconContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    successRipple: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: '#10B981',
      opacity: 0.3,
    },
    richModalHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    richModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 8,
    },
    richModalSubtitle: {
      fontSize: 16,
      color: '#94A3B8',
      textAlign: 'center',
    },
    gameInfoCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    gameIconContainer: {
      marginRight: 16,
    },
    gameIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gameDetails: {
      flex: 1,
    },
    gameName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    gameStatus: {
      fontSize: 14,
      color: '#10B981',
      fontWeight: '500',
    },
    benefitsList: {
      width: '100%',
      marginBottom: 32,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    benefitText: {
      fontSize: 15,
      color: '#E2E8F0',
      marginLeft: 12,
    },
    richModalActions: {
      width: '100%',
    },
    richModalButton: {
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    richModalButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 8,
    },
    richModalButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // Upgrade Modal Specific Styles
    upgradeInfoCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    upgradeIconContainer: {
      marginRight: 16,
    },
    upgradeIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upgradeDetails: {
      flex: 1,
    },
    upgradeName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    upgradeLevel: {
      fontSize: 14,
      color: '#8B5CF6',
      fontWeight: '500',
      marginBottom: 4,
    },
    upgradeStatus: {
      fontSize: 14,
      color: '#10B981',
      fontWeight: '500',
    },
    upgradeEffectsList: {
      width: '100%',
      marginBottom: 24,
    },
    effectsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 16,
      textAlign: 'center',
    },
    effectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: 8,
    },
    effectText: {
      fontSize: 14,
      color: '#E2E8F0',
      marginLeft: 12,
      fontWeight: '500',
    },
    performanceBoostCard: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      width: '100%',
    },
    boostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    boostTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#F59E0B',
      marginLeft: 8,
    },
    boostDescription: {
      fontSize: 14,
      color: '#E2E8F0',
      lineHeight: 20,
    },

    // Video Upload Modal Specific Styles
    videoInfoCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    videoIconContainer: {
      marginRight: 16,
    },
    videoIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoDetails: {
      flex: 1,
    },
    videoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 4,
      fontStyle: 'italic',
    },
    videoStatus: {
      fontSize: 14,
      color: '#10B981',
      fontWeight: '500',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 24,
      gap: 12,
    },
    statCard: {
      backgroundColor: 'rgba(30, 41, 59, 0.6)',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      width: '48%',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: '#94A3B8',
      fontWeight: '500',
      textAlign: 'center',
    },
    performanceSummaryCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      width: '100%',
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#10B981',
      marginLeft: 8,
    },
    summaryDescription: {
      fontSize: 14,
      color: '#E2E8F0',
      lineHeight: 20,
    },
  });

  // Merge styles
  const allStyles = { ...styles, ...modalStyles };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#E2E8F0']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={scale(24)} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Video size={scale(32)} color="#8B5CF6" />
          <Text style={styles.headerTitle}>YouVideo</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
          onPress={() => setActiveTab('videos')}
        >
          <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>
            Videos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
            Stats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'studio' && styles.activeTab]}
          onPress={() => setActiveTab('studio')}
        >
          <Text style={[styles.tabText, activeTab === 'studio' && styles.activeTabText]}>
            Studio
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'store' && styles.activeTab]}
          onPress={() => setActiveTab('store')}
        >
          <Text style={[styles.tabText, activeTab === 'store' && styles.activeTabText]}>
            Store
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'videos' && renderVideosTab()}
      {activeTab === 'stats' && renderStatsTab()}
      {activeTab === 'studio' && renderStudioTab()}
      {activeTab === 'store' && renderStoreTab()}

      {/* Video Not Owned Modal */}
      <Modal visible={showVideoNotOwnedModal} transparent animationType="fade">
        <View style={allStyles.modalOverlay}>
          <View style={[allStyles.modalContainer, isDarkMode && allStyles.modalContainerDark]}>
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.modalGradient}
            >
              <View style={allStyles.modalHeader}>
                <Text style={[allStyles.modalTitle, isDarkMode && allStyles.modalTitleDark]}>
                  🎥 Video Not Owned
                </Text>
              </View>
              
              <View style={allStyles.modalContent}>
                <Text style={[allStyles.modalMessage, isDarkMode && allStyles.modalMessageDark]}>
                  You need to buy {modalData.videoName} for ${modalData.videoCost} first.
                </Text>
              </View>
              
              <View style={allStyles.modalActions}>
                <TouchableOpacity
                  style={allStyles.modalButton}
                  onPress={() => setShowVideoNotOwnedModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.modalButtonGradient}
                  >
                    <Text style={allStyles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Not Enough Energy Modal */}
      <Modal visible={showNotEnoughEnergyModal} transparent animationType="fade">
        <View style={allStyles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.modalGradient}
            >
              <View style={allStyles.modalHeader}>
                <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                  ⚡ Not Enough Energy
                </Text>
              </View>
              
              <View style={allStyles.modalContent}>
                <Text style={[styles.modalMessage, isDarkMode && styles.modalMessageDark]}>
                  You need {modalData.requiredEnergy} energy to create this video. You have {modalData.currentEnergy}.
                </Text>
              </View>
              
              <View style={allStyles.modalActions}>
                <TouchableOpacity
                  style={allStyles.modalButton}
                  onPress={() => setShowNotEnoughEnergyModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.modalButtonGradient}
                  >
                    <Text style={allStyles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Video Uploaded Modal - Rich & Smooth */}
      <Modal visible={showVideoUploadedModal} transparent animationType="slide">
        <View style={allStyles.richModalOverlay}>
          <Animated.View style={[allStyles.richModalContainer, { 
            transform: [{ 
              scale: showVideoUploadedModal ? 1 : 0.9 
            }] 
          }]}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#334155']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={allStyles.successAnimationContainer}>
                <View style={allStyles.successIconContainer}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={allStyles.successIcon}
                  >
                    <Upload size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={allStyles.successRipple} />
                </View>
              </View>

              {/* Rich Modal Header */}
              <View style={allStyles.richModalHeader}>
                <Text style={allStyles.richModalTitle}>🎬 Video Uploaded!</Text>
                <Text style={allStyles.richModalSubtitle}>
                  Your content is now live and performing
                </Text>
              </View>

              {/* Video Info Card */}
              <View style={allStyles.videoInfoCard}>
                <View style={allStyles.videoIconContainer}>
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    style={allStyles.videoIcon}
                  >
                    <Video size={24} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <View style={allStyles.videoDetails}>
                  <Text style={allStyles.videoTitle}>"{modalData.videoTitle}"</Text>
                  <Text style={allStyles.videoStatus}>✅ Successfully Uploaded</Text>
                </View>
              </View>

              {/* Performance Stats Grid */}
              <View style={allStyles.statsGrid}>
                <View style={allStyles.statCard}>
                  <View style={allStyles.statIconContainer}>
                    <Eye size={20} color="#3B82F6" />
                  </View>
                  <Text style={allStyles.statValue}>{modalData.views?.toLocaleString() || '0'}</Text>
                  <Text style={allStyles.statLabel}>Views</Text>
                </View>

                <View style={allStyles.statCard}>
                  <View style={allStyles.statIconContainer}>
                    <DollarSign size={20} color="#10B981" />
                  </View>
                  <Text style={allStyles.statValue}>${modalData.earnings?.toFixed(2) || '0.00'}</Text>
                  <Text style={allStyles.statLabel}>Earnings</Text>
                </View>

                <View style={allStyles.statCard}>
                  <View style={allStyles.statIconContainer}>
                    <Users size={20} color="#8B5CF6" />
                  </View>
                  <Text style={allStyles.statValue}>+{modalData.subscribersGained || '0'}</Text>
                  <Text style={allStyles.statLabel}>New Subs</Text>
                </View>

                <View style={allStyles.statCard}>
                  <View style={allStyles.statIconContainer}>
                    <Zap size={20} color="#F59E0B" />
                  </View>
                  <Text style={allStyles.statValue}>-{modalData.energyUsed || '0'}</Text>
                  <Text style={allStyles.statLabel}>Energy Used</Text>
                </View>
              </View>

              {/* Performance Summary */}
              <View style={allStyles.performanceSummaryCard}>
                <View style={allStyles.summaryHeader}>
                  <TrendingUp size={20} color="#10B981" />
                  <Text style={allStyles.summaryTitle}>Great Performance!</Text>
                </View>
                <Text style={allStyles.summaryDescription}>
                  Your video is gaining traction! Keep creating quality content to grow your channel even more.
                </Text>
              </View>

              {/* Action Button */}
              <View style={allStyles.richModalActions}>
                <TouchableOpacity
                  style={allStyles.richModalButton}
                  onPress={() => setShowVideoUploadedModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.richModalButtonGradient}
                  >
                    <Text style={allStyles.richModalButtonText}>Keep Creating! 🚀</Text>
                    <Video size={18} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>

      {/* Video Purchased Modal - Rich & Smooth */}
      <Modal visible={showVideoPurchasedModal} transparent animationType="slide">
        <View style={allStyles.richModalOverlay}>
          <Animated.View style={[allStyles.richModalContainer, { 
            transform: [{ 
              scale: showVideoPurchasedModal ? 1 : 0.9 
            }] 
          }]}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#334155']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={allStyles.successAnimationContainer}>
                <View style={allStyles.successIconContainer}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={allStyles.successIcon}
                  >
                    <Video size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={allStyles.successRipple} />
                </View>
              </View>

              {/* Rich Modal Header */}
              <View style={allStyles.richModalHeader}>
                <Text style={allStyles.richModalTitle}>🎮 Game Purchased!</Text>
                <Text style={allStyles.richModalSubtitle}>
                  You're ready to create amazing content
                </Text>
              </View>

              {/* Game Info Card */}
              <View style={allStyles.gameInfoCard}>
                <View style={allStyles.gameIconContainer}>
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={allStyles.gameIcon}
                  >
                    <Gamepad2 size={24} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <View style={allStyles.gameDetails}>
                  <Text style={allStyles.gameName}>{modalData.videoName}</Text>
                  <Text style={allStyles.gameStatus}>✅ Now Available for Videos</Text>
                </View>
              </View>

              {/* Benefits List */}
              <View style={allStyles.benefitsList}>
                <View style={allStyles.benefitItem}>
                  <Video size={16} color="#10B981" />
                  <Text style={allStyles.benefitText}>Create videos with this game</Text>
                </View>
                <View style={allStyles.benefitItem}>
                  <TrendingUp size={16} color="#10B981" />
                  <Text style={allStyles.benefitText}>Unlock new content opportunities</Text>
                </View>
                <View style={allStyles.benefitItem}>
                  <DollarSign size={16} color="#10B981" />
                  <Text style={allStyles.benefitText}>Earn money from video views</Text>
                </View>
                <View style={allStyles.benefitItem}>
                  <Users size={16} color="#10B981" />
                  <Text style={allStyles.benefitText}>Attract more subscribers</Text>
                </View>
              </View>

              {/* Action Button */}
              <View style={allStyles.richModalActions}>
                <TouchableOpacity
                  style={allStyles.richModalButton}
                  onPress={() => setShowVideoPurchasedModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.richModalButtonGradient}
                  >
                    <Text style={allStyles.richModalButtonText}>Start Creating! 🚀</Text>
                    <Play size={18} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>

      {/* Insufficient Funds Modal */}
      <Modal visible={showInsufficientFundsModal} transparent animationType="fade">
        <View style={allStyles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.modalGradient}
            >
              <View style={allStyles.modalHeader}>
                <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                  💰 Insufficient Funds
                </Text>
              </View>
              
              <View style={allStyles.modalContent}>
                <Text style={[styles.modalMessage, isDarkMode && styles.modalMessageDark]}>
                  {modalData.videoName ? 
                    `You need $${modalData.videoCost} to buy ${modalData.videoName}.` :
                    `You need $${modalData.cost} to upgrade ${modalData.upgradeName}.`
                  }
                </Text>
              </View>
              
              <View style={allStyles.modalActions}>
                <TouchableOpacity
                  style={allStyles.modalButton}
                  onPress={() => setShowInsufficientFundsModal(false)}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.modalButtonGradient}
                  >
                    <Text style={allStyles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Max Level Modal */}
      <Modal visible={showMaxLevelModal} transparent animationType="fade">
        <View style={allStyles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.modalGradient}
            >
              <View style={allStyles.modalHeader}>
                <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                  🏆 Max Level Reached
                </Text>
              </View>
              
              <View style={allStyles.modalContent}>
                <Text style={[styles.modalMessage, isDarkMode && styles.modalMessageDark]}>
                  This upgrade is already at maximum level!
                </Text>
              </View>
              
              <View style={allStyles.modalActions}>
                <TouchableOpacity
                  style={allStyles.modalButton}
                  onPress={() => setShowMaxLevelModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.modalButtonGradient}
                  >
                    <Text style={allStyles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Upgrade Purchased Modal - Rich & Smooth */}
      <Modal visible={showUpgradePurchasedModal} transparent animationType="slide">
        <View style={allStyles.richModalOverlay}>
          <Animated.View style={[allStyles.richModalContainer, { 
            transform: [{ 
              scale: showUpgradePurchasedModal ? 1 : 0.9 
            }] 
          }]}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#334155']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={allStyles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={allStyles.successAnimationContainer}>
                <View style={allStyles.successIconContainer}>
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={allStyles.successIcon}
                  >
                    <Settings size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={[allStyles.successRipple, { borderColor: '#8B5CF6' }]} />
                </View>
              </View>

              {/* Rich Modal Header */}
              <View style={allStyles.richModalHeader}>
                <Text style={allStyles.richModalTitle}>🚀 Upgrade Complete!</Text>
                <Text style={allStyles.richModalSubtitle}>
                  Your studio just got a major boost
                </Text>
              </View>

              {/* Upgrade Info Card */}
              <View style={allStyles.upgradeInfoCard}>
                <View style={allStyles.upgradeIconContainer}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={allStyles.upgradeIcon}
                  >
                    <Star size={24} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <View style={allStyles.upgradeDetails}>
                  <Text style={allStyles.upgradeName}>{modalData.upgradeName}</Text>
                  <Text style={allStyles.upgradeLevel}>✨ Level {modalData.newLevel} Unlocked</Text>
                  <Text style={allStyles.upgradeStatus}>✅ Active & Boosting Performance</Text>
                </View>
              </View>

              {/* Upgrade Effects List */}
              <View style={allStyles.upgradeEffectsList}>
                <Text style={allStyles.effectsTitle}>New Benefits Unlocked:</Text>
                
                {/* Dynamic effects based on upgrade type */}
                {(() => {
                  const upgradeId = Object.keys(UPGRADE_STORE).find(id => 
                    UPGRADE_STORE[id as keyof typeof UPGRADE_STORE].name === modalData.upgradeName
                  );
                  if (!upgradeId) return null;
                  
                  const upgrade = UPGRADE_STORE[upgradeId as keyof typeof UPGRADE_STORE];
                  const level = modalData.newLevel - 1; // Convert to 0-based index
                  
                  return Object.entries(upgrade.effects).map(([effectKey, effectValues]) => {
                    const currentValue = effectValues[level];
                    const effectName = effectKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    
                    return (
                      <View key={effectKey} style={allStyles.effectItem}>
                        <TrendingUp size={16} color="#10B981" />
                        <Text style={allStyles.effectText}>
                          {effectName}: {typeof currentValue === 'number' && currentValue > 1 
                            ? `+${Math.round((currentValue - 1) * 100)}%` 
                            : `+${Math.round(currentValue * 100)}%`}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* Performance Boost Summary */}
              <View style={allStyles.performanceBoostCard}>
                <View style={allStyles.boostHeader}>
                  <Zap size={20} color="#F59E0B" />
                  <Text style={allStyles.boostTitle}>Performance Boost Active</Text>
                </View>
                <Text style={allStyles.boostDescription}>
                  Your videos will now perform better with improved quality, views, and engagement!
                </Text>
              </View>

              {/* Action Button */}
              <View style={allStyles.richModalActions}>
                <TouchableOpacity
                  style={allStyles.richModalButton}
                  onPress={() => setShowUpgradePurchasedModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={allStyles.richModalButtonGradient}
                  >
                    <Text style={allStyles.richModalButtonText}>Start Creating! 🎬</Text>
                    <Video size={18} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
