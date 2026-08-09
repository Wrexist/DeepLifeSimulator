/**
 * Share Your Life Card Component
 *
 * Displays a shareable card summarizing the player's life:
 * - Character name and age
 * - Career and salary
 * - Net worth and financial status
 * - Key life events (married, kids, prestige level)
 * - A contextual tagline
 *
 * Usage:
 * import ShareLifeCard from '@/components/ShareLifeCard';
 * <ShareLifeCard gameState={gameState} onClose={() => setVisible(false)} />
 */

import React, { useState } from 'react';
import {
 View,
 Text,
 TouchableOpacity,
 StyleSheet,
 Share,
 ActivityIndicator,
 Platform,
} from 'react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { Heart, Share2 } from 'lucide-react-native';
import { GameState } from '@/contexts/game/types';
import { netWorth as canonicalNetWorth } from '@/lib/progress/achievements';
import { scale, fontScale, responsiveWidth } from '@/utils/scaling';
import { getThemeColors } from '@/lib/config/theme';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { logger } from '@/utils/logger';
import { APP_STORE_URL } from '@/lib/config/appConfig';
const BlurView = BlurViewFallback;

interface ShareLifeCardProps {
 gameState: GameState;
 onClose?: () => void;
}

/**
 * Generate a tagline based on player's current life situation
 */
function generateTagline(gameState: GameState): string {
 const { stats, family, generationNumber } = gameState;
 const netWorth = calculateNetWorth(gameState);

 // Get current career if any
 const workingCareer = gameState.careers.find(c => c.accepted);

 if (netWorth > 1000000) {
 return ' Living the dream life!';
 }

 if (family?.spouse) {
 // family.children can be undefined on old/partial saves (repairGameState does
 // not backfill `family`); guard it like line 130 in this same file does.
 const childCount = family.children?.length ?? 0;
 if (childCount > 0) {
 return ` Building a legacy! ${childCount} kids deep`;
 }
 return ' Happily married & thriving';
 }

 if (workingCareer && workingCareer.level >= 3) {
 return ' Career on fire!';
 }

 if (stats?.happiness > 85) {
 return ' Living my best life';
 }

 if (generationNumber > 1) {
 return ` Generation ${generationNumber} - carrying the legacy forward`;
 }

 return ' Making moves in life';
}

/**
 * Total net worth — the CANONICAL figure (`lib/progress/achievements.netWorth`),
 * the same one prestige, the leaderboard, ambitions, bail cost and the stats
 * screen read. This card previously carried its own copy that summed only cash +
 * bank + real estate at PURCHASE price — no stocks, companies, vehicles, loans
 * or luxury — so a player's shareable card contradicted every other net-worth
 * surface in the game (2026-07-28 weekly audit: 5-way net-worth duplication).
 */
function calculateNetWorth(gameState: GameState): number {
 return canonicalNetWorth(gameState);
}

/**
 * Format currency in a human-readable way
 */
function formatCurrency(amount: number): string {
 if (amount >= 1000000) {
 return `$${(amount / 1000000).toFixed(1)}M`;
 }
 if (amount >= 1000) {
 return `$${(amount / 1000).toFixed(0)}K`;
 }
 return `$${amount.toFixed(0)}`;
}

/**
 * Format age display
 */
function formatAge(stats: any): string {
 if (stats?.age) {
 return `Age ${Math.floor(stats.age)}`;
 }
 return 'Age Unknown';
}

