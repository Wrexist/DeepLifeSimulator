/**
 * MessagesScreen - Pulse DMs.
 *
 * Wraps the existing DMSystem component (with its mystery-clue mechanics)
 * rather than rewriting 1,188 lines of working code. The wrapping lets us
 * apply Pulse styling at the edges without losing the underlying behavior.
 *
 * A later refactor can break DMSystem into Pulse/components/DMConversationRow
 * + DMBubble; for now wrap-and-ship.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import DMSystem from '@/components/mobile/social/DMSystem';

interface MessagesScreenProps {
  onBack: () => void;
}

export default function MessagesScreen({ onBack }: MessagesScreenProps) {
  return (
    <View style={styles.root}>
      <DMSystem onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
