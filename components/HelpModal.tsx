import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, Mail } from 'lucide-react-native';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

const helpContent = [
  {
    category: 'Gameplay Basics',
    items: [
      {
        question: 'How do I progress to the next week?',
        answer: 'Tap the green "Next Week" button on the top bar.',
      },
      {
        question: 'How do I earn money?',
        answer: 'Work jobs, run companies, and invest in assets to grow your wealth.',
      },
      {
        question: 'Can I play on mobile and web?',
        answer: 'Yes! DeepLife works on iOS, Android and the web with the same save file.',
      },
    ],
  },
  {
    category: 'Work & Careers',
    items: [
      {
        question: 'How do I get a job?',
        answer: 'Visit the work app and apply for careers that match your education level.',
      },
      {
        question: 'How do promotions work?',
        answer: 'Each week you have a chance for promotion. Mindset perks and high stats improve the odds.',
      },
      {
        question: 'Can I switch careers?',
        answer: 'Yes, resign from your current job and apply for a new career at any time.',
      },
    ],
  },
  {
    category: 'Apps',
    items: [
      {
        question: 'What is the Shop?',
        answer: 'The shop lets you buy items that boost your stats.',
      },
      {
        question: 'How do I unlock new apps?',
        answer: 'New apps appear as you advance and meet requirements.',
      },
    ],
  },
  {
    category: 'Onion Browser & Hacking',
    items: [
      {
        question: 'How do I access the Onion browser?',
        answer: 'Buy a computer and the Onion app to browse the dark web.',
      },
      {
        question: 'What do hacks do?',
        answer: 'Running hacks can earn untraceable money but carries a risk of being caught.',
      },
      {
        question: 'How do I reduce hack risk?',
        answer: 'Purchase dark web items like VPNs and USB exploits to lower your trace chance.',
      },
    ],
  },
  {
    category: 'Crypto Mining',
    items: [
      {
        question: 'How do I start mining crypto?',
        answer: 'Open the Bitcoin Mining app on your computer and buy your first miner.',
      },
      {
        question: 'Which miner is best?',
        answer: 'More expensive miners earn faster but also use more power. Upgrade as your budget grows.',
      },
      {
        question: 'Can I trade cryptocurrency?',
        answer: 'Yes, use the Crypto Market tab in the mining app to buy, sell or swap coins.',
      },
    ],
  },
  {
    category: 'Stats',
    items: [
      {
        question: 'Why is health important?',
        answer: 'Keeping your health high lets you live longer and avoid negative events.',
      },
      {
        question: 'How do I increase happiness?',
        answer: 'Spend money on fun activities and maintain relationships.',
      },
    ],
  },
  {
    category: 'Contact & Support',
    items: [
      {
        question: 'How do I contact support?',
        answer: 'Tap the "Contact Support" button below to send us an email.',
      },
    ],
  },
];

export default function HelpModal({ visible, onClose }: HelpModalProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = helpContent
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  const toggleItem = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const overlayStyle = [styles.overlay, settings.darkMode && styles.overlayDark];
  const modalStyle = [styles.modal, settings.darkMode && styles.modalDark];
  const itemTextStyle = [styles.itemText, settings.darkMode && styles.itemTextDark];
  const answerStyle = [styles.answer, settings.darkMode && styles.answerDark];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={overlayStyle}>
        <View style={modalStyle}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Help</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.searchInput, settings.darkMode && styles.searchInputDark]}
            placeholder="Search..."
            placeholderTextColor={settings.darkMode ? '#9CA3AF' : '#6B7280'}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {filtered.map((section) => (
              <View key={section.category} style={styles.section}>
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  {section.category}
                </Text>
                {section.items.map((item) => {
                  const key = section.category + item.question;
                  return (
                    <View key={key} style={styles.item}>
                      <TouchableOpacity onPress={() => toggleItem(key)}>
                        <Text style={itemTextStyle}>{item.question}</Text>
                      </TouchableOpacity>
                      {expanded[key] && <Text style={answerStyle}>{item.answer}</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.contactButton, settings.darkMode && styles.contactButtonDark]}
            onPress={() => {
              const subject = 'DeepLife Simulator - Support Request';
              const body = `Hello,\n\nI need help with DeepLife Simulator.\n\nGame Info:\nWeek: ${gameState.week}\nMoney: $${Math.floor(gameState.stats.money)}\nAge: ${Math.floor(gameState.date.age)}\n\nPlease describe your issue here:`;
              const emailUrl = `mailto:deeplifesimulator@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              
              Linking.openURL(emailUrl).then(() => {
                Alert.alert('Email Prepared', 'Your email app will open with a pre-filled message. Please send the email to contact our support team.');
              }).catch(() => {
                Alert.alert('Error', 'Could not open email app. Please email deeplifesimulator@gmail.com directly.');
              });
            }}
          >
            <Mail size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayDark: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 16,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    color: '#111827',
  },
  searchInputDark: {
    borderColor: '#374151',
    color: '#F9FAFB',
  },
  content: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  item: {
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#1F2937',
  },
  itemTextDark: {
    color: '#F9FAFB',
  },
  answer: {
    marginTop: 4,
    fontSize: 13,
    color: '#4B5563',
  },
  answerDark: {
    color: '#D1D5DB',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  contactButtonDark: {
    backgroundColor: '#1D4ED8',
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
