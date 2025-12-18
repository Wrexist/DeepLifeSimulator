/**
 * Gaming & Streaming App - Video Logic Hook
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { GameState, Video } from '@/contexts/game/types';
import { getRenderTimeMs, getUploadTimeMs, getNextUpgradePrice } from './utils';

export const useVideoLogic = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  availableGames: any[]
) => {
  const { gamingStreaming } = gameState;
  const gamingData = gamingStreaming || {
    videos: [],
    videoTitleCounters: {},
    videoRecordingState: {
      isRecording: false,
      isRendering: false,
      isUploading: false,
      recordProgress: 0,
      renderProgress: 0,
      uploadProgress: 0,
      videoTitle: '',
      videoGame: '',
    }
  };

  // Local state for video processing (syncs with global state)
  const [isRecording, setIsRecording] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoGame, setVideoGame] = useState<string>('');
  
  // Timers - setInterval returns different types on different platforms
  type TimerType = ReturnType<typeof setInterval>;
  const [recordTimer, setRecordTimer] = useState<TimerType | null>(null);
  const [renderTimer, setRenderTimer] = useState<TimerType | null>(null);
  const [uploadTimer, setUploadTimer] = useState<TimerType | null>(null);

  // Helper to update persistent state
  const updateVideoRecordingState = (newState: Partial<{
    isRecording: boolean;
    isRendering: boolean;
    isUploading: boolean;
    recordProgress: number;
    renderProgress: number;
    uploadProgress: number;
    videoTitle: string;
    videoGame: string;
  }>) => {
    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        videoRecordingState: {
          ...prev.gamingStreaming!.videoRecordingState!,
          ...newState
        }
      }
    }));
  };

  // Initialize local state from persistent state
  useEffect(() => {
    const savedState = gamingData.videoRecordingState;
    if (savedState) {
      setIsRecording(savedState.isRecording);
      setIsRendering(savedState.isRendering);
      setIsUploading(savedState.isUploading);
      setRecordProgress(savedState.recordProgress);
      setRenderProgress(savedState.renderProgress);
      setUploadProgress(savedState.uploadProgress);
      setVideoTitle(savedState.videoTitle || '');
      setVideoGame(savedState.videoGame || '');
    }
  }, []);

  // Video Actions
  const startRecording = (gameId: string, title: string) => {
    if (isRecording || isRendering || isUploading) return;
    
    setIsRecording(true);
    setRecordProgress(0);
    setVideoGame(gameId);
    setVideoTitle(title);
    
    updateVideoRecordingState({
      isRecording: true,
      videoGame: gameId,
      videoTitle: title,
      recordProgress: 0
    });

    // 5 seconds to record
    const timer = setInterval(() => {
      setRecordProgress(prev => {
        const next = prev + 2; // 50 ticks * 100ms = 5000ms
        updateVideoRecordingState({ recordProgress: next });
        
        if (next >= 100) {
          clearInterval(timer);
          setRecordTimer(null);
          finishRecording();
          return 100;
        }
        return next;
      });
    }, 100);
    setRecordTimer(timer);
  };

  const finishRecording = () => {
    setIsRecording(false);
    setIsRendering(true);
    setRecordProgress(100);
    setRenderProgress(0);
    
    updateVideoRecordingState({
      isRecording: false,
      isRendering: true,
      recordProgress: 100,
      renderProgress: 0
    });

    startRendering();
  };

  const startRendering = () => {
    // Calculate render time based on PC stats
    const renderTime = getRenderTimeMs(gamingData.pcComponents);
    const tickInterval = 100;
    const totalTicks = renderTime / tickInterval;
    const incrementPerTick = 100 / totalTicks;

    const timer = setInterval(() => {
      setRenderProgress(prev => {
        const next = Math.min(100, prev + incrementPerTick);
        updateVideoRecordingState({ renderProgress: next });
        
        if (next >= 100) {
          clearInterval(timer);
          setRenderTimer(null);
          finishRendering();
          return 100;
        }
        return next;
      });
    }, tickInterval);
    setRenderTimer(timer);
  };

  const finishRendering = () => {
    setIsRendering(false);
    setIsUploading(true);
    setRenderProgress(100);
    setUploadProgress(0);
    
    updateVideoRecordingState({
      isRendering: false,
      isUploading: true,
      renderProgress: 100,
      uploadProgress: 0
    });

    startUploading();
  };

  const startUploading = () => {
    const uploadTime = getUploadTimeMs(gamingData.pcComponents);
    const tickInterval = 100;
    const totalTicks = uploadTime / tickInterval;
    const incrementPerTick = 100 / totalTicks;

    const timer = setInterval(() => {
      setUploadProgress(prev => {
        const next = Math.min(100, prev + incrementPerTick);
        updateVideoRecordingState({ uploadProgress: next });
        
        if (next >= 100) {
          clearInterval(timer);
          setUploadTimer(null);
          finishUploading();
          return 100;
        }
        return next;
      });
    }, tickInterval);
    setUploadTimer(timer);
  };

  const finishUploading = () => {
    setIsUploading(false);
    setUploadProgress(100);
    
    // Create video object
    const game = availableGames.find(g => g.id === videoGame);
    const newVideo: Video = {
      id: Date.now().toString(),
      title: videoTitle,
      gameId: videoGame,
      views: 0,
      likes: 0,
      earnings: 0,
      uploadDate: Date.now(),
      quality: Math.floor(Math.random() * 100), // Based on skills later
      duration: 600 + Math.floor(Math.random() * 600), // 10-20 mins
    };

    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        // PERFORMANCE FIX: Cap videos to last 100 items to prevent unbounded growth
        videos: [newVideo, ...(prev.gamingStreaming!.videos || [])].slice(0, 100),
        videoRecordingState: {
          isRecording: false,
          isRendering: false,
          isUploading: false,
          recordProgress: 0,
          renderProgress: 0,
          uploadProgress: 0,
          videoTitle: '',
          videoGame: '',
        }
      }
    }));

    Alert.alert('Video Uploaded!', `"${videoTitle}" is now live on your channel.`);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (recordTimer) clearInterval(recordTimer);
      if (renderTimer) clearInterval(renderTimer);
      if (uploadTimer) clearInterval(uploadTimer);
    };
  }, [recordTimer, renderTimer, uploadTimer]);

  return {
    isRecording,
    isRendering,
    isUploading,
    recordProgress,
    renderProgress,
    uploadProgress,
    startRecording,
    videoTitle,
    videoGame,
    setVideoTitle,
    setVideoGame
  };
};


