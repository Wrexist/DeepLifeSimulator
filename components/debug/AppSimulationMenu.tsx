/**
 * Debug menu for running app simulations
 * Accessible from the AI Debug Menu
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import SimulationRunner from '@/components/simulation/SimulationRunner';
import { X } from 'lucide-react-native';
import { responsivePadding, responsiveFontSize } from '@/utils/scaling';

interface AppSimulationMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function AppSimulationMenu({ visible, onClose }: AppSimulationMenuProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>App Simulation</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <SimulationRunner
          onComplete={(results) => {
            console.log('[AppSimulation] Complete:', results.length, 'tests');
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
});

