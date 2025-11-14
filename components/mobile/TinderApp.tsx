import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Image, Animated, Dimensions, ScrollView } from 'react-native';
import { Platform } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { ArrowLeft, Heart, X, Settings, DollarSign, Star, MapPin, MessageCircle, Sparkles, Users, Filter, Crown, Zap, ChevronDown, Clock, TrendingUp } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useFeedback } from '@/utils/feedbackSystem';

interface DatingAppProps {
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
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 45000,
    personality: 'adventurous',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'wealthy',
    income: 85000,
    personality: 'creative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 38000,
    personality: 'active',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'millionaire',
    income: 250000,
    personality: 'ambitious',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 120000,
    personality: 'intelligent',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 6,
    wealth: 'poor',
    income: 15000,
    personality: 'romantic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 52000,
    personality: 'passionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 78000,
    personality: 'stylish',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 48000,
    personality: 'environmentalist',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'poor',
    income: 28000,
    personality: 'artistic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'wealthy',
    income: 95000,
    personality: 'determined',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=600&fit=crop&crop=face',
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
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 65000,
    personality: 'analytical',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Software Engineer',
    education: 'Computer Science Degree',
  },
  {
    id: '13',
    name: 'Amelia Foster',
    age: 27,
    bio: 'Yoga instructor and wellness coach 🧘‍♀️ Helping people find balance in mind, body, and soul.',
    interests: ['Yoga', 'Meditation', 'Wellness', 'Nature'],
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 42000,
    personality: 'zen',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Yoga Instructor',
    education: 'Wellness Certification',
  },
  {
    id: '14',
    name: 'Harper Mitchell',
    age: 25,
    bio: 'Graphic designer and digital artist 🎨 Creating visual stories that inspire and connect people.',
    interests: ['Design', 'Art', 'Photography', 'Creativity'],
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 72000,
    personality: 'creative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Graphic Designer',
    education: 'Design Degree',
  },
  {
    id: '15',
    name: 'Scarlett Bennett',
    age: 29,
    bio: 'Investment banker and finance expert 💼 Making money moves and building wealth for the future.',
    interests: ['Finance', 'Investing', 'Travel', 'Wine'],
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'millionaire',
    income: 180000,
    personality: 'ambitious',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Investment Banker',
    education: 'MBA Finance',
  },
  {
    id: '16',
    name: 'Lily Chen',
    age: 24,
    bio: 'Elementary school teacher and children\'s book author 📚 Nurturing young minds and creating magical stories.',
    interests: ['Teaching', 'Writing', 'Children', 'Books'],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'average',
    income: 38000,
    personality: 'nurturing',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Elementary Teacher',
    education: 'Education Degree',
  },
  {
    id: '17',
    name: 'Natalie Rodriguez',
    age: 26,
    bio: 'Marine biologist and ocean conservationist 🌊 Protecting our oceans and discovering marine life secrets.',
    interests: ['Marine Biology', 'Conservation', 'Diving', 'Science'],
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 55000,
    personality: 'passionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Marine Biologist',
    education: 'Marine Biology PhD',
  },
  {
    id: '18',
    name: 'Victoria Kim',
    age: 28,
    bio: 'Fashion model and social media influencer 📸 Living life in the spotlight and inspiring others to be confident.',
    interests: ['Fashion', 'Modeling', 'Social Media', 'Travel'],
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 95000,
    personality: 'confident',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Fashion Model',
    education: 'Fashion Design',
  },
  {
    id: '19',
    name: 'Penelope Davis',
    age: 22,
    bio: 'College student studying psychology 🧠 Understanding human behavior and helping people overcome challenges.',
    interests: ['Psychology', 'Reading', 'Coffee', 'Therapy'],
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&h=600&fit=crop&crop=face',
    distance: 6,
    wealth: 'poor',
    income: 12000,
    personality: 'empathetic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Psychology Student',
    education: 'Psychology Degree (In Progress)',
  },
  {
    id: '20',
    name: 'Ruby Thompson',
    age: 30,
    bio: 'Veterinarian and animal lover 🐕 Healing furry friends and advocating for animal welfare.',
    interests: ['Animals', 'Veterinary', 'Nature', 'Hiking'],
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 88000,
    personality: 'compassionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Veterinarian',
    education: 'Veterinary Medicine Degree',
  },
  {
    id: '21',
    name: 'Stella Wilson',
    age: 25,
    bio: 'Event planner and party coordinator 🎉 Creating unforgettable experiences and bringing people together.',
    interests: ['Events', 'Planning', 'Socializing', 'Creativity'],
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 48000,
    personality: 'social',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Event Planner',
    education: 'Event Management',
  },
  {
    id: '22',
    name: 'Hazel Anderson',
    age: 27,
    bio: 'Architect and urban designer 🏗️ Designing sustainable cities and beautiful spaces for the future.',
    interests: ['Architecture', 'Design', 'Sustainability', 'Travel'],
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 78000,
    personality: 'visionary',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Architect',
    education: 'Architecture Degree',
  },
  {
    id: '23',
    name: 'Iris Martinez',
    age: 24,
    bio: 'Dance instructor and choreographer 💃 Expressing emotions through movement and teaching others to dance.',
    interests: ['Dance', 'Music', 'Performance', 'Fitness'],
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'average',
    income: 35000,
    personality: 'expressive',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Dance Instructor',
    education: 'Dance Performance',
  },
  {
    id: '24',
    name: 'Jade Taylor',
    age: 26,
    bio: 'Nutritionist and wellness coach 🥗 Helping people achieve their health goals through proper nutrition.',
    interests: ['Nutrition', 'Health', 'Cooking', 'Wellness'],
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'average',
    income: 52000,
    personality: 'health-conscious',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Nutritionist',
    education: 'Nutrition Science',
  },
  {
    id: '25',
    name: 'Cora Johnson',
    age: 28,
    bio: 'Pilot and aviation enthusiast ✈️ Soaring through the skies and exploring the world from above.',
    interests: ['Aviation', 'Travel', 'Adventure', 'Photography'],
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'wealthy',
    income: 95000,
    personality: 'adventurous',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Commercial Pilot',
    education: 'Aviation Degree',
  },
];

