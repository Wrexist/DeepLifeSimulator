/**
 * YouVideo App Component
 * 
 * Complete video creation platform with recording, rendering, and uploading
 * Includes energy costs, realistic view simulation, and subscriber growth
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Image,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
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
  Cpu,
  Sparkles,
} from 'lucide-react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { useGame, Video as VideoType } from '@/contexts/GameContext';
import { useMemoryCleanup } from '@/utils/performanceOptimization';

// Use shared scaling utils so tablet/web-tablet scale up correctly
import { scale, fontScale } from '@/utils/scaling';


const { width: screenWidth } = Dimensions.get('window');

// YouVideo Upgrade Images
const UPGRADE_IMAGES = {
  gpu: require('@/assets/images/YouVideo/Upgrades/gpu.png'),
  cpu: require('@/assets/images/YouVideo/Upgrades/cpu.png'),
  ram: require('@/assets/images/YouVideo/Upgrades/ram.png'),
  storage: require('@/assets/images/YouVideo/Upgrades/storage.png'),
  microphone: require('@/assets/images/YouVideo/Upgrades/microphone.png'),
  webcam: require('@/assets/images/YouVideo/Upgrades/webcam.png'),
  captureCard: require('@/assets/images/YouVideo/Upgrades/capture_card.png'),
  lighting: require('@/assets/images/YouVideo/Upgrades/lightning.png'),
  videoEditing: require('@/assets/images/YouVideo/Upgrades/video_editing.png'),
  thumbnails: require('@/assets/images/YouVideo/Upgrades/thumbnails.png'),
  seo: require('@/assets/images/YouVideo/Upgrades/seo.png'),
  verifiedBadge: require('@/assets/images/YouVideo/Upgrades/verified_badge.png'),
  customEmotes: require('@/assets/images/YouVideo/Upgrades/custom_emotes.png'),
  memberships: require('@/assets/images/YouVideo/Upgrades/membership.png'),
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
  const { gameState, updateGameState, updateMoney, saveGame } = useGame();
  const { addCleanup } = useMemoryCleanup();
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

  // Extract frequently used values from gameState
  const settings = gameState.settings;
  const isDarkMode = settings.darkMode;
  const energy = gameState.stats.energy;
  const money = gameState.stats.money;
  const gamingStreaming = gameState.gamingStreaming;
  const date = gameState.date;

  // Helper function to format game date - memoized
  const formatGameDate = useCallback(() => {
    // Handle the game date structure properly
    const month = date.month || 'Jan';
    const year = date.year || 2024;
    const week = date.week || 1;
    
    // Calculate approximate day based on week (1-4 weeks per month)
    const day = Math.min(28, Math.max(1, week * 7));
    
    // Format as "Week X, Month Year" for clarity
    return `Week ${week}, ${month} ${year}`;
  }, [date]);

  // Refs for intervals
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const renderingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (renderingIntervalRef.current) {
        clearInterval(renderingIntervalRef.current);
      }
      if (uploadingIntervalRef.current) {
        clearInterval(uploadingIntervalRef.current);
      }
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  // Helper to create setTimeout with cleanup
  const createTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      callback();
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    }, delay);
    timeoutRefs.current.push(timeoutId);
    addCleanup(() => {
      clearTimeout(timeoutId);
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    });
    return timeoutId;
  }, [addCleanup]);

  // Initialize gaming data if it doesn't exist
  useEffect(() => {
    if (!gamingStreaming) {
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
  }, [gamingStreaming, updateGameState]);

  const videoData = gamingStreaming || {
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

  // Calculate total energy cost for complete video creation (recording + rendering + uploading)
  const calculateTotalEnergyCost = useCallback((videoId: string): number => {
    const video = AVAILABLE_VIDEOS.find(v => v.id === videoId);
    if (!video) return Infinity;
    
    const modifiers = calculateUpgradeModifiers();
    
    // Energy costs for each phase:
    // Recording: full energyCost
    // Rendering: energyCost / 2
    // Uploading: energyCost / 4
    // Total = energyCost * (1 + 0.5 + 0.25) = energyCost * 1.75
    const baseTotalCost = video.energyCost * 1.75;
    
    // Apply energy reduction to total cost
    const effectiveTotalCost = Math.ceil(baseTotalCost * (1 - modifiers.energyReduction));
    
    return effectiveTotalCost;
  }, []);

  const startVideoCreation = (videoId: string) => {
    const video = AVAILABLE_VIDEOS.find(v => v.id === videoId);
    if (!video) return;

    if (!videoData.ownedGames.includes(videoId) && video.cost > 0) {
      setModalData({ videoName: video.name, videoCost: video.cost });
      setShowVideoNotOwnedModal(true);
      return;
    }

    // Check total energy for complete process (recording + rendering + uploading)
    const totalEnergyRequired = calculateTotalEnergyCost(videoId);
    
    if (energy < totalEnergyRequired) {
      setModalData({ requiredEnergy: totalEnergyRequired, currentEnergy: energy });
      setShowNotEnoughEnergyModal(true);
      return;
    }

    setSelectedVideo(videoId);
    setVideoTitle(`${video.name} - ${formatGameDate()}`);
    setActiveTab('studio');
  };

  // Cleanup intervals on unmount with useMemoryCleanup
  useEffect(() => {
    const cleanup = () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (renderingIntervalRef.current) {
        clearInterval(renderingIntervalRef.current);
        renderingIntervalRef.current = null;
      }
      if (uploadingIntervalRef.current) {
        clearInterval(uploadingIntervalRef.current);
        uploadingIntervalRef.current = null;
      }
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
    
    addCleanup(cleanup);
    return cleanup;
  }, [addCleanup]);

  const stopVideoProcess = useCallback(() => {
    // Clear all intervals
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (renderingIntervalRef.current) {
      clearInterval(renderingIntervalRef.current);
      renderingIntervalRef.current = null;
    }
    if (uploadingIntervalRef.current) {
      clearInterval(uploadingIntervalRef.current);
      uploadingIntervalRef.current = null;
    }
    
    // Stop all animations
    recordingAnimation.stopAnimation();
    renderingAnimation.stopAnimation();
    uploadingAnimation.stopAnimation();
    
    // Reset all state
    setIsRecording(false);
    setIsRendering(false);
    setIsUploading(false);
    setCurrentPhase('idle');
    setRecordingProgress(0);
    setRenderingProgress(0);
    setUploadingProgress(0);
    
    // Reset animation values
    recordingAnimation.setValue(0);
    renderingAnimation.setValue(0);
    uploadingAnimation.setValue(0);
    
    // Reset video selection
    setSelectedVideo(null);
    setVideoTitle('');
    
    // Show alert
    Alert.alert(
      'Process Stopped',
      'Video creation stopped due to insufficient energy. You need enough energy for the complete process (recording + rendering + uploading).',
      [{ text: 'OK' }]
    );
  }, []);

  const startRecording = () => {
    if (!selectedVideo || !videoTitle.trim()) return;
    
    // Check total energy for complete process before starting
    const totalEnergyRequired = calculateTotalEnergyCost(selectedVideo);
    if (energy < totalEnergyRequired) {
      setModalData({ requiredEnergy: totalEnergyRequired, currentEnergy: energy });
      setShowNotEnoughEnergyModal(true);
      return;
    }
    
    // Clear any existing interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (renderingIntervalRef.current) {
      clearInterval(renderingIntervalRef.current);
    }
    if (uploadingIntervalRef.current) {
      clearInterval(uploadingIntervalRef.current);
    }
    
    // Start recording
    setIsRecording(true);
    setCurrentPhase('recording');
    setRecordingProgress(0);
    
    // Animate recording progress
    recordingAnimation.setValue(0);
    Animated.timing(recordingAnimation, {
      toValue: 1,
      duration: 5000, // 5 seconds to record
      useNativeDriver: false,
    }).start();
    
    // Simulate recording progress with real-time energy drain
    // OPTIMIZATION: Batch energy updates to reduce gameState update frequency
    let energyAccumulator = 0;
    const energyUpdateInterval = 500; // Update energy every 500ms instead of every 100ms
    let lastEnergyUpdate = Date.now();
    
    recordingIntervalRef.current = setInterval(() => {
      setRecordingProgress(prev => {
        if (prev >= 100) {
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
          finishRecording();
          return 100;
        }
        
        // Drain energy in real-time with upgrade energy reduction
        const video = AVAILABLE_VIDEOS.find(v => v.id === selectedVideo);
        if (video) {
          const modifiers = calculateUpgradeModifiers();
          const effectiveEnergyCost = video.energyCost * (1 - modifiers.energyReduction);
          const energyPerTick = effectiveEnergyCost / 50; // 50 ticks over 5 seconds
          
          // Accumulate energy drain
          energyAccumulator += energyPerTick;
          
          // Only update gameState every 500ms to reduce re-renders
          const now = Date.now();
          if (now - lastEnergyUpdate >= energyUpdateInterval) {
            const energyToDrain = Math.floor(energyAccumulator);
            energyAccumulator -= energyToDrain;
            lastEnergyUpdate = now;
            
            // Use setTimeout to avoid setState during render - with cleanup
            createTimeout(() => {
              updateGameState(prev => {
                const newEnergy = Math.max(0, prev.stats.energy - energyToDrain);
                return {
                  ...prev,
                  stats: {
                    ...prev.stats,
                    energy: newEnergy,
                  },
                };
              });
            }, 0);
          }
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
    
    // Clear any existing interval
    if (renderingIntervalRef.current) {
      clearInterval(renderingIntervalRef.current);
    }
    
    // Animate rendering progress with upgrade time reduction
    const modifiers = calculateUpgradeModifiers();
    const renderDuration = 8000 * (1 - modifiers.renderTimeReduction - modifiers.processingTimeReduction);
    
    renderingAnimation.setValue(0);
    Animated.timing(renderingAnimation, {
      toValue: 1,
      duration: Math.max(2000, renderDuration), // Minimum 2 seconds
      useNativeDriver: false,
    }).start();
    
    // Simulate rendering progress with real-time energy drain
    renderingIntervalRef.current = setInterval(() => {
      setRenderingProgress(prev => {
        if (prev >= 100) {
          if (renderingIntervalRef.current) {
            clearInterval(renderingIntervalRef.current);
            renderingIntervalRef.current = null;
          }
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
          
          // Use setTimeout to avoid setState during render - with cleanup
          createTimeout(() => {
            updateGameState(prev => {
              const newEnergy = Math.max(0, prev.stats.energy - energyPerTick);
              return {
                ...prev,
                stats: {
                  ...prev.stats,
                  energy: newEnergy,
                },
              };
            });
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
    
    // Clear any existing interval
    if (uploadingIntervalRef.current) {
      clearInterval(uploadingIntervalRef.current);
    }
    
    // Animate uploading progress with upgrade upload speed
    const modifiers = calculateUpgradeModifiers();
    const uploadDuration = 6000 * (1 - modifiers.uploadSpeed);
    
    uploadingAnimation.setValue(0);
    Animated.timing(uploadingAnimation, {
      toValue: 1,
      duration: Math.max(2000, uploadDuration), // Minimum 2 seconds
      useNativeDriver: false,
    }).start();
    
    // Simulate uploading progress with real-time energy drain
    uploadingIntervalRef.current = setInterval(() => {
      setUploadingProgress(prev => {
        if (prev >= 100) {
          if (uploadingIntervalRef.current) {
            clearInterval(uploadingIntervalRef.current);
            uploadingIntervalRef.current = null;
          }
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
          
          // Use setTimeout to avoid setState during render - with cleanup
          createTimeout(() => {
            updateGameState(prev => {
              const newEnergy = Math.max(0, prev.stats.energy - energyPerTick);
              return {
                ...prev,
                stats: {
                  ...prev.stats,
                  energy: newEnergy,
                },
              };
            });
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
        // PERFORMANCE FIX: Cap videos to last 100 items to prevent unbounded growth (increased from 50)
        videos: [newVideo, ...(prev.gamingStreaming!.videos || [])].slice(0, 100),
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
    
    // Save game after video upload
    saveGame();
    
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

    if (money >= video.cost) {
      // Use centralized money handling - don't update dailySummary for video purchases
      updateMoney(-video.cost, `Buy ${video.name}`, false);
      
      updateGameState(prev => ({
        ...prev,
        gamingStreaming: {
          ...prev.gamingStreaming!,
          ownedGames: [...prev.gamingStreaming!.ownedGames, videoId],
        },
      }));

      // Save game after purchase
      saveGame();

      setModalData({ videoName: video.name });
      setShowVideoPurchasedModal(true);
    } else {
      setModalData({ videoName: video.name, videoCost: video.cost });
      setShowInsufficientFundsModal(true);
    }
  };

  const renderVideosTab = () => (
    <ScrollView 
      style={styles.tabContent} 
      contentContainerStyle={styles.tabContentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Available Video Types
        </Text>
        <Text style={[styles.sectionSubtitle, isDarkMode && styles.sectionSubtitleDark]}>
          {AVAILABLE_VIDEOS.length} games available
        </Text>
      </View>
      {AVAILABLE_VIDEOS.map((video, index) => {
        const isOwned = videoData.ownedGames.includes(video.id);
        const canCreate = isOwned || video.cost === 0;
        const hasEnergy = energy >= video.energyCost;
        
        return (
          <MotiView
            key={video.id}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: index * 50 }}
          >
            <TouchableOpacity
              style={[styles.videoCard, isDarkMode && styles.videoCardDark]}
              onPress={() => canCreate && hasEnergy ? startVideoCreation(video.id) : !canCreate ? buyVideo(video.id) : null}
              disabled={canCreate && !hasEnergy}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={isDarkMode 
                  ? ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(249, 250, 251, 0.95)']
                }
                style={styles.cardGradient}
              >
                <View style={styles.videoCardHeader}>
                  <View style={styles.videoIconContainer}>
                    <Gamepad2 size={24} color={isDarkMode ? '#8B5CF6' : '#6366F1'} />
                  </View>
                  <View style={styles.videoInfo}>
                    <View style={styles.videoNameRow}>
                      <Text style={[styles.videoName, isDarkMode && styles.videoNameDark]}>
                        {video.name}
                      </Text>
                      {isOwned && (
                        <View style={styles.ownedBadge}>
                          <Text style={styles.ownedBadgeText}>OWNED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.videoDescription, isDarkMode && styles.videoDescriptionDark]}>
                      {video.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.videoStatsContainer}>
                  <View style={styles.videoStatBadge}>
                    <Eye size={14} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.videoStatText, isDarkMode && styles.videoStatTextDark]}>
                      {video.baseViewers.toLocaleString()} views
                    </Text>
                  </View>
                  <View style={styles.videoStatBadge}>
                    <DollarSign size={14} color={isDarkMode ? '#10B981' : '#059669'} />
                    <Text style={[styles.videoStatText, isDarkMode && styles.videoStatTextDark]}>
                      ${video.baseEarnings}/week
                    </Text>
                  </View>
                  <View style={styles.videoStatBadge}>
                    <Zap size={14} color="#F59E0B" />
                    <Text style={[styles.videoStatText, isDarkMode && styles.videoStatTextDark]}>
                      {video.energyCost} energy
                    </Text>
                  </View>
                </View>

                <View style={styles.videoCardFooter}>
                  {canCreate ? (
                    <TouchableOpacity
                      style={[styles.createButtonCard, !hasEnergy && styles.disabledButtonCard]}
                      onPress={() => startVideoCreation(video.id)}
                      disabled={!hasEnergy}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={hasEnergy ? ['#10B981', '#059669'] : ['#9CA3AF', '#6B7280']}
                        style={styles.createButtonGradient}
                      >
                        <Video size={18} color="#FFF" />
                        <Text style={styles.createButtonText}>
                          {hasEnergy ? 'Create Video' : 'No Energy'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.buyButtonCard, money < video.cost && styles.disabledButtonCard]}
                      onPress={() => buyVideo(video.id)}
                      disabled={money < video.cost}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={money >= video.cost ? ['#8B5CF6', '#7C3AED'] : ['#9CA3AF', '#6B7280']}
                        style={styles.buyButtonGradient}
                      >
                        <DollarSign size={18} color="#FFF" />
                        <Text style={styles.buyButtonText}>
                          Buy ${video.cost}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        );
      })}
    </ScrollView>
  );

  const renderStatsTab = () => (
    <ScrollView 
      style={styles.tabContent} 
      contentContainerStyle={styles.tabContentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Channel Statistics
        </Text>
        <Text style={[styles.sectionSubtitle, isDarkMode && styles.sectionSubtitleDark]}>
          Your content performance
        </Text>
      </View>
      
      <View style={styles.statsGrid}>
        {[
          { icon: Users, value: videoData.followers.toLocaleString(), label: 'Followers', color: '#8B5CF6', index: 0 },
          { icon: Star, value: videoData.subscribers.toLocaleString(), label: 'Subscribers', color: '#F59E0B', index: 1 },
          { icon: TrendingUp, value: videoData.totalViews.toLocaleString(), label: 'Total Views', color: '#10B981', index: 2 },
          { icon: DollarSign, value: `$${videoData.totalEarnings.toFixed(2)}`, label: 'Total Earnings', color: '#EF4444', index: 3 },
          { icon: Crown, value: videoData.experience.toLocaleString(), label: 'Experience', color: '#8B5CF6', index: 4 },
          { icon: Video, value: (videoData.videos?.length || 0).toString(), label: 'Videos', color: '#6366F1', index: 5 },
        ].map((stat) => (
          <MotiView
            key={stat.label}
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400, delay: stat.index * 50 }}
          >
            <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
              <LinearGradient
                colors={isDarkMode 
                  ? ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(249, 250, 251, 0.95)']
                }
                style={styles.statCardGradient}
              >
                <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
                  <stat.icon size={24} color={stat.color} />
                </View>
                <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                  {stat.label}
                </Text>
              </LinearGradient>
            </View>
          </MotiView>
        ))}
      </View>

      {/* Uploaded Videos Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Recent Videos
        </Text>
        <Text style={[styles.sectionSubtitle, isDarkMode && styles.sectionSubtitleDark]}>
          {videoData.videos?.length || 0} total videos
        </Text>
      </View>
      {videoData.videos && videoData.videos.length > 0 ? (
        videoData.videos.slice(0, 10).map((video: VideoType, index: number) => (
          <MotiView
            key={video.id}
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 400, delay: index * 50 }}
          >
            <View style={[styles.uploadedVideoCard, isDarkMode && styles.uploadedVideoCardDark]}>
              <LinearGradient
                colors={isDarkMode 
                  ? ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(249, 250, 251, 0.95)']
                }
                style={styles.cardGradient}
              >
                <View style={styles.videoHeader}>
                  <View style={styles.videoHeaderLeft}>
                    <Video size={18} color={isDarkMode ? '#8B5CF6' : '#6366F1'} />
                    <Text style={[styles.videoTitle, isDarkMode && styles.videoTitleDark]}>
                      {video.title}
                    </Text>
                  </View>
                  <Text style={[styles.videoDate, isDarkMode && styles.videoDateDark]}>
                    {formatGameDate()}
                  </Text>
                </View>
                <View style={styles.videoMetrics}>
                  <View style={styles.metricBadge}>
                    <Eye size={14} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.metricText, isDarkMode && styles.metricTextDark]}>
                      {video.views.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.metricBadge}>
                    <Heart size={14} color="#EF4444" />
                    <Text style={[styles.metricText, isDarkMode && styles.metricTextDark]}>
                      {video.likes.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.metricBadge}>
                    <MessageCircle size={14} color={isDarkMode ? '#10B981' : '#059669'} />
                    <Text style={[styles.metricText, isDarkMode && styles.metricTextDark]}>
                      {video.comments.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.metricBadge}>
                    <DollarSign size={14} color="#F59E0B" />
                    <Text style={[styles.metricText, isDarkMode && styles.metricTextDark]}>
                      ${video.earnings.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </MotiView>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <View style={styles.emptyIconContainer}>
              <Video size={64} color={isDarkMode ? '#8B5CF6' : '#6366F1'} />
            </View>
          </MotiView>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            No Videos Yet
          </Text>
          <Text style={[styles.emptyStateSubtext, isDarkMode && styles.emptyStateSubtextDark]}>
            Start creating your first video to see it here!
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // Memoize estimated views so they don't change during recording
  const studioEstimates = useMemo(() => {
    const views = Math.floor(Math.random() * 5000) + 1000;
    return { views, earnings: Math.floor(views * 0.01) };
  }, [selectedVideo]);

  const renderStudioTab = () => {
    const selectedVideoData = AVAILABLE_VIDEOS.find(v => v.id === selectedVideo);
    const energyCost = selectedVideoData?.energyCost || 15;
    
    return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
        {selectedVideo && selectedVideoData ? (
        <View style={styles.studioContent}>
            {/* Studio Header Card */}
            <LinearGradient
              colors={isDarkMode ? ['#1E293B', '#0F172A'] : ['#F8FAFC', '#E2E8F0']}
              style={{
                borderRadius: scale(16),
                padding: scale(20),
                marginBottom: scale(16),
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(12) }}>
                <View style={{
                  width: scale(48),
                  height: scale(48),
                  borderRadius: scale(12),
                  backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: scale(12),
                }}>
                  <Video size={scale(24)} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: fontScale(18),
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                  }}>
                    {selectedVideoData.name}
                  </Text>
                  <Text style={{
                    fontSize: fontScale(12),
                    color: isDarkMode ? '#9CA3AF' : '#6B7280',
                  }}>
                    {selectedVideoData.description}
            </Text>
                </View>
          </View>
          
              {/* Quick Stats Row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{
                  flex: 1,
                  backgroundColor: isDarkMode ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.15)',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                  alignItems: 'center',
                }}>
                  <Zap size={scale(16)} color="#F59E0B" />
                  <Text style={{ fontSize: fontScale(14), fontWeight: 'bold', color: '#F59E0B', marginTop: scale(4) }}>
                    {energyCost}
                  </Text>
                  <Text style={{ fontSize: fontScale(10), color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>Energy</Text>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                  alignItems: 'center',
                }}>
                  <Eye size={scale(16)} color="#3B82F6" />
                  <Text style={{ fontSize: fontScale(14), fontWeight: 'bold', color: '#3B82F6', marginTop: scale(4) }}>
                    ~{studioEstimates.views.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: fontScale(10), color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>Est. Views</Text>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: isDarkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)',
                  borderRadius: scale(8),
                  padding: scale(10),
                  alignItems: 'center',
                }}>
                  <DollarSign size={scale(16)} color="#10B981" />
                  <Text style={{ fontSize: fontScale(14), fontWeight: 'bold', color: '#10B981', marginTop: scale(4) }}>
                    ${studioEstimates.earnings}
                  </Text>
                  <Text style={{ fontSize: fontScale(10), color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>Est. Earn</Text>
                </View>
              </View>
            </LinearGradient>

            {currentPhase === 'idle' ? (
              <>
                {/* Title Input Card */}
                <View style={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  borderRadius: scale(12),
                  padding: scale(16),
                  marginBottom: scale(16),
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                }}>
                  <Text style={{
                    fontSize: fontScale(14),
                    fontWeight: '600',
                    color: isDarkMode ? '#FFFFFF' : '#374151',
                    marginBottom: scale(8),
                  }}>
                    Video Title
                  </Text>
            <TextInput
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      borderRadius: scale(8),
                      padding: scale(12),
                      fontSize: fontScale(14),
                      color: isDarkMode ? '#FFFFFF' : '#1F2937',
                      borderWidth: 1,
                      borderColor: videoTitle.trim() ? '#10B981' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                    }}
              value={videoTitle}
              onChangeText={(text) => {
                setVideoTitle(text);
                // Only clear saved progress if videoId changes (not just title)
                // Title can be edited without losing progress
              }}
                    placeholder="Enter a catchy title..."
              placeholderTextColor="#9CA3AF"
                    maxLength={60}
            />
                  <Text style={{
                    fontSize: fontScale(11),
                    color: isDarkMode ? '#6B7280' : '#9CA3AF',
                    marginTop: scale(6),
                    textAlign: 'right',
                  }}>
                    {videoTitle.length}/60
                  </Text>
          </View>
          
                {/* Action Buttons */}
                {(() => {
                  // Calculate total energy required for complete process
                  const totalEnergyRequired = selectedVideo ? calculateTotalEnergyCost(selectedVideo) : 0;
                  const hasEnoughEnergy = energy >= totalEnergyRequired;
                  const buttonText = hasEnoughEnergy ? 'Start Recording' : `No Energy (Need ${totalEnergyRequired})`;
                  
                  return (
                    <TouchableOpacity
                      style={{
                        borderRadius: scale(12),
                        overflow: 'hidden',
                        marginBottom: scale(12),
                        opacity: (videoTitle.trim() && hasEnoughEnergy) ? 1 : 0.5,
                      }}
                      onPress={startRecording}
                      disabled={!videoTitle.trim() || !hasEnoughEnergy}
                    >
                      <LinearGradient
                        colors={hasEnoughEnergy ? ['#EF4444', '#DC2626'] : ['#9CA3AF', '#6B7280']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: scale(16),
                        }}
                      >
                        {hasEnoughEnergy ? (
                          <View style={{
                            width: scale(12),
                            height: scale(12),
                            borderRadius: scale(6),
                            backgroundColor: '#FFFFFF',
                            marginRight: scale(10),
                          }} />
                        ) : (
                          <Zap size={scale(16)} color="#FFFFFF" style={{ marginRight: scale(8) }} />
                        )}
                        <Text style={{
                          fontSize: fontScale(16),
                          fontWeight: 'bold',
                          color: '#FFFFFF',
                        }}>
                          {buttonText}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })()}

                <TouchableOpacity
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#E5E7EB',
                    borderRadius: scale(12),
                    padding: scale(14),
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setSelectedVideo(null);
                    setVideoTitle('');
                  }}
                >
                  <Text style={{
                    fontSize: fontScale(14),
                    fontWeight: '600',
                    color: isDarkMode ? '#9CA3AF' : '#6B7280',
                  }}>
                    Change Game
                </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Progress View - Recording/Rendering/Uploading */
              <View style={{
                backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                borderRadius: scale(16),
                padding: scale(20),
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
              }}>
                <View style={{ alignItems: 'center', marginBottom: scale(16) }}>
                  <View style={{
                    width: scale(64),
                    height: scale(64),
                    borderRadius: scale(32),
                    backgroundColor: currentPhase === 'recording' ? 'rgba(239,68,68,0.1)' : 
                                    currentPhase === 'rendering' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: scale(12),
                  }}>
                    {currentPhase === 'recording' && <Video size={scale(28)} color="#EF4444" />}
                    {currentPhase === 'rendering' && <Cpu size={scale(28)} color="#A855F7" />}
                    {currentPhase === 'uploading' && <Upload size={scale(28)} color="#3B82F6" />}
              </View>
                  <Text style={{
                    fontSize: fontScale(18),
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                  }}>
                    {currentPhase === 'recording' && 'Recording...'}
                    {currentPhase === 'rendering' && 'Rendering...'}
                    {currentPhase === 'uploading' && 'Uploading...'}
                  </Text>
                  <Text style={{
                    fontSize: fontScale(12),
                    color: isDarkMode ? '#9CA3AF' : '#6B7280',
                    marginTop: scale(4),
                  }}>
                    {videoTitle}
                </Text>
              </View>

                {/* Progress Bar */}
                <View style={{
                  height: scale(8),
                  backgroundColor: isDarkMode ? '#374151' : '#E5E7EB',
                  borderRadius: scale(4),
                  overflow: 'hidden',
                  marginBottom: scale(12),
                }}>
                <Animated.View 
                    style={{
                      height: '100%',
                      borderRadius: scale(4),
                      backgroundColor: currentPhase === 'recording' ? '#EF4444' : 
                                      currentPhase === 'rendering' ? '#A855F7' : '#3B82F6',
                      width: currentPhase === 'recording' 
                        ? recordingAnimation.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : currentPhase === 'rendering'
                        ? renderingAnimation.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : uploadingAnimation.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    }}
                />
              </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(12) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Zap size={scale(14)} color="#F59E0B" />
                    <Text style={{ fontSize: fontScale(12), color: '#F59E0B', marginLeft: scale(4) }}>
                      {Math.max(0, Math.floor(energy))} Energy
                </Text>
              </View>
                  <Text style={{
                    fontSize: fontScale(16),
                    fontWeight: 'bold',
                    color: currentPhase === 'recording' ? '#EF4444' : 
                          currentPhase === 'rendering' ? '#A855F7' : '#3B82F6',
                  }}>
                    {currentPhase === 'recording' && `${Math.min(100, Math.max(0, Math.round(recordingProgress)))}%`}
                    {currentPhase === 'rendering' && `${Math.min(100, Math.max(0, Math.round(renderingProgress)))}%`}
                    {currentPhase === 'uploading' && `${Math.min(100, Math.max(0, Math.round(uploadingProgress)))}%`}
                  </Text>
              </View>

              {/* Upgrade Speed Bonuses */}
              {(() => {
                const modifiers = calculateUpgradeModifiers();
                const hasSpeedBonuses = modifiers.renderTimeReduction > 0 || modifiers.processingTimeReduction > 0 || modifiers.uploadSpeed > 0 || modifiers.energyReduction > 0;
                
                if (!hasSpeedBonuses) return null;
                
                return (
                  <View style={{
                    backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.08)',
                    borderRadius: scale(12),
                    padding: scale(12),
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(8) }}>
                      <Sparkles size={scale(14)} color="#8B5CF6" />
                      <Text style={{
                        fontSize: fontScale(13),
                        fontWeight: '700',
                        color: isDarkMode ? '#A78BFA' : '#7C3AED',
                        marginLeft: scale(6),
                      }}>
                        Active Upgrades
                      </Text>
                    </View>
                    <View style={{ gap: scale(6) }}>
                      {currentPhase === 'recording' && modifiers.energyReduction > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: fontScale(11), color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                            Energy Reduction
                          </Text>
                          <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#10B981' }}>
                            -{Math.round(modifiers.energyReduction * 100)}%
                          </Text>
                        </View>
                      )}
                      {currentPhase === 'rendering' && (
                        <>
                          {modifiers.renderTimeReduction > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: fontScale(11), color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                                Render Speed
                              </Text>
                              <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#10B981' }}>
                                +{Math.round(modifiers.renderTimeReduction * 100)}%
                              </Text>
                            </View>
                          )}
                          {modifiers.processingTimeReduction > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: fontScale(11), color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                                Processing Speed
                              </Text>
                              <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#10B981' }}>
                                +{Math.round(modifiers.processingTimeReduction * 100)}%
                              </Text>
                            </View>
                          )}
                          {modifiers.energyReduction > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: fontScale(11), color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                                Energy Reduction
                              </Text>
                              <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#10B981' }}>
                                -{Math.round(modifiers.energyReduction * 100)}%
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                      {currentPhase === 'uploading' && (
                        <>
                          {modifiers.uploadSpeed > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: fontScale(11), color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                                Upload Speed
                              </Text>
                              <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#10B981' }}>
                                +{Math.round(modifiers.uploadSpeed * 100)}%
                              </Text>
                            </View>
                          )}
                          {modifiers.energyReduction > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: fontScale(11), color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                                Energy Reduction
                              </Text>
                              <Text style={{ fontSize: fontScale(11), fontWeight: '700', color: '#10B981' }}>
                                -{Math.round(modifiers.energyReduction * 100)}%
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })()}
          
                {/* Cancel Button */}
          <TouchableOpacity
                  style={{
                    marginTop: scale(16),
                    padding: scale(12),
                    alignItems: 'center',
                  }}
            onPress={() => {
              if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
              }
              if (renderingIntervalRef.current) {
                clearInterval(renderingIntervalRef.current);
                renderingIntervalRef.current = null;
              }
              if (uploadingIntervalRef.current) {
                clearInterval(uploadingIntervalRef.current);
                uploadingIntervalRef.current = null;
              }
              setSelectedVideo(null);
              setVideoTitle('');
              setCurrentPhase('idle');
              setIsRecording(false);
              setIsRendering(false);
              setIsUploading(false);
              setRecordingProgress(0);
              setRenderingProgress(0);
              setUploadingProgress(0);
            }}
          >
                  <Text style={{ fontSize: fontScale(14), color: '#EF4444', fontWeight: '600' }}>
                    Cancel
                  </Text>
          </TouchableOpacity>
              </View>
            )}
        </View>
      ) : (
          /* Empty State - No Video Selected */
          <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: scale(60),
          }}>
            <View style={{
              width: scale(100),
              height: scale(100),
              borderRadius: scale(50),
              backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: scale(20),
            }}>
              <Video size={scale(48)} color={isDarkMode ? '#4B5563' : '#9CA3AF'} />
            </View>
            <Text style={{
              fontSize: fontScale(18),
              fontWeight: 'bold',
              color: isDarkMode ? '#FFFFFF' : '#1F2937',
              marginBottom: scale(8),
            }}>
              Ready to Create?
            </Text>
            <Text style={{
              fontSize: fontScale(14),
              color: isDarkMode ? '#9CA3AF' : '#6B7280',
              textAlign: 'center',
              paddingHorizontal: scale(32),
            }}>
              Select a game from the Videos tab to start recording your next hit video!
            </Text>
        </View>
      )}
    </ScrollView>
  );
  };

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
      if (money >= cost) {
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
        
        // Save game after upgrade purchase
        saveGame();
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
      const hasFunds = money >= cost;
      
      const upgradeImage = UPGRADE_IMAGES[upgradeId as keyof typeof UPGRADE_IMAGES];
      
      return (
        <View key={upgradeId} style={styles.upgradeCard}>
          <View style={styles.upgradeCardContent}>
            {/* Upgrade Image */}
            {upgradeImage && (
              <View style={styles.upgradeImageContainer}>
                <Image 
                  source={upgradeImage} 
                  style={styles.upgradeImage}
                  resizeMode="contain"
                />
              </View>
            )}
            
            {/* Upgrade Info */}
            <View style={styles.upgradeInfo}>
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
            </View>
          </View>
          
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
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
        <Text style={styles.sectionTitle}>Upgrade Store</Text>
        <Text style={styles.storeDescription}>
          Upgrade your equipment and skills to improve video quality, reduce energy costs, and increase views!
        </Text>
        
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

  // Create styles function that can access isDarkMode - Liquid Glass Design
  const getStyles = () => StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(20),
      paddingTop: scale(16),
      paddingBottom: scale(16),
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
      shadowColor: 'rgba(0,0,0,0.08)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 3,
    },
    headerDark: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(22),
      backgroundColor: 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: scale(12),
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerIconContainer: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(22),
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: scale(12),
    },
    headerTitle: {
      fontSize: fontScale(24),
      fontWeight: '700',
      color: '#111827',
      letterSpacing: 0.3,
    },
    headerTitleDark: {
      color: '#F9FAFB',
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: scale(16),
      paddingVertical: scale(12),
      gap: scale(12),
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    tabsDark: {
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    tab: {
      flex: 1,
      paddingVertical: scale(12),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: scale(12),
      backgroundColor: 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
    },
    activeTab: {
      backgroundColor: 'rgba(139, 92, 246, 0.15)',
      borderColor: 'rgba(139, 92, 246, 0.4)',
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    tabContent: {
      flex: 1,
      paddingHorizontal: scale(16),
      paddingTop: scale(12),
      paddingBottom: scale(40),
    },
    tabContentContainer: {
      flexGrow: 1,
    },
    sectionHeader: {
      marginBottom: scale(20),
    },
    sectionTitle: {
      fontSize: fontScale(22),
      fontWeight: '700',
      color: '#111827',
      marginBottom: scale(4),
      letterSpacing: 0.2,
    },
    sectionTitleDark: {
      color: '#F9FAFB',
    },
    sectionSubtitle: {
      fontSize: fontScale(13),
      color: '#6B7280',
      fontWeight: '500',
    },
    sectionSubtitleDark: {
      color: '#9CA3AF',
    },
    videoCard: {
      borderRadius: scale(20),
      marginBottom: scale(16),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    videoCardDark: {
      borderColor: 'rgba(255,255,255,0.1)',
    },
    cardGradient: {
      padding: scale(20),
      borderRadius: scale(20),
    },
    videoCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scale(16),
    },
    videoIconContainer: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(12),
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: scale(12),
    },
    videoNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: scale(8),
    },
    videoName: {
      fontSize: fontScale(18),
      fontWeight: '700',
      color: '#111827',
      flex: 1,
      letterSpacing: 0.2,
    },
    videoNameDark: {
      color: '#F9FAFB',
    },
    ownedBadge: {
      backgroundColor: '#10B981',
      paddingHorizontal: scale(8),
      paddingVertical: scale(4),
      borderRadius: scale(6),
    },
    ownedBadgeText: {
      color: '#FFF',
      fontSize: fontScale(10),
      fontWeight: '700',
    },
    videoDescription: {
      fontSize: fontScale(14),
      color: '#6B7280',
      marginTop: scale(4),
      lineHeight: fontScale(20),
    },
    videoDescriptionDark: {
      color: '#9CA3AF',
    },
    videoStatsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(8),
      marginBottom: scale(16),
    },
    videoStatBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.03)',
      paddingHorizontal: scale(10),
      paddingVertical: scale(6),
      borderRadius: scale(8),
      gap: scale(6),
    },
    videoStatText: {
      fontSize: fontScale(12),
      color: '#374151',
      fontWeight: '600',
    },
    videoStatTextDark: {
      color: '#D1D5DB',
    },
    videoCardFooter: {
      marginTop: scale(8),
    },
    createButtonCard: {
      borderRadius: scale(12),
      overflow: 'hidden',
    },
    createButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(14),
      paddingHorizontal: scale(20),
      gap: scale(8),
    },
    createButtonText: {
      color: '#FFF',
      fontSize: fontScale(15),
      fontWeight: '700',
    },
    buyButtonCard: {
      borderRadius: scale(12),
      overflow: 'hidden',
    },
    buyButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(14),
      paddingHorizontal: scale(20),
      gap: scale(8),
    },
    buyButtonText: {
      color: '#FFF',
      fontSize: fontScale(15),
      fontWeight: '700',
    },
    disabledButtonCard: {
      opacity: 0.5,
    },
    videoInfo: {
      flex: 1,
    },
    videoName: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(4),
      letterSpacing: 0.2,
    },
    videoDescription: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.55)',
      marginBottom: scale(8),
    },
    videoStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    videoStats: {
      fontSize: fontScale(12),
      color: 'rgba(255, 255, 255, 0.5)',
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
      paddingVertical: scale(10),
      borderRadius: scale(12),
      minWidth: scale(85),
      justifyContent: 'center',
    },
    createButton: {
      backgroundColor: 'rgba(16, 185, 129, 0.9)',
    },
    buyButton: {
      backgroundColor: 'rgba(139, 92, 246, 0.9)',
    },
    disabledButton: {
      backgroundColor: 'rgba(107, 114, 128, 0.4)',
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: fontScale(13),
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: scale(10),
      width: '100%',
    },
    statCard: {
      borderRadius: scale(20),
      width: '48%',
      minWidth: scale(140),
      marginBottom: scale(12),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    statCardDark: {
      borderColor: 'rgba(255,255,255,0.1)',
    },
    statCardGradient: {
      padding: scale(20),
      alignItems: 'center',
      borderRadius: scale(20),
    },
    statIconContainer: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: scale(12),
    },
    statValue: {
      fontSize: fontScale(24),
      fontWeight: '700',
      color: '#111827',
      marginBottom: scale(4),
    },
    statValueDark: {
      color: '#F9FAFB',
    },
    statLabel: {
      fontSize: fontScale(12),
      color: '#6B7280',
      textAlign: 'center',
      fontWeight: '600',
      writingDirection: 'ltr',
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    statLabelDark: {
      color: '#9CA3AF',
    },
    uploadedVideoCard: {
      borderRadius: scale(20),
      marginBottom: scale(16),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    uploadedVideoCardDark: {
      borderColor: 'rgba(255,255,255,0.1)',
    },
    videoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: scale(12),
    },
    videoHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: scale(8),
    },
    videoTitle: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: '#111827',
      flex: 1,
    },
    videoTitleDark: {
      color: '#F9FAFB',
    },
    videoDate: {
      fontSize: fontScale(11),
      color: '#9CA3AF',
      fontWeight: '500',
    },
    videoDateDark: {
      color: '#6B7280',
    },
    videoMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(8),
    },
    metricBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.03)',
      paddingHorizontal: scale(10),
      paddingVertical: scale(6),
      borderRadius: scale(8),
      gap: scale(6),
    },
    metricText: {
      fontSize: fontScale(12),
      color: '#374151',
      fontWeight: '600',
    },
    metricTextDark: {
      color: '#D1D5DB',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(60),
    },
    emptyIconContainer: {
      width: scale(120),
      height: scale(120),
      borderRadius: scale(60),
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: scale(20),
    },
    emptyStateText: {
      fontSize: fontScale(20),
      fontWeight: '700',
      color: '#111827',
      marginBottom: scale(8),
    },
    emptyStateTextDark: {
      color: '#F9FAFB',
    },
    emptyStateSubtext: {
      fontSize: fontScale(14),
      color: '#6B7280',
      textAlign: 'center',
      paddingHorizontal: scale(40),
    },
    emptyStateSubtextDark: {
      color: '#9CA3AF',
    },
    studioContent: {
      width: '100%',
    },
    videoSelection: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: scale(14),
      padding: scale(14),
      marginBottom: scale(16),
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    selectedVideoText: {
      fontSize: fontScale(15),
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '600',
    },
    titleInput: {
      width: '100%',
      marginBottom: scale(20),
    },
    inputLabel: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: scale(8),
      fontWeight: '500',
    },
    textInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: scale(14),
      padding: scale(14),
      color: '#FFFFFF',
      fontSize: fontScale(15),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    progressContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: scale(20),
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: scale(16),
      padding: scale(20),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    progressTitle: {
      fontSize: fontScale(16),
      color: '#FFFFFF',
      marginBottom: scale(12),
      fontWeight: '700',
    },
    energyDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(12),
    },
    energyText: {
      fontSize: fontScale(13),
      color: '#FFFFFF',
      marginLeft: scale(8),
      fontWeight: '600',
    },
    progressBar: {
      width: '100%',
      height: scale(12),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: scale(6),
      overflow: 'hidden',
      marginBottom: scale(8),
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#10B981',
      borderRadius: scale(6),
    },
    renderingFill: {
      backgroundColor: '#F59E0B',
    },
    uploadingFill: {
      backgroundColor: '#8B5CF6',
    },
    progressText: {
      fontSize: fontScale(12),
      color: 'rgba(255, 255, 255, 0.55)',
    },
    cancelButton: {
      backgroundColor: 'rgba(239, 68, 68, 0.9)',
      paddingHorizontal: scale(24),
      paddingVertical: scale(12),
      borderRadius: scale(12),
      marginTop: scale(16),
    },
    cancelButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: fontScale(14),
    },
    studioEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(60),
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: scale(20),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    studioEmptyText: {
      fontSize: fontScale(16),
      color: '#FFFFFF',
      marginTop: scale(16),
      marginBottom: scale(8),
      textAlign: 'center',
      fontWeight: '600',
    },
    studioEmptySubtext: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.45)',
      textAlign: 'center',
    },
    // Upgrade Store Styles - Glass Design
    upgradeCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: scale(18),
      padding: scale(16),
      marginBottom: scale(12),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    upgradeCardContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scale(12),
    },
    upgradeImageContainer: {
      width: scale(72),
      height: scale(72),
      marginRight: scale(14),
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: scale(16),
      justifyContent: 'center',
      alignItems: 'center',
      padding: scale(8),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    upgradeImage: {
      width: '100%',
      height: '100%',
    },
    upgradeInfo: {
      flex: 1,
    },
    upgradeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: scale(8),
    },
    upgradeName: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: '#FFFFFF',
      flex: 1,
      letterSpacing: 0.2,
    },
    upgradeLevel: {
      fontSize: fontScale(13),
      color: '#8B5CF6',
      fontWeight: '700',
    },
    upgradeLevelContainer: {
      alignItems: 'flex-end',
    },
    maxLevelIndicator: {
      backgroundColor: 'rgba(16, 185, 129, 0.9)',
      paddingHorizontal: scale(8),
      paddingVertical: scale(4),
      borderRadius: scale(8),
      marginTop: scale(4),
    },
    maxLevelIndicatorText: {
      color: '#FFFFFF',
      fontSize: fontScale(10),
      fontWeight: '700',
    },
    upgradeDescription: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.55)',
      marginBottom: scale(12),
    },
    upgradeEffects: {
      marginBottom: scale(12),
    },
    effectText: {
      fontSize: fontScale(12),
      color: 'rgba(255, 255, 255, 0.5)',
      marginBottom: scale(4),
    },
    activeEffectText: {
      color: '#10B981',
      fontWeight: '600',
    },
    upgradeButton: {
      backgroundColor: 'rgba(139, 92, 246, 0.9)',
    },
    maxLevelBadge: {
      backgroundColor: 'rgba(107, 114, 128, 0.5)',
      paddingHorizontal: scale(14),
      paddingVertical: scale(8),
      borderRadius: scale(10),
      marginTop: scale(12),
    },
    maxLevelText: {
      color: '#FFFFFF',
      fontSize: fontScale(13),
      fontWeight: '700',
    },
    categorySection: {
      marginBottom: scale(20),
    },
    categoryTitle: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(12),
      letterSpacing: 0.2,
    },
    storeDescription: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.55)',
      marginBottom: scale(16),
      textAlign: 'center',
    },
    // Active Upgrades Summary Styles - Glass
    activeUpgradesSummary: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: scale(16),
      padding: scale(16),
      marginBottom: scale(20),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    activeUpgradesTitle: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: '#FFFFFF',
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
      paddingVertical: scale(10),
      paddingHorizontal: scale(14),
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: scale(12),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    activeUpgradeName: {
      fontSize: fontScale(13),
      fontWeight: '600',
      color: '#FFFFFF',
    },
    activeUpgradeEffects: {
      fontSize: fontScale(11),
      color: '#10B981',
      fontWeight: '600',
    },
  });

  // Get styles instance
  const styles = getStyles();

  // Add modal styles - Glass Design
  const modalStyles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: scale(20),
    },
    modalContainer: {
      width: '100%',
      maxWidth: scale(380),
      borderRadius: scale(24),
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.4,
      shadowRadius: 40,
      elevation: 20,
    },
    modalContainerDark: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
    },
    modalGradient: {
      padding: scale(24),
      borderRadius: scale(24),
    },
    modalHeader: {
      marginBottom: scale(20),
    },
    modalTitle: {
      fontSize: fontScale(20),
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      letterSpacing: 0.3,
    },
    modalTitleDark: {
      color: '#FFFFFF',
    },
    modalContent: {
      marginBottom: scale(24),
    },
    modalMessage: {
      fontSize: fontScale(15),
      color: 'rgba(255, 255, 255, 0.75)',
      textAlign: 'center',
      lineHeight: fontScale(22),
    },
    modalMessageDark: {
      color: 'rgba(255, 255, 255, 0.75)',
    },
    modalSubtext: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.5)',
      textAlign: 'center',
      marginTop: scale(12),
      lineHeight: fontScale(18),
    },
    modalSubtextDark: {
      color: 'rgba(255, 255, 255, 0.55)',
    },
    modalActions: {
      flexDirection: 'row',
      gap: scale(12),
    },
    modalButton: {
      flex: 1,
      borderRadius: scale(14),
      overflow: 'hidden',
    },
    modalButtonGradient: {
      paddingVertical: scale(14),
      alignItems: 'center',
      borderRadius: scale(14),
    },
    modalButtonText: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // Rich Modal Styles - Glass
    richModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: scale(16),
    },
    richModalContainer: {
      width: '100%',
      maxWidth: scale(400),
      maxHeight: '90%',
      borderRadius: scale(24),
      backgroundColor: 'rgba(15, 23, 42, 0.98)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.5,
      shadowRadius: 40,
      elevation: 20,
    },
    richModalGradient: {
      padding: scale(24),
      borderRadius: scale(24),
      alignItems: 'center',
    },
    successAnimationContainer: {
      alignItems: 'center',
      marginBottom: scale(20),
    },
    successIconContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successIcon: {
      width: scale(64),
      height: scale(64),
      borderRadius: scale(32),
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0px 4px 8px rgba(16, 185, 129, 0.3)',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    successRipple: {
      position: 'absolute',
      width: scale(80),
      height: scale(80),
      borderRadius: scale(40),
      borderWidth: 2,
      borderColor: '#10B981',
      opacity: 0.3,
    },
    richModalHeader: {
      alignItems: 'center',
      marginBottom: scale(20),
    },
    richModalTitle: {
      fontSize: fontScale(20),
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: scale(8),
      letterSpacing: 0.3,
    },
    richModalSubtitle: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.55)',
      textAlign: 'center',
    },
    gameInfoCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: scale(16),
      padding: scale(16),
      marginBottom: scale(20),
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.25)',
    },
    gameIconContainer: {
      marginRight: scale(14),
    },
    gameIcon: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    gameDetails: {
      flex: 1,
    },
    gameName: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(4),
    },
    gameStatus: {
      fontSize: fontScale(13),
      color: '#10B981',
      fontWeight: '600',
    },
    benefitsList: {
      width: '100%',
      marginBottom: scale(24),
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(10),
      paddingHorizontal: scale(14),
      paddingVertical: scale(8),
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: scale(10),
    },
    benefitText: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.8)',
      marginLeft: scale(10),
    },
    richModalActions: {
      width: '100%',
    },
    richModalButton: {
      borderRadius: scale(14),
      overflow: 'hidden',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    richModalButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(14),
      paddingHorizontal: scale(20),
      gap: scale(8),
      borderRadius: scale(14),
    },
    richModalButtonText: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // Upgrade Modal Specific Styles - Glass
    upgradeInfoCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: scale(16),
      padding: scale(16),
      marginBottom: scale(20),
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    upgradeIconContainer: {
      marginRight: scale(14),
    },
    upgradeIcon: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    upgradeDetails: {
      flex: 1,
    },
    upgradeName: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(4),
    },
    upgradeLevel: {
      fontSize: fontScale(13),
      color: '#8B5CF6',
      fontWeight: '600',
      marginBottom: scale(4),
    },
    upgradeStatus: {
      fontSize: fontScale(12),
      color: '#10B981',
      fontWeight: '600',
    },
    upgradeEffectsList: {
      width: '100%',
      marginBottom: scale(20),
    },
    effectsTitle: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(14),
      textAlign: 'center',
    },
    effectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(10),
      paddingHorizontal: scale(14),
      paddingVertical: scale(10),
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderRadius: scale(10),
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.15)',
    },
    effectText: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.8)',
      marginLeft: scale(10),
      fontWeight: '500',
    },
    performanceBoostCard: {
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderRadius: scale(14),
      padding: scale(16),
      marginBottom: scale(20),
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
      width: '100%',
    },
    boostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(8),
    },
    boostTitle: {
      fontSize: fontScale(14),
      fontWeight: '700',
      color: '#F59E0B',
      marginLeft: scale(8),
    },
    boostDescription: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: fontScale(18),
    },

    // Video Upload Modal Specific Styles - Glass
    videoInfoCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: scale(16),
      padding: scale(16),
      marginBottom: scale(20),
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.25)',
    },
    videoIconContainer: {
      marginRight: scale(14),
    },
    videoIcon: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoDetails: {
      flex: 1,
    },
    videoTitle: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(4),
      fontStyle: 'italic',
    },
    videoStatus: {
      fontSize: fontScale(12),
      color: '#10B981',
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: scale(20),
      gap: scale(10),
    },
    statCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: scale(14),
      padding: scale(14),
      alignItems: 'center',
      width: '48%',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    statIconContainer: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: scale(6),
    },
    statValue: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: scale(4),
    },
    statLabel: {
      fontSize: fontScale(10),
      color: 'rgba(255, 255, 255, 0.5)',
      fontWeight: '500',
      textAlign: 'center',
    },
    performanceSummaryCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderRadius: scale(14),
      padding: scale(16),
      marginBottom: scale(20),
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
      width: '100%',
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(8),
    },
    summaryTitle: {
      fontSize: fontScale(14),
      fontWeight: '700',
      color: '#10B981',
      marginLeft: scale(8),
    },
    summaryDescription: {
      fontSize: fontScale(13),
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: fontScale(18),
    },
  });

  // Merge styles
  const allStyles = { ...styles, ...modalStyles };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F8FAFC', '#FFFFFF', '#F1F5F9']}
      style={styles.container}
    >
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
      >
        <View style={[styles.header, isDarkMode && styles.headerDark]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeft size={scale(24)} color={isDarkMode ? '#F9FAFB' : '#111827'} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <Video size={scale(28)} color={isDarkMode ? '#8B5CF6' : '#6366F1'} />
            </View>
            <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
              YouVideo
            </Text>
          </View>
        </View>
      </MotiView>

      {/* Tabs - Icon Only */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 100 }}
      >
        <View style={[styles.tabs, isDarkMode && styles.tabsDark]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
            onPress={() => setActiveTab('videos')}
            activeOpacity={0.7}
          >
            <Video 
              size={24} 
              color={activeTab === 'videos' 
                ? '#8B5CF6' 
                : (isDarkMode ? '#9CA3AF' : '#6B7280')
              } 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
            onPress={() => setActiveTab('stats')}
            activeOpacity={0.7}
          >
            <TrendingUp 
              size={24} 
              color={activeTab === 'stats' 
                ? '#8B5CF6' 
                : (isDarkMode ? '#9CA3AF' : '#6B7280')
              } 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'studio' && styles.activeTab]}
            onPress={() => setActiveTab('studio')}
            activeOpacity={0.7}
          >
            <Play 
              size={24} 
              color={activeTab === 'studio' 
                ? '#8B5CF6' 
                : (isDarkMode ? '#9CA3AF' : '#6B7280')
              } 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'store' && styles.activeTab]}
            onPress={() => setActiveTab('store')}
            activeOpacity={0.7}
          >
            <Settings 
              size={24} 
              color={activeTab === 'store' 
                ? '#8B5CF6' 
                : (isDarkMode ? '#9CA3AF' : '#6B7280')
              } 
            />
          </TouchableOpacity>
        </View>
      </MotiView>

      {/* Tab Content */}
      {activeTab === 'videos' && renderVideosTab()}
      {activeTab === 'stats' && renderStatsTab()}
      {activeTab === 'studio' && renderStudioTab()}
      {activeTab === 'store' && renderStoreTab()}

      {/* Video Not Owned Modal */}
      <Modal visible={showVideoNotOwnedModal} transparent animationType="fade" onRequestClose={() => setShowVideoNotOwnedModal(false)}>
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
      <Modal visible={showNotEnoughEnergyModal} transparent animationType="fade" onRequestClose={() => setShowNotEnoughEnergyModal(false)}>
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

      {/* Video Uploaded Modal - Compact */}
      <Modal visible={showVideoUploadedModal} transparent animationType="fade" onRequestClose={() => setShowVideoUploadedModal(false)}>
        <View style={allStyles.richModalOverlay}>
          <View style={[allStyles.richModalContainer, { maxHeight: '60%' }]}>
              <LinearGradient
              colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              style={[allStyles.richModalGradient, { padding: 20 }]}
            >
              {/* Compact Header */}
              <Text style={[allStyles.richModalTitle, { marginBottom: 8, textAlign: 'center' }]}>🎬 Video Uploaded!</Text>
              <Text style={[allStyles.videoTitle, { textAlign: 'center', marginBottom: 16 }]}>&quot;{modalData.videoTitle}&quot;</Text>

              {/* Compact Stats Row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={allStyles.statValue}>{modalData.views?.toLocaleString() || '0'}</Text>
                  <Text style={allStyles.statLabel}>Views</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={allStyles.statValue}>${modalData.earnings?.toFixed(2) || '0.00'}</Text>
                  <Text style={allStyles.statLabel}>Earnings/wk</Text>
                  </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={allStyles.statValue}>+{modalData.subscribersGained || '0'}</Text>
                  <Text style={allStyles.statLabel}>Subs</Text>
                </View>
              </View>

              {/* Action Button */}
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
                  <Text style={allStyles.richModalButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Video Purchased Modal - Rich & Smooth */}
      <Modal visible={showVideoPurchasedModal} transparent animationType="fade" onRequestClose={() => setShowVideoPurchasedModal(false)}>
        <View style={allStyles.richModalOverlay}>
          <View style={allStyles.richModalContainer}>
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
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
                  You&apos;re ready to create amazing content
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Insufficient Funds Modal */}
      <Modal visible={showInsufficientFundsModal} transparent animationType="fade" onRequestClose={() => setShowInsufficientFundsModal(false)}>
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
      <Modal visible={showMaxLevelModal} transparent animationType="fade" onRequestClose={() => setShowMaxLevelModal(false)}>
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
                  🏆† Max Level Reached
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
      <Modal visible={showUpgradePurchasedModal} transparent animationType="fade" onRequestClose={() => setShowUpgradePurchasedModal(false)}>
        <View style={allStyles.richModalOverlay}>
          <View style={allStyles.richModalContainer}>
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

