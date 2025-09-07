import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Image, Animated } from 'react-native';
import { Platform } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Heart, X, Settings, DollarSign, Star, MapPin, MessageCircle } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

interface HinderAppProps {
  onBack: () => void;
}

interface Profile {
  id: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  image: string;
  distance: number;
  wealth: 'poor' | 'average' | 'wealthy' | 'millionaire';
  income: number;
  personality: string;
  gender: 'male' | 'female';
  seekingGender: 'male' | 'female';
  photos: string[];
  job: string;
  education: string;
}

const mockProfiles: Profile[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    age: 24,
    bio: 'Love hiking and coffee ☕️ Looking for someone who shares my passion for adventure and good conversation.',
    interests: ['Hiking', 'Coffee', 'Travel', 'Photography'],
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
    distance: 2,
    wealth: 'average',
    income: 45000,
    personality: 'adventurous',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
    ],
    job: 'Marketing Manager',
    education: 'Bachelor\'s Degree',
  },
  {
    id: '2',
    name: 'Emma Davis',
    age: 26,
    bio: 'Artist by day, dreamer by night 🎨 I create beauty and seek someone who appreciates the finer things in life.',
    interests: ['Art', 'Music', 'Photography', 'Wine'],
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    distance: 5,
    wealth: 'wealthy',
    income: 85000,
    personality: 'creative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    ],
    job: 'Art Director',
    education: 'Master\'s Degree',
  },
  {
    id: '3',
    name: 'Jessica Kim',
    age: 23,
    bio: 'Fitness enthusiast and foodie 💪 Looking for someone who values health and can cook a mean pasta!',
    interests: ['Fitness', 'Cooking', 'Yoga', 'Healthy Living'],
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    distance: 3,
    wealth: 'average',
    income: 38000,
    personality: 'active',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
    ],
    job: 'Personal Trainer',
    education: 'Bachelor\'s Degree',
  },
  {
    id: '4',
    name: 'Sophia Rodriguez',
    age: 28,
    bio: 'Tech entrepreneur and coffee addict ☕️ Building the future while looking for someone to share it with.',
    interests: ['Technology', 'Coffee', 'Startups', 'Travel'],
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    distance: 1,
    wealth: 'millionaire',
    income: 250000,
    personality: 'ambitious',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    ],
    job: 'CEO & Founder',
    education: 'MBA',
  },
  {
    id: '5',
    name: 'Isabella Chen',
    age: 25,
    bio: 'Doctor by profession, foodie by passion 🏥 Looking for someone who can keep up with my busy schedule.',
    interests: ['Medicine', 'Cooking', 'Travel', 'Reading'],
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
    distance: 4,
    wealth: 'wealthy',
    income: 120000,
    personality: 'intelligent',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    ],
    job: 'Medical Doctor',
    education: 'Medical Degree',
  },
  {
    id: '6',
    name: 'Olivia Thompson',
    age: 22,
    bio: 'Student and aspiring writer 📚 Love books, poetry, and deep conversations under the stars.',
    interests: ['Reading', 'Writing', 'Poetry', 'Astronomy'],
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    distance: 6,
    wealth: 'poor',
    income: 15000,
    personality: 'romantic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
    ],
    job: 'Student',
    education: 'Bachelor\'s Degree (In Progress)',
  },
  {
    id: '7',
    name: 'Ava Martinez',
    age: 27,
    bio: 'Chef and food blogger 🍳 Passionate about creating delicious meals and sharing culinary adventures.',
    interests: ['Cooking', 'Food', 'Travel', 'Photography'],
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
    distance: 3,
    wealth: 'average',
    income: 52000,
    personality: 'passionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
    ],
    job: 'Executive Chef',
    education: 'Culinary Arts Degree',
  },
  {
    id: '8',
    name: 'Mia Wilson',
    age: 24,
    bio: 'Fashion designer and style enthusiast 👗 Creating beautiful designs and helping people feel confident.',
    interests: ['Fashion', 'Design', 'Art', 'Shopping'],
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    distance: 4,
    wealth: 'wealthy',
    income: 78000,
    personality: 'stylish',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
    ],
    job: 'Fashion Designer',
    education: 'Fashion Design Degree',
  },
  {
    id: '9',
    name: 'Luna Anderson',
    age: 26,
    bio: 'Environmental scientist and nature lover 🌱 Working to protect our planet while exploring its beauty.',
    interests: ['Environment', 'Nature', 'Hiking', 'Science'],
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    distance: 2,
    wealth: 'average',
    income: 48000,
    personality: 'environmentalist',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
    ],
    job: 'Environmental Scientist',
    education: 'Master\'s in Environmental Science',
  },
  {
    id: '10',
    name: 'Zoe Taylor',
    age: 25,
    bio: 'Musician and songwriter 🎵 Creating melodies that touch hearts and tell stories through music.',
    interests: ['Music', 'Songwriting', 'Guitar', 'Concerts'],
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
    distance: 5,
    wealth: 'poor',
    income: 28000,
    personality: 'artistic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    ],
    job: 'Musician',
    education: 'Music Degree',
  },
  {
    id: '11',
    name: 'Chloe Brown',
    age: 29,
    bio: 'Lawyer and justice advocate ⚖️ Fighting for what\'s right and helping people navigate the legal system.',
    interests: ['Law', 'Justice', 'Reading', 'Debate'],
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    distance: 1,
    wealth: 'wealthy',
    income: 95000,
    personality: 'determined',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    ],
    job: 'Attorney',
    education: 'Law Degree',
  },
  {
    id: '12',
    name: 'Grace Lee',
    age: 23,
    bio: 'Software engineer and tech enthusiast 💻 Building the future one line of code at a time.',
    interests: ['Technology', 'Coding', 'Gaming', 'AI'],
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
    distance: 3,
    wealth: 'average',
    income: 65000,
    personality: 'analytical',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
    ],
    job: 'Software Engineer',
    education: 'Computer Science Degree',
  },
];

