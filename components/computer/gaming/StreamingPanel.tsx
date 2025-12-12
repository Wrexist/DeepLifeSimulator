import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import { GamingStreamingState , GameSettings } from '@/contexts/game/types';


// Define props interface
interface StreamingPanelProps {
  settings: GameSettings;
  styles: any;
  isStreaming: boolean;
  gamingData: GamingStreamingState;
  availableGames: any[];
  selectedGame: string;
  setSelectedGame: (gameId: string) => void;
  subsMilestone: number;
  subsGoal: number;
  donMilestone: number;
  donGoal: number;
  computeEnergyPerSecond: () => number;
  simpleScale: (size: number) => number;
  streamDonations: any[];
  subPopups: any[];
  GAME_IMAGES: any;
  AnimatedPopup: any;
}

export default function StreamingPanel({
  settings,
  styles,
  isStreaming,
  gamingData,
  availableGames,
  selectedGame,
  setSelectedGame,
  subsMilestone,
  subsGoal,
  donMilestone,
  donGoal,
  computeEnergyPerSecond,
  simpleScale,
  streamDonations,
  subPopups,
  GAME_IMAGES,
  AnimatedPopup
}: StreamingPanelProps) {
  
  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
      <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Select Game to Stream
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Choose a game to stream. You can purchase games you don&apos;t own yet.
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
          {availableGames.map((game: any) => (
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
        {isStreaming && streamDonations.map((donation: any) => (
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
        {isStreaming && subPopups.map((sub: any) => (
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
}






