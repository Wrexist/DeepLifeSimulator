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
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { X, Mail, Share2, MessageCircle } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { responsivePadding, responsiveFontSize, responsiveBorderRadius, scale } from '@/utils/scaling';
import { SUPPORT_EMAIL } from '@/lib/config/appConfig';
import {
  emailDiagnosticReport,
  shareDiagnosticReport,
  openSupportDiscord,
} from '@/utils/diagnosticReport';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function BugReportSheet({ visible, onClose }: Props) {
  const { gameState } = useGame();
  const [bugReportText, setBugReportText] = useState('');

  // Every path here attaches a comprehensive diagnostic report (build marker,
  // game position, state validation, recent error logs) built from the LIVE
  // game state — so whatever reaches us is rich enough to debug right away.
  const reportOptions = () => ({
    gameState,
    userNote: bugReportText,
    source: 'Settings → Report a Problem',
  });

  const finishWith = (message: string) => {
    setBugReportText('');
    onClose();
    Alert.alert('Thank you!', message);
  };

  const handleEmail = () => {
    emailDiagnosticReport(reportOptions())
      .then((opened) => {
        if (opened) {
          finishWith('Your report (with diagnostic details) is ready in your email app — just hit send.');
        } else {
          Alert.alert(
            'Could not open email',
            `Please email ${SUPPORT_EMAIL} directly, or use Share / Discord instead.`
          );
        }
      })
      .catch(() => {
        Alert.alert('Error', `Could not open email app. Please email ${SUPPORT_EMAIL} directly.`);
      });
  };

  const handleShare = () => {
    shareDiagnosticReport(reportOptions())
      .then((shared) => {
        if (shared) {
          finishWith('Thanks for sending the report — it helps us fix issues faster!');
        }
      })
      .catch(() => { /* share failures are non-fatal */ });
  };

  const handleDiscord = () => {
    void openSupportDiscord();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Report a Problem</Text>
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
              Tell us what happened (steps to reproduce help a lot!). We'll attach
              diagnostic details automatically so we can fix it fast — no personal data.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="What happened? What were you doing?"
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
            <TouchableOpacity style={styles.discordButton} onPress={handleDiscord}>
              <MessageCircle size={18} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Discord</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Share2 size={18} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sendButton} onPress={handleEmail}>
              <Mail size={18} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Email</Text>
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
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
    }),
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
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.15)',
  },
  discordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#5865F2',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(107, 114, 128, 0.5)',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#3B82F6',
  },
  sendButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
