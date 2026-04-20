import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { AlertTriangle, X, RefreshCw } from 'lucide-react-native';

interface ErrorMessageProps {
  visible: boolean;
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  onDismiss?: () => void;
  onRetry?: () => void;
  autoDismiss?: boolean;
  dismissAfter?: number;
}

export default function ErrorMessage({
  visible,
  title,
  message,
  severity = 'error',
  onDismiss,
  onRetry,
  autoDismiss = false,
  dismissAfter = 5000,
}: ErrorMessageProps) {
  React.useEffect(() => {
    if (visible && autoDismiss && onDismiss) {
      const timer = setTimeout(onDismiss, dismissAfter);
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismiss, onDismiss, dismissAfter]);

  if (!visible) return null;

  const getSeverityColors = () => {
    switch (severity) {
      case 'info':
        return ['#3B82F6', '#60A5FA'];
      case 'warning':
        return ['#F59E0B', '#FBBF24'];
      case 'critical':
        return ['#DC2626', '#EF4444'];
      default: // error
        return ['#EF4444', '#F87171'];
    }
  };

  const getIcon = () => {
    switch (severity) {
      case 'info':
        return 'â„¹ï¸';
      case 'warning':
        return 'âš ï¸';
      case 'critical':
        return 'ðŸš¨';
      default:
        return 'âŒ';
    }
  };

  const colors = getSeverityColors();
  const icon = getIcon();

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -20 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.container}
    >
      <LinearGradient
        colors={colors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.icon}>{icon}</Text>
            <View style={styles.textContainer}>
              {title && <Text style={styles.title}>{title}</Text>}
              <Text style={styles.message}>{message}</Text>
            </View>
            {onDismiss && (
              <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          {(onRetry || severity === 'critical') && (
            <View style={styles.actions}>
              {onRetry && (
                <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                  <RefreshCw size={16} color="#fff" />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
              {severity === 'critical' && (
                <TouchableOpacity
                  onPress={() => Alert.alert('Contact Support', 'Please contact support for assistance.')}
                  style={styles.supportButton}
                >
                  <Text style={styles.supportText}>Get Help</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </LinearGradient>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 12,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    borderRadius: 12,
    padding: 16,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  supportButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  supportText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

