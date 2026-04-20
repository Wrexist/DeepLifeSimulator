/**
 * BugReportSheet — Modal for composing and sending bug reports via email.
 * Extracted from SettingsModal to reduce its size.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Linking,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { responsivePadding, responsiveFontSize, responsiveBorderRadius, scale } from '@/utils/scaling';
import { SUPPORT_EMAIL } from '@/lib/config/appConfig';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function BugReportSheet({ visible, onClose }: Props) {
  const { gameState } = useGame();
  const [bugReportText, setBugReportText] = useState('');

  const handleBugReport = () => {
    if (!bugReportText.trim()) {
      Alert.alert('Empty Report', 'Please describe the bug you encountered.');
      return;
    }

    const subject = 'Bug Report - DeepLife Simulator';
    const body = `Bug Report:\n\n${bugReportText.trim()}\n\nGame Info:\nWeek: ${gameState.week}\nMoney: $${Math.floor(gameState.stats.money)}\nAge: ${Math.floor(gameState.date.age)}`;
    const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.openURL(emailUrl)
      .then(() => {
        setBugReportText('');
        onClose();
        Alert.alert(
          'Thank you!',
          'Your bug report has been prepared. Please send the email to help us improve the game.'
        );
      })
      .catch(() => {
        Alert.alert(
          'Error',
          `Could not open email app. Please email ${SUPPORT_EMAIL} directly.`
        );
      });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Bug</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#D1D5DB" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator
          >
            <Text style={styles.description}>
              Please describe the bug you encountered. Include steps to reproduce it if possible.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Describe the bug here..."
              placeholderTextColor="#9CA3AF"
              value={bugReportText}
              onChangeText={setBugReportText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={1000}
              editable
              autoFocus
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                onClose();
                setBugReportText('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, !bugReportText.trim() && styles.sendButtonDisabled]}
              onPress={handleBugReport}
              disabled={!bugReportText.trim()}
            >
              <Text
                style={[
                  styles.sendButtonText,
                  !bugReportText.trim() && styles.sendButtonTextDisabled,
                ]}
              >
                Send Report
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modal: {
    backgroundColor: '#1F2937',
    borderRadius: responsiveBorderRadius.xl,
    maxWidth: 450,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.large,
    paddingBottom: responsivePadding.medium,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.15)',
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  closeButton: {
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  scrollView: {
    maxHeight: 400,
  },
  content: {
    padding: responsivePadding.large,
  },
  description: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
    marginBottom: responsivePadding.medium,
    lineHeight: 22,
  },
  input: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsivePadding.medium,
    fontSize: responsiveFontSize.base,
    color: '#F9FAFB',
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: responsivePadding.large,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.15)',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  cancelButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  sendButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#3B82F6',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  sendButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sendButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