export default function ShareLifeCard({ gameState, onClose }: ShareLifeCardProps) {
 const [isSharing, setIsSharing] = useState(false);

 const isDarkMode = gameState.settings?.darkMode ?? true;
 const themeColors = getThemeColors(isDarkMode);

 // Extract key data
 const characterName = gameState.userProfile?.displayName || gameState.userProfile?.name || 'Unknown';
 const age = formatAge(gameState.stats);
 const workingCareer = gameState.careers.find(c => c.accepted);
 const careerName = workingCareer?.id
 ? workingCareer.id.charAt(0).toUpperCase() + workingCareer.id.slice(1)
 : 'Unemployed';
 const salary = workingCareer?.levels[workingCareer.level]?.salary || 0;
 const netWorth = calculateNetWorth(gameState);
 const spouse = gameState.family?.spouse;
 const childrenCount = gameState.family?.children?.length || 0;
 const prestigeLevel = gameState.generationNumber || 1;
 const tagline = generateTagline(gameState);

 // Build share text
 const shareText = ` My Deep Life:
 ${characterName} (${age})
 ${careerName} - ${formatCurrency(salary)}/week
 Net Worth: ${formatCurrency(netWorth)}
${spouse ? ` Married to ${spouse.name}` : ''}
${childrenCount > 0 ? ` ${childrenCount} children` : ''}
 Generation ${prestigeLevel}
${tagline}

Live your own life in Deep Life Simulator:
${APP_STORE_URL}

#DeepLifeSim`;

 const handleShare = async () => {
 try {
 setIsSharing(true);
 await Share.share({
 message: shareText,
 title: `${characterName}'s Life in Deep Life Simulator`,
 url: Platform.OS === 'ios' ? undefined : undefined,
 });
 } catch (error) {
 logger.error('[ShareLifeCard] Share failed', error);
 } finally {
 setIsSharing(false);
 }
 };

 const styles = StyleSheet.create({
 container: {
 flex: 1,
 justifyContent: 'center',
 alignItems: 'center',
 backgroundColor: 'rgba(0, 0, 0, 0.5)',
 },
 card: {
 width: responsiveWidth(85),
 borderRadius: scale(20),
 padding: scale(24),
 marginHorizontal: scale(16),
 ...getGlassCard(isDarkMode, 12),
 },
 header: {
 marginBottom: scale(20),
 alignItems: 'center',
 },
 characterName: {
 fontSize: fontScale(24),
 fontWeight: '700',
 color: themeColors.text,
 marginBottom: scale(4),
 },
 ageText: {
 fontSize: fontScale(14),
 color: themeColors.textSecondary,
 },
 section: {
 marginVertical: scale(12),
 paddingBottom: scale(12),
 borderBottomWidth: 1,
 borderBottomColor: themeColors.border,
 },
 lastSection: {
 borderBottomWidth: 0,
 marginBottom: scale(20),
 },
 sectionTitle: {
 fontSize: fontScale(12),
 fontWeight: '600',
 color: themeColors.textMuted,
 textTransform: 'uppercase',
 letterSpacing: 1,
 marginBottom: scale(8),
 },
 statRow: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginVertical: scale(6),
 },
 statLabel: {
 fontSize: fontScale(14),
 color: themeColors.text,
 fontWeight: '500',
 },
 statValue: {
 fontSize: fontScale(14),
 color: '#6366F1',
 fontWeight: '600',
 },
 tagline: {
 fontSize: fontScale(16),
 fontWeight: '600',
 color: themeColors.text,
 textAlign: 'center',
 marginVertical: scale(16),
 padding: scale(12),
 backgroundColor: isDarkMode
 ? 'rgba(99, 102, 241, 0.15)'
 : 'rgba(99, 102, 241, 0.1)',
 borderRadius: scale(12),
 },
 buttonRow: {
 flexDirection: 'row',
 gap: scale(12),
 marginTop: scale(16),
 },
 button: {
 flex: 1,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: scale(12),
 paddingHorizontal: scale(16),
 borderRadius: scale(12),
 backgroundColor: '#6366F1',
 gap: scale(8),
 ...getPlatformShadows(6, 0.2),
 },
 buttonSecondary: {
 backgroundColor: themeColors.surfaceElevated,
 borderWidth: 1,
 borderColor: themeColors.border,
 },
 buttonText: {
 fontSize: fontScale(14),
 fontWeight: '600',
 color: '#FFFFFF',
 },
 buttonTextSecondary: {
 color: themeColors.text,
 },
 loadingOverlay: {
 position: 'absolute',
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 borderRadius: scale(20),
 justifyContent: 'center',
 alignItems: 'center',
 backgroundColor: 'rgba(0, 0, 0, 0.3)',
 },
 closeButton: {
 position: 'absolute',
 top: scale(16),
 right: scale(16),
 zIndex: 10,
 padding: scale(8),
 },
 });

 return (
 <View style={styles.container}>
 <View style={styles.card}>
 {/* Close button */}
 {onClose && (
 <TouchableOpacity style={styles.closeButton} onPress={onClose}>
 <Text style={{ fontSize: fontScale(24), color: themeColors.text }}>×</Text>
 </TouchableOpacity>
 )}

 {/* Header */}
 <View style={styles.header}>
 <Text style={styles.characterName}>{characterName}</Text>
 <Text style={styles.ageText}>{age}</Text>
 </View>

 {/* Career Section */}
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Career</Text>
 <View style={styles.statRow}>
 <Text style={styles.statLabel}>{careerName}</Text>
 <Text style={styles.statValue}>{formatCurrency(salary)}/wk</Text>
 </View>
 </View>

 {/* Finances Section */}
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Finances</Text>
 <View style={styles.statRow}>
 <Text style={styles.statLabel}>Cash</Text>
 <Text style={styles.statValue}>{formatCurrency(gameState.stats?.money || 0)}</Text>
 </View>
 <View style={styles.statRow}>
 <Text style={styles.statLabel}>Net Worth</Text>
 <Text style={styles.statValue}>{formatCurrency(netWorth)}</Text>
 </View>
 </View>

 {/* Life Section */}
 <View style={[styles.section, styles.lastSection]}>
 <Text style={styles.sectionTitle}>Life Status</Text>
 {spouse && (
 <View style={styles.statRow}>
 <Text style={styles.statLabel}>
 <Heart size={14} color="#EC4899" /> Married
 </Text>
 <Text style={styles.statValue}>{spouse.name}</Text>
 </View>
 )}
 {childrenCount > 0 && (
 <View style={styles.statRow}>
 <Text style={styles.statLabel}>Children</Text>
 <Text style={styles.statValue}>{childrenCount}</Text>
 </View>
 )}
 <View style={styles.statRow}>
 <Text style={styles.statLabel}>Generation</Text>
 <Text style={styles.statValue}>{prestigeLevel}</Text>
 </View>
 </View>

 {/* Tagline */}
 <Text style={styles.tagline}>{tagline}</Text>

 {/* Action Buttons */}
 <View style={styles.buttonRow}>
 <TouchableOpacity
 style={styles.button}
 onPress={handleShare}
 disabled={isSharing}
 activeOpacity={0.7}
 >
 {isSharing ? (
 <ActivityIndicator color="#FFFFFF" size="small" />
 ) : (
 <>
 <Share2 size={16} color="#FFFFFF" />
 <Text style={styles.buttonText}>Share</Text>
 </>
 )}
 </TouchableOpacity>

 </View>

 {/* Loading overlay */}
 {isSharing && (
 <View style={styles.loadingOverlay}>
 <ActivityIndicator color="#6366F1" size="large" />
 </View>
 )}
 </View>
 </View>
 );
}
