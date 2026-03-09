/**
 * Journal Component
 * 
 * Full-featured life diary system with categories, search, timeline,
 * and detailed entry views
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  BookOpen,
  Search,
  Filter,
  Calendar,
  Briefcase,
  Heart,
  Trophy,
  Plane,
  Users,
  AlertTriangle,
  Activity,
  X,
  ChevronRight,
  Clock,
  Star,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { JournalEntry } from '@/contexts/game/types';
import { scale, fontScale } from '@/utils/scaling';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

type JournalCategory = 'all' | 'career' | 'relationship' | 'achievement' | 'travel' | 'family' | 'crime' | 'health' | 'other';

interface CategoryInfo {
  id: JournalCategory;
  label: string;
  icon: any;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'all', label: 'All', icon: BookOpen, color: '#6366F1', bgColor: '#EEF2FF' },
  { id: 'career', label: 'Career', icon: Briefcase, color: '#3B82F6', bgColor: '#DBEAFE' },
  { id: 'relationship', label: 'Relationships', icon: Heart, color: '#EC4899', bgColor: '#FCE7F3' },
  { id: 'achievement', label: 'Achievements', icon: Trophy, color: '#F59E0B', bgColor: '#FEF3C7' },
  { id: 'travel', label: 'Travel', icon: Plane, color: '#8B5CF6', bgColor: '#EDE9FE' },
  { id: 'family', label: 'Family', icon: Users, color: '#10B981', bgColor: '#D1FAE5' },
  { id: 'crime', label: 'Crime', icon: AlertTriangle, color: '#EF4444', bgColor: '#FEE2E2' },
  { id: 'health', label: 'Health', icon: Activity, color: '#14B8A6', bgColor: '#CCFBF1' },
];

// Helper to determine category from entry content
function getCategoryFromEntry(entry: JournalEntry): JournalCategory {
  const title = entry.title.toLowerCase();
  const details = (entry.details || '').toLowerCase();
  const combined = title + ' ' + details;

  if (combined.includes('job') || combined.includes('work') || combined.includes('career') || combined.includes('promoted') || combined.includes('hired') || combined.includes('salary')) {
    return 'career';
  }
  if (combined.includes('relationship') || combined.includes('dating') || combined.includes('married') || combined.includes('partner') || combined.includes('love') || combined.includes('broke up')) {
    return 'relationship';
  }
  if (combined.includes('achievement') || combined.includes('unlocked') || combined.includes('completed') || combined.includes('milestone')) {
    return 'achievement';
  }
  if (combined.includes('travel') || combined.includes('visited') || combined.includes('trip') || combined.includes('vacation') || combined.includes('country')) {
    return 'travel';
  }
  if (combined.includes('family') || combined.includes('child') || combined.includes('baby') || combined.includes('parent') || combined.includes('heir')) {
    return 'family';
  }
  if (combined.includes('crime') || combined.includes('jail') || combined.includes('arrested') || combined.includes('steal') || combined.includes('hack')) {
    return 'crime';
  }
  if (combined.includes('health') || combined.includes('sick') || combined.includes('hospital') || combined.includes('died') || combined.includes('disease')) {
    return 'health';
  }
  return 'other';
}

interface JournalProps {
  compact?: boolean;
}

export default function Journal({ compact = false }: JournalProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const entries = gameState.journal || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<JournalCategory>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Add category to each entry
  const categorizedEntries = useMemo(() => {
    return entries.map(entry => ({
      ...entry,
      category: getCategoryFromEntry(entry),
    }));
  }, [entries]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...categorizedEntries];

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(entry => entry.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        entry =>
          entry.title.toLowerCase().includes(query) ||
          (entry.details || '').toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aWeek = a.atWeek || 0;
      const bWeek = b.atWeek || 0;
      return sortOrder === 'newest' ? bWeek - aWeek : aWeek - bWeek;
    });

    return result;
  }, [categorizedEntries, selectedCategory, searchQuery, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    categorizedEntries.forEach(entry => {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    });
    return {
      total: categorizedEntries.length,
      byCategory,
    };
  }, [categorizedEntries]);

  const getCategoryInfo = useCallback((categoryId: JournalCategory): CategoryInfo => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  }, []);

  const formatWeek = useCallback((week: number) => {
    const year = Math.floor(week / WEEKS_PER_YEAR) + 1;
    const weekInYear = (week % WEEKS_PER_YEAR) + 1;
    return `Year ${year}, Week ${weekInYear}`;
  }, []);

  // Compact view for embedding
  if (compact) {
    return (
      <View style={[styles.compactContainer, settings.darkMode && styles.containerDark]}>
        <View style={styles.compactHeader}>
          <BookOpen size={18} color={settings.darkMode ? '#A78BFA' : '#6366F1'} />
          <Text style={[styles.compactTitle, settings.darkMode && styles.textDark]}>
            Journal
          </Text>
          <View style={styles.compactBadge}>
            <Text style={styles.compactBadgeText}>{entries.length}</Text>
          </View>
        </View>
        {entries.length === 0 ? (
          <Text style={[styles.emptyText, settings.darkMode && styles.textMuted]}>
            No journal entries yet. Your life events will be recorded here!
          </Text>
        ) : (
          <View style={styles.compactEntries}>
            {filteredEntries.slice(0, 3).map(entry => {
              const categoryInfo = getCategoryInfo(entry.category);
              const CategoryIcon = categoryInfo.icon;
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.compactEntry, settings.darkMode && styles.compactEntryDark]}
                  onPress={() => setSelectedEntry(entry)}
                >
                  <View style={[styles.compactIconContainer, { backgroundColor: settings.darkMode ? `${categoryInfo.color}30` : categoryInfo.bgColor }]}>
                    <CategoryIcon size={14} color={categoryInfo.color} />
                  </View>
                  <View style={styles.compactEntryContent}>
                    <Text style={[styles.compactEntryTitle, settings.darkMode && styles.textDark]} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={[styles.compactEntryMeta, settings.darkMode && styles.textMuted]}>
                      Week {entry.atWeek}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
                </TouchableOpacity>
              );
            })}
            {entries.length > 3 && (
              <Text style={[styles.moreEntriesText, settings.darkMode && styles.textMuted]}>
                +{entries.length - 3} more entries
              </Text>
            )}
          </View>
        )}
        {renderEntryModal()}
      </View>
    );
  }

  // Render entry detail modal
  function renderEntryModal() {
    if (!selectedEntry) return null;

    const categoryInfo = getCategoryInfo((selectedEntry as any).category || 'other');
    const CategoryIcon = categoryInfo.icon;

    return (
      <Modal
        visible={!!selectedEntry}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
            {/* Header */}
            <LinearGradient
              colors={[categoryInfo.color, `${categoryInfo.color}CC`]}
              style={styles.modalHeader}
            >
              <View style={styles.modalHeaderContent}>
                <CategoryIcon size={28} color="#FFF" />
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>{selectedEntry.title}</Text>
                  <Text style={styles.modalMeta}>
                    {formatWeek(selectedEntry.atWeek || 0)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedEntry(null)}
              >
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            {/* Content */}
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalDetails, settings.darkMode && styles.textDark]}>
                {selectedEntry.details || 'No additional details.'}
              </Text>

              {/* Category Badge */}
              <View style={styles.modalCategorySection}>
                <Text style={[styles.modalSectionLabel, settings.darkMode && styles.textMuted]}>
                  Category
                </Text>
                <View style={[styles.categoryBadge, { backgroundColor: settings.darkMode ? `${categoryInfo.color}30` : categoryInfo.bgColor }]}>
                  <CategoryIcon size={14} color={categoryInfo.color} />
                  <Text style={[styles.categoryBadgeText, { color: categoryInfo.color }]}>
                    {categoryInfo.label}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // Full view
  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <BookOpen size={24} color={settings.darkMode ? '#A78BFA' : '#6366F1'} />
          <Text style={[styles.title, settings.darkMode && styles.textDark]}>
            Life Journal
          </Text>
        </View>
        <View style={styles.headerStats}>
          <Text style={[styles.statsText, settings.darkMode && styles.textMuted]}>
            {stats.total} entries
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, settings.darkMode && styles.searchContainerDark]}>
        <Search size={18} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        <TextInput
          style={[styles.searchInput, settings.darkMode && styles.searchInputDark]}
          placeholder="Search entries..."
          placeholderTextColor={settings.darkMode ? '#6B7280' : '#9CA3AF'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? '#6366F1' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
        </TouchableOpacity>
      </View>

      {/* Category Filters */}
      {showFilters && (
        <View style={styles.filtersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {CATEGORIES.map(category => {
              const CategoryIcon = category.icon;
              const isActive = selectedCategory === category.id;
              const count = category.id === 'all' ? stats.total : (stats.byCategory[category.id] || 0);

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    isActive && { backgroundColor: category.color },
                    !isActive && settings.darkMode && styles.categoryChipDark,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <CategoryIcon size={14} color={isActive ? '#FFF' : category.color} />
                  <Text style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                    !isActive && settings.darkMode && styles.textMuted,
                  ]}>
                    {category.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sort Control */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          >
            <Clock size={14} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.sortButtonText, settings.darkMode && styles.textMuted]}>
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </Text>
            {sortOrder === 'newest' ? (
              <ChevronDown size={14} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
            ) : (
              <ChevronUp size={14} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Entries List — C-1: Virtualized with FlatList to prevent OOM on large journals */}
      {filteredEntries.length === 0 ? (
        <View style={[styles.entriesContainer, styles.emptyState]}>
          <BookOpen size={48} color={settings.darkMode ? '#4B5563' : '#D1D5DB'} />
          <Text style={[styles.emptyStateTitle, settings.darkMode && styles.textDark]}>
            {searchQuery || selectedCategory !== 'all'
              ? 'No matching entries'
              : 'No journal entries yet'}
          </Text>
          <Text style={[styles.emptyStateText, settings.darkMode && styles.textMuted]}>
            {searchQuery || selectedCategory !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Your life events will be recorded here as you play!'}
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.entriesContainer}
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={7}
          renderItem={({ item: entry, index }) => {
            const categoryInfo = getCategoryInfo(entry.category);
            const CategoryIcon = categoryInfo.icon;

            // Check if we should show a date separator
            const prevEntry = index > 0 ? filteredEntries[index - 1] : null;
            const currentYear = Math.floor((entry.atWeek || 0) / WEEKS_PER_YEAR) + 1;
            const prevYear = prevEntry ? Math.floor((prevEntry.atWeek || 0) / WEEKS_PER_YEAR) + 1 : null;
            const showYearSeparator = currentYear !== prevYear;

            return (
              <View>
                {showYearSeparator && (
                  <View style={styles.yearSeparator}>
                    <View style={[styles.yearLine, settings.darkMode && styles.yearLineDark]} />
                    <Text style={[styles.yearText, settings.darkMode && styles.textMuted]}>
                      Year {currentYear}
                    </Text>
                    <View style={[styles.yearLine, settings.darkMode && styles.yearLineDark]} />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.entryCard, settings.darkMode && styles.entryCardDark]}
                  onPress={() => setSelectedEntry(entry)}
                >
                  {/* Timeline dot */}
                  <View style={styles.timelineDot}>
                    <View style={[styles.dot, { backgroundColor: categoryInfo.color }]} />
                    {index < filteredEntries.length - 1 && (
                      <View style={[styles.timelineLine, settings.darkMode && styles.timelineLineDark]} />
                    )}
                  </View>

                  {/* Entry content */}
                  <View style={styles.entryContent}>
                    <View style={styles.entryHeader}>
                      <View style={[styles.entryIconContainer, { backgroundColor: settings.darkMode ? `${categoryInfo.color}30` : categoryInfo.bgColor }]}>
                        <CategoryIcon size={16} color={categoryInfo.color} />
                      </View>
                      <View style={styles.entryHeaderText}>
                        <Text style={[styles.entryTitle, settings.darkMode && styles.textDark]}>
                          {entry.title}
                        </Text>
                        <Text style={[styles.entryMeta, settings.darkMode && styles.textMuted]}>
                          Week {entry.atWeek}
                        </Text>
                      </View>
                    </View>
                    {entry.details && (
                      <Text
                        style={[styles.entryDetails, settings.darkMode && styles.textMuted]}
                        numberOfLines={2}
                      >
                        {entry.details}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {renderEntryModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: scale(10),
  },
  headerStats: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  statsText: {
    fontSize: fontScale(12),
    color: '#6366F1',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: scale(16),
    marginBottom: scale(8),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
  },
  searchContainerDark: {
    backgroundColor: '#374151',
  },
  searchInput: {
    flex: 1,
    fontSize: fontScale(14),
    color: '#111827',
    marginLeft: scale(10),
    marginRight: scale(10),
  },
  searchInputDark: {
    color: '#F9FAFB',
  },
  filterButton: {
    padding: scale(4),
  },
  filtersSection: {
    paddingHorizontal: scale(16),
    marginBottom: scale(8),
  },
  categoriesScroll: {
    paddingVertical: scale(8),
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    marginRight: scale(8),
  },
  categoryChipDark: {
    backgroundColor: '#374151',
  },
  categoryChipText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#4B5563',
    marginLeft: scale(6),
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: scale(8),
  },
  sortButtonText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginHorizontal: scale(4),
  },
  entriesContainer: {
    flex: 1,
    paddingHorizontal: scale(16),
  },
  yearSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: scale(16),
  },
  yearLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  yearLineDark: {
    backgroundColor: '#374151',
  },
  yearText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    marginHorizontal: scale(12),
  },
  entryCard: {
    flexDirection: 'row',
    marginBottom: scale(4),
  },
  entryCardDark: {},
  timelineDot: {
    alignItems: 'center',
    marginRight: scale(12),
    width: scale(20),
  },
  dot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    marginTop: scale(6),
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: scale(4),
  },
  timelineLineDark: {
    backgroundColor: '#374151',
  },
  entryContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(8),
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryIconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  entryHeaderText: {
    flex: 1,
  },
  entryTitle: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#111827',
  },
  entryMeta: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(2),
  },
  entryDetails: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: scale(8),
    lineHeight: fontScale(18),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
  },
  emptyStateTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(16),
  },
  emptyStateText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(8),
    textAlign: 'center',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(16),
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  compactTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginLeft: scale(8),
    flex: 1,
  },
  compactBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  compactBadgeText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6366F1',
  },
  compactEntries: {},
  compactEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  compactEntryDark: {
    borderBottomColor: '#374151',
  },
  compactIconContainer: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(6),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  compactEntryContent: {
    flex: 1,
  },
  compactEntryTitle: {
    fontSize: fontScale(14),
    fontWeight: '500',
    color: '#111827',
  },
  compactEntryMeta: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
  },
  moreEntriesText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: scale(12),
  },
  emptyText: {
    fontSize: fontScale(13),
    color: '#6B7280',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalContent: {
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(16),
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalHeaderText: {
    marginLeft: scale(12),
    flex: 1,
  },
  modalTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalMeta: {
    fontSize: fontScale(13),
    color: 'rgba(255,255,255,0.8)',
    marginTop: scale(2),
  },
  modalCloseButton: {
    padding: scale(4),
  },
  modalBody: {
    padding: scale(16),
  },
  modalDetails: {
    fontSize: fontScale(15),
    color: '#374151',
    lineHeight: fontScale(22),
  },
  modalCategorySection: {
    marginTop: scale(20),
  },
  modalSectionLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(16),
  },
  categoryBadgeText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    marginLeft: scale(6),
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});

