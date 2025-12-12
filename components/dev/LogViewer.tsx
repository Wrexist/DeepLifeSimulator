import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Share } from 'react-native';
import { OptimizedFlatList } from '../OptimizedFlatList';
import { remoteLogger, LogEntry } from '@/services/RemoteLoggingService';
import { X, Share2, Trash2, Search, Filter } from 'lucide-react-native';
import { logger } from '@/utils/logger';

interface LogViewerProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogViewer({ visible, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const unsubscribe = remoteLogger.subscribe((newLogs) => {
        setLogs(newLogs);
      });
      return unsubscribe;
    }
  }, [visible]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.context && JSON.stringify(log.context).toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesFilter = filterLevel ? log.level === filterLevel : true;

      return matchesSearch && matchesFilter;
    });
  }, [logs, searchQuery, filterLevel]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return '#9CA3AF';
      case 'INFO': return '#3B82F6';
      case 'WARN': return '#F59E0B';
      case 'ERROR': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const handleShare = async () => {
    try {
      const logText = filteredLogs.map(log => 
        `[${log.timestamp}] [${log.level}] ${log.message} ${log.context ? JSON.stringify(log.context) : ''}`
      ).join('\n');
      
      await Share.share({
        message: logText,
        title: 'App Logs',
      });
    } catch (error) {
      if (__DEV__) {
        logger.error('LogViewer error:', error);
      }
    }
  };

  const renderLogItem = useCallback(({ item }: { item: LogEntry }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Text style={[styles.logLevel, { color: getLevelColor(item.level) }]}>{item.level}</Text>
        <Text style={styles.logTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.context && (
        <Text style={styles.logContext}>{JSON.stringify(item.context, null, 2)}</Text>
      )}
      {item.error && (
        <Text style={styles.logError}>{JSON.stringify(item.error, null, 2)}</Text>
      )}
    </View>
  ), []);

  const keyExtractor = useCallback((item: LogEntry) => item.id, []);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Log Viewer</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
              <Share2 size={20} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remoteLogger.clearLogs()} style={styles.iconButton}>
              <Trash2 size={20} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <X size={24} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search logs..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <View style={styles.filterContainer}>
            {['DEBUG', 'INFO', 'WARN', 'ERROR'].map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.filterChip,
                  filterLevel === level && styles.activeFilterChip,
                  { borderColor: getLevelColor(level) }
                ]}
                onPress={() => setFilterLevel(filterLevel === level ? null : level)}
              >
                <Text style={[
                  styles.filterText,
                  filterLevel === level && styles.activeFilterText,
                  { color: filterLevel === level ? '#FFF' : getLevelColor(level) }
                ]}>{level}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <OptimizedFlatList
          data={filteredLogs}
          renderItem={renderLogItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  filterContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  activeFilterChip: {
    backgroundColor: '#3B82F6', // Will be overridden by inline style
    borderColor: 'transparent',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  logItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  logContext: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  logError: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'monospace',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});