export default function DatingApp({ onBack }: DatingAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const { buttonPress, haptic } = useFeedback(settings.hapticFeedback);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Profile | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [scrollIndicatorOpacity, setScrollIndicatorOpacity] = useState(1);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const scrollIndicatorAnim = useRef(new Animated.Value(1)).current;
  const likeButtonScale = useRef(new Animated.Value(1)).current;
  const passButtonScale = useRef(new Animated.Value(1)).current;

  const currentProfile = mockProfiles[currentProfileIndex];

  // Initialize scroll indicator state
  useEffect(() => {
    if (currentProfileIndex >= mockProfiles.length - 3) {
      setShowScrollIndicator(true);
    } else {
      setShowScrollIndicator(false);
    }
  }, [currentProfileIndex]);

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
    // Add haptic feedback
    haptic('success');
    
    if (Math.random() < 0.4) { // 40% match rate
      setCurrentMatch(currentProfile);
      setShowMatchModal(true);
      setMatches(prev => [...prev, currentProfile]);
    }
    nextProfile();
  }, [currentProfile]);

  const handlePass = useCallback(() => {
    // Add haptic feedback
    haptic('light');
    
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

  // Enhanced button animation functions
  const animateButton = useCallback((buttonRef: Animated.Value, callback: () => void) => {
    Animated.sequence([
      Animated.timing(buttonRef, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonRef, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    callback();
  }, []);

  const handleActionWithLoading = useCallback((action: () => void) => {
    setIsLoading(true);
    setTimeout(() => {
      action();
      setIsLoading(false);
    }, 300);
  }, []);

  const handleLikeWithLoading = useCallback(() => {
    handleActionWithLoading(() => animateButton(likeButtonScale, handleLike));
  }, [handleActionWithLoading, animateButton, handleLike]);

  const handlePassWithLoading = useCallback(() => {
    handleActionWithLoading(() => animateButton(passButtonScale, handlePass));
  }, [handleActionWithLoading, animateButton, handlePass]);

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
    const nextIndex = (currentProfileIndex + 1) % mockProfiles.length;
    setCurrentProfileIndex(nextIndex);
    setCurrentPhotoIndex(0);
    
    // Show scroll indicator if we're near the end of profiles
    if (nextIndex >= mockProfiles.length - 3) {
      setShowScrollIndicator(true);
      // Animate scroll indicator
      Animated.sequence([
        Animated.timing(scrollIndicatorAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scrollIndicatorAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setShowScrollIndicator(false);
    }
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

  const showDetails = () => {
    setShowProfileDetails(true);
  };

  const hideDetails = () => {
    setShowProfileDetails(false);
  };

  const rotateInterpolate = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-30deg', '0deg', '30deg'],
  });

  // Check if player already has a partner
  const existingPartner = gameState.relationships?.find(r => r.type === 'partner');

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <MotiView
        from={{ opacity: 0, translateY: -50 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
        style={styles.headerContainer}
      >
        <LinearGradient
          colors={['#FF6B6B', '#FF8E8E', '#FFB3B3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <LinearGradient
                colors={['#1F2937', '#374151']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.backButtonGradient}
              >
                <ArrowLeft size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <View style={styles.headerTitleContainer}>
                <Heart size={20} color="#FFFFFF" />
                <Text style={styles.headerTitle}>Dating</Text>
                <Sparkles size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.headerSubtitle}>Find your perfect match</Text>
            </View>
            
            <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
              <LinearGradient
                colors={['#1F2937', '#374151']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingsButtonGradient}
              >
                <Settings size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </MotiView>

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
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            style={styles.profileCardContainer}
          >
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
                <Image source={{ uri: currentProfile.image }} style={styles.profileImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
                  style={styles.imageGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                
                {/* Enhanced overlay with blur effect */}
                <BlurView intensity={20} style={styles.imageBlurOverlay} />
                
                {/* Profile Navigation */}
                <View style={styles.photoNavigation}>
                  <TouchableOpacity style={styles.photoNavButton} onPress={showDetails}>
                    <Text style={styles.photoNavText}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoNavButton} onPress={showDetails}>
                    <Text style={styles.photoNavText}>›</Text>
                  </TouchableOpacity>
                </View>

                {/* Enhanced Wealth Badge */}
                <LinearGradient
                  colors={[getWealthColor(currentProfile.wealth), getWealthColor(currentProfile.wealth) + 'CC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.wealthBadge}
                >
                  <View style={styles.wealthBadgeContent}>
                    <Text style={styles.wealthIcon}>{getWealthIcon(currentProfile.wealth)}</Text>
                    <Text style={styles.wealthText}>{currentProfile.wealth.charAt(0).toUpperCase() + currentProfile.wealth.slice(1)}</Text>
                  </View>
                  <View style={styles.wealthBadgeGlow} />
                </LinearGradient>
              </View>
              
              <LinearGradient
                colors={['#1F2937', '#111827', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileInfo}
              >
                <View style={styles.profileHeader}>
                  <View style={styles.profileNameContainer}>
                    <View style={styles.profileNameRow}>
                      <Text style={styles.profileName}>{currentProfile.name}, {currentProfile.age}</Text>
                      <View style={styles.ageBadge}>
                        <Text style={styles.ageBadgeText}>{currentProfile.age}</Text>
                      </View>
                    </View>
                    <View style={styles.profileStats}>
                      <MapPin size={16} color="#9FA4B3" />
                      <Text style={styles.distanceText}>{currentProfile.distance} miles away</Text>
                      <View style={styles.onlineIndicator} />
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.bioContainer}>
                  <Text style={styles.profileBio}>{currentProfile.bio}</Text>
                </View>
                
                {/* Quick Stats */}
                <View style={styles.quickStatsContainer}>
                  <View style={styles.quickStat}>
                    <Star size={14} color="#F59E0B" />
                    <Text style={styles.quickStatText}>{currentProfile.personality}</Text>
                  </View>
                  <View style={styles.quickStat}>
                    <Users size={14} color="#10B981" />
                    <Text style={styles.quickStatText}>{currentProfile.job}</Text>
                  </View>
                </View>
                
                {/* Interest Tags */}
                <View style={styles.interestsPreviewContainer}>
                  {currentProfile.interests.slice(0, 3).map((interest, index) => (
                    <View key={index} style={styles.interestTagPreview}>
                      <Text style={styles.interestTagPreviewText}>{interest}</Text>
                    </View>
                  ))}
                  {currentProfile.interests.length > 3 && (
                    <View style={styles.moreInterestsTag}>
                      <Text style={styles.moreInterestsText}>+{currentProfile.interests.length - 3}</Text>
                    </View>
                  )}
                </View>
                
                <TouchableOpacity style={styles.viewDetailsButton} onPress={showDetails}>
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.viewDetailsButtonGradient}
                  >
                    <Text style={styles.viewDetailsButtonText}>View Full Profile</Text>
                    <ChevronDown size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          </PanGestureHandler>
        </MotiView>
        )}

        {/* Scroll Indicator */}
        {showScrollIndicator && (
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            style={styles.scrollIndicatorContainer}
          >
            <Animated.View style={[styles.scrollIndicator, { opacity: scrollIndicatorAnim }]}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scrollIndicatorGradient}
              >
                <ChevronDown size={20} color="#FFFFFF" />
                <Text style={styles.scrollIndicatorText}>More Profiles</Text>
                <ChevronDown size={20} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>
          </MotiView>
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

      {/* Enhanced Floating Action Buttons - Only show when no partner */}
      {!existingPartner && (
        <MotiView
          from={{ opacity: 0, translateY: 100 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 150 }}
          style={styles.floatingActionButtons}
        >
          <TouchableOpacity 
            style={styles.passButton} 
            onPress={handlePassWithLoading}
            disabled={isLoading}
          >
            <Animated.View style={{ transform: [{ scale: passButtonScale }] }}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.passButtonGradient}
              >
                <X size={28} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.likeButton} 
            onPress={handleLikeWithLoading}
            disabled={isLoading}
          >
            <Animated.View style={{ transform: [{ scale: likeButtonScale }] }}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.likeButtonGradient}
              >
                <Heart size={28} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </MotiView>
      )}

      {/* Enhanced Match Modal */}
      <Modal visible={showMatchModal} transparent animationType="fade" onRequestClose={() => setShowMatchModal(false)}>
        <BlurView intensity={20} style={styles.modalBackdrop}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            style={styles.modalCard}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF8E8E', '#FFB3B3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>It's a Match! 💕</Text>
                <Sparkles size={24} color="#FFFFFF" />
              </View>
            
              {currentMatch && (
                <View style={styles.matchContent}>
                  <View style={styles.matchImageContainer}>
                    <Image source={{ uri: currentMatch.image }} style={styles.matchModalImage} />
                    <View style={styles.matchImageGlow} />
                  </View>
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
                  <LinearGradient
                    colors={['#6B7280', '#4B5563']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cancelButtonGradient}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </LinearGradient>
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
            </LinearGradient>
          </MotiView>
        </BlurView>
      </Modal>

      {/* Enhanced Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <BlurView intensity={20} style={styles.modalBackdrop}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            style={styles.modalCard}
          >
            <LinearGradient
              colors={['#1F2937', '#111827', '#0F172A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Dating Settings</Text>
                <Settings size={24} color="#FFFFFF" />
              </View>
              
              <View style={styles.settingsContent}>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    resetProfiles();
                    setShowSettings(false);
                  }}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.settingsButtonGradient}
                  >
                    <Users size={20} color="#FFFFFF" />
                    <Text style={styles.settingsButtonText}>Reset Profiles</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => setShowSettings(false)}
                >
                  <LinearGradient
                    colors={['#6B7280', '#4B5563']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.settingsButtonGradient}
                  >
                    <X size={20} color="#FFFFFF" />
                    <Text style={styles.settingsButtonText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </MotiView>
        </BlurView>
      </Modal>

      {/* Profile Details Modal */}
      <Modal visible={showProfileDetails} transparent animationType="fade" onRequestClose={hideDetails}>
        <View style={styles.modalBackdrop}>
          <View style={styles.profileDetailsModal}>
            <View style={styles.profileDetailsModalHeader}>
              <Text style={styles.profileDetailsTitle}>Profile Details</Text>
              <TouchableOpacity style={styles.closeDetailsButton} onPress={hideDetails}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {currentProfile && (
              <ScrollView 
                style={styles.profileDetailsScrollView}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.profileDetailsContent}
              >
                <View style={styles.profileDetailsImageContainer}>
                  <Image source={{ uri: currentProfile.image }} style={styles.profileDetailsImage} />
                </View>

                <View style={styles.profileDetailsInfo}>
                  <View style={styles.profileDetailsInfoHeader}>
                    <View style={styles.profileNameRow}>
                      <Text style={styles.profileDetailsName}>{currentProfile.name}, {currentProfile.age}</Text>
                      <View style={styles.ageBadge}>
                        <Text style={styles.ageBadgeText}>{currentProfile.age}</Text>
                      </View>
                    </View>
                    <View style={styles.profileStats}>
                      <MapPin size={16} color="#9FA4B3" />
                      <Text style={styles.distanceText}>{currentProfile.distance} miles away</Text>
                      <View style={styles.onlineIndicator} />
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  </View>

                  <View style={styles.profileDetails}>
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Text style={styles.detailIcon}>💼</Text>
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Profession</Text>
                          <Text style={styles.detailValue}>{currentProfile.job}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Text style={styles.detailIcon}>🎓</Text>
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Education</Text>
                          <Text style={styles.detailValue}>{currentProfile.education}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Text style={styles.detailIcon}>💰</Text>
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Income</Text>
                          <Text style={[styles.detailValue, { color: '#9FA4B3' }]}>
                            Hidden
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Text style={styles.detailIcon}>🌟</Text>
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Personality</Text>
                          <Text style={styles.detailValue}>{currentProfile.personality.charAt(0).toUpperCase() + currentProfile.personality.slice(1)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.bioContainer}>
                    <Text style={styles.profileBio}>{currentProfile.bio}</Text>
                  </View>
                  
                  <View style={styles.interestsSection}>
                    <Text style={styles.interestsTitle}>Interests</Text>
                    <View style={styles.interestsContainer}>
                      {currentProfile.interests.map((interest, index) => (
                        <View key={index} style={styles.interestTag}>
                          <Text style={styles.interestText}>{interest}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
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
  headerContainer: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 120, // Add space for floating buttons
  },
  profileCardContainer: {
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#0F1220',
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: '#23283B',
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  profileImageContainer: {
    height: 350,
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
    height: 120,
  },
  imageBlurOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
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
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  wealthBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  wealthBadgeGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: -1,
  },
  wealthIcon: {
    fontSize: 18,
  },
  wealthText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  profileInfo: {
    padding: 20,
    minHeight: 200,
    maxHeight: 300,
  },
  viewDetailsButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewDetailsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  viewDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    marginBottom: 16,
  },
  profileNameContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ageBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ageBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  onlineText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  profileDetails: {
    marginBottom: 16,
    gap: 8,
  },
  detailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailIcon: {
    fontSize: 20,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    color: '#9FA4B3',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bioContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  profileBio: {
    color: '#F3F4F6',
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  interestsSection: {
    marginTop: 4,
  },
  interestsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  interestTagGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollIndicatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  scrollIndicator: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  scrollIndicatorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scrollIndicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  floatingActionButtons: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: 20,
  },
  passButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  passButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  likeButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  matchContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  matchImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  matchModalImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  matchImageGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: -1,
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
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsContent: {
    gap: 16,
  },
  settingsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  profileDetailsModal: {
    width: '90%',
    height: '80%',
    maxWidth: 500,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  profileDetailsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
  },
  profileDetailsInfoHeader: {
    marginBottom: 16,
  },
  profileDetailsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeDetailsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetailsScrollView: {
    flex: 1,
  },
  profileDetailsContent: {
    paddingBottom: 20,
  },
  profileDetailsImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileDetailsImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  profileDetailsWealthBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  profileDetailsInfo: {
    padding: 20,
  },
  profileDetailsName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  // New UX Enhancement Styles
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  quickStatText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 80,
    textAlign: 'center',
  },
  interestsPreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 12,
    gap: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  interestTagPreview: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  interestTagPreviewText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '500',
  },
  moreInterestsTag: {
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  moreInterestsText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
});