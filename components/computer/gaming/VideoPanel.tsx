import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, TextInput, StyleProp, ViewStyle } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { Zap } from 'lucide-react-native';
import { GamingStreamingState , GameSettings } from '@/contexts/game/types';


interface VideoPanelProps {
  settings: GameSettings;
  styles: any;
  gamingData: GamingStreamingState;
  availableGames: any[];
  videoGame: string;
  setVideoGame: (gameId: string) => void;
  buyGame: (gameId: string) => void;
  videoTitle: string;
  setVideoTitle: (title: string) => void;
  isRecording: boolean;
  isRendering: boolean;
  isUploading: boolean;
  recordProgress: number;
  renderProgress: number;
  uploadProgress: number;
  startVideoRecording: (gameId: string) => void;
  startRender: () => void;
  startUpload: () => void;
  setShowSelectGameModal: (show: boolean) => void;
  setModalData: (data: any) => void;
  setShowRecordingInProgressModal: (show: boolean) => void;
  updateVideoRecordingState: (state: any) => void;
  setRecordProgress: (progress: number) => void;
  computeEnergyPerSecond: () => number;
  simpleScale: (size: number) => number;
  GAME_IMAGES: any;
  Shimmer: React.FC;
}

export default function VideoPanel({
  settings,
  styles,
  gamingData,
  availableGames,
  videoGame,
  setVideoGame,
  buyGame,
  videoTitle,
  setVideoTitle,
  isRecording,
  isRendering,
  isUploading,
  recordProgress,
  renderProgress,
  uploadProgress,
  startVideoRecording,
  startRender,
  startUpload,
  setShowSelectGameModal,
  setModalData,
  setShowRecordingInProgressModal,
  updateVideoRecordingState,
  setRecordProgress,
  computeEnergyPerSecond,
  simpleScale,
  GAME_IMAGES,
  Shimmer
}: VideoPanelProps) {
  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
      {/* Record Video */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Record Video</Text>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] as const : ['#F8FAFC', '#FFFFFF'] as const}
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
                  <Text style={styles.requirementText}>${game.cost} â€¢ Tap to buy</Text>
                ) : (
                  <>
                    <Text style={styles.ownedText}>âœ“ Owned</Text>
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
              {recordProgress === 0 ? 'Record Video' : (recordProgress < 100 ? (isRecording ? `Recording ${recordProgress}%` : `Recording ${recordProgress}% (Paused)`) : 'Recorded âœ”')}
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
              {renderProgress === 0 ? 'Render Video' : (renderProgress < 100 ? (isRendering ? `Rendering ${renderProgress}%` : `Rendering ${renderProgress}% (Paused)`) : 'Rendered âœ”')}
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
              {uploadProgress === 0 ? 'Upload Video' : (uploadProgress < 100 ? (isUploading ? `Uploading ${uploadProgress}%` : `Uploading ${uploadProgress}% (Paused)`) : 'Uploaded âœ”')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Progress UI integrated into buttons above */}
      </View>

      {/* Your Videos */}
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Your Videos</Text>
        {(gamingData.videos || []).length ? (
          (gamingData.videos || []).map((v: any) => (
            <View key={v.id} style={[styles.streamHistoryCard, settings.darkMode && styles.streamHistoryCardDark]}>
              <Text style={[styles.streamHistoryGame, settings.darkMode && styles.streamHistoryGameDark]}>
                {v.title}
              </Text>
              <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                ðŸŽ® {v.game} â€¢ ðŸ‘€ {v.views.toLocaleString()} â€¢ ðŸ‘ {v.likes.toLocaleString()} â€¢ ðŸ’¬ {v.comments.toLocaleString()} â€¢ ðŸ’° ${v.earnings.toLocaleString()}
              </Text>
              {/* Simple analytics breakdown */}
              <Text style={[styles.streamHistoryStats, settings.darkMode && styles.streamHistoryStatsDark]}>
                CTR ~{Math.max(2, Math.min(18, Math.round(6 + (v.quality||0)*8)))}% â€¢ AVD ~{Math.round(40 + (v.quality||0)*30)}s â€¢ RPM ${Math.max(1, Math.round(((v.earnings/(v.views/1000))||2)*0.7*100)/100)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, settings.darkMode && styles.emptyTextDark]}>No videos yet. Record one above.</Text>
        )}
      </View>
    </ScrollView>
  );
}





