export default function HinderApp({ onBack }: HinderAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Profile | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const currentProfile = mockProfiles[currentProfileIndex];

  const getWealthIcon = (wealth: string) => {
    switch (wealth) {
      case 'poor': return '💸';
      case 'average': return '💰';
      case 'wealthy': return '💎';
      case 'millionaire': return '👑';
      default: return '💰';
    }
  };

  const getWealthColor = (wealth: string) => {
    switch (wealth) {
      case 'poor': return '#EF4444';
      case 'average': return '#10B981';
      case 'wealthy': return '#3B82F6';
      case 'millionaire': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const handleLike = useCallback(() => {
    if (Math.random() < 0.4) { // 40% match rate
      setCurrentMatch(currentProfile);
      setShowMatchModal(true);
      setMatches(prev => [...prev, currentProfile]);
    }
    nextProfile();
  }, [currentProfile]);

  const handlePass = useCallback(() => {
    nextProfile();
  }, []);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const swipeDistance = 300;
    const targetX = direction === 'right' ? swipeDistance : -swipeDistance;
    
    const parallelAnimation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: targetX,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(rotate, {
        toValue: direction === 'right' ? 0.3 : -0.3,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    
    parallelAnimation.start(() => {
      if (direction === 'right') {
        handleLike();
      } else {
        handlePass();
      }
      // Reset animation values
      translateX.setValue(0);
      translateY.setValue(0);
      rotate.setValue(0);
      scale.setValue(1);
    });
  }, [handleLike, handlePass]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: Platform.OS !== 'web' }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      
      if (translationX > 100) {
        handleSwipe('right');
      } else if (translationX < -100) {
        handleSwipe('left');
      } else {
        // Return to center
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(rotate, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }
    }
  };

  const nextProfile = () => {
    setCurrentProfileIndex(prev => (prev + 1) % mockProfiles.length);
    setCurrentPhotoIndex(0);
  };

  const resetProfiles = () => {
    setCurrentProfileIndex(0);
    setMatches([]);
    setCurrentPhotoIndex(0);
  };

  const handleConfirmMatch = useCallback(() => {
    // Handle confirm match
    if (currentMatch) {
      // Processing current match
      
      // Check if player already has a partner
      const existingPartner = gameState.relationships?.find(r => r.type === 'partner');
      
      if (existingPartner) {
        Alert.alert(
          'Already Have a Partner',
          `You already have a partner (${existingPartner.name}). You can only have one partner at a time.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowMatchModal(false);
                setCurrentMatch(null);
              }
            }
          ]
        );
        return;
      }

      // Add to contacts as partner with 50 relationship score
      // Convert annual income to weekly income (divide by 52 weeks)
      const weeklyIncome = Math.floor(currentMatch.income / 52);
      
      const newPartner = {
        id: `partner_${currentMatch.id}`,
        name: currentMatch.name,
        type: 'partner' as const,
        relationshipScore: 50,
        personality: currentMatch.personality,
        gender: currentMatch.gender,
        age: currentMatch.age,
        income: weeklyIncome,
        actions: {},
        weeksAtZero: 0,
      };

      // Creating new partner

      setGameState(prev => {
        const updatedState = {
          ...prev,
          relationships: [...(prev.relationships || []), newPartner],
        };
        // Adding partner to relationships
        return updatedState;
      });
      
      // Saving game after partner creation
      saveGame();

      // Close modal immediately
      setShowMatchModal(false);
      setCurrentMatch(null);
      
      // Show small "Added" popup after a short delay
      setTimeout(() => {
        Alert.alert(
          'Added! 💕',
          `${currentMatch.name} has been added to your contacts!`,
          [{ text: 'OK' }]
        );
      }, 100);
    } else {
      // No current match to confirm
    }
  }, [currentMatch, setGameState, saveGame, gameState.relationships]);

  const nextPhoto = () => {
    if (currentProfile && currentPhotoIndex < currentProfile.photos.length - 1) {
      setCurrentPhotoIndex(prev => prev + 1);
    }
  };

  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(prev => prev - 1);
    }
  };

  const rotateInterpolate = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-30deg', '0deg', '30deg'],
  });

  // Check if player already has a partner
  const existingPartner = gameState.relationships?.find(r => r.type === 'partner');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hinder</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
          <Settings size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {existingPartner ? (
          // Locked state when already have a partner
          <View style={styles.lockedContainer}>
            <View style={styles.lockedIcon}>
              <Text style={styles.lockedIconText}>🔒</Text>
            </View>
            <Text style={styles.lockedTitle}>Already Have a Partner</Text>
            <Text style={styles.lockedMessage}>
              You're currently in a relationship with {existingPartner.name}. 
              You can only have one partner at a time.
            </Text>
            <Text style={styles.lockedSubtext}>
              Visit your Contacts app to manage your relationship.
            </Text>
          </View>
        ) : currentProfile && (
          <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
            <Animated.View
              style={[
                styles.profileCard,
                {
                  transform: [
                    { translateX },
                    { translateY },
                    { rotate: rotateInterpolate },
                    { scale },
                  ],
                },
              ]}
            >
              <View style={styles.profileImageContainer}>
                <Image source={{ uri: currentProfile.photos[currentPhotoIndex] }} style={styles.profileImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  style={styles.imageGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                
                {/* Photo Navigation */}
                <View style={styles.photoNavigation}>
                  <TouchableOpacity style={styles.photoNavButton} onPress={prevPhoto} disabled={currentPhotoIndex === 0}>
                    <Text style={[styles.photoNavText, currentPhotoIndex === 0 && styles.photoNavTextDisabled]}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoNavButton} onPress={nextPhoto} disabled={currentPhotoIndex === currentProfile.photos.length - 1}>
                    <Text style={[styles.photoNavText, currentPhotoIndex === currentProfile.photos.length - 1 && styles.photoNavTextDisabled]}>›</Text>
                  </TouchableOpacity>
                </View>

                {/* Photo Indicators */}
                <View style={styles.photoIndicators}>
                  {currentProfile.photos.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.photoIndicator,
                        index === currentPhotoIndex && styles.photoIndicatorActive,
                      ]}
                    />
                  ))}
                </View>

                {/* Wealth Badge */}
                <View style={[styles.wealthBadge, { backgroundColor: getWealthColor(currentProfile.wealth) }]}>
                  <Text style={styles.wealthIcon}>{getWealthIcon(currentProfile.wealth)}</Text>
                  <Text style={styles.wealthText}>{currentProfile.wealth.charAt(0).toUpperCase() + currentProfile.wealth.slice(1)}</Text>
                </View>
              </View>
              
              <View style={styles.profileInfo}>
                <View style={styles.profileHeader}>
                  <View style={styles.profileNameContainer}>
                    <Text style={styles.profileName}>{currentProfile.name}, {currentProfile.age}</Text>
                    <View style={styles.profileStats}>
                      <MapPin size={16} color="#9FA4B3" />
                      <Text style={styles.distanceText}>{currentProfile.distance} miles away</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.profileDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>💼 Job:</Text>
                    <Text style={styles.detailValue}>{currentProfile.job}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🎓 Education:</Text>
                    <Text style={styles.detailValue}>{currentProfile.education}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>💰 Income:</Text>
                    <Text style={[styles.detailValue, { color: '#9FA4B3' }]}>
                      Hidden
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🌟 Personality:</Text>
                    <Text style={styles.detailValue}>{currentProfile.personality.charAt(0).toUpperCase() + currentProfile.personality.slice(1)}</Text>
                  </View>
                </View>

                <Text style={styles.profileBio}>{currentProfile.bio}</Text>
                
                <View style={styles.interestsContainer}>
                  {currentProfile.interests.map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          </PanGestureHandler>
        )}



        {/* Matches Section */}
        {matches.length > 0 && (
          <View style={styles.matchesSection}>
            <Text style={styles.matchesTitle}>Your Matches</Text>
            <View style={styles.matchesList}>
              {matches.map((match, index) => (
                <View key={index} style={styles.matchItem}>
                  <Image source={{ uri: match.image }} style={styles.matchImage} />
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchName}>{match.name}, {match.age}</Text>
                    <Text style={styles.matchJob}>{match.job}</Text>
                    <View style={styles.matchWealth}>
                      <Text style={styles.wealthIcon}>{getWealthIcon(match.wealth)}</Text>
                      <Text style={styles.matchWealthText}>{match.wealth}</Text>
                    </View>
                  </View>
                                     <View style={styles.matchIncome}>
                     <DollarSign size={16} color="#9FA4B3" />
                     <Text style={[styles.matchIncomeText, { color: '#9FA4B3' }]}>Hidden</Text>
                   </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Floating Action Buttons - Only show when no partner */}
      {!existingPartner && (
        <View style={styles.floatingActionButtons}>
          <TouchableOpacity style={styles.passButton} onPress={handlePass}>
            <X size={32} color="#EF4444" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
            <Heart size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Match Modal */}
      <Modal visible={showMatchModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>It's a Match! 💕</Text>
            
            {currentMatch && (
              <View style={styles.matchContent}>
                <Image source={{ uri: currentMatch.image }} style={styles.matchModalImage} />
                <Text style={styles.matchModalName}>{currentMatch.name}, {currentMatch.age}</Text>
                <Text style={styles.matchModalJob}>{currentMatch.job}</Text>
                
                                 <View style={styles.matchModalDetails}>
                   <View style={styles.matchModalDetail}>
                     <DollarSign size={20} color="#9FA4B3" />
                     <Text style={[styles.matchModalDetailText, { color: '#9FA4B3' }]}>
                       Hidden
                     </Text>
                   </View>
                   <View style={styles.matchModalDetail}>
                     <Text style={styles.wealthIcon}>{getWealthIcon(currentMatch.wealth)}</Text>
                     <Text style={styles.matchModalDetailText}>{currentMatch.wealth}</Text>
                   </View>
                 </View>
                
                                 <Text style={styles.matchModalMessage}>
                   {currentMatch.name} will be added to your contacts as a partner with 50 relationship points.
                 </Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowMatchModal(false);
                  setCurrentMatch(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmMatch}
              >
                <LinearGradient colors={['#16A34A', '#4ADE80']} style={styles.confirmButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.confirmButtonText}>Confirm Match</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hinder Settings</Text>
            
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                resetProfiles();
                setShowSettings(false);
              }}
            >
              <Text style={styles.settingsButtonText}>Reset Profiles</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.settingsButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#11131A',
    borderBottomColor: '#1F2230',
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 120, // Add space for floating buttons
  },
  profileCard: {
    backgroundColor: '#0F1220',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderColor: '#23283B',
    borderWidth: 0.5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  profileImageContainer: {
    height: 400,
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  photoNavigation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  photoNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  photoNavText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  photoNavTextDisabled: {
    color: '#6B7280',
  },
  photoIndicators: {
    position: 'absolute',
    top: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  photoIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  photoIndicatorActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  wealthBadge: {
    position: 'absolute',
    top: 30,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  wealthIcon: {
    fontSize: 18,
  },
  wealthText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  profileInfo: {
    padding: 24,
    minHeight: 280, // Ensure minimum height for content
  },
  profileHeader: {
    marginBottom: 20,
  },
  profileNameContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    color: '#9FA4B3',
    fontSize: 14,
  },
  profileDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  detailLabel: {
    color: '#9FA4B3',
    fontSize: 15,
    fontWeight: '600',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  profileBio: {
    color: '#9FA4B3',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 20,
    marginTop: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  interestTag: {
    backgroundColor: '#1A1D29',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderColor: '#23283B',
    borderWidth: 1,
    marginBottom: 4,
  },
  interestText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  floatingActionButtons: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    paddingHorizontal: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  passButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#DC2626',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  matchesSection: {
    backgroundColor: '#0F1220',
    borderRadius: 12,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  matchesTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  matchesList: {
    gap: 12,
  },
  matchItem: {
    backgroundColor: '#1A1D29',
    padding: 12,
    borderRadius: 8,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchJob: {
    color: '#9FA4B3',
    fontSize: 14,
    marginBottom: 4,
  },
  matchWealth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchWealthText: {
    color: '#9FA4B3',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  matchIncome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchIncomeText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#121527',
    borderRadius: 16,
    padding: 20,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  matchContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  matchModalImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  matchModalName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  matchModalJob: {
    color: '#9FA4B3',
    fontSize: 16,
    marginBottom: 12,
  },
  matchModalDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  matchModalDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchModalDetailText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  matchModalMessage: {
    color: '#9FA4B3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    marginBottom: 12,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockedIconText: {
    fontSize: 32,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  lockedMessage: {
    fontSize: 16,
    color: '#9FA4B3',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  lockedSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});