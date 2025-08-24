import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ImageBackground,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { ArrowLeft, User, Users, Dice } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function Customize() {
  const { state, setState } = useOnboarding();
  const router = useRouter();
  const [firstName, setFirstName] = useState(state.firstName);
  const [lastName, setLastName] = useState(state.lastName);
  const [sex, setSex] = useState(state.sex);
  const [sexuality, setSexuality] = useState(state.sexuality);

  const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Chris'];
  const LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Garcia', 'Williams'];

  const next = () => {
    let f = firstName.trim();
    let l = lastName.trim();
    let randomized = false;
    if (!f) {
      f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      randomized = true;
    }
    if (!l) {
      l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      randomized = true;
    }
    if (randomized) {
      Alert.alert('Randomized Name', `${f} ${l} was generated.`);
    }
    setState(prev => ({ ...prev, firstName: f, lastName: l, sex, sexuality }));
    router.push('/(onboarding)/Perks');
  };

  const SexButton = ({ value, icon, label }: { value: any; icon: any; label: string }) => (
    <TouchableOpacity style={styles.choiceWrapper} onPress={() => setSex(value)}>
      <LinearGradient
        colors={sex === value ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.choice}
      >
        <Image source={icon} style={styles.choiceIcon} />
        <Text style={styles.choiceText}>{label}</Text>
        {sex === value && (
          <View style={styles.selectedIndicator}>
            <View style={styles.selectedDot} />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const SexualityButton = ({
    value,
    icon,
    label,
  }: {
    value: any;
    icon: any;
    label: string;
  }) => (
    <TouchableOpacity style={styles.choiceWrapper} onPress={() => setSexuality(value)}>
      <LinearGradient
        colors={sexuality === value ? ['#10B981', '#059669'] : ['#374151', '#1F2937']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.choice}
      >
        <Image source={icon} style={styles.choiceIcon} />
        <Text style={styles.choiceText}>{label}</Text>
        {sexuality === value && (
          <View style={styles.selectedIndicator}>
            <View style={styles.selectedDot} />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <LinearGradient
              colors={['#374151', '#1F2937']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>Customize Your Character</Text>
          <View style={styles.placeholder} />
        </View>
        
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name</Text>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputWrapper}
                  >
                    <User size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      placeholder="Enter first name"
                      placeholderTextColor="#9CA3AF"
                      value={firstName}
                      onChangeText={setFirstName}
                      style={styles.input}
                    />
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputWrapper}
                  >
                    <User size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      placeholder="Enter last name"
                      placeholderTextColor="#9CA3AF"
                      value={lastName}
                      onChangeText={setLastName}
                      style={styles.input}
                    />
                  </LinearGradient>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sex</Text>
              <View style={styles.choiceRow}>
                <SexButton
                  value="male"
                  icon={require('@/assets/images/Sex/Male.png')}
                  label="Male"
                />
                <SexButton
                  value="female"
                  icon={require('@/assets/images/Sex/Female.png')}
                  label="Female"
                />
                <SexButton
                  value="random"
                  icon={require('@/assets/images/Sex/Dice.png')}
                  label="Random"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sexuality</Text>
              <View style={styles.choiceRow}>
                <SexualityButton
                  value="straight"
                  icon={require('@/assets/images/Sex/Straight.png')}
                  label="Straight"
                />
                <SexualityButton
                  value="gay"
                  icon={require('@/assets/images/Sex/Gay.png')}
                  label="Gay"
                />
                <SexualityButton
                  value="bi"
                  icon={require('@/assets/images/Sex/Bi.png')}
                  label="Bi"
                />
              </View>
            </View>

            <TouchableOpacity onPress={next} style={styles.nextButton}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextText}>Continue to Perks</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { 
    flex: 1, 
    width: '100%', 
    height: '100%' 
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  placeholder: {
    width: 48,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  inputContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  choiceWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  choice: {
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  choiceIcon: {
    width: 48,
    height: 48,
    marginBottom: 8,
    borderRadius: 24,
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  nextButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
