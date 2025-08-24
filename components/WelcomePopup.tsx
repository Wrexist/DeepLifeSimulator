import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { Heart, DollarSign, Star } from 'lucide-react-native';

export default function WelcomePopup() {
  const { gameState, dismissWelcomePopup } = useGame();
  const { settings } = gameState;

  const steps = [
    {
      icon: Heart,
      title: 'Welcome to DeepLife Simulator',
      message:
        "Welcome to your new life! Grow from humble beginnings and shape your destiny.",
    },
    {
      icon: DollarSign,
      title: 'Build Your Wealth',
      message:
        'Take on jobs, manage expenses and invest wisely to create your fortune.',
    },
    {
      icon: Star,
      title: 'Achieve Greatness',
      message:
        'Unlock perks and accomplishments as you make impactful choices.',
    },
  ];

  const [step, setStep] = useState(0);
  const StepIcon = steps[step].icon;

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      dismissWelcomePopup();
    }
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={dismissWelcomePopup}
    >
      <View style={styles.overlay}>
        <View style={[styles.popup, settings.darkMode && styles.popupDark]}>
          <StepIcon size={48} color="#EF4444" style={styles.icon} />
          <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
            {steps[step].title}
          </Text>
          <Text style={[styles.message, settings.darkMode && styles.messageDark]}>
            {steps[step].message}
          </Text>
          <TouchableOpacity style={styles.button} onPress={next} activeOpacity={0.8}>
            <Text style={styles.buttonText}>
              {step < steps.length - 1 ? 'Next' : 'Begin Your Adventure'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skip} onPress={dismissWelcomePopup}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  popupDark: {
    backgroundColor: '#1F2937',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  messageDark: {
    color: '#D1D5DB',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skip: {
    marginTop: 12,
  },
  skipText: {
    color: '#6B7280',
    fontSize: 14,
  },
});