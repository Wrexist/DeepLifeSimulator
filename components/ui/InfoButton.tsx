import React, { useState } from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet, Modal, View, ScrollView } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { HelpCircle, X } from 'lucide-react-native';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';
const LinearGradient = Gradient;

interface InfoButtonProps {
  title: string;
  content: string | React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  darkMode?: boolean;
}

export default function InfoButton({ 
  title, 
  content, 
  size = 'medium', 
  darkMode = false 
}: InfoButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          buttonSize: 24,
          iconSize: 14,
          fontSize: responsiveFontSize.xs,
        };
      case 'large':
        return {
          buttonSize: 32,
          iconSize: 20,
          fontSize: responsiveFontSize.base,
        };
      default: // medium
        return {
          buttonSize: 28,
          iconSize: 16,
          fontSize: responsiveFontSize.sm,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.infoButton,
          {
            width: sizeStyles.buttonSize,
            height: sizeStyles.buttonSize,
          },
          darkMode && styles.infoButtonDark,
        ]}
        onPress={() => setShowModal(true)}
        accessibilityLabel={`Get help with ${title}`}
        accessibilityRole="button"
      >
        <HelpCircle 
          size={sizeStyles.iconSize} 
          color={darkMode ? '#94A3B8' : '#64748B'} 
        />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            darkMode && styles.modalContainerDark,
          ]}>
            <LinearGradient
              colors={darkMode ? ['#334155', '#1E293B'] : ['#F8FAFC', '#E2E8F0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <Text style={[
                styles.modalTitle,
                darkMode && styles.modalTitleDark,
              ]}>
                {title}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={darkMode ? '#CBD5E1' : '#64748B'} />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalContent}>
              <Text style={[
                styles.modalText,
                darkMode && styles.modalTextDark,
              ]}>
                {typeof content === 'string' ? content : content}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  infoButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
  infoButtonDark: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderColor: 'rgba(156, 163, 175, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '100%',
    maxHeight: '80%',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
    ...Platform.select({
      web: { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
    }),
    elevation: 10,
  },
  modalContainerDark: {
    backgroundColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    borderTopLeftRadius: responsiveBorderRadius.lg,
    borderTopRightRadius: responsiveBorderRadius.lg,
  },
  modalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  modalContent: {
    padding: responsiveSpacing.lg,
  },
  modalText: {
    fontSize: responsiveFontSize.base,
    lineHeight: responsiveFontSize.base * 1.5,
    color: '#475569',
  },
  modalTextDark: {
    color: '#CBD5E1',
  },
});

