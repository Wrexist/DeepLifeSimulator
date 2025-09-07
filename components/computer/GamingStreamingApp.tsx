/**
 * Gaming & Streaming App Component
 * 
 * ⚠️  PERMANENT SCALING FIX ⚠️
 * This component uses its OWN simple scaling system
 * DO NOT import or use any external responsive scaling utilities
 * DO NOT change the scaling functions below
 * 
 * Scaling is based on iPhone 14/15 (390px width) as reference
 * All scaling is contained within this file only
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
  AppState,
  InteractionManager,
  Animated,
  Easing,
  Image,
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
  Video,
  Mic,
  Camera,
  Star,
  Settings,
  Zap,
  Award,
  Crown,
  Clock,
  Activity
} from 'lucide-react-native';
import { Snowflake, Square } from 'lucide-react-native';
import { useGame, GameState } from '@/contexts/GameContext';


// PERMANENT SIMPLE SCALING - INDEPENDENT OF ANY OTHER SCALING SYSTEM
const getScreenWidth = () => {
  try {
    return Dimensions.get('window').width;
  } catch {
    return 390; // Fallback to iPhone 14/15 width
  }
};

const simpleScale = (size: number): number => {
  const width = getScreenWidth();
  const baseWidth = 390; // iPhone 14/15 base width
  const scaleFactor = Math.min(Math.max(width / baseWidth, 0.8), 1.2); // Between 0.8x and 1.2x
  const result = Math.round(size * scaleFactor);
  
  // Debug logging (only in development)
  if (__DEV__) {
    console.log(`🔧 SimpleScale: ${size}px → ${result}px (width: ${width}px, factor: ${scaleFactor.toFixed(2)})`);
  }
  
  return result;
};

const simpleFontScale = (size: number): number => {
  const width = getScreenWidth();
  const baseWidth = 390;
  const scaleFactor = Math.min(Math.max(width / baseWidth, 0.9), 1.1); // Between 0.9x and 1.1x for fonts
  return Math.round(size * scaleFactor);
};

// (Removed FORCE_SCALE constants to avoid unused warnings)

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Static game catalog (avoid recreating arrays every render)
const AVAILABLE_GAMES: Array<{
  id: string;
  name: string;
  baseViewers: number;
  baseEarnings: number;
  required: number;
  cost: number;
  description: string;
}> = [
  { id: 'minecraft', name: 'Minecraft', baseViewers: 50, baseEarnings: 2, required: 0, cost: 150, description: 'Creative sandbox game' },
  { id: 'amongus', name: 'Among Us', baseViewers: 80, baseEarnings: 3, required: 0, cost: 80, description: 'Social deduction game' },
  { id: 'fortnite', name: 'Fortnite', baseViewers: 120, baseEarnings: 4, required: 100, cost: 50, description: 'Battle royale game' },
  { id: 'valorant', name: 'Valorant', baseViewers: 150, baseEarnings: 5, required: 200, cost: 75, description: 'Tactical shooter game' },
  { id: 'league', name: 'League of Legends', baseViewers: 200, baseEarnings: 6, required: 500, cost: 100, description: 'MOBA game' },
] as const;

// Game images (placed in assets/images/Games)
const GAME_IMAGES: Record<string, any> = {
  minecraft: require('@/assets/images/Games/Minecraft.png'),
  amongus: require('@/assets/images/Games/Among us.png'),
  fortnite: require('@/assets/images/Games/Fortnite.png'),
  valorant: require('@/assets/images/Games/Valorant.png'),
  league: require('@/assets/images/Games/League of Legends.png'),
};

interface GamingStreamingAppProps {
  onBack: () => void;
}

interface StreamSession {
  id: string;
  game: string;
  duration: number;
  viewers: number;
  earnings: number;
  followers: number;
  subscribers: number;
  chatMessages: number;
  donations: number;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) { console.error('GamingStreamingApp error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: '#6B7280', marginBottom: 12 }}>Try going back and reopening the app.</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children as any;
  }
}

export default function GamingStreamingApp({ onBack }: GamingStreamingAppProps) {
  const { gameState, setGameState, updateMoney } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stream' | 'videos' | 'shop'>('dashboard');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [streamDuration, setStreamDuration] = useState(0);
  const [streamTimer, setStreamTimer] = useState<NodeJS.Timeout | null>(null);
  const [streamProgress, setStreamProgress] = useState(0);
  const [progressTimer, setProgressTimer] = useState<NodeJS.Timeout | null>(null);
  const [streamDonations, setStreamDonations] = useState<Array<{id: string, amount: number, message: string, position: {top: number, left: number}}>>([]);
  const [donationTimer, setDonationTimer] = useState<NodeJS.Timeout | null>(null);
  const [viewersTimer, setViewersTimer] = useState<NodeJS.Timeout | null>(null);
  const [energyTimer, setEnergyTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentViewers, setCurrentViewers] = useState(0);
  const [totalDonations, setTotalDonations] = useState(0);
  const [subsTimer, setSubsTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentSubsGained, setCurrentSubsGained] = useState(0);
  const [subPopups, setSubPopups] = useState<Array<{id: string, name: string, position: { top: number, left: number }}>>([]);
  
  // Modal states
  const [showGameNotOwnedModal, setShowGameNotOwnedModal] = useState(false);
  const [showNotEnoughEnergyModal, setShowNotEnoughEnergyModal] = useState(false);
  const [showSelectGameModal, setShowSelectGameModal] = useState(false);
  const [showAlreadyStreamingModal, setShowAlreadyStreamingModal] = useState(false);
  const [showFollowersRequiredModal, setShowFollowersRequiredModal] = useState(false);
  const [showStreamEndedModal, setShowStreamEndedModal] = useState(false);
  const [showGamePurchasedModal, setShowGamePurchasedModal] = useState(false);
  const [showAlreadyOwnedModal, setShowAlreadyOwnedModal] = useState(false);
  const [showInsufficientFundsModal, setShowInsufficientFundsModal] = useState(false);
  const [showRecordingInProgressModal, setShowRecordingInProgressModal] = useState(false);
  const [showResumingModal, setShowResumingModal] = useState(false);
  const [modalData, setModalData] = useState<any>({});
  
  // Maximum number of popups to prevent screen clutter
  const MAX_POPUPS = 8;
  const isEndingRef = useRef(false);
  const isStreamingRef = useRef(false);
  // Videos state - now using persistent state from gameState
  const [isRecording, setIsRecording] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoGame, setVideoGame] = useState<string>('');
  const [recordTimer, setRecordTimer] = useState<NodeJS.Timeout | null>(null);
  const [renderTimer, setRenderTimer] = useState<NodeJS.Timeout | null>(null);
  const [uploadTimer, setUploadTimer] = useState<NodeJS.Timeout | null>(null);
  // Stream goals overlay
  const [subsGoal, setSubsGoal] = useState(0);
  const [donGoal, setDonGoal] = useState(0);
  const [subsMilestone, setSubsMilestone] = useState(0);
  const [donMilestone, setDonMilestone] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);
  const [showConfetti, setShowConfetti] = useState(false);
  const [postInteractionReady, setPostInteractionReady] = useState(false);

  // Simple press scale hook for nice button interactions
  const usePressScale = () => {
    const scale = useRef(new Animated.Value(1)).current;
    const onPressIn = () => {
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
    };
    const onPressOut = () => {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    };
    return { scale, onPressIn, onPressOut };
  };

  // Create press scale hook instance at component level
  const pressScale = usePressScale();

  // Shimmer overlay for progress fills
  const Shimmer = () => {
    const translateX = useRef(new Animated.Value(-40)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, { toValue: 160, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -40, duration: 0, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [translateX]);
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.shimmerOverlay, { transform: [{ translateX }] }]}
      />
    );
  };

  // Animated popup for donations/subs
  const AnimatedPopup = ({ children, top, left, bgStyle }: { children: React.ReactNode; top: number; left: number; bgStyle?: any; }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;
    useEffect(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
      ]).start();
    }, [opacity, translateY]);
    return (
      <Animated.View style={[styles.donationPopup, bgStyle, { top, left, opacity, transform: [{ translateY }] }]}> 
        {children}
      </Animated.View>
    );
  };

  // Confetti overlay shown on successful upload
  const ConfettiOverlay = ({ onDone }: { onDone?: () => void }) => {
    const t = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        onDone && onDone();
      });
    }, [t, onDone]);
    const pieces = Array.from({ length: 24 }).map((_, i) => {
      const left = Math.random() * (screenWidth - 16);
      const drift = (Math.random() * 60) - 30;
      const endY = screenHeight * (0.4 + Math.random() * 0.4);
      const size = 6 + Math.round(Math.random() * 6);
      const colors = ['#F87171', '#34D399', '#60A5FA', '#FBBF24', '#A78BFA', '#F472B6'];
      const color = colors[i % colors.length];
      return (
        <Animated.View
          key={`confetti_${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left,
            width: size,
            height: size,
            borderRadius: 2,
            backgroundColor: color,
            opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-20, endY] }) },
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${Math.random() * 360}deg`] }) },
            ],
          }}
        />
      );
    });
    return (
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {pieces}
      </View>
    );
  };

  // Defer non-critical work until after initial interactions
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setPostInteractionReady(true);
    });
    // @ts-ignore older RN versions
    return () => task?.cancel?.();
  }, []);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Calculate level based on experience
  const calculateLevel = (experience: number): number => {
    // Level 1: 0-99 XP, Level 2: 100-299 XP, Level 3: 300-599 XP, etc.
    return Math.floor(experience / 100) + 1;
  };

  const gamingData = (gameState.gamingStreaming || {
    followers: 0,
    subscribers: 0,
    totalViews: 0,
    totalEarnings: 0,
    totalDonations: 0,
    totalSubEarnings: 0,
    level: 1,
    experience: 0,
    gamesPlayed: [],
    streamHours: 0,
    averageViewers: 0,
    bestStream: null,
    currentStream: null,
    equipment: {
      microphone: false,
      webcam: false,
      gamingChair: false,
      greenScreen: false,
      lighting: false,
    },
    pcComponents: {
      cpu: false,
      gpu: false,
      ram: false,
      ssd: false,
      motherboard: false,
      cooling: false,
      psu: false,
      case: false,
    },
    unlockedGames: [],
    ownedGames: [],
    streamHistory: [],
    videos: [],
    // Persistent video recording state
    videoRecordingState: {
      isRecording: false,
      isRendering: false,
      isUploading: false,
      recordProgress: 0,
      renderProgress: 0,
      uploadProgress: 0,
      videoTitle: '',
      videoGame: '',
    },
    // Persistent streaming state
    streamingState: {
      isStreaming: false,
      streamProgress: 0,
      streamDuration: 0,
      selectedGame: '',
      currentViewers: 0,
      totalDonations: 0,
      currentSubsGained: 0,
    },
  }) as NonNullable<GameState['gamingStreaming']>;

  // Compute energy drain per second based on owned equipment/components
  const computeEnergyPerSecond = (): number => {
    // Base drain
    let drain = 3; // base energy per second
    const eq = gamingData.equipment || {} as any;
    const pc = gamingData.pcComponents || {} as any;
    const lv = (gamingData as any).pcUpgradeLevels || {} as any;

    // Reductions from equipment
    if (eq.gamingChair) drain *= 0.85; // 15% less
    if (eq.lighting) drain *= 0.95; // small tuning effect

    // Reductions from PC components
    if (pc.cooling) drain *= 0.9; // better thermals
    if (pc.cpu) drain *= 0.95;
    if (pc.gpu) drain *= 0.95;

    // Additional reductions by upgrade levels (stack multiplicatively)
    if (lv.cooling) drain *= Math.pow(0.9, lv.cooling); // -10% per level
    if (lv.cpu) drain *= Math.pow(0.95, lv.cpu); // -5% per level
    if (lv.gpu) drain *= Math.pow(0.95, lv.gpu); // -5% per level

    // Clamp between 1 and 6
    drain = Math.max(1, Math.min(6, Math.round(drain)));
    return drain;
  };

  // PC component model names per level for display
  const getComponentModel = (type: string, level: number): string => {
    const maps: Record<string, string[]> = {
      cpu: ['Stock CPU', 'Ryzen 5 / Core i5', 'Ryzen 7 / Core i7', 'Ryzen 9 / Core i9'],
      gpu: ['Integrated GPU', 'RTX 3060', 'RTX 4070', 'RTX 4080'],
      ram: ['8GB DDR4', '16GB DDR4', '32GB DDR5', '64GB DDR5'],
      ssd: ['SATA SSD', 'NVMe Gen3', 'NVMe Gen4', 'NVMe Gen5'],
      motherboard: ['Entry ATX', 'B-Series', 'X-Series'],
      cooling: ['Stock Cooler', 'Tower Air', '240mm AIO', '360mm AIO'],
      psu: ['500W Bronze', '650W Gold', '850W Gold'],
      case: ['Compact Case', 'Mid Tower', 'Airflow Case'],
      network: ['Basic 50 Mbps', '100 Mbps', '500 Mbps', '1 Gbps'],
    };
    const arr = maps[type] || ['Level 0', 'Level 1', 'Level 2', 'Level 3'];
    const idx = Math.max(0, Math.min(level, arr.length - 1));
    return arr[idx];
  };

  const getNextUpgradePrice = (type: string, level: number): number | null => {
    const pricing: Record<string, number[]> = {
      cpu: [800, 1200, 1600],
      gpu: [900, 1400, 2000],
      ram: [200, 300, 400],
      ssd: [150, 250, 350],
      cooling: [120, 220, 320],
      motherboard: [200, 350],
      psu: [150, 250],
      case: [120, 200],
      network: [100, 200, 400],
    };
    const arr = pricing[type] || [];
    return level < arr.length ? arr[level] : null;
  };

  // ---------- Videos logic ----------
  const randomizeTitle = (gameName: string): string => {
    const counters = (gameState.gamingStreaming as any).videoTitleCounters || {};
    const nextIndex = (base: string) => {
      const key = `${gameName}:${base}`;
      const n = (counters[key] || 0) + 1;
      counters[key] = n;
      setGameState(prev => ({
        ...prev,
        gamingStreaming: { ...prev.gamingStreaming!, videoTitleCounters: counters },
      }));
      return n;
    };
    const templates = [
      () => `${gameName} Funny Moments #${nextIndex('Funny Moments')}`,
      () => `${gameName} Highlights #${nextIndex('Highlights')}`,
      () => `Pro Tips in ${gameName}`,
      () => `Road to Rank in ${gameName}`,
      () => `Best Settings for ${gameName}`,
      () => `New Update in ${gameName}: My Thoughts`,
      () => `${gameName} Challenge Run #${nextIndex('Challenge')}`,
      () => `Speedrun Attempts in ${gameName} #${nextIndex('Speedrun')}`,
    ];
    const pick = templates[Math.floor(Math.random() * templates.length)];
    return pick();
  };

  const getRenderTimeMs = (): number => {
    // base 8000ms reduced by components
    const lv = (gamingData as any).pcUpgradeLevels || {} as any;
    let t = 8000;
    t *= Math.pow(0.9, lv.ram || 0); // RAM -10% per level
    t *= Math.pow(0.85, lv.gpu || 0); // GPU -15% per level
    t *= Math.pow(0.9, lv.cpu || 0); // CPU -10% per level (render)
    return Math.max(3000, Math.round(t));
  };

  const getUploadTimeMs = (): number => {
    // base 6000ms reduced by SSD + small lighting prep
    const eq = gamingData.equipment || {} as any;
    const lv = (gamingData as any).pcUpgradeLevels || {} as any;
    let t = 6000;
    t *= Math.pow(0.85, lv.ssd || 0); // SSD -15% per level
    t *= Math.pow(0.9, lv.network || 0); // Network upgrade -10% per level
    if (eq.lighting) t *= 0.95;
    return Math.max(2000, Math.round(t));
  };

  const startVideoRecording = (gameId: string) => {
    if (isStreaming || isRecording || isRendering || isUploading) return;
    const game = availableGames.find(g => g.id === gameId);
    if (!game) return;
    if (!(gamingData.ownedGames || []).includes(game.id)) {
      setModalData({ gameName: game.name });
      setShowGameNotOwnedModal(true);
      return;
    }
    // Fixed recording energy cost (no per-second drain)
    const recordCost = Math.max(1, computeEnergyPerSecond() * 12);
    if (gameState.stats.energy < recordCost) {
      setModalData({ requiredEnergy: recordCost });
      setShowNotEnoughEnergyModal(true);
      return;
    }
    const title = (videoTitle || '').trim() || randomizeTitle(game.name);
    setVideoTitle(title);
    setVideoGame(game.id);
    setIsRecording(true);
    setRecordProgress(0);
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, energy: Math.max(0, prev.stats.energy - recordCost) },
    }));

    const perSec = computeEnergyPerSecond();
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      setRecordProgress(p => {
        const newProgress = Math.min(100, p + 10);
        // Update persistent state with the new progress
        updateVideoRecordingState({
          isRecording: true,
          recordProgress: newProgress,
          videoTitle: title,
          videoGame: game.id,
        });
        return newProgress;
      });
      // no per-second drain during recording (fixed cost only)

      if (ticks >= 10) {
        clearInterval(timer);
        setRecordTimer(null);
        // finish recording step; user must manually start rendering next
        setIsRecording(false);
        setRenderProgress(0);
        updateVideoRecordingState({
          isRecording: false,
          recordProgress: 100,
          renderProgress: 0,
          uploadProgress: 0,
        });
      }
    }, 1000);
    setRecordTimer(timer as unknown as NodeJS.Timeout);
  };

  const resumeVideoRecording = () => {
    const videoState = gamingData.videoRecordingState;
    if (!videoState) return;

    // Show a brief alert to inform user that recording is resuming
    if (videoState.recordProgress > 0 || videoState.renderProgress > 0 || videoState.uploadProgress > 0) {
      setShowResumingModal(true);
    }

    // Resume recording if it was in progress
    if (videoState.isRecording && videoState.recordProgress < 100) {
      setIsRecording(true);
      setRecordProgress(videoState.recordProgress);
      setVideoTitle(videoState.videoTitle || '');
      setVideoGame(videoState.videoGame || '');
      
      const remainingTicks = Math.ceil((100 - videoState.recordProgress) / 10);
      let ticks = 0;
      const timer = setInterval(() => {
        ticks += 1;
        setRecordProgress(p => {
          const newProgress = Math.min(100, p + 10);
          updateVideoRecordingState({
            isRecording: true,
            recordProgress: newProgress,
          });
          return newProgress;
        });

        if (ticks >= remainingTicks) {
          clearInterval(timer);
          setRecordTimer(null);
          setIsRecording(false);
          setRenderProgress(0);
          updateVideoRecordingState({
            isRecording: false,
            recordProgress: 100,
            renderProgress: 0,
            uploadProgress: 0,
          });
        }
      }, 1000);
      setRecordTimer(timer as unknown as NodeJS.Timeout);
    }
    // Resume rendering if it was in progress
    else if (videoState.isRendering && videoState.renderProgress < 100) {
      setIsRendering(true);
      setRenderProgress(videoState.renderProgress);
      setVideoTitle(videoState.videoTitle || '');
      setVideoGame(videoState.videoGame || '');
      
      const renderMs = getRenderTimeMs();
      const steps = 20;
      const remainingSteps = Math.ceil((100 - videoState.renderProgress) / (100 / steps));
      let step = 0;
          const renderInt = setInterval(() => {
      step += 1;
      setRenderProgress(p => {
        const newProgress = Math.min(100, Math.round((step / remainingSteps) * (100 - videoState.renderProgress) + videoState.renderProgress));
        updateVideoRecordingState({
          isRendering: true,
          renderProgress: newProgress,
        });
        return newProgress;
      });
              if (step >= remainingSteps) {
          clearInterval(renderInt);
          setRenderTimer(null);
          setIsRendering(false);
          setUploadProgress(0);
          updateVideoRecordingState({
            isRendering: false,
            renderProgress: 100,
            uploadProgress: 0,
          });
        }
    }, Math.max(50, Math.round(renderMs / steps)));
      setRenderTimer(renderInt as unknown as NodeJS.Timeout);
    }
    // Resume uploading if it was in progress
    else if (videoState.isUploading && videoState.uploadProgress < 100) {
      setIsUploading(true);
      setUploadProgress(videoState.uploadProgress);
      setVideoTitle(videoState.videoTitle || '');
      setVideoGame(videoState.videoGame || '');
      
      const uploadMs = getUploadTimeMs();
      const usteps = 20;
      const remainingSteps = Math.ceil((100 - videoState.uploadProgress) / (100 / usteps));
      let ustep = 0;
          const uploadInt = setInterval(() => {
      ustep += 1;
      setUploadProgress(p => {
        const newProgress = Math.min(100, Math.round((ustep / remainingSteps) * (100 - videoState.uploadProgress) + videoState.uploadProgress));
        updateVideoRecordingState({
          isUploading: true,
          uploadProgress: newProgress,
        });
        return newProgress;
      });
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, energy: Math.max(0, prev.stats.energy - Math.max(1, Math.round(computeEnergyPerSecond() * 0.5))) },
      }));
      if (ustep >= remainingSteps) {
        clearInterval(uploadInt);
        setUploadTimer(null);
        setIsUploading(false);
        const game = availableGames.find(g => g.id === videoState.videoGame);
        if (game) finalizeVideo(game, videoState.videoTitle || randomizeTitle(game.name));
        // Reset flow so user must start from Record again
        setRecordProgress(0);
        setRenderProgress(0);
        setUploadProgress(0);
        setIsRecording(false);
        setIsRendering(false);
        setVideoTitle('');
        updateVideoRecordingState({
          isRecording: false,
          isRendering: false,
          isUploading: false,
          recordProgress: 0,
          renderProgress: 0,
          uploadProgress: 0,
          videoTitle: '',
          videoGame: '',
        });
        // Trigger confetti
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1600);
      }
    }, Math.max(50, Math.round(uploadMs / usteps)));
      setUploadTimer(uploadInt as unknown as NodeJS.Timeout);
    }
  };

  const startRender = () => {
    if (isStreaming || isRecording || isRendering || isUploading) return;
    // Require recording to be complete
    if (recordProgress < 100) return;
    // Minimal energy check so player understands requirement
    if (gameState.stats.energy <= 0) {
      setModalData({ requiredEnergy: 1 });
      setShowNotEnoughEnergyModal(true);
      return;
    }
    setIsRendering(true);
    setRenderProgress(0);
    updateVideoRecordingState({
      isRendering: true,
      renderProgress: 0,
    });
    const renderMs = getRenderTimeMs();
    const steps = 20;
    let step = 0;
    const renderInt = setInterval(() => {
      step += 1;
      setRenderProgress(p => {
        const newProgress = Math.min(100, Math.round((step / steps) * 100));
        updateVideoRecordingState({
          isRendering: true,
          renderProgress: newProgress,
        });
        return newProgress;
      });
      if (step >= steps) {
        clearInterval(renderInt);
        setRenderTimer(null);
        setIsRendering(false);
        setUploadProgress(0);
        updateVideoRecordingState({
          isRendering: false,
          renderProgress: 100,
          uploadProgress: 0,
        });
      }
    }, Math.max(50, Math.round(renderMs / steps)));
    setRenderTimer(renderInt as unknown as NodeJS.Timeout);
  };

  const startUpload = () => {
    if (isStreaming || isRecording || isRendering || isUploading) return;
    if (renderProgress < 100) return;
    const perSec = computeEnergyPerSecond();
    const perSecUpload = Math.max(1, Math.round(perSec * 0.5));
    if (gameState.stats.energy < perSecUpload) {
      setModalData({ requiredEnergy: perSecUpload });
      setShowNotEnoughEnergyModal(true);
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    updateVideoRecordingState({
      isUploading: true,
      uploadProgress: 0,
    });
    const uploadMs = getUploadTimeMs();
    const usteps = 20;
    let ustep = 0;
    const uploadInt = setInterval(() => {
      ustep += 1;
      setUploadProgress(p => {
        const newProgress = Math.min(100, Math.round((ustep / usteps) * 100));
        updateVideoRecordingState({
          isUploading: true,
          uploadProgress: newProgress,
        });
        return newProgress;
      });
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, energy: Math.max(0, prev.stats.energy - perSecUpload) },
      }));
      if (ustep >= usteps) {
        clearInterval(uploadInt);
        setUploadTimer(null);
        setIsUploading(false);
        const game = availableGames.find(g => g.id === videoGame);
        if (game) finalizeVideo(game, videoTitle || randomizeTitle(game.name));
        // Reset flow so user must start from Record again
        setRecordProgress(0);
        setRenderProgress(0);
        setUploadProgress(0);
        setIsRecording(false);
        setIsRendering(false);
        // Optional: clear title for next recording
        setVideoTitle('');
        updateVideoRecordingState({
          isRecording: false,
          isRendering: false,
          isUploading: false,
          recordProgress: 0,
          renderProgress: 0,
          uploadProgress: 0,
          videoTitle: '',
          videoGame: '',
        });
        // Trigger confetti
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1600);
      }
    }, Math.max(50, Math.round(uploadMs / usteps)));
    setUploadTimer(uploadInt as unknown as NodeJS.Timeout);
  };

  const finalizeVideo = (game: { id: string; name: string; baseViewers: number }, title: string) => {
    // compute quality and stats with more variance
    const eq = gamingData.equipment || ({} as any);
    const lv = ((gamingData as any).pcUpgradeLevels || {}) as any;
    let quality = 0.2;
    if (eq.microphone) quality += 0.15;
    if (eq.webcam) quality += 0.1;
    if (eq.lighting) quality += 0.1;
    if (eq.greenScreen) quality += 0.05;
    if (eq.gamingChair) quality += 0.05;
    quality += 0.05 * (lv.cpu || 0) + 0.05 * (lv.gpu || 0) + 0.03 * (lv.cooling || 0);
    quality = Math.min(1.0, Math.max(0.2, quality));

    const followers = gamingData.followers || 0;
    const base = game.baseViewers * (1.1 + Math.random() * 0.3); // 1.1x..1.4x baseline with noise
    const channel = Math.min(4, 1 + followers / 5000);
    const titleFactor = title.toLowerCase().includes(game.name.toLowerCase()) ? 1.1 : 0.9 + Math.random() * 0.2; // 0.9..1.1
    const qualityFactor = 0.75 + 0.5 * quality; // stronger impact from quality
    const trendFactor = 0.9 + Math.random() * 0.4; // 0.9..1.3
    const timeFactor = 0.85 + Math.random() * 0.3; // 0.85..1.15
    const videosOfThisGame = ((gamingData.videos as any[]) || []).filter(v => v.game === game.name).length;
    const repetitionPenalty = Math.max(0.75, 1 - Math.min(0.25, videosOfThisGame * 0.05)); // up to -25%
    const viralMultiplier = Math.random() < 0.07 ? 1.8 + Math.random() * 2.2 : 1; // 7% viral chance 1.8x..4x
    const randomness = 0.8 + Math.random() * 0.4; // 0.8..1.2
    const views = Math.max(
      150,
      Math.min(
        2000000,
        Math.floor(
          base * channel * titleFactor * qualityFactor * trendFactor * timeFactor * repetitionPenalty * viralMultiplier * randomness
        )
      )
    );
    const likeRate = (0.06 + 0.08 * quality) * (0.8 + Math.random() * 0.4); // ~3%..15%
    const commentRate = (0.01 + 0.02 * Math.random()) * (0.9 + Math.random() * 0.3); // ~1%..3%
    const likes = Math.floor(views * likeRate);
    const comments = Math.floor(views * commentRate);

    // CPM based on subscribers and quality, with variance
    const subs = gamingData.subscribers || 0;
    const subsBoost = Math.min(6, (subs / 10000) * 3); // +0..+6 as subs grow
    let cpm = (2 + subsBoost) * (0.85 + 0.35 * quality) * (0.85 + Math.random() * 0.3);

    // Source impacts monetization slightly
    const sources = ['Recommendations', 'Channel', 'Search'];
    const sourceWeights = [0.55, 0.3, 0.15];
    const r = Math.random();
    const source = r < sourceWeights[0] ? sources[0] : r < sourceWeights[0] + sourceWeights[1] ? sources[1] : sources[2];
    if (source === 'Search') cpm *= 1.05;
    if (source === 'Channel') cpm *= 0.95;

    const earnings = Math.round(((views / 1000) * cpm) * 100) / 100;
    const subsElastic = 1 - (gamingData.subscribers || 0) / ((gamingData.subscribers || 0) + 20000);
    const subsGain = Math.floor(
      views * (0.001 + Math.random() * 0.005) * (0.9 + 0.2 * quality) * subsElastic * (viralMultiplier > 1 ? 1.2 : 1)
    );

    // Analytics
    const ctr = Math.max(2, Math.min(22, Math.round(4 + quality * 10 + (Math.random() * 6 - 3))));
    const avgViewDuration = Math.max(25, Math.min(180, Math.round(35 + quality * 60 + (Math.random() * 40 - 20))));
    const rpm = Math.max(0.8, Math.round(((earnings / (views / 1000 || 1)) * 0.7) * 100) / 100); // platform cut approx

    // save video and update totals
    const video = {
      id: Date.now().toString(),
      game: game.name,
      title,
      durationSec: 10,
      views,
      likes,
      comments,
      earnings,
      quality,
      uploadedAt: Date.now(),
      ctr,
      avgViewDuration,
      rpm,
      source,
    } as any;

    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        videos: [video, ...((prev.gamingStreaming!.videos as any[]) || [])].slice(0, 20),
        followers: prev.gamingStreaming!.followers + Math.floor(subsGain * 4),
        subscribers: prev.gamingStreaming!.subscribers + subsGain,
        totalViews: prev.gamingStreaming!.totalViews + views,
        totalEarnings: prev.gamingStreaming!.totalEarnings + earnings,
        totalSubEarnings: (prev.gamingStreaming!.totalSubEarnings || 0),
        totalDonations: (prev.gamingStreaming!.totalDonations || 0),
      }
    }));
  };

  // Popup layout helpers to avoid overlap and avoid bottom streaming container area
  const POPUP_WIDTH = 200;
  const POPUP_HEIGHT = 60;
  const RESERVED_BOTTOM = 0; // allow popups over streaming container
  const getNonOverlappingPosition = (existing: Array<{ top: number; left: number }>): { top: number; left: number } => {
    // Target upper area more densely to surface more popups
    const maxTop = Math.max(0, screenHeight - RESERVED_BOTTOM - POPUP_HEIGHT);
    const maxLeft = Math.max(0, screenWidth - POPUP_WIDTH - 20);
    
    // Try to find a non-overlapping position
    for (let attempt = 0; attempt < 30; attempt++) {
      const top = Math.random() * Math.max(40, maxTop * 0.7) + 20; // bias to top 70%
      const left = Math.random() * (maxLeft - 10) + 10;
      
      // Check for overlaps with more generous spacing
      const overlaps = existing.some(p => 
        Math.abs(p.top - top) < POPUP_HEIGHT + 20 && 
        Math.abs(p.left - left) < POPUP_WIDTH + 20
      );
      
      if (!overlaps) return { top, left };
    }
    
    // fallback: create a grid-based position to avoid overlaps
    const gridCols = Math.floor(maxLeft / (POPUP_WIDTH + 20));
    const gridRows = Math.floor(maxTop / (POPUP_HEIGHT + 20));
    const totalSlots = gridCols * gridRows;
    
    if (existing.length < totalSlots) {
      // Find first available slot
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const top = 20 + row * (POPUP_HEIGHT + 20);
          const left = 10 + col * (POPUP_WIDTH + 20);
          
          const overlaps = existing.some(p => 
            Math.abs(p.top - top) < POPUP_HEIGHT + 10 && 
            Math.abs(p.left - left) < POPUP_WIDTH + 10
          );
          
          if (!overlaps) return { top, left };
        }
      }
    }
    
    // Final fallback: stack with offset
    const offset = existing.length * 15;
    return { 
      top: Math.min(maxTop, 20 + (offset % (maxTop - 20))), 
      left: Math.min(maxLeft, 10 + (offset % (maxLeft - 10))) 
    };
  };

  // Initialize gaming data if it doesn't exist
  useEffect(() => {
    if (!gameState.gamingStreaming) {
      setGameState(prev => ({
        ...prev,
        gamingStreaming: {
          followers: 0,
          subscribers: 0,
          totalViews: 0,
          totalEarnings: 0,
          totalDonations: 0,
          totalSubEarnings: 0,
          level: 1,
          experience: 0,
          gamesPlayed: [],
          streamHours: 0,
          averageViewers: 0,
          bestStream: null,
          currentStream: null,
          equipment: {
            microphone: false,
            webcam: false,
            gamingChair: false,
            greenScreen: false,
            lighting: false,
          },
          pcComponents: {
            cpu: false,
            gpu: false,
            ram: false,
            ssd: false,
            motherboard: false,
            cooling: false,
            psu: false,
            case: false,
          },
          pcUpgradeLevels: {
            cpu: 0,
            gpu: 0,
            ram: 0,
            ssd: 0,
            motherboard: 0,
            cooling: 0,
            psu: 0,
            case: 0,
          },
          unlockedGames: [],
          ownedGames: [],
          streamHistory: [],
          videos: [],
          videoTitleCounters: {},
          // Initialize persistent video recording state
          videoRecordingState: {
            isRecording: false,
            isRendering: false,
            isUploading: false,
            recordProgress: 0,
            renderProgress: 0,
            uploadProgress: 0,
            currentPhase: 'idle' as const,
            videoTitle: '',
            videoGame: '',
          },
          // Initialize persistent streaming state
          streamingState: {
            isStreaming: false,
            streamProgress: 0,
            streamDuration: 0,
            selectedGame: '',
            currentViewers: 0,
            totalDonations: 0,
            currentSubsGained: 0,
          },
        }
      }));
    }
  }, []);

  // Initialize local video state from persistent state
  useEffect(() => {
    const videoState = gamingData.videoRecordingState;
    if (videoState) {
      setIsRecording(videoState.isRecording);
      setIsRendering(videoState.isRendering || false);
      setIsUploading(videoState.isUploading || false);
      setRecordProgress(videoState.recordProgress);
      setRenderProgress(videoState.renderProgress);
      setUploadProgress(videoState.uploadProgress);
      setVideoTitle(videoState.videoTitle || '');
      setVideoGame(videoState.videoGame || '');
    }
  }, [gamingData.videoRecordingState]);

  // Helper function to update persistent video recording state
  const updateVideoRecordingState = (updates: Partial<typeof gamingData.videoRecordingState>) => {
    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        videoRecordingState: {
          isRecording: false,
          recordProgress: 0,
          renderProgress: 0,
          uploadProgress: 0,
          currentPhase: 'idle' as const,
          videoTitle: '',
          videoGame: '',
          isRendering: false,
          isUploading: false,
          ...prev.gamingStreaming!.videoRecordingState,
          ...updates,
        }
      }
    }));
  };

  // Helper function to update persistent streaming state
  const updateStreamingState = (updates: Partial<typeof gamingData.streamingState>) => {
    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        streamingState: {
          isStreaming: false,
          streamProgress: 0,
          totalDonations: 0,
          streamDuration: 0,
          selectedGame: '',
          currentViewers: 0,
          currentSubsGained: 0,
          ...prev.gamingStreaming!.streamingState,
          ...updates,
        }
      }
    }));
  };

  // Initialize local streaming state from persistent state
  useEffect(() => {
    const streamState = gamingData.streamingState;
    if (streamState) {
      setIsStreaming(streamState.isStreaming);
      setStreamProgress(streamState.streamProgress);
      setStreamDuration(streamState.streamDuration || 0);
      setSelectedGame(streamState.selectedGame || '');
      setCurrentViewers(streamState.currentViewers || 0);
      setTotalDonations(streamState.totalDonations || 0);
      setCurrentSubsGained(streamState.currentSubsGained || 0);
    }
  }, [gamingData.streamingState]);

  // Cleanup timers when component unmounts
  useEffect(() => {
    return () => {
      if (streamTimer) {
        clearInterval(streamTimer);
        setStreamTimer(null);
      }
      if (donationTimer) {
        clearInterval(donationTimer);
        setDonationTimer(null);
      }
      if (progressTimer) {
        clearInterval(progressTimer);
        setProgressTimer(null);
      }
      if (viewersTimer) {
        clearInterval(viewersTimer);
        setViewersTimer(null);
      }
      if (energyTimer) {
        clearInterval(energyTimer);
        setEnergyTimer(null);
      }
    };
  }, [streamTimer, donationTimer, progressTimer, viewersTimer, energyTimer]);

  // Clean tab switching logic for streaming
  useEffect(() => {
    if (activeTab !== 'stream') {
      // Pause streaming when leaving stream tab
      pauseStreaming();
    } else {
      // Handle returning to stream tab
      handleStreamTabReturn();
    }
    if (activeTab !== 'videos') {
      // Save current video recording progress before pausing timers
      if (recordTimer || renderTimer || uploadTimer) {
        updateVideoRecordingState({
          isRecording: false, // Always set to false when pausing
          isRendering: false,
          isUploading: false,
          recordProgress,
          renderProgress,
          uploadProgress,
          videoTitle,
          videoGame,
        });
      }
      // Force clear all video timers
      if (recordTimer) { 
        clearInterval(recordTimer); 
        setRecordTimer(null); 
      }
      if (renderTimer) { 
        clearInterval(renderTimer); 
        setRenderTimer(null); 
      }
      if (uploadTimer) { 
        clearInterval(uploadTimer); 
        setUploadTimer(null); 
      }
      // Also set local state to false to ensure UI shows paused
      setIsRecording(false);
      setIsRendering(false);
      setIsUploading(false);
    } else {
      // Resume video recording if we're returning to videos tab and there was progress
      const videoState = gamingData.videoRecordingState;
      if (videoState && (videoState.recordProgress > 0 || videoState.renderProgress > 0 || videoState.uploadProgress > 0)) {
        // Only resume if we're not already in the middle of an operation
        if (!isRecording && !isRendering && !isUploading) {
          resumeVideoRecording();
        }
      }
    }
  }, [activeTab]);

  // Pause background activity to avoid leaks or stale updates
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        // Pause streaming timers
        if (streamTimer) { clearInterval(streamTimer); setStreamTimer(null); }
        if (donationTimer) { clearInterval(donationTimer); setDonationTimer(null); }
        if (progressTimer) { clearInterval(progressTimer); setProgressTimer(null); }
        if (viewersTimer) { clearInterval(viewersTimer); setViewersTimer(null); }
        if (subsTimer) { clearInterval(subsTimer); setSubsTimer(null); }
        if (energyTimer) { clearInterval(energyTimer); setEnergyTimer(null); }
        
        // Pause video recording timers and save progress
        if (recordTimer || renderTimer || uploadTimer) {
          updateVideoRecordingState({
            isRecording: false,
            isRendering: false,
            isUploading: false,
            recordProgress,
            renderProgress,
            uploadProgress,
            videoTitle,
            videoGame,
          });
        }
        if (recordTimer) { clearInterval(recordTimer); setRecordTimer(null); }
        if (renderTimer) { clearInterval(renderTimer); setRenderTimer(null); }
        if (uploadTimer) { clearInterval(uploadTimer); setUploadTimer(null); }
        setIsRecording(false);
        setIsRendering(false);
        setIsUploading(false);
      }
    });
    // @ts-ignore RN older versions
    return () => { sub?.remove ? sub.remove() : AppState.removeEventListener?.('change', () => {}); };
  }, [streamTimer, donationTimer, progressTimer, viewersTimer, subsTimer, energyTimer, recordTimer, renderTimer, uploadTimer]);

  const availableGames = AVAILABLE_GAMES as unknown as typeof AVAILABLE_GAMES[number][];

  // ✅ CLEAN STREAMING HELPER FUNCTIONS
  
  const pauseStreaming = () => {
    // Save current streaming state
    if (isStreaming || streamProgress > 0) {
      updateStreamingState({
        isStreaming: false,
        streamProgress,
        streamDuration,
        selectedGame,
        currentViewers,
        totalDonations,
        currentSubsGained,
      });
    }
    
    // Clear all timers
    clearAllStreamingTimers();
    
    // Set local state to paused
    setIsStreaming(false);
  };

  const handleStreamTabReturn = () => {
    const streamState = gamingData.streamingState;
    
    if (!streamState || streamState.streamProgress === 0) {
      // No active stream, do nothing
      return;
    }
    
    if (streamState.streamProgress >= 100) {
      // Stream is completed, clear everything
      clearStreamingState();
      return;
    }
    
    if (streamState.streamProgress > 0 && streamState.streamProgress < 100) {
      // Resume the stream
      resumeStreaming();
    }
  };

  const clearStreamingState = () => {
    updateStreamingState({
      isStreaming: false,
      streamProgress: 0,
      streamDuration: 0,
      selectedGame: '',
      currentViewers: 0,
      totalDonations: 0,
      currentSubsGained: 0,
    });
    setSelectedGame('');
    setIsStreaming(false);
  };

  const clearAllStreamingTimers = () => {
    if (streamTimer) { clearInterval(streamTimer); setStreamTimer(null); }
    if (donationTimer) { clearInterval(donationTimer); setDonationTimer(null); }
    if (progressTimer) { clearInterval(progressTimer); setProgressTimer(null); }
    if (viewersTimer) { clearInterval(viewersTimer); setViewersTimer(null); }
    if (subsTimer) { clearInterval(subsTimer); setSubsTimer(null); }
    if (energyTimer) { clearInterval(energyTimer); setEnergyTimer(null); }
  };

  const resetStreamingState = () => {
    // Reset local state
    setIsStreaming(false);
    setStreamDuration(0);
    setStreamProgress(0);
    setStreamDonations([]);
    setCurrentViewers(0);
    setTotalDonations(0);
    setCurrentSubsGained(0);
    setSubPopups([]);
    setSelectedGame('');
    
    // Clear persistent streaming state
    updateStreamingState({
      isStreaming: false,
      streamProgress: 0,
      streamDuration: 0,
      selectedGame: '',
      currentViewers: 0,
      totalDonations: 0,
      currentSubsGained: 0,
    });
  };

  const createEnergyTimer = (energyPerSecond: number) => {
    return setInterval(() => {
      if (!isStreamingRef.current) return;
      setGameState(prev => {
        const newEnergy = Math.max(0, prev.stats.energy - energyPerSecond);
        if (newEnergy <= 0) {
          // Energy depleted - pause streaming (don't clear state)
          clearAllStreamingTimers();
          setIsStreaming(false);
          // Don't clear selectedGame or streaming state - just pause
          return { ...prev, stats: { ...prev.stats, energy: 0 } };
        }
        return { ...prev, stats: { ...prev.stats, energy: newEnergy } };
      });
    }, 1000);
  };

  const startStream = () => {
    if (!selectedGame) {
      setShowSelectGameModal(true);
      return;
    }

    if (isStreaming) {
      setShowAlreadyStreamingModal(true);
      return;
    }

    // ✅ Check if there's a completed stream state and clear it
    const streamState = gamingData.streamingState;
    if (streamState && streamState.streamProgress >= 100) {
      updateStreamingState({
        isStreaming: false,
        streamProgress: 0,
        streamDuration: 0,
        selectedGame: '',
        currentViewers: 0,
        totalDonations: 0,
        currentSubsGained: 0,
      });
    }

    const game = availableGames.find(g => g.id === selectedGame);
    if (!game) return;

    if (game.required && gamingData.followers < game.required) {
      setModalData({ gameName: game.name, requiredFollowers: game.required });
      setShowFollowersRequiredModal(true);
      return;
    }

    if (!(gamingData.ownedGames || []).includes(game.id)) {
      setModalData({ gameName: game.name });
      setShowGameNotOwnedModal(true);
      return;
    }

    // Check if player has enough energy to start streaming
    const energyPerSecond = computeEnergyPerSecond();
    if (gameState.stats.energy < energyPerSecond) {
      setModalData({ requiredEnergy: energyPerSecond });
      setShowNotEnoughEnergyModal(true);
      return;
    }

    // ✅ Clear any existing timers first
    clearAllStreamingTimers();

    isEndingRef.current = false;
    // ensure enough energy to start, then deduct
    const startCost = computeEnergyPerSecond() * 2;
    if (gameState.stats.energy < startCost) {
      setModalData({ requiredEnergy: startCost });
      setShowNotEnoughEnergyModal(true);
      return;
    }
    // upfront double energy cost to start
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, energy: Math.max(0, prev.stats.energy - startCost) },
    }));

    setIsStreaming(true);
    setStreamDuration(0);
    setStreamProgress(0);
    setStreamDonations([]);
    setCurrentViewers(0);
    setTotalDonations(0);
    setCurrentSubsGained(0);
    
    // Save initial streaming state
    updateStreamingState({
      isStreaming: true,
      streamProgress: 0,
      streamDuration: 0,
      selectedGame: game.id,
      currentViewers: 0,
      totalDonations: 0,
      currentSubsGained: 0,
    });
    
    // Progress timer (10 seconds total)
    const progressTimerInterval = setInterval(() => {
      setStreamProgress(prev => {
        const next = prev + 10;
        updateStreamingState({
          isStreaming: true,
          streamProgress: next,
        });
        if (next >= 100) {
          clearInterval(progressTimerInterval);
          setProgressTimer(null);
          // End stream immediately to avoid race conditions
          endStream();
          return 100;
        }
        return next;
      });
    }, 1000);
    setProgressTimer(progressTimerInterval as any);
    
    // Duration timer
    const timer = setInterval(() => {
      setStreamDuration(prev => {
        const newDuration = prev + 1;
        updateStreamingState({
          isStreaming: true,
          streamDuration: newDuration,
        });
        return newDuration;
      });
    }, 1000);
    setStreamTimer(timer as any);
    
    // Viewers timer - update viewers every 2 seconds
    const viewersTimerInterval = setInterval(() => {
      const game = availableGames.find(g => g.id === selectedGame);
      if (game) {
        const baseViewers = game.baseViewers;
        const viewerVariation = Math.floor(baseViewers * 0.3); // ±30% variation
        const newViewers = Math.max(10, baseViewers - viewerVariation + Math.floor(Math.random() * (viewerVariation * 2)));
        setCurrentViewers(newViewers);
        updateStreamingState({
          isStreaming: true,
          currentViewers: newViewers,
        });
      }
    }, 2000);
    setViewersTimer(viewersTimerInterval as any);
    
    // Subscribers timer - random sub gains during stream
    const names = [
      'Alex', 'Sam', 'Jamie', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
      'Robin', 'Noah', 'Charlie', 'Skyler', 'Dakota', 'Parker', 'Remy', 'Elliot', 'Rowan', 'Cameron'
    ];
    const subsTimerInterval = setInterval(() => {
      // 25% chance to gain 1-3 subs every 3 seconds
      if (Math.random() < 0.25) {
        const gained = 1 + Math.floor(Math.random() * 3);
        setCurrentSubsGained(prev => {
          const newSubs = prev + gained;
          updateStreamingState({
            isStreaming: true,
            currentSubsGained: newSubs,
          });
          return newSubs;
        });
        setSubsMilestone(s => s + gained);
        // Create popups for each new sub with staggered timing
        for (let i = 0; i < gained; i++) {
          setTimeout(() => {
            const id = `${Date.now()}_${i}_${Math.random()}`;
            setSubPopups(prev => {
              // Don't create more popups if we're at the limit
              if (prev.length >= MAX_POPUPS) return prev;
              
              const name = names[Math.floor(Math.random() * names.length)];
              const existingPositions = [
                ...prev.map(s => s.position),
                ...streamDonations.map(d => d.position),
              ];
              const pos = getNonOverlappingPosition(existingPositions);
              return [...prev, { id, name, position: { top: pos.top, left: pos.left } }];
            });
            // auto-remove after 3s
            setTimeout(() => {
              setSubPopups(prev => prev.filter(s => s.id !== id));
            }, 3000);
          }, i * 200); // Stagger popups by 200ms each
        }
      }
    }, 3000);
    setSubsTimer(subsTimerInterval as any);
    
    // ✅ Energy drain timer - clean implementation
    const energyInterval = createEnergyTimer(energyPerSecond);
    setEnergyTimer(energyInterval as any);
    
    // Donation timer (random donations during stream)
    const donationInterval = setInterval(() => {
      const shouldDonate = Math.random() < 0.3; // 30% chance every 2 seconds
      if (shouldDonate) {
        const donationAmount = Math.floor(Math.random() * 10) + 1; // $1-$10
        const donationMessages = [
          "Great stream!",
          "Keep it up!",
          "Love the content!",
          "Amazing gameplay!",
          "You're awesome!",
        ];
        const randomMessage = donationMessages[Math.floor(Math.random() * donationMessages.length)];
        
        const donationId = `${Date.now()}_${Math.random()}`;
        
        setStreamDonations(prev => {
          // Don't create more popups if we're at the limit
          if (prev.length >= MAX_POPUPS) return prev;
          
          const existingPositions = [
            ...prev.map(d => d.position),
            ...subPopups.map(s => s.position),
          ];
          const pos = getNonOverlappingPosition(existingPositions);
          return [...prev, {
            id: donationId,
            amount: donationAmount,
            message: randomMessage,
            position: { top: pos.top, left: pos.left }
          }];
        });
        
        // Update total donations and add money immediately
        setTotalDonations(prev => {
          const newTotal = prev + donationAmount;
          updateStreamingState({
            isStreaming: true,
            totalDonations: newTotal,
          });
          return newTotal;
        });
        setDonMilestone(s => s + donationAmount);
        
        // Add donation money to player immediately
        setGameState(prev => ({
          ...prev,
          stats: { ...prev.stats, money: prev.stats.money + donationAmount }
        }));
        
        // Remove donation after 3 seconds
        setTimeout(() => {
          setStreamDonations(prev => prev.filter(d => d.id !== donationId));
        }, 3000);
      }
    }, 2000);
    setDonationTimer(donationInterval as any);
  };

  const stopStream = () => {
    if (!isStreaming) return;
    endStream(); // ✅ endStream() now handles navigation to dashboard automatically
  };

  const resumeStreaming = () => {
    const streamState = gamingData.streamingState;
    if (!streamState || !streamState.selectedGame) {
      return;
    }

    // Restore selectedGame if it's missing from local state
    if (!selectedGame && streamState.selectedGame) {
      setSelectedGame(streamState.selectedGame);
    }

    // ✅ If stream is already complete, clear state and return immediately
    if (streamState.streamProgress >= 100) {
      updateStreamingState({
        isStreaming: false,
        streamProgress: 0,
        streamDuration: 0,
        selectedGame: '',
        currentViewers: 0,
        totalDonations: 0,
        currentSubsGained: 0,
      });
      setSelectedGame('');
      setIsStreaming(false);
      return;
    }

    // Check if player has enough energy to resume streaming
    const energyPerSecond = computeEnergyPerSecond();
    if (gameState.stats.energy < energyPerSecond) {
      setModalData({ requiredEnergy: energyPerSecond });
      setShowNotEnoughEnergyModal(true);
      return;
    }

    // Show a brief alert to inform user that streaming is resuming
    if (streamState.streamProgress > 0 || (streamState.streamDuration || 0) > 0) {
      setShowResumingModal(true);
    }

    // Restore streaming state
    setIsStreaming(true);
    setStreamProgress(streamState.streamProgress);
    setStreamDuration(streamState.streamDuration || 0);
    setSelectedGame(streamState.selectedGame || '');
    setCurrentViewers(streamState.currentViewers || 0);
    setTotalDonations(streamState.totalDonations || 0);
    setCurrentSubsGained(streamState.currentSubsGained || 0);

    // Resume progress timer if not complete
    if (streamState.streamProgress < 100) {
      const remainingProgress = 100 - streamState.streamProgress;
      const remainingTime = Math.ceil(remainingProgress / 10); // 10% per second
      
      const progressTimerInterval = setInterval(() => {
        setStreamProgress(prev => {
          const newProgress = Math.min(100, prev + 10);
          updateStreamingState({
            isStreaming: true,
            streamProgress: newProgress,
          });
          if (newProgress >= 100) {
            clearInterval(progressTimerInterval);
            setProgressTimer(null);
            // End stream immediately to avoid race conditions
            endStream();
            return 100;
          }
          return newProgress;
        });
      }, 1000);
      setProgressTimer(progressTimerInterval as any);
    }

    // Resume duration timer
    const timer = setInterval(() => {
      setStreamDuration(prev => {
        const newDuration = prev + 1;
        updateStreamingState({
          isStreaming: true,
          streamDuration: newDuration,
        });
        return newDuration;
      });
    }, 1000);
    setStreamTimer(timer as any);

    // Resume viewers timer
    const viewersTimerInterval = setInterval(() => {
      const game = availableGames.find(g => g.id === streamState.selectedGame);
      if (game) {
        const baseViewers = game.baseViewers;
        const viewerVariation = Math.floor(baseViewers * 0.3);
        const newViewers = Math.max(10, baseViewers - viewerVariation + Math.floor(Math.random() * (viewerVariation * 2)));
        setCurrentViewers(newViewers);
        updateStreamingState({
          isStreaming: true,
          currentViewers: newViewers,
        });
      }
    }, 2000);
    setViewersTimer(viewersTimerInterval as any);

    // Resume subscribers timer
    const names = [
      'Alex', 'Sam', 'Jamie', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
      'Robin', 'Noah', 'Charlie', 'Skyler', 'Dakota', 'Parker', 'Remy', 'Elliot', 'Rowan', 'Cameron'
    ];
    const subsTimerInterval = setInterval(() => {
      if (Math.random() < 0.25) {
        const gained = 1 + Math.floor(Math.random() * 3);
        setCurrentSubsGained(prev => {
          const newSubs = prev + gained;
          updateStreamingState({
            isStreaming: true,
            currentSubsGained: newSubs,
          });
          return newSubs;
        });
        setSubsMilestone(s => s + gained);
        
        // Create popups for new subs
        for (let i = 0; i < gained; i++) {
          setTimeout(() => {
            const id = `${Date.now()}_${i}_${Math.random()}`;
            setSubPopups(prev => {
              if (prev.length >= MAX_POPUPS) return prev;
              const name = names[Math.floor(Math.random() * names.length)];
              const existingPositions = [
                ...prev.map(s => s.position),
                ...streamDonations.map(d => d.position),
              ];
              const pos = getNonOverlappingPosition(existingPositions);
              return [...prev, { id, name, position: { top: pos.top, left: pos.left } }];
            });
            setTimeout(() => {
              setSubPopups(prev => prev.filter(s => s.id !== id));
            }, 3000);
          }, i * 200);
        }
      }
    }, 3000);
    setSubsTimer(subsTimerInterval as any);

    // ✅ Resume energy drain timer - clean implementation
    const energyInterval = createEnergyTimer(energyPerSecond);
    setEnergyTimer(energyInterval as any);

    // Resume donation timer
    const donationInterval = setInterval(() => {
      const shouldDonate = Math.random() < 0.3;
      if (shouldDonate) {
        const donationAmount = Math.floor(Math.random() * 10) + 1;
        const donationMessages = [
          "Great stream!",
          "Keep it up!",
          "Love the content!",
          "Amazing gameplay!",
          "You're awesome!",
        ];
        const randomMessage = donationMessages[Math.floor(Math.random() * donationMessages.length)];
        
        const donationId = `${Date.now()}_${Math.random()}`;
        
        setStreamDonations(prev => {
          if (prev.length >= MAX_POPUPS) return prev;
          const existingPositions = [
            ...prev.map(d => d.position),
            ...subPopups.map(s => s.position),
          ];
          const pos = getNonOverlappingPosition(existingPositions);
          return [...prev, {
            id: donationId,
            amount: donationAmount,
            message: randomMessage,
            position: { top: pos.top, left: pos.left }
          }];
        });
        
        setTotalDonations(prev => {
          const newTotal = prev + donationAmount;
          updateStreamingState({
            isStreaming: true,
            totalDonations: newTotal,
          });
          return newTotal;
        });
        setDonMilestone(s => s + donationAmount);
        
        // Add donation money to player immediately
        setGameState(prev => ({
          ...prev,
          stats: { ...prev.stats, money: prev.stats.money + donationAmount }
        }));
        
        setTimeout(() => {
          setStreamDonations(prev => prev.filter(d => d.id !== donationId));
        }, 3000);
      }
    }, 2000);
    setDonationTimer(donationInterval as any);
  };

  const endStream = () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    
    const finalStreamDuration = streamDuration;
    
    // ✅ Clear all timers immediately
    clearAllStreamingTimers();

    // ✅ Clear streaming state immediately to prevent container from showing
    updateStreamingState({
      isStreaming: false,
      streamProgress: 0,
      streamDuration: 0,
      selectedGame: '',
      currentViewers: 0,
      totalDonations: 0,
      currentSubsGained: 0,
    });

    const game = availableGames.find(g => g.id === selectedGame);
    if (!game) return;

    // Calculate stream results
    const finalViewers = Math.floor(game.baseViewers * (0.8 + Math.random() * 0.4));
    const finalEarnings = Math.floor(game.baseEarnings * (0.8 + Math.random() * 0.4));
    // Increased follower gain - now 25% of viewers become followers (was 10%)
    const newFollowers = Math.floor(finalViewers * 0.25);
    // Base subs from performance plus live subs gained during the session
    const newSubscribers = Math.floor(finalViewers * 0.02) + currentSubsGained;
    const experience = Math.floor(finalStreamDuration / 60 + finalViewers);
    const chatMessages = Math.floor(finalViewers * 0.5);
    // Use actual live totalDonations from state rather than estimate

    // Create stream session
    const streamSession: StreamSession = {
      id: Date.now().toString(),
      game: game.name,
      duration: finalStreamDuration,
      viewers: finalViewers,
      earnings: finalEarnings,
      followers: newFollowers,
      subscribers: newSubscribers,
      chatMessages: chatMessages,
      donations: totalDonations,
    };

    // Update gaming data
    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        followers: prev.gamingStreaming!.followers + newFollowers,
        subscribers: prev.gamingStreaming!.subscribers + newSubscribers,
        totalViews: prev.gamingStreaming!.totalViews + finalViewers,
        totalEarnings: prev.gamingStreaming!.totalEarnings + finalEarnings,
        totalDonations: (prev.gamingStreaming!.totalDonations || 0) + totalDonations,
        totalSubEarnings: (prev.gamingStreaming!.totalSubEarnings || 0) + Math.floor(finalViewers * 0.02) * 2.5 + currentSubsGained * 2.5,
        experience: prev.gamingStreaming!.experience + experience,
        streamHours: prev.gamingStreaming!.streamHours + (finalStreamDuration / 3600),
        gamesPlayed: prev.gamingStreaming!.gamesPlayed.includes(game.name) 
          ? prev.gamingStreaming!.gamesPlayed 
          : [...prev.gamingStreaming!.gamesPlayed, game.name],
        streamHistory: [streamSession, ...prev.gamingStreaming!.streamHistory.slice(0, 9)],
        bestStream: !prev.gamingStreaming!.bestStream || finalViewers > prev.gamingStreaming!.bestStream.viewers
          ? streamSession
          : prev.gamingStreaming!.bestStream,
      }
    }));

    // Update money without triggering daily summary
    updateMoney(finalEarnings, `Stream earnings from ${game.name}`);

    // ✅ Reset local streaming state (persistent state already cleared in progress timer)
    setIsStreaming(false);
    setStreamDuration(0);
    setStreamProgress(0);
    setStreamDonations([]);
    setCurrentViewers(0);
    setTotalDonations(0);
    setCurrentSubsGained(0);
    setSubPopups([]);
    setSelectedGame('');

    setModalData({
      duration: finalStreamDuration,
      viewers: finalViewers,
      earnings: finalEarnings,
      followers: newFollowers,
      subscribers: newSubscribers
    });
    setShowStreamEndedModal(true);
    
    // Clear the stream state after showing modal
    setTimeout(() => {
      // ✅ Automatically navigate to dashboard after stream completion
      setActiveTab('dashboard');
    }, 100);
  };

  const buyGame = (gameId: string) => {
    const game = availableGames.find(g => g.id === gameId);
    if (!game) return;

    if (gameState.stats.money < game.cost) {
      setModalData({ gameName: game.name, gameCost: game.cost });
      setShowInsufficientFundsModal(true);
      return;
    }

    if ((gamingData.ownedGames || []).includes(gameId)) {
      setModalData({ gameName: game.name });
      setShowAlreadyOwnedModal(true);
      return;
    }

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - game.cost
      }
    }));
    
    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        ownedGames: [...(prev.gamingStreaming!.ownedGames || []), gameId],
      }
    }));

    setModalData({ gameName: game.name });
    setShowGamePurchasedModal(true);
  };

  const renderDashboard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <Users size={24} color="#3B82F6" />
          <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
            {gamingData.followers.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Followers</Text>
        </View>

        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <Star size={24} color="#F59E0B" />
          <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
            {gamingData.subscribers.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Subscribers</Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
            ${ (gamingData.subscribers * 2.5).toFixed(2) } / week
          </Text>
        </View>

        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <TrendingUp size={24} color="#10B981" />
          <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
            {gamingData.totalViews.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Total Views</Text>
        </View>

        <View style={[styles.statCard, settings.darkMode && styles.statCardDark]}>
          <DollarSign size={24} color="#EF4444" />
          <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
            ${gamingData.totalEarnings.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>Total Earnings</Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
            Donations: ${ (gamingData.totalDonations || 0).toLocaleString() }
          </Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
            Subs: ${ (gamingData.totalSubEarnings || 0).toLocaleString() }
          </Text>
          <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
            Ads: ${ (((gamingData.videos as any[]) || []).reduce((s,v)=> s + (v.earnings||0), 0)).toLocaleString() }
          </Text>
        </View>
      </View>

      <LinearGradient
        colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.levelCard, settings.darkMode && styles.levelCardDark]}
      >
        <View style={styles.levelHeader}>
          <Crown size={24} color="#F59E0B" />
          <Text style={[styles.levelTitle, settings.darkMode && styles.levelTitleDark]}>
            Level {calculateLevel(gamingData.experience)} Content Creator
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((gamingData.experience % 100) / 100) * 100}%` }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, settings.darkMode && styles.progressTextDark]}>
          {gamingData.experience % 100} / 100 XP
        </Text>
      </LinearGradient>

      {/* Channel KPIs */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Channel KPIs</Text>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoCard}
        >
          {(() => {
            const videosArr = (gamingData.videos as any[]) || [];
            const totalAds = videosArr.reduce((s,v)=> s + (v.earnings||0), 0);
            return (
              <View style={styles.infoPillsRow}>
                <View style={[styles.infoPill, styles.infoPillGreen, styles.infoPillThird]}>
                  <Text style={styles.infoPillText}>Weekly Subs ${ (gamingData.subscribers * 2.5).toFixed(2) }</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillPurple, styles.infoPillThird]}>
                  <Text style={styles.infoPillText}>Donations ${ (gamingData.totalDonations||0).toLocaleString() }</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillBlue, styles.infoPillThird]}>
                  <Text style={styles.infoPillText}>Ads ${ totalAds.toLocaleString() }</Text>
                </View>
              </View>
            );
          })()}
          {(() => {
            const paid = (gamingData as any).paidMembers || 0;
            const rate = (gamingData as any).membershipRate || 4;
            return (
              <View style={[styles.infoPillsRow, { marginTop: simpleScale(8) }]}>
                <View style={[styles.infoPill, styles.infoPillGreen, styles.infoPillHalf]}>
                  <Text style={styles.infoPillText}>Paid Members {paid}</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillPurple, styles.infoPillHalf]}>
                  <Text style={styles.infoPillText}>Memberships ${ (paid * rate).toFixed(2) } / week</Text>
                </View>
              </View>
            );
          })()}
        </LinearGradient>
      </View>

      {/* Channel Averages */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Channel Averages</Text>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoCard}
        >
          {(() => {
            const streams = (gamingData.streamHistory || []).slice(0, 10);
            const avgStreamViewers = streams.length ? Math.round(streams.reduce((s:any,st:any)=> s + (st.viewers||0), 0) / streams.length) : 0;
            const videosArr = (gamingData.videos as any[]) || [];
            const vcount = videosArr.length;
            const avgCtr = vcount ? Math.round(videosArr.reduce((s,v)=> s + (v.ctr||0), 0) / vcount) : 0;
            const avgRpm = vcount ? Math.round(videosArr.reduce((s,v)=> s + (v.rpm||0), 0) / vcount) : 0;
            return (
              <View style={styles.infoPillsRow}>
                <View style={[styles.infoPill, styles.infoPillGreen]}>
                  <Text style={styles.infoPillText}>Avg Stream Viewers {avgStreamViewers}</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillPurple]}>
                  <Text style={styles.infoPillText}>Avg Video CTR {avgCtr}%</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillBlue]}>
                  <Text style={styles.infoPillText}>Avg RPM ${avgRpm}</Text>
                </View>
              </View>
            );
          })()}
        </LinearGradient>
      </View>

      {/* Videos Overview */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Videos Overview</Text>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoCard}
        >
          {(() => {
            const videosArr = (gamingData.videos as any[]) || [];
            const count = videosArr.length;
            const totalAds = videosArr.reduce((s,v)=> s + (v.earnings||0), 0);
            const avgCtr = count ? Math.round(videosArr.reduce((s,v)=> s + (v.ctr||0), 0) / count) : 0;
            const avgAvd = count ? Math.round(videosArr.reduce((s,v)=> s + (v.avgViewDuration||0), 0) / count) : 0;
            const avgRpm = count ? Math.round(videosArr.reduce((s,v)=> s + (v.rpm||0), 0) / count) : 0;
            return (
              <View style={styles.infoPillsRow}>
                <View style={[styles.infoPill, styles.infoPillGreen]}>
                  <Text style={styles.infoPillText}>Videos: {count}</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillPurple]}>
                  <Text style={styles.infoPillText}>Avg CTR: {avgCtr}%</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillBlue]}>
                  <Text style={styles.infoPillText}>Avg AVD: {avgAvd}s</Text>
                </View>
              </View>
            );
          })()}
          {(() => {
            const videosArr = (gamingData.videos as any[]) || [];
            const count = videosArr.length;
            const totalAds = videosArr.reduce((s,v)=> s + (v.earnings||0), 0);
            const avgRpm = count ? Math.round(videosArr.reduce((s,v)=> s + (v.rpm||0), 0) / count) : 0;
            return (
              <View style={[styles.infoPillsRow, { marginTop: simpleScale(8) }]}>
                <View style={[styles.infoPill, styles.infoPillGreen]}>
                  <Text style={styles.infoPillText}>Ads: ${totalAds.toLocaleString()}</Text>
                </View>
                <View style={[styles.infoPill, styles.infoPillPurple]}>
                  <Text style={styles.infoPillText}>Avg RPM: ${avgRpm}</Text>
                </View>
              </View>
            );
          })()}
        </LinearGradient>

        {/* Latest Video */}
        {((gamingData.videos as any[]) || []).length > 0 && (
          <View style={[styles.streamHistoryCard, settings.darkMode && styles.streamHistoryCardDark]}>
            {(() => {
              const v = (gamingData.videos as any[])[0];
              return (
                <>
                  <Text style={[styles.streamHistoryGame, settings.darkMode && styles.streamHistoryGameDark]}>
                    Last Video: {v.title}
                  </Text>
                  <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                    👀 {v.views.toLocaleString()} • 👍 {v.likes?.toLocaleString?.() || 0} • 💬 {v.comments?.toLocaleString?.() || 0} • 💰 ${v.earnings?.toLocaleString?.() || 0}
                  </Text>
                  <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                    CTR {v.ctr || 0}% • AVD {v.avgViewDuration || 0}s • RPM ${v.rpm || 0} • Source {v.source || '—'}
                  </Text>
                </>
              );
            })()}
          </View>
        )}
      </View>

      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Recent Streams
        </Text>
        {gamingData.streamHistory.length === 0 ? (
          <Text style={[styles.emptyText, settings.darkMode && styles.emptyTextDark]}>
            No streams yet. Start streaming to see your history!
          </Text>
        ) : (
          gamingData.streamHistory.map((stream: any) => (
            <View key={stream.id} style={[styles.streamHistoryCard, settings.darkMode && styles.streamHistoryCardDark]}>
              <Text style={[styles.streamHistoryGame, settings.darkMode && styles.streamHistoryGameDark]}>
                {stream.game}
              </Text>
              <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                👥 {stream.viewers} • 💰 ${stream.earnings} • ⭐ +{stream.subscribers} • ⏱️ {Math.floor(stream.duration / 60)}m
              </Text>
            </View>
          ))
        )}
      </View>
      {showConfetti && <ConfettiOverlay onDone={() => setShowConfetti(false)} />}
    </ScrollView>
  );

  const renderStream = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Select Game to Stream
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Choose a game to stream. You can purchase games you don't own yet.
        </Text>
        {/* Stream Goals */}
        {isStreaming && (
          <View style={{ marginBottom: 10 }}>
            <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Stream Goals</Text>
            <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Subs Goal ({subsMilestone}/{subsGoal || 25})</Text>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(((subsMilestone)/(subsGoal||25))*100))}%` }]} /></View>
            <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Donations Goal (${donMilestone}/${donGoal || 100})</Text>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(((donMilestone)/(donGoal||100))*100))}%` }]} /></View>
          </View>
        )}
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoCard}
        >
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Streaming Cost</Text>
          <View style={styles.infoPillsRow}>
            <View style={[styles.infoPill, styles.infoPillGreen]}>
              <Text style={styles.infoPillText}>Per 10s: {computeEnergyPerSecond() * 10}</Text>
              <Zap size={16} color="#065F46" />
            </View>
            <View style={[styles.infoPill, styles.infoPillPurple]}>
              <Text style={styles.infoPillText}>Start cost: {computeEnergyPerSecond() * 2}</Text>
              <Zap size={16} color="#4C1D95" />
            </View>
          </View>
        </LinearGradient>
        <View style={styles.gamesGrid}>
          {availableGames.map(game => (
            <TouchableOpacity
              key={game.id}
                             style={[
                 styles.gameCard,
                 selectedGame === game.id && styles.selectedGameCard,
                 settings.darkMode && styles.gameCardDark,
                 game.required && gamingData.followers < game.required ? styles.lockedGameCard : undefined
               ]}
               onPress={() => setSelectedGame(game.id)}
               disabled={game.required ? gamingData.followers < game.required : false}
            >
              <Image source={GAME_IMAGES[game.id]} style={{ width: simpleScale(48), height: simpleScale(48), borderRadius: 8 }} resizeMode="cover" />
              <Text style={[
                styles.gameName,
                selectedGame === game.id && styles.selectedGameName,
                settings.darkMode && styles.gameNameDark
              ]}>
                {game.name}
              </Text>
              <Text style={[styles.gameStats, settings.darkMode && styles.gameStatsDark]}>
                {game.baseViewers} viewers • Donation-based
              </Text>
              {game.required && gamingData.followers < game.required && (
                <Text style={styles.requirementText}>
                  {game.required} followers needed
                </Text>
              )}
              {(gamingData.ownedGames || []).includes(game.id) ? (
                <Text style={styles.ownedText}>
                  ✓ Owned
                </Text>
              ) : (
                <Text style={styles.requirementText}>
                  ${game.cost} to buy
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>



      {/* Popups Overlay */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Donation Popups - Show when streaming is active */}
        {isStreaming && streamDonations.map(donation => (
          <AnimatedPopup
            key={donation.id}
            top={donation.position.top}
            left={donation.position.left}
            bgStyle={settings.darkMode && styles.donationPopupDark}
          >
            <Text style={[styles.donationAmount, settings.darkMode && styles.donationAmountDark]}>💰 ${donation.amount}</Text>
            <Text style={[styles.donationMessage, settings.darkMode && styles.donationMessageDark]}>{donation.message}</Text>
          </AnimatedPopup>
        ))}
        {/* Subscriber Popups */}
        {isStreaming && subPopups.map(sub => (
          <AnimatedPopup
            key={sub.id}
            top={sub.position.top}
            left={sub.position.left}
            bgStyle={[settings.darkMode && styles.donationPopupDark, { borderLeftColor: '#10B981' }]}
          >
            <Text style={[styles.donationAmount, settings.darkMode && styles.donationAmountDark]}>⭐ New sub: {sub.name}</Text>
          </AnimatedPopup>
        ))}
      </View>
    </ScrollView>
  );

  const renderVideos = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
      {/* Record Video */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Record Video</Text>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoCard}
        >
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Energy</Text>
          <View style={styles.infoPillsRow}>
            <View style={[styles.infoPill, styles.infoPillGreen]}>
              <Text style={styles.infoPillText}>Record cost: {Math.max(1, computeEnergyPerSecond() * 12)}</Text>
              <Zap size={16} color="#065F46" />
            </View>
            <View style={[styles.infoPill, styles.infoPillPurple]}>
              <Text style={styles.infoPillText}>Upload drain: {Math.max(1, Math.round(computeEnergyPerSecond() * 0.5))}/s</Text>
              <Zap size={16} color="#4C1D95" />
            </View>
          </View>
        </LinearGradient>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Analytics: Open any video below to see CTR, Avg View Duration, RPM, and sources.
        </Text>
        
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Select game to record (tap a game to use)</Text>
        <View style={styles.gamesGrid}>
          {availableGames.map(game => {
            const owned = (gamingData.ownedGames || []).includes(game.id);
            return (
              <TouchableOpacity
                key={game.id}
                style={[
                  styles.gameCard,
                  videoGame === game.id && styles.selectedGameCard,
                  settings.darkMode && styles.gameCardDark,
                  !owned ? styles.lockedGameCard : undefined,
                ]}
                onPress={() => {
                  if (!owned) {
                    buyGame(game.id);
                  } else {
                    setVideoGame(game.id);
                  }
                }}
              >
                <Image source={GAME_IMAGES[game.id]} style={{ width: simpleScale(48), height: simpleScale(48), borderRadius: 8 }} resizeMode="cover" />
                <Text style={[styles.gameName, videoGame === game.id && styles.selectedGameName, settings.darkMode && styles.gameNameDark]}>
                  {game.name}
                </Text>
                {!owned ? (
                  <Text style={styles.requirementText}>${game.cost} • Tap to buy</Text>
                ) : (
                  <>
                    <Text style={styles.ownedText}>✓ Owned</Text>
                    {videoGame !== game.id && (
                      <Text style={styles.useHintText}>Tap to use</Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Title input moved near action buttons */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Title (optional)</Text>
          <TextInput
            placeholder="Enter a title or leave empty to randomize"
            placeholderTextColor="#6B7280"
            value={videoTitle}
            onChangeText={setVideoTitle}
            style={{
              borderWidth: 1,
              borderColor: settings.darkMode ? '#374151' : '#E5E7EB',
              backgroundColor: settings.darkMode ? '#1F2937' : '#FFFFFF',
              color: settings.darkMode ? '#F9FAFB' : '#111827',
              padding: 10,
              borderRadius: 8,
              marginTop: 6,
            }}
          />
        </View>
        {/* Step 1: Record - Progress Button */}
        <TouchableOpacity
          onPress={() => {
            if (!videoGame) {
              setShowSelectGameModal(true);
              return;
            }
            if (isRecording || isRendering || isUploading) return;
            if (recordProgress === 100) return; // proceed to Render instead
            if (recordProgress > 0 && recordProgress < 100) {
              // Ask user if they want to reset or continue
              setModalData({ 
                hasRecording: true,
                onReset: () => {
                  setRecordProgress(0);
                  updateVideoRecordingState({
                    recordProgress: 0,
                    isRecording: false,
                  });
                },
                onContinue: () => startVideoRecording(videoGame)
              });
              setShowRecordingInProgressModal(true);
              return;
            }
            // start immediately (even if we just reset progress)
            startVideoRecording(videoGame);
          }}
          disabled={!videoGame || isRecording || isRendering || isUploading}
          style={{ marginTop: 10, opacity: (!videoGame || isRecording || isRendering || isUploading) ? 0.5 : 1 }}
        >
          <View style={[styles.progressButton, settings.darkMode && styles.progressButtonDark]}> 
            <View style={[styles.progressButtonFill, { width: `${recordProgress}%`, backgroundColor: '#10B981' }]} />
            {isRecording && <Shimmer />}
            <Text style={[styles.progressButtonText, settings.darkMode && styles.progressButtonTextDark]}>
              {recordProgress === 0 ? 'Record Video' : (recordProgress < 100 ? (isRecording ? `Recording ${recordProgress}%` : `Recording ${recordProgress}% (Paused)`) : 'Recorded ✔')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Step 2: Render - Progress Button */}
        <TouchableOpacity
          onPress={() => !isRendering && recordProgress === 100 && renderProgress === 0 && startRender()}
          disabled={recordProgress < 100 || isRecording || isRendering || isUploading}
          style={{ marginTop: 10, opacity: (recordProgress < 100 || isRecording || isRendering || isUploading) ? 0.5 : 1 }}
        >
          <View style={[styles.progressButton, settings.darkMode && styles.progressButtonDark]}> 
            <View style={[styles.progressButtonFill, { width: `${renderProgress}%`, backgroundColor: '#3B82F6' }]} />
            {isRendering && <Shimmer />}
            <Text style={[styles.progressButtonText, settings.darkMode && styles.progressButtonTextDark]}>
              {renderProgress === 0 ? 'Render Video' : (renderProgress < 100 ? (isRendering ? `Rendering ${renderProgress}%` : `Rendering ${renderProgress}% (Paused)`) : 'Rendered ✔')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Step 3: Upload - Progress Button */}
        <TouchableOpacity
          onPress={() => !isUploading && renderProgress === 100 && uploadProgress === 0 && startUpload()}
          disabled={renderProgress < 100 || isRecording || isRendering || isUploading}
          style={{ marginTop: 10, opacity: (renderProgress < 100 || isRecording || isRendering || isUploading) ? 0.5 : 1 }}
        >
          <View style={[styles.progressButton, settings.darkMode && styles.progressButtonDark]}> 
            <View style={[styles.progressButtonFill, { width: `${uploadProgress}%`, backgroundColor: '#8B5CF6' }]} />
            {isUploading && <Shimmer />}
            <Text style={[styles.progressButtonText, settings.darkMode && styles.progressButtonTextDark]}>
              {uploadProgress === 0 ? 'Upload Video' : (uploadProgress < 100 ? (isUploading ? `Uploading ${uploadProgress}%` : `Uploading ${uploadProgress}% (Paused)`) : 'Uploaded ✔')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Progress UI integrated into buttons above */}
      </View>

      {/* Your Videos */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Your Videos</Text>
        {(gamingData.videos as any[])?.length ? (
          (gamingData.videos as any[]).map((v: any) => (
            <View key={v.id} style={[styles.streamHistoryCard, settings.darkMode && styles.streamHistoryCardDark]}>
              <Text style={[styles.streamHistoryGame, settings.darkMode && styles.streamHistoryGameDark]}>
                {v.title}
              </Text>
              <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                🎮 {v.game} • 👀 {v.views.toLocaleString()} • 👍 {v.likes.toLocaleString()} • 💬 {v.comments.toLocaleString()} • 💰 ${v.earnings.toLocaleString()}
              </Text>
              {/* Simple analytics breakdown */}
              <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                CTR ~{Math.max(2, Math.min(18, Math.round(6 + (v.quality||0)*8)))}% • AVD ~{Math.round(40 + (v.quality||0)*30)}s • RPM ${Math.max(1, Math.round(((v.earnings/(v.views/1000))||2)*0.7*100)/100)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, settings.darkMode && styles.emptyTextDark]}>No videos yet. Record one above.</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderShop = () => {
    const eq = gamingData.equipment as any;
    const lv = (gamingData as any).pcUpgradeLevels || {} as any;
    const money = gameState.stats.money;

    const equipmentList = [
      { key: 'microphone', name: 'Microphone', price: 300 },
      { key: 'webcam', name: 'Webcam', price: 400 },
      { key: 'lighting', name: 'Lighting', price: 200 },
      { key: 'gamingChair', name: 'Gaming Chair', price: 600 },
      { key: 'greenScreen', name: 'Green Screen', price: 500 },
    ];

    const componentsList = [
      { key: 'cpu', name: 'CPU' },
      { key: 'gpu', name: 'GPU' },
      { key: 'ram', name: 'RAM' },
      { key: 'ssd', name: 'SSD' },
      { key: 'cooling', name: 'Cooling' },
      { key: 'motherboard', name: 'Motherboard' },
      { key: 'psu', name: 'PSU' },
      { key: 'case', name: 'Case' },
    ];

    const buyEquipment = (k: string, price: number) => {
      if (eq[k]) return;
      if (gameState.stats.money < price) {
        setModalData({ cost: price });
        setShowInsufficientFundsModal(true);
        return;
      }
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - price },
        gamingStreaming: {
          ...prev.gamingStreaming!,
          equipment: { ...prev.gamingStreaming!.equipment, [k]: true },
        }
      }));
    };

    const upgradeComponent = (k: string) => {
      const level = lv[k] || 0;
      const price = getNextUpgradePrice(k, level);
      if (price == null) return;
      if (money < price) {
        setModalData({ cost: price });
        setShowInsufficientFundsModal(true);
        return;
      }
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - price },
        gamingStreaming: {
          ...prev.gamingStreaming!,
          pcUpgradeLevels: { ...((prev.gamingStreaming as any).pcUpgradeLevels || {}), [k]: level + 1 },
          pcComponents: { ...prev.gamingStreaming!.pcComponents, [k]: true },
        }
      }));
    };

    const getEquipmentEffect = (k: string): string => {
      switch (k) {
        case 'microphone': return 'Improves video quality → higher CTR and RPM';
        case 'webcam': return 'Adds facecam → boosts engagement and CTR';
        case 'lighting': return 'Better lighting → faster uploads and slight quality gain';
        case 'gamingChair': return 'Comfort → reduces stream energy drain';
        case 'greenScreen': return 'Clean background → small quality boost';
        default: return '';
      }
    };

    const getComponentEffect = (k: string): string => {
      switch (k) {
        case 'cpu': return 'Faster rendering, small energy savings';
        case 'gpu': return 'Much faster rendering, visual quality boost';
        case 'ram': return 'Quicker renders, smoother workflow';
        case 'ssd': return 'Faster uploads and general speed';
        case 'cooling': return 'Lower temps → less energy drain while streaming';
        case 'motherboard': return 'Enables higher-tier CPU/RAM speeds';
        case 'psu': return 'Stable power delivery for upgrades';
        case 'case': return 'Airflow → helps cooling efficiency';
        case 'network': return 'Internet plan → faster uploads';
        default: return '';
      }
    };

    const canAfford = (price: number | null) => price != null && money >= price;

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
        {/* Shop Intro */}
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.section, settings.darkMode && styles.sectionDark]}
        >
          <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Upgrade Your Setup</Text>
          <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>Gear reduces energy drain and increases content quality. PC parts speed up rendering and uploading. Network upgrades improve upload speed.</Text>
          <View style={styles.infoPillsRow}>
            <View style={[styles.infoPill, styles.infoPillGreen]}>
              <Zap size={16} color="#065F46" />
              <Text style={styles.infoPillText}>Energy ↓</Text>
            </View>
            <View style={[styles.infoPill, styles.infoPillPurple]}>
              <Camera size={16} color="#4C1D95" />
              <Text style={styles.infoPillText}>Quality ↑</Text>
            </View>
            <View style={[styles.infoPill, styles.infoPillBlue]}>
              <Clock size={16} color="#1E3A8A" />
              <Text style={styles.infoPillText}>Time ↓</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Equipment */}
        <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Equipment</Text>
          {equipmentList.map(item => {
            const owned = !!eq[item.key];
            return (
              <View key={item.key} style={[styles.shopRow, settings.darkMode && styles.shopRowDark]}>
                <View style={styles.shopRowLeft}>
                  {item.key === 'microphone' && <Mic size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {item.key === 'webcam' && <Camera size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {item.key === 'lighting' && <Zap size={20} color={settings.darkMode ? '#FCD34D' : '#92400E'} />}
                  {item.key === 'gamingChair' && <Star size={20} color={settings.darkMode ? '#F59E0B' : '#D97706'} />}
                  {item.key === 'greenScreen' && <Award size={20} color={settings.darkMode ? '#60A5FA' : '#2563EB'} />}
                  <View style={styles.shopTextBox}>
                    <Text style={[styles.shopName, settings.darkMode && styles.shopNameDark]}>{item.name}</Text>
                    <Text style={[styles.shopDesc, settings.darkMode && styles.shopDescDark]}>{getEquipmentEffect(item.key)}</Text>
                  </View>
                </View>
                {owned ? (
                  <View style={styles.ownedBadgeBox}><Text style={styles.ownedText}>Owned</Text></View>
                ) : (
                  <TouchableOpacity
                    onPress={() => buyEquipment(item.key, item.price)}
                    disabled={money < item.price}
                    style={[styles.priceChip, { opacity: money < item.price ? 0.5 : 1 }]}
                  >
                    <Text style={styles.buyButtonText}>Buy ${item.price}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* PC Components */}
        <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>PC Components</Text>
          {componentsList.map(c => {
            const level = lv[c.key] || 0;
            const price = getNextUpgradePrice(c.key, level);
            const currentModel = getComponentModel(c.key, level);
            const nextModel = getComponentModel(c.key, level + 1);
            const atMax = price == null;
            return (
              <View key={c.key} style={[styles.shopRow, settings.darkMode && styles.shopRowDark]}>
                <View style={styles.shopRowLeft}>
                  {c.key === 'cpu' && <Settings size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {c.key === 'gpu' && <Video size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {c.key === 'ram' && <Activity size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {c.key === 'ssd' && <Zap size={20} color={settings.darkMode ? '#F59E0B' : '#D97706'} />}
                  {c.key === 'cooling' && <Snowflake size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {c.key === 'motherboard' && <Crown size={20} color={settings.darkMode ? '#60A5FA' : '#2563EB'} />}
                  {c.key === 'psu' && <Zap size={20} color={settings.darkMode ? '#34D399' : '#059669'} />}
                  {c.key === 'case' && <Square size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
                  {c.key === 'network' && <Activity size={20} color={settings.darkMode ? '#A78BFA' : '#7C3AED'} />}
                  <View style={styles.shopTextBox}>
                    <Text style={[styles.shopName, settings.darkMode && styles.shopNameDark]}>{c.name} • {currentModel}</Text>
                    <Text style={[styles.shopDesc, settings.darkMode && styles.shopDescDark]}>{getComponentEffect(c.key)}</Text>
                    <Text style={[styles.smallLabel, settings.darkMode && styles.smallLabelDark]}>
                      {atMax ? 'Max level reached' : `Next: ${nextModel}`}
                    </Text>
                  </View>
                </View>
                {atMax ? (
                  <View style={styles.ownedBadgeBox}><Text style={styles.ownedText}>Max</Text></View>
                ) : (
                  <TouchableOpacity
                    onPress={() => upgradeComponent(c.key)}
                    disabled={!canAfford(price)}
                    style={[styles.priceChip, { opacity: !canAfford(price) ? 0.5 : 1 }]}
                  >
                    <Text style={styles.buyButtonText}>Upgrade ${price}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <ErrorBoundary>
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Header */}
      <LinearGradient
        colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, settings.darkMode && styles.headerDark]}
      >
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={settings.darkMode ? '#D1D5DB' : '#374151'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
          Gaming & Streaming
        </Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabContainer, settings.darkMode && styles.tabContainerDark]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Activity size={18} color={activeTab === 'dashboard' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stream' && styles.activeTab]}
          onPress={() => setActiveTab('stream')}
        >
          <Video size={18} color={activeTab === 'stream' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'stream' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Stream
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
          onPress={() => setActiveTab('videos')}
        >
          <Camera size={18} color={activeTab === 'videos' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Videos
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shop' && styles.activeTab]}
          onPress={() => setActiveTab('shop')}
        >
          <DollarSign size={18} color={activeTab === 'shop' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'shop' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Shop
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'stream' && renderStream()}
      {activeTab === 'videos' && renderVideos()}
      {activeTab === 'shop' && renderShop()}

      {/* Floating Action Button - Show when not streaming and no active stream state */}
      {selectedGame && activeTab === 'stream' && !isStreaming && (!gamingData.streamingState || gamingData.streamingState.streamProgress === 0) && (
        <View style={styles.floatingButtonContainer}>
          {(() => {
            const canStream = (gamingData.ownedGames || []).includes(selectedGame);
            return (
              <Animated.View style={{ transform: [{ scale: pressScale.scale }] }}>
                <TouchableOpacity
                  style={[
                    styles.floatingActionButton,
                    !canStream && styles.buyButton,
                    settings.darkMode && styles.floatingActionButtonDark
                  ]}
                  onPressIn={pressScale.onPressIn}
                  onPressOut={pressScale.onPressOut}
                  onPress={() => {
                    if (!canStream) {
                      buyGame(selectedGame);
                    } else {
                      startStream();
                    }
                  }}
                >
                  {!canStream ? (
                    <>
                      <DollarSign size={24} color="#FFFFFF" />
                      <Text style={styles.floatingButtonText}>
                        Buy {availableGames.find(g => g.id === selectedGame)?.name} for ${availableGames.find(g => g.id === selectedGame)?.cost}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Play size={24} color="#FFFFFF" />
                      <Text style={styles.floatingButtonText}>Start Streaming</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })()}
        </View>
      )}

      {/* Streaming Container - Show when streaming or paused (replaces floating button) */}
      {activeTab === 'stream' && (isStreaming || ((gamingData.streamingState?.streamProgress || 0) > 0 && (gamingData.streamingState?.streamProgress || 0) < 100 && !isStreaming && gamingData.streamingState?.selectedGame)) && (
        <View style={styles.floatingButtonContainer}>
          <View style={[styles.streamingContainer, settings.darkMode && styles.streamingContainerDark]}>
            <Text style={[styles.streamingTitle, settings.darkMode && styles.streamingTitleDark]}>
              {isStreaming ? '🔴 Streaming' : '⏸️ Streaming (Paused)'} {availableGames.find(g => g.id === (selectedGame || gamingData.streamingState?.selectedGame))?.name}
            </Text>
            
            <View style={styles.streamingStats}>
              <View style={styles.statItem}>
                <Users size={16} color="#3B82F6" />
                <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                  {currentViewers.toLocaleString()} viewers
                </Text>
              </View>
              <View style={styles.statItem}>
                <DollarSign size={16} color="#10B981" />
                <Text style={[styles.statText, settings.darkMode && styles.statTextDark]}>
                  ${totalDonations.toFixed(2)} donations
                </Text>
              </View>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${streamProgress}%` }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, settings.darkMode && styles.progressTextDark]}>
                {streamProgress}% Complete • {Math.floor(streamDuration / 60)}m {streamDuration % 60}s
              </Text>
            </View>

            {isStreaming ? (
              <TouchableOpacity
                style={[styles.stopStreamButton, settings.darkMode && styles.stopStreamButtonDark]}
                onPress={stopStream}
              >
                <Text style={styles.stopStreamButtonText}>Stop Streaming</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.stopStreamButton, { backgroundColor: '#10B981' }, settings.darkMode && { backgroundColor: '#059669' }]}
                onPress={resumeStreaming}
              >
                <Text style={styles.stopStreamButtonText}>Resume Streaming</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Game Not Owned Modal */}
      <Modal visible={showGameNotOwnedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  🎮 Game Not Owned
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  You need to buy {modalData.gameName} before you can use it.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowGameNotOwnedModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Not Enough Energy Modal */}
      <Modal visible={showNotEnoughEnergyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  ⚡ Not Enough Energy
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  You need at least {modalData.requiredEnergy} energy to perform this action.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowNotEnoughEnergyModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Select Game Modal */}
      <Modal visible={showSelectGameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  🎮 Select Game
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  Please select a game below to record or stream.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowSelectGameModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Already Streaming Modal */}
      <Modal visible={showAlreadyStreamingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  📺 Already Streaming
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  You are already streaming. Please stop the current stream first.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowAlreadyStreamingModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Followers Required Modal */}
      <Modal visible={showFollowersRequiredModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  👥 Followers Required
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  You need {modalData.requiredFollowers} followers to stream {modalData.gameName}.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowFollowersRequiredModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Stream Ended Modal */}
      <Modal visible={showStreamEndedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  📺 Stream Ended
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  Stream Results:
                </Text>
                <Text style={[styles.modalSubtext, settings.darkMode && styles.modalSubtextDark]}>
                  ⏱️ Duration: {Math.floor(modalData.duration / 60)}m {modalData.duration % 60}s{'\n'}
                  👥 Viewers: {modalData.viewers}{'\n'}
                  💰 Total Earnings: ${modalData.earnings}{'\n'}
                  📈 New Followers: +{modalData.followers}{'\n'}
                  ⭐ New Subscribers: +{modalData.subscribers}
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowStreamEndedModal(false)}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Great!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Game Purchased Modal */}
      <Modal visible={showGamePurchasedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  🎮 Game Purchased!
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  {modalData.gameName} purchased! You can now stream this game.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowGamePurchasedModal(false)}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Awesome!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Already Owned Modal */}
      <Modal visible={showAlreadyOwnedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  🎮 Already Owned
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  You already own {modalData.gameName}.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowAlreadyOwnedModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Insufficient Funds Modal */}
      <Modal visible={showInsufficientFundsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  💰 Insufficient Funds
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  {modalData.gameName ? 
                    `You need $${modalData.gameCost} to buy ${modalData.gameName}.` :
                    `You need $${modalData.cost} for this purchase.`
                  }
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowInsufficientFundsModal(false)}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Recording in Progress Modal */}
      <Modal visible={showRecordingInProgressModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  🎥 Recording in Progress
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  You have a recording in progress. Do you want to reset it or continue from where you left off?
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setShowRecordingInProgressModal(false);
                    modalData.onReset?.();
                  }}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Reset</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setShowRecordingInProgressModal(false);
                    modalData.onContinue?.();
                  }}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Resuming Modal */}
      <Modal visible={showResumingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, settings.darkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                  🔄 Resuming
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, settings.darkMode && styles.modalMessageDark]}>
                  Your session has been restored.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowResumingModal(false)}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Great!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: simpleScale(24),
    paddingVertical: simpleScale(8),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  backButton: {
    padding: simpleScale(8),
  },
  headerTitle: {
    fontSize: simpleFontScale(18),
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: simpleScale(8),
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  headerSpacer: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabContainerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: simpleScale(10),
    paddingHorizontal: simpleScale(6),
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: simpleFontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: simpleScale(4),
  },
  tabTextDark: {
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: simpleScale(12),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: simpleScale(12),
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: simpleScale(12),
    borderRadius: simpleScale(12),
    alignItems: 'center',
    marginBottom: simpleScale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardDark: {
    backgroundColor: '#374151',
  },
  statValue: {
    fontSize: simpleFontScale(18),
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: simpleScale(8),
  },
  statValueDark: {
    color: '#F9FAFB',
  },
  statLabel: {
    fontSize: simpleFontScale(12),
    color: '#6B7280',
    marginTop: simpleScale(4),
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  levelCard: {
    backgroundColor: '#FFFFFF',
    padding: simpleScale(12),
    borderRadius: simpleScale(12),
    marginBottom: simpleScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  levelCardDark: {
    backgroundColor: '#374151',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: simpleScale(12),
  },
  levelTitle: {
    fontSize: simpleFontScale(16),
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: simpleScale(8),
  },
  levelTitleDark: {
    color: '#F9FAFB',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: simpleScale(6),
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  // Specialized fills for phases
  progressFillRecording: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressFillRendering: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  progressFillUploading: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: simpleFontScale(12),
    color: '#6B7280',
    textAlign: 'center',
  },
  progressTextDark: {
    color: '#9CA3AF',
  },
  progressButton: {
    position: 'relative',
    width: '100%',
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressButtonDark: {
    backgroundColor: '#1F2937',
  },
  progressButtonText: {
    position: 'absolute',
    zIndex: 2,
    color: '#111827',
    fontWeight: '700',
  },
  progressButtonTextDark: {
    color: '#F9FAFB',
  },
  progressButtonFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  infoCard: {
    padding: simpleScale(8),
    borderRadius: simpleScale(10),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: simpleScale(8),
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  infoPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: simpleScale(4),
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: simpleScale(4),
    paddingHorizontal: simpleScale(8),
    borderRadius: simpleScale(999),
    position: 'relative',
    marginBottom: simpleScale(6),
  },
  infoPillThird: {
    flexBasis: '31%',
  },
  infoPillHalf: {
    flexBasis: '49%',
  },
  infoPillText: {
    marginLeft: simpleScale(6),
    color: '#111827',
    fontSize: simpleFontScale(11),
    fontWeight: '600',
  },
  infoPillGreen: {
    backgroundColor: '#D1FAE5',
  },
  infoPillPurple: {
    backgroundColor: '#EDE9FE',
  },
  infoPillBlue: {
    backgroundColor: '#DBEAFE',
  },
  pillIconBg: {
    position: 'absolute',
    right: simpleScale(6),
    top: -simpleScale(6),
    opacity: 0.08,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: simpleScale(12),
    borderRadius: simpleScale(12),
    marginBottom: simpleScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionTitle: {
    fontSize: simpleFontScale(16),
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: simpleScale(8),
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  sectionDescription: {
    fontSize: simpleFontScale(12),
    color: '#6B7280',
    marginBottom: simpleScale(10),
    lineHeight: 20,
  },
  sectionDescriptionDark: {
    color: '#9CA3AF',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gameCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: simpleScale(10),
    borderRadius: simpleScale(8),
    alignItems: 'center',
    marginBottom: simpleScale(8),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gameCardDark: {
    backgroundColor: '#4B5563',
  },
  selectedGameCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  lockedGameCard: {
    opacity: 0.5,
  },
  gameName: {
    fontSize: simpleFontScale(14),
    fontWeight: '600',
    color: '#374151',
    marginTop: simpleScale(8),
    textAlign: 'center',
  },
  gameNameDark: {
    color: '#D1D5DB',
  },
  selectedGameName: {
    color: '#1E40AF',
  },
  gameStats: {
    fontSize: simpleFontScale(12),
    color: '#6B7280',
    marginTop: simpleScale(4),
    textAlign: 'center',
  },
  gameStatsDark: {
    color: '#9CA3AF',
  },
  requirementText: {
    fontSize: simpleFontScale(10),
    color: '#EF4444',
    marginTop: simpleScale(4),
    textAlign: 'center',
  },
  ownedText: {
    fontSize: simpleFontScale(10),
    color: '#10B981',
    marginTop: simpleScale(4),
    textAlign: 'center',
    fontWeight: '600',
  },
  useHintText: {
    fontSize: simpleFontScale(10),
    color: '#6B7280',
    marginTop: simpleScale(2),
    textAlign: 'center',
  },
  streamCard: {
    backgroundColor: '#FEF2F2',
    padding: simpleScale(14),
    borderRadius: simpleScale(12),
    alignItems: 'center',
    marginBottom: simpleScale(12),
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  streamCardDark: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
  },
  streamTitle: {
    fontSize: simpleFontScale(18),
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: simpleScale(8),
  },
  streamTitleDark: {
    color: '#FCA5A5',
  },
  progressContainer: {
    width: '100%',
    marginBottom: simpleScale(10),
  },
  stopStreamButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: simpleScale(16),
    paddingVertical: simpleScale(12),
    borderRadius: simpleScale(12),
  },
  stopStreamButtonDark: {
    backgroundColor: '#DC2626',
  },
  stopStreamButtonText: {
    color: '#FFFFFF',
    fontSize: simpleFontScale(16),
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: simpleFontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
  streamHistoryCard: {
    backgroundColor: '#F9FAFB',
    padding: simpleScale(10),
    borderRadius: simpleScale(8),
    marginBottom: simpleScale(8),
  },
  streamHistoryCardDark: {
    backgroundColor: '#4B5563',
  },
  streamHistoryGame: {
    fontSize: simpleFontScale(14),
    fontWeight: 'bold',
    color: '#374151',
  },
  streamHistoryGameDark: {
    color: '#D1D5DB',
  },
  streamHistoryStats: {
    fontSize: simpleFontScale(12),
    color: '#6B7280',
    marginTop: simpleScale(4),
  },
  streamHistoryStatsDark: {
    color: '#9CA3AF',
  },
  buyButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: simpleScale(16),
    paddingVertical: simpleScale(8),
    borderRadius: simpleScale(8),
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: simpleFontScale(12),
    fontWeight: '600',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: simpleScale(12),
    backgroundColor: 'transparent',
  },
  floatingActionButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: simpleScale(12),
    borderRadius: simpleScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingActionButtonDark: {
    backgroundColor: '#059669',
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: simpleFontScale(16),
    fontWeight: 'bold',
    marginLeft: simpleScale(8),
  },
  streamingContainer: {
    backgroundColor: '#FEF2F2',
    padding: simpleScale(12),
    borderRadius: simpleScale(12),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  streamingContainerDark: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
  },
  streamingTitle: {
    fontSize: simpleFontScale(16),
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: simpleScale(8),
  },
  streamingTitleDark: {
    color: '#FCA5A5',
  },
  streamingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: simpleScale(12),
    paddingHorizontal: simpleScale(8),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: simpleScale(8),
    paddingVertical: simpleScale(4),
    borderRadius: simpleScale(6),
  },
  statText: {
    fontSize: simpleFontScale(12),
    fontWeight: '600',
    color: '#374151',
    marginLeft: simpleScale(4),
  },
  statTextDark: {
    color: '#D1D5DB',
  },
  donationPopup: {
    position: 'absolute',
    backgroundColor: '#FEF3C7',
    padding: simpleScale(12),
    borderRadius: simpleScale(8),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 200,
    zIndex: 1000,
  },
  donationPopupDark: {
    backgroundColor: '#451A03',
    borderLeftColor: '#FCD34D',
  },
  donationAmount: {
    fontSize: simpleFontScale(16),
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'center',
  },
  donationAmountDark: {
    color: '#FCD34D',
  },
  donationMessage: {
    fontSize: simpleFontScale(12),
    color: '#92400E',
    textAlign: 'center',
    marginTop: simpleScale(4),
  },
  donationMessageDark: {
    color: '#FCD34D',
  },
  // Shop styles
  shopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: simpleScale(12),
    borderRadius: simpleScale(8),
    marginBottom: simpleScale(12),
  },
  shopRowDark: {
    backgroundColor: '#4B5563',
  },
  shopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopTextBox: {
    marginLeft: simpleScale(8),
    flex: 1,
  },
  shopName: {
    fontSize: simpleFontScale(14),
    fontWeight: '700',
    color: '#111827',
  },
  shopNameDark: {
    color: '#F9FAFB',
  },
  shopDesc: {
    fontSize: simpleFontScale(12),
    color: '#6B7280',
    marginTop: simpleScale(2),
  },
  shopDescDark: {
    color: '#D1D5DB',
  },
  priceChip: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: simpleScale(12),
    paddingVertical: simpleScale(8),
    borderRadius: simpleScale(999),
  },
  smallLabel: {
    fontSize: simpleFontScale(10),
    color: '#6B7280',
    marginTop: simpleScale(2),
  },
  smallLabelDark: {
    color: '#9CA3AF',
  },
  ownedBadgeBox: {
    backgroundColor: '#10B981',
    borderRadius: simpleScale(999),
    paddingHorizontal: simpleScale(10),
    paddingVertical: simpleScale(6),
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: simpleScale(20),
  },
  modalContainer: {
    width: '100%',
    maxWidth: simpleScale(400),
    borderRadius: simpleScale(16),
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
    padding: simpleScale(24),
    borderRadius: simpleScale(16),
  },
  modalHeader: {
    marginBottom: simpleScale(20),
  },
  modalTitle: {
    fontSize: simpleFontScale(20),
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalContent: {
    marginBottom: simpleScale(24),
  },
  modalMessage: {
    fontSize: simpleFontScale(16),
    color: '#374151',
    textAlign: 'center',
    lineHeight: simpleFontScale(24),
  },
  modalMessageDark: {
    color: '#D1D5DB',
  },
  modalSubtext: {
    fontSize: simpleFontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: simpleScale(12),
    lineHeight: simpleFontScale(20),
  },
  modalSubtextDark: {
    color: '#9CA3AF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: simpleScale(12),
  },
  modalButton: {
    flex: 1,
    borderRadius: simpleScale(8),
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: simpleScale(12),
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: simpleFontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
