import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';

interface Props {
  visible: boolean;
  hobbyId: string;
  onClose: () => void;
}

export default function ClickerGame({ visible, hobbyId, onClose }: Props) {
  const { completeMinigame } = useGame();
  const [score, setScore] = useState(0);

  const endGame = () => {
    completeMinigame(hobbyId, score);
    setScore(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Tap as fast as you can!</Text>
        <Text style={styles.score}>Score: {score}</Text>
        <TouchableOpacity style={styles.tap} onPress={() => setScore(s => s + 1)}>
          <Text>Tap</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.end} onPress={endGame}>
          <Text style={styles.endText}>Finish</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, marginBottom: 20 },
  score: { fontSize: 18, marginBottom: 20 },
  tap: { padding: 20, backgroundColor: '#E5E7EB', borderRadius: 8, marginBottom: 20 },
  end: { padding: 10, backgroundColor: '#10B981', borderRadius: 8 },
  endText: { color: '#fff', fontWeight: '600' },
});
