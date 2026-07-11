import React, { useEffect, useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, Platform } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { Trophy, Star, X, Medal } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { fetchLeaderboard, uploadLeaderboardScore, LeaderboardEntry } from '@/lib/progress/cloud';
import { netWorth } from '@/lib/progress/achievements';
import LoadingSpinner from '@/components/LoadingSpinner';
import { logger } from '@/utils/logger';
import { calculateChecksum, calculateHmacSignature } from '@/utils/saveValidation';
const LinearGradient = LinearGradientFallback;

interface Props {
 visible: boolean;
 onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: Props) {
 const { gameState } = useGame();
 // screenWidth removed - unused
 const pulseAnim = useRef(new Animated.Value(1)).current;
 const rotateAnim = useRef(new Animated.Value(0)).current;
 const slideAnim = useRef(new Animated.Value(50)).current;
 const fadeAnim = useRef(new Animated.Value(0)).current;
 
 const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
 const [loading, setLoading] = useState(false);
 const [selectedCategory, setSelectedCategory] = useState<string>('networth');
 const [playerRank, setPlayerRank] = useState<number>(-1);
 
 // R2-H: replace the mojibake (`µ`, `‚`, and an empty string) the previous
 // encoding round-trip produced. Use real emoji for the category chips.
 const categories = [
 { id: 'networth', name: 'Net Worth', icon: '💰' },
 { id: 'money', name: 'Money', icon: '💵' },
 { id: 'age', name: 'Age', icon: '🎂' },
 ];

 useEffect(() => {
 if (visible) {
 loadLeaderboard();
 submitPlayerScore();
 
 // Start animations
 Animated.parallel([
 Animated.timing(fadeAnim, {
 toValue: 1,
 duration: 800,
 useNativeDriver: Platform.OS!=='web',
 }),
 Animated.timing(slideAnim, {
 toValue: 0,
 duration: 600,
 useNativeDriver: Platform.OS!== 'web',
 }),
 ]).start();

 // Pulse animation
 const pulse = Animated.loop(
 Animated.sequence([
 Animated.timing(pulseAnim, {
 toValue: 1.1,
 duration: 1500,
 useNativeDriver: Platform.OS!== 'web',
 }),
 Animated.timing(pulseAnim, {
 toValue: 1,
 duration: 1500,
 useNativeDriver: Platform.OS!== 'web',
 }),
 ])
 );
 pulse.start();

 // Rotation animation
 const rotate = Animated.loop(
 Animated.timing(rotateAnim, {
 toValue: 1,
 duration: 3000,
 useNativeDriver: Platform.OS!== 'web',
 })
 );
 rotate.start();

 // R2-I: stop the loops on unmount or when `visible` flips false. The
 // previous version started loops and never stopped them, so each open of
 // the leaderboard stacked another set of native-driver animations.
 return () => {
 pulse.stop();
 rotate.stop();
 };
 } else {
 // Reset animations
 fadeAnim.setValue(0);
 slideAnim.setValue(50);
 pulseAnim.setValue(1);
 rotateAnim.setValue(0);
 }
 return undefined;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [visible, selectedCategory]);

 const loadLeaderboard = async () => {
 setLoading(true);
 try {
 const data = await fetchLeaderboard(selectedCategory);
 setLeaderboard(data.sort((a, b) => b.score - a.score));
 
 // R2-A: optional-chain userProfile in case the save lacks it.
 const playerName = gameState.userProfile?.name;
 const rank = playerName ? data.findIndex(entry => entry.name === playerName) : -1;
 setPlayerRank(rank >= 0 ? rank + 1: -1);
 } catch (error) {
 logger.error('Failed to load leaderboard:', error);
 } finally {
 setLoading(false);
 }
 };

 const submitPlayerScore = async () => {
 try {
 // R2-A: optional-chain userProfile so a missing profile doesn't crash
 // the score-submit (the async catch below would swallow it but the
 // synchronous deref throws first).
 const playerName = gameState.userProfile?.name;
 const userId = gameState.userProfile?.username || gameState.userProfile?.handle;
 const revision = gameState.weeksLived || 0;

 if (!userId || userId.trim().length < 3 || revision <= 0) {
 logger.warn('Skipping leaderboard submit: missing trusted user identity or revision', {
 userIdPresent: Boolean(userId),
 revision,
 });
 return;
 }

 let score = 0;
 
 switch (selectedCategory) {
 case 'networth':
 score = netWorth(gameState);
 break;
 case 'money':
 // R2-A: safe accessors so a malformed save doesn't crash the submit.
 score = gameState.stats?.money ?? 0;
 break;
 case 'age':
 score = gameState.date?.age ?? 0;
 break;
 }

 const runPayload = JSON.stringify({
 userId: userId.trim(),
 category: selectedCategory,
 score,
 revision,
 });
 const runHash = calculateChecksum(runPayload);
 const runSignature = calculateHmacSignature(`${userId.trim()}:${revision}:${runHash}`);
 
 await uploadLeaderboardScore({
 name: playerName,
 score,
 category: selectedCategory,
 userId: userId.trim(),
 revision,
 runSignature,
 });
 } catch (error) {
 logger.error('Failed to submit score:', error);
 }
 };

 const spin = rotateAnim.interpolate({
 inputRange: [0, 1],
 outputRange: ['0deg', '360deg'],
 });

 return (
 <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
 <View style={styles.container}>
 <LinearGradient
 colors={['#1E293B','#0F172A', '#020617'] as const}
 style={styles.backgroundGradient}
 >
 {/* Close Button */}
 <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
 <X size={24} color="#FFFFFF"/>
 </TouchableOpacity>

 {/* Main Content */}
 <Animated.View 
 style={[
 styles.content,
 {
 opacity: fadeAnim,
 transform: [{ translateY: slideAnim }],
 }
 ]}
 >
 {/* Trophy Icon with Pulse Animation */}
 <Animated.View style={[styles.trophyContainer, { transform: [{ scale: pulseAnim }] }]}>
 <LinearGradient
 colors={['#FFD700','#FFA500', '#FF8C00'] as const}
 style={styles.trophyGradient}
 >
 <Trophy size={60} color="#FFFFFF"/>
 </LinearGradient>
 </Animated.View>

 {/* Rotating Stars */}
 <Animated.View style={[styles.starContainer, { transform: [{ rotate: spin }] }]}>
 <Star size={20} color="#FFD700" />
 </Animated.View>
 <Animated.View style={[styles.starContainer2, { transform: [{ rotate: spin }] }]}>
 <Star size={16} color="#FFA500" />
 </Animated.View>
 <Animated.View style={[styles.starContainer3, { transform: [{ rotate: spin }] }]}>
 <Star size={18} color="#FF8C00" />
 </Animated.View>

 {/* Title */}
 <Text style={styles.title}>Leaderboard</Text>
 
 {/* Category Selector */}
 <View style={styles.categoryContainer}>
 {categories.map((cat) => (
 <TouchableOpacity
 key={cat.id}
 style={[
 styles.categoryButton,
 selectedCategory === cat.id && styles.categoryButtonActive
 ]}
 onPress={() => setSelectedCategory(cat.id)}
 >
 <Text style={styles.categoryEmoji}>{cat.icon}</Text>
 <Text style={[
 styles.categoryText,
 selectedCategory === cat.id && styles.categoryTextActive
 ]}>
 {cat.name}
 </Text>
 </TouchableOpacity>
 ))}
 </View>

 {/* Player Rank */}
 {playerRank > 0 && (
 <View style={styles.playerRankContainer}>
 <LinearGradient
 colors={['#3B82F6','#1D4ED8'] as const}
 style={styles.playerRankGradient}
 >
 <Medal size={20} color="#FFFFFF"/>
 <Text style={styles.playerRankText}>
 Your Rank: #{playerRank}
 </Text>
 </LinearGradient>
 </View>
 )}

 {/* Leaderboard List */}
 <ScrollView style={styles.leaderboardList} contentContainerStyle={styles.leaderboardContent}>
 {loading ? (
 <View style={{ marginTop: 40 }}>
 <LoadingSpinner visible size="large" color="#3B82F6" variant="compact" />
 </View>
 ): leaderboard.length === 0 ? (
 <Text style={styles.emptyText}>No scores yet. Be the first to submit!</Text>
 ): (
 leaderboard.map((entry, index) => {
 const isPlayer = entry.name === gameState.userProfile?.name;
 const rank = index + 1;
 const medalColors: string[] = 
 rank === 1 ? ['#FFD700','#FFA500']:
 rank === 2 ? ['#C0C0C0', '#A0A0A0']:
 rank === 3 ? ['#CD7F32', '#B87333']:
 ['#3B82F6', '#1D4ED8'];
 
 return (
 <View
 key={`${entry.name}-${index}`}
 style={[
 styles.leaderboardItem,
 isPlayer && styles.leaderboardItemPlayer
 ]}
 >
 <View style={styles.rankContainer}>
 {rank <= 3 ? (
 <LinearGradient colors={medalColors} style={styles.medalContainer}>
 <Medal size={24} color="#FFFFFF"/>
 </LinearGradient>
 ): (
 <Text style={styles.rankText}>#{rank}</Text>
 )}
 </View>
 <View style={styles.entryInfo}>
 <Text style={[styles.entryName, isPlayer && styles.entryNamePlayer]}>
 {entry.name} {isPlayer &&'(You)'}
 </Text>
 <Text style={styles.entryScore}>
 {selectedCategory === 'networth'?'$': ''}
 {entry.score.toLocaleString()}
 {selectedCategory === 'age'&&' years'}
 </Text>
 </View>
 </View>
 );
 })
 )}
 </ScrollView>
 </Animated.View>
 </LinearGradient>
 </View>
 </Modal>
 );
}

const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: '#000',
 },
 backgroundGradient: {
 flex: 1,
 justifyContent: 'center',
 alignItems: 'center',
 padding: 20,
 },
 closeButton: {
 position: 'absolute',
 top: 50,
 right: 20,
 zIndex: 10,
 padding: 8,
 borderRadius: 20,
 backgroundColor: 'rgba(255, 255, 255, 0.1)',
 },
 content: {
 alignItems: 'center',
 justifyContent: 'center',
 width: '100%',
 maxWidth: 400,
 },
 trophyContainer: {
 marginBottom: 30,
 },
 trophyGradient: {
 width: 120,
 height: 120,
 borderRadius: 60,
 justifyContent: 'center',
 alignItems: 'center',
 boxShadow: '0px 0px 20px rgba(255, 215, 0, 0.5)',
...Platform.select({
 web: { boxShadow: '0px 0px 20px rgba(255, 215, 0, 0.5)'} as any,
 default: {
 shadowColor:'#FFD700',
 shadowOffset: { width: 0, height: 0 },
 shadowOpacity: 0.5,
 shadowRadius: 20,
 },
 }),
 elevation: 10,
 },
 starContainer: {
 position: 'absolute',
 top: 50,
 right: 60,
 },
 starContainer2: {
 position: 'absolute',
 top: 80,
 left: 40,
 },
 starContainer3: {
 position: 'absolute',
 top: 120,
 right: 30,
 },
 title: {
 fontSize: 36,
 fontWeight: 'bold',
 color: '#FFFFFF',
 marginBottom: 20,
 textAlign: 'center',
...Platform.select({
 web: { textShadow: '0px 2px 4px rgba(0, 0, 0, 0.5)'} as any,
 default: {
 textShadowColor:'rgba(0, 0, 0, 0.5)',
 textShadowOffset: { width: 0, height: 2 },
 textShadowRadius: 4,
 },
 }),
 },
 categoryContainer: {
 flexDirection: 'row',
 marginBottom: 20,
 gap: 10,
 paddingHorizontal: 20,
 },
 categoryButton: {
 flex: 1,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: 10,
 paddingHorizontal: 12,
 borderRadius: 10,
 backgroundColor: 'rgba(255, 255, 255, 0.1)',
 gap: 6,
 },
 categoryButtonActive: {
 backgroundColor: 'rgba(59, 130, 246, 0.3)',
 },
 categoryEmoji: {
 fontSize: 16,
 },
 categoryText: {
 color: '#E5E7EB',
 fontSize: 12,
 fontWeight: '600',
 },
 categoryTextActive: {
 color: '#FFFFFF',
 fontWeight: '700',
 },
 playerRankContainer: {
 marginBottom: 20,
 paddingHorizontal: 20,
 },
 playerRankGradient: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: 12,
 paddingHorizontal: 20,
 borderRadius: 12,
 gap: 8,
 },
 playerRankText: {
 color: '#FFFFFF',
 fontSize: 16,
 fontWeight: '700',
 },
 leaderboardList: {
 width: '100%',
 maxHeight: 400,
 },
 leaderboardContent: {
 paddingHorizontal: 20,
 paddingBottom: 20,
 },
 loader: {
 marginVertical: 40,
 },
 emptyText: {
 color: '#94A3B8',
 fontSize: 16,
 textAlign: 'center',
 marginVertical: 40,
 },
 leaderboardItem: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingVertical: 12,
 paddingHorizontal: 16,
 marginBottom: 8,
 borderRadius: 10,
 backgroundColor: 'rgba(255, 255, 255, 0.05)',
 },
 leaderboardItemPlayer: {
 backgroundColor: 'rgba(59, 130, 246, 0.2)',
 borderWidth: 2,
 borderColor: '#3B82F6',
 },
 rankContainer: {
 width: 40,
 alignItems: 'center',
 marginRight: 12,
 },
 rankText: {
 color: '#94A3B8',
 fontSize: 16,
 fontWeight: '700',
 },
 medalContainer: {
 width: 32,
 height: 32,
 borderRadius: 16,
 justifyContent: 'center',
 alignItems: 'center',
 },
 entryInfo: {
 flex: 1,
 },
 entryName: {
 color: '#FFFFFF',
 fontSize: 16,
 fontWeight: '600',
 marginBottom: 4,
 },
 entryNamePlayer: {
 color: '#60A5FA',
 fontWeight: '700',
 },
 entryScore: {
 color: '#94A3B8',
 fontSize: 14,
 fontWeight: '500',
 },
});

