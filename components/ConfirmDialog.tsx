import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'warning' | 'danger' | 'success';
  showIcon?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  type = 'default',
  showIcon = false,
  destructive = false,
}: ConfirmDialogProps) {
  const getTypeColors = () => {
    switch (type) {
      case 'warning':
        return ['#F59E0B', '#FBBF24'];
      case 'danger':
        return ['#DC2626', '#EF4444'];
      case 'success':
        return ['#10B981', '#34D399'];
      default:
        return ['#3B82F6', '#60A5FA'];
    }
  };

  const getIcon = () => {
    if (!showIcon) return null;
    
    switch (type) {
      case 'warning':
        return <AlertTriangle size={24} color="#F59E0B" />;
      case 'danger':
        return <XCircle size={24} color="#DC2626" />;
      case 'success':
        return <CheckCircle size={24} color="#10B981" />;
      default:
        return <AlertTriangle size={24} color="#3B82F6" />;
    }
  };

  const colors = getTypeColors();
  const icon = getIcon();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.container}
        >
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.button}>
              <LinearGradient
                colors={['#D1D5DB', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonInner}
              >
                <Text style={styles.cancel}>{cancelText}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles.button}>
              <LinearGradient
                colors={destructive ? ['#DC2626', '#EF4444'] : colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonInner}
              >
                <Text style={[styles.confirm, destructive && styles.destructiveText]}>
                  {confirmText}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1F2937',
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
    color: '#4B5563',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 4,
  },
  buttonInner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancel: {
    color: '#6B7280',
    fontWeight: '600',
  },
  confirm: {
    color: '#fff',
    fontWeight: 'bold',
  },
  destructiveText: {
    color: '#fff',
  },
});
