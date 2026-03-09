/**
 * LifeStoryModal — Auto-generated narrative of the player's life
 *
 * Reads journal entries, event log, relationships, and stats to produce
 * a shareable, chapter-based "life story" that players can view and share.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { X, BookOpen, Share2, ChevronRight } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useGameState } from '@/contexts/game/GameStateContext';
import { generateLifeStory, generateShareableStory, type LifeStory, type StoryChapter } from '@/lib/lifeMoments/storyGenerator';
import FadeInUp from '@/components/anim/FadeInUp';
import { haptic } from '@/utils/haptics';
import { Z_INDEX } from '@/utils/zIndexConstants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LifeStoryModal({ visible, onClose }: Props) {
  const { gameState } = useGameState();

  const story: LifeStory = useMemo(() => {
    if (!gameState) {
      return { title: 'Your Story', subtitle: '', chapters: [], summary: '' };
    }
    return generateLifeStory(gameState);
  }, [
    gameState?.journal?.length,
    gameState?.eventLog?.length,
    gameState?.relationships?.length,
    gameState?.date?.age,
    gameState?.stats?.money,
  ]);

  const handleShare = async () => {
    if (!gameState) return;
    haptic.success();
    try {
      const text = generateShareableStory(gameState);
      await Share.share({
        message: text,
        title: story.title,
      });
    } catch {
      // User cancelled share
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <BookOpen size={24} color="#FFFFFF" />
              <View style={styles.headerText}>
                <Text style={styles.title}>{story.title}</Text>
                <Text style={styles.subtitle}>{story.subtitle}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                <Share2 size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Story Content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {story.chapters.length === 0 ? (
              <FadeInUp delay={0}>
                <View style={styles.emptyState}>
                  <BookOpen size={48} color="#4B5563" />
                  <Text style={styles.emptyTitle}>Your story is just beginning</Text>
                  <Text style={styles.emptyText}>
                    Keep living your life — every week adds to your story. Make choices, build relationships, and pursue your dreams.
                  </Text>
                </View>
              </FadeInUp>
            ) : (
              story.chapters.map((chapter, idx) => (
                <FadeInUp key={idx} delay={idx * 100}>
                  <ChapterCard chapter={chapter} index={idx} />
                </FadeInUp>
              ))
            )}

            {/* Closing */}
            {story.summary ? (
              <FadeInUp delay={story.chapters.length * 100}>
                <View style={styles.closingCard}>
                  <Text style={styles.closingText}>{story.summary}</Text>
                </View>
              </FadeInUp>
            ) : null}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ChapterCard({ chapter, index }: { chapter: StoryChapter; index: number }) {
  const chapterColors = [
    ['#6366F1', '#818CF8'],
    ['#EC4899', '#F472B6'],
    ['#10B981', '#34D399'],
    ['#F59E0B', '#FBBF24'],
    ['#3B82F6', '#60A5FA'],
  ];
  const [c1, c2] = chapterColors[index % chapterColors.length];

  return (
    <View style={styles.chapterCard}>
      <View style={styles.chapterHeader}>
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chapterBadge}
        >
          <Text style={styles.chapterNumber}>Chapter {index + 1}</Text>
        </LinearGradient>
        <View style={styles.chapterTitleRow}>
          <Text style={styles.chapterTitle}>{chapter.title}</Text>
          <Text style={styles.chapterAge}>{chapter.ageRange}</Text>
        </View>
      </View>

      {chapter.paragraphs.map((p, i) => (
        <View key={i} style={styles.paragraphRow}>
          <ChevronRight size={14} color="#6B7280" style={{ marginTop: 3 }} />
          <Text style={styles.paragraph}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    marginTop: 60,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    zIndex: Z_INDEX.MODAL,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
  },
  closeButton: {
    padding: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#D1D5DB',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  chapterCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chapterHeader: {
    marginBottom: 12,
  },
  chapterBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  chapterNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F3F4F6',
  },
  chapterAge: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  paragraphRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 4,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
    color: '#9CA3AF',
    marginLeft: 8,
    flex: 1,
  },
  closingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    marginBottom: 16,
  },
  closingText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#D1D5DB',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
