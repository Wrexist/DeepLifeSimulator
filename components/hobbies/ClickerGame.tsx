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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Tap as fast as you can!</Text>
        <Text style={styles.score}>Score: {score}</Text>
        <TouchableOpacity style={styles.tap} onPress={() => setScore(s => s + 1)}>
          <Text style={styles.tapText}>Tap</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.end} onPress={endGame}>
          <Text style={styles.endText}>Finish</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#1F2937',
  },
  score: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#3B82F6',
  },
  tap: {
    padding: 40,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    marginBottom: 30,
    minWidth: 200,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  tapText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  end: {
    padding: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  endText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
