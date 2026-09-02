import React, { useState, useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, Clock, AlertCircle, Save } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { safeSettings } from '@/utils/safeGameState';
import { saveQueue } from '@/utils/saveQueue';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { responsiveFontSize } from '@/utils/scaling';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from '@/utils/logger';
import { Z_INDEX } from '@/utils/zIndexConstants';

interface SaveStatus {
  status: 'saved' | 'saving' | 'pending' | 'error';
  lastSaveTime: number | null;
  queueLength: number;
}

interface AutoSaveIndicatorProps {
  position?: 'absolute' | 'relative';
}

export default function AutoSaveIndicator({ position = 'absolute' }: AutoSaveIndicatorProps) {
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual);
  const insets = useSafeAreaInsets();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    status: 'saved',
    lastSaveTime: null,
    queueLength: 0,
  });
  const [showDetails, setShowDetails] = useState(false);
  // NOISE: the indicator is transient - visible while a save is in flight (or
  // errored) plus a short "Saved" confirmation, then it disappears instead of
  // sitting on the HUD forever.
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // R6: guard against setState-after-unmount when the async AsyncStorage read
  // resolves after the component is gone (common on rapid tab switches).
  const isMountedRef = useRef(true);
  // PERF (2026-08-26): the poll used to read AsyncStorage on EVERY 2s tick for
  // as long as the component is mounted - a disk round-trip forever, for a
  // value the save queue itself just wrote. `saveQueue.getStatus()` now mirrors
  // `lastSaveTime` in memory, so AsyncStorage is read exactly once (to seed the
  // pre-session timestamp after a relaunch) and every subsequent tick is a
  // pure in-memory read.
  const seededLastSaveRef = useRef<number | null>(null);
  useEffect(() => {
    isMountedRef.current = true;
    const updateSaveStatus = () => {
      try {
        const queueStatus = saveQueue.getStatus();
        const lastSaveTime = queueStatus.lastSaveTime ?? seededLastSaveRef.current;
        const status: SaveStatus['status'] = queueStatus.isProcessing ? 'saving' : queueStatus.queueLength > 0 ? 'pending' : 'saved';
        // PERF: only commit when something actually changed - the old
        // unconditional setState re-rendered the HUD card every 2s forever.
        setSaveStatus(prev =>
          prev.status === status && prev.lastSaveTime === lastSaveTime && prev.queueLength === queueStatus.queueLength
            ? prev
            : { status, lastSaveTime, queueLength: queueStatus.queueLength }
        );
      } catch (error) {
        if (!isMountedRef.current) return;
        logger.error('Failed to update save status:', error);
        setSaveStatus(prev => (prev.status === 'error' ? prev : { ...prev, status: 'error' }));
      }
    };

    // One-time seed: the timestamp of the last save of the PREVIOUS session,
    // for the details popover before any save has happened in this one.
    AsyncStorage.getItem('lastSaveTime')
      .then((lastSaveStr) => {
        if (!isMountedRef.current || !lastSaveStr) return;
        const parsed = parseInt(lastSaveStr, 10);
        if (Number.isFinite(parsed)) {
          seededLastSaveRef.current = parsed;
          updateSaveStatus();
        }
      })
      .catch(() => {});

    updateSaveStatus();
    const interval = setInterval(updateSaveStatus, 2000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
    // P1-4: empty deps - `updateSaveStatus` reads from `saveQueue.getStatus()`
    // only, which does not depend on `gameState`. Re-installing the interval on
    // every state change tore down + recreated the timer on the hot path.
  }, []);

  // Transient visibility: appear on activity/error, linger briefly on "saved",
  // then hide (and collapse any open details) until the next save cycle.
  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (saveStatus.status !== 'saved') {
      setVisible(true);
      return undefined;
    }
    // Just returned to "saved": if we were showing activity, keep the
    // confirmation up for a moment; if we were already hidden, stay hidden.
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setShowDetails(false);
    }, 2500);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [saveStatus.status]);

  const formatLastSaveTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getStatusColor = (): string => {
    switch (saveStatus.status) {
      case 'saved':
        return '#10B981';
      case 'saving':
        return '#3B82F6';
      case 'pending':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getStatusIcon = () => {
    switch (saveStatus.status) {
      case 'saved':
        return <CheckCircle size={14} color={getStatusColor()} />;
      case 'saving':
        return <Save size={14} color={getStatusColor()} />;
      case 'pending':
        return <Clock size={14} color={getStatusColor()} />;
      case 'error':
        return <AlertCircle size={14} color={getStatusColor()} />;
      default:
        return <Clock size={14} color={getStatusColor()} />;
    }
  };

  const getStatusText = (): string => {
    switch (saveStatus.status) {
      case 'saved':
        return 'Saved';
      case 'saving':
        return 'Saving...';
      case 'pending':
        return `Pending (${saveStatus.queueLength})`;
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  // R2-A: AutoSaveIndicator mounts globally - a missing settings would crash
  // the entire layout. Use safe accessor with autoSave/darkMode defaults.
  const safeAutoSaveSettings = settings;
  if (!safeAutoSaveSettings.autoSave || !visible) {
    return null;
  }

  const containerStyle = position === 'relative'
    ? [styles.containerRelative, safeAutoSaveSettings.darkMode && styles.containerDark]
    : [styles.container, safeAutoSaveSettings.darkMode && styles.containerDark, { top: insets.top + 70 }];

  return (
    <TouchableOpacity
      onPress={() => setShowDetails(!showDetails)}
      style={containerStyle}
      activeOpacity={0.7}
    >
      <View style={styles.statusRow}>
        {getStatusIcon()}
        <Text
          style={[
            styles.statusText,
            settings.darkMode && styles.statusTextDark,
            { color: getStatusColor() },
          ]}
        >
          {getStatusText()}
        </Text>
      </View>

      {showDetails && (
        <View style={[
          styles.detailsContainer,
          settings.darkMode && styles.detailsContainerDark,
        ]}>
          <Text style={[
            styles.detailText,
            settings.darkMode && styles.detailTextDark,
          ]}>
            Last save: {formatLastSaveTime(saveStatus.lastSaveTime)}
          </Text>
          {saveStatus.queueLength > 0 && (
            <Text style={[
              styles.detailText,
              settings.darkMode && styles.detailTextDark,
            ]}>
              Queue: {saveStatus.queueLength} pending
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
    elevation: 3,
    zIndex: Z_INDEX.TOAST,
  },
  containerRelative: {
    // Inline chip: takes its own slot in the row it is rendered in, so it can
    // never sit on top of another element (it used to be absolute top-right).
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
    elevation: 4,
    zIndex: 10,
  },
  containerDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  statusTextDark: {
    color: '#FFFFFF',
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  detailsContainerDark: {
    borderTopColor: '#334155',
  },
  detailText: {
    fontSize: responsiveFontSize.xs,
    color: '#64748B',
    marginTop: 4,
  },
  detailTextDark: {
    color: '#94A3B8',
  },
});

