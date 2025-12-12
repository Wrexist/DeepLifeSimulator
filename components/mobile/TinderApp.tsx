import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, Animated, Dimensions, ScrollView , Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { ArrowLeft, Heart, X, Settings, DollarSign, Star, MapPin, MessageCircle, Sparkles, Users, ChevronDown, Calendar, Circle } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useFeedback } from '@/utils/feedbackSystem';
import { scale, fontScale } from '@/utils/scaling';
import { goOnDate, giveGift, proposeMarriage, getRelationshipStatus } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { ENGAGEMENT_RINGS, getTierColor } from '@/lib/dating/engagementRings';

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
  {
    id: '26',
    name: 'Aria Patel',
    age: 26,
    bio: 'Data scientist and AI researcher 🤖 Exploring the future of technology and machine learning.',
    interests: ['AI', 'Data Science', 'Technology', 'Research'],
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'wealthy',
    income: 95000,
    personality: 'analytical',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Data Scientist',
    education: 'PhD in Computer Science',
  },
  {
    id: '27',
    name: 'Elena Vasquez',
    age: 28,
    bio: 'Journalist and storyteller 📰 Sharing important stories and uncovering the truth.',
    interests: ['Journalism', 'Writing', 'Travel', 'Politics'],
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'average',
    income: 55000,
    personality: 'curious',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Journalist',
    education: 'Journalism Degree',
  },
  {
    id: '28',
    name: 'Maya Singh',
    age: 25,
    bio: 'Therapist and mental health advocate 🧠 Helping people navigate life\'s challenges with compassion.',
    interests: ['Psychology', 'Mental Health', 'Meditation', 'Wellness'],
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 58000,
    personality: 'empathetic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Therapist',
    education: 'Master\'s in Psychology',
  },
  {
    id: '29',
    name: 'Nina Kowalski',
    age: 27,
    bio: 'Product manager and innovation enthusiast 💡 Building products that make a difference.',
    interests: ['Product Management', 'Innovation', 'Startups', 'Design'],
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'wealthy',
    income: 105000,
    personality: 'innovative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Product Manager',
    education: 'MBA',
  },
  {
    id: '30',
    name: 'Sofia Andersen',
    age: 24,
    bio: 'Photographer and visual storyteller 📷 Capturing moments and emotions through my lens.',
    interests: ['Photography', 'Art', 'Travel', 'Nature'],
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 45000,
    personality: 'artistic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Photographer',
    education: 'Photography Degree',
  },
  {
    id: '31',
    name: 'Layla Hassan',
    age: 29,
    bio: 'Financial advisor and investment strategist 📈 Helping people build wealth and secure their future.',
    interests: ['Finance', 'Investing', 'Economics', 'Business'],
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'millionaire',
    income: 150000,
    personality: 'strategic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Financial Advisor',
    education: 'Finance MBA',
  },
  {
    id: '32',
    name: 'Zara Williams',
    age: 23,
    bio: 'Social worker and community advocate ❤️ Making a positive impact in people\'s lives every day.',
    interests: ['Social Work', 'Community', 'Volunteering', 'Advocacy'],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'poor',
    income: 35000,
    personality: 'compassionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Social Worker',
    education: 'Social Work Degree',
  },
  {
    id: '33',
    name: 'Diana Torres',
    age: 26,
    bio: 'Interior designer and space creator 🏠 Transforming houses into beautiful, functional homes.',
    interests: ['Interior Design', 'Architecture', 'Home Decor', 'Creativity'],
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 72000,
    personality: 'creative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Interior Designer',
    education: 'Interior Design Degree',
  },
  {
    id: '34',
    name: 'Kira Nakamura',
    age: 25,
    bio: 'Game developer and digital artist 🎮 Creating immersive worlds and interactive experiences.',
    interests: ['Game Development', 'Gaming', 'Art', 'Technology'],
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 68000,
    personality: 'creative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Game Developer',
    education: 'Computer Science Degree',
  },
  {
    id: '35',
    name: 'Rosa Martinez',
    age: 30,
    bio: 'Restaurant owner and culinary innovator 🍽️ Bringing people together through amazing food experiences.',
    interests: ['Cooking', 'Food', 'Business', 'Hospitality'],
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'wealthy',
    income: 110000,
    personality: 'entrepreneurial',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Restaurant Owner',
    education: 'Culinary Arts & Business',
  },
  {
    id: '36',
    name: 'Camila Rivera',
    age: 27,
    bio: 'Luxury travel writer ✈️ Sharing hidden gems from around the globe and looking for a co-adventurer.',
    interests: ['Travel', 'Writing', 'Cuisine', 'Photography'],
    image: 'https://images.unsplash.com/photo-1503342250623-60cdd8f3e0b3?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 98000,
    personality: 'adventurous',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1503342250623-60cdd8f3e0b3?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Travel Journalist',
    education: 'International Relations Degree',
  },
  {
    id: '37',
    name: 'Marcus Reid',
    age: 30,
    bio: 'Tech founder building AI tools 🤖 Seeking someone curious, driven, and ready for spontaneous coffee runs.',
    interests: ['Startups', 'Cycling', 'Coffee', 'AI'],
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'millionaire',
    income: 320000,
    personality: 'ambitious',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'AI Startup CEO',
    education: 'Computer Engineering',
  },
  {
    id: '38',
    name: 'Isla Morgan',
    age: 25,
    bio: 'Marine conservationist 🌊 Fighting for the oceans and searching for someone who loves the sea breeze.',
    interests: ['Diving', 'Conservation', 'Kayaking', 'Volunteering'],
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'average',
    income: 54000,
    personality: 'empathetic',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Marine Biologist',
    education: 'Marine Ecology MSc',
  },
  {
    id: '39',
    name: 'Liam Chen',
    age: 28,
    bio: 'Architect designing sustainable cities 🏙️ Looking for someone to explore rooftop gardens and art exhibits.',
    interests: ['Architecture', 'Art', 'Rock Climbing', 'Tea'],
    image: 'https://images.unsplash.com/photo-1544723795-76653f02d793?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'wealthy',
    income: 150000,
    personality: 'visionary',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1544723795-76653f02d793?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Sustainable Architect',
    education: 'Architecture Masters',
  },
  {
    id: '40',
    name: 'Sienna Patel',
    age: 26,
    bio: 'Wellness entrepreneur 🧘‍♀️ Hosting retreats around the world and searching for a grounded partner.',
    interests: ['Yoga', 'Ayurveda', 'Hiking', 'Cooking'],
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 112000,
    personality: 'zen',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Retreat Founder',
    education: 'Holistic Nutrition Certification',
  },
  {
    id: '41',
    name: 'Noah Hernandez',
    age: 27,
    bio: 'Documentary filmmaker 🎥 Capturing real stories and dreaming of a co-director for life.',
    interests: ['Film', 'Surfing', 'Street Food', 'Travel'],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'average',
    income: 72000,
    personality: 'creative',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Documentary Director',
    education: 'Film School Graduate',
  },
  {
    id: '42',
    name: 'Aurora Bennett',
    age: 24,
    bio: 'Concert violinist 🎻 Performing worldwide and hoping to find someone who loves late-night jazz.',
    interests: ['Music', 'Jazz Clubs', 'Museums', 'Travel'],
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 95000,
    personality: 'passionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Professional Violinist',
    education: 'Royal Conservatory Graduate',
  },
  {
    id: '43',
    name: 'Julian Park',
    age: 31,
    bio: 'Cardiologist on a mission ❤️ Balancing hospital life with mountain biking and Michelin-star dinners.',
    interests: ['Medicine', 'Cycling', 'Gastronomy', 'Travel'],
    image: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'millionaire',
    income: 410000,
    personality: 'dedicated',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Cardiologist',
    education: 'MD, Cardiology Fellowship',
  },
  {
    id: '44',
    name: 'Maya Alvarez',
    age: 28,
    bio: 'Social impact strategist 🌍 Designing programs that uplift communities and searching for a kind heart.',
    interests: ['Philanthropy', 'Cycling', 'Poetry', 'Cooking'],
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 68000,
    personality: 'compassionate',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Program Director',
    education: 'Public Policy Masters',
  },
  {
    id: '45',
    name: 'Dominic Rossi',
    age: 32,
    bio: 'Luxury home builder 🏡 Crafting dream estates and looking for someone to design a future with.',
    interests: ['Architecture', 'Sailing', 'Wine', 'Fitness'],
    image: 'https://images.unsplash.com/photo-1521038199265-3c3f94a1d37b?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'millionaire',
    income: 520000,
    personality: 'confident',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1521038199265-3c3f94a1d37b?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Luxury Builder',
    education: 'Business & Construction Management',
  },
  {
    id: '46',
    name: 'Harper Ellis',
    age: 23,
    bio: 'Indie game designer 🎮 Turning stories into experiences and craving a co-op partner IRL.',
    interests: ['Gaming', 'Storytelling', 'Coffee', 'Comics'],
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    distance: 6,
    wealth: 'average',
    income: 58000,
    personality: 'creative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Indie Game Writer',
    education: 'Interactive Media BA',
  },
  {
    id: '47',
    name: 'Gabriel Foster',
    age: 27,
    bio: 'Firefighter and rescue diver 🚒 Ready for early hikes, late-night tacos, and real conversations.',
    interests: ['Fitness', 'Diving', 'Cooking', 'Volunteering'],
    image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 69000,
    personality: 'brave',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Firefighter / EMT',
    education: 'Emergency Services Academy',
  },
  {
    id: '48',
    name: 'Adeline Brooks',
    age: 29,
    bio: 'Boutique hotel curator 🏨 Blending design and hospitality while searching for someone who loves weekend getaways.',
    interests: ['Interior Design', 'Wine', 'Hiking', 'Design Fairs'],
    image: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'wealthy',
    income: 135000,
    personality: 'refined',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1463453091185-61582044d556?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Hospitality Consultant',
    education: 'MBA Hospitality',
  },
  {
    id: '49',
    name: 'Mateo Silva',
    age: 26,
    bio: 'Latin Grammy-nominated producer 🎶 Mixing beats by night and exploring farmers markets by day.',
    interests: ['Music', 'Dancing', 'Cooking', 'Travel'],
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 180000,
    personality: 'charismatic',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Music Producer',
    education: 'Audio Engineering Degree',
  },
  {
    id: '50',
    name: 'Vivian Clarke',
    age: 31,
    bio: 'Corporate attorney by day, salsa dancer by night 💃 Seeking chemistry, loyalty, and laughter.',
    interests: ['Law', 'Dance', 'Travel', 'Books'],
    image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'millionaire',
    income: 260000,
    personality: 'driven',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Corporate Attorney',
    education: 'JD, Ivy League',
  },
  {
    id: '51',
    name: 'Caleb Stone',
    age: 29,
    bio: 'Adventure photographer 📸 Chasing storms, sunrises, and someone to share campfire stories with.',
    interests: ['Photography', 'Climbing', 'Trail Running', 'Travel'],
    image: 'https://images.unsplash.com/photo-1502767089025-6572583495b4?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'average',
    income: 82000,
    personality: 'free-spirited',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1502767089025-6572583495b4?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Adventure Photographer',
    education: 'Fine Arts Degree',
  },
  {
    id: '52',
    name: 'Elena Novak',
    age: 27,
    bio: 'Biotech researcher 🔬 Turning science fiction into reality and looking for someone equally curious.',
    interests: ['Biotech', 'Podcasts', 'Running', 'Cooking'],
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 140000,
    personality: 'analytical',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Biotech Research Lead',
    education: 'PhD in Genetics',
  },
  {
    id: '53',
    name: 'Owen Gallagher',
    age: 33,
    bio: 'Commercial pilot ✈️ Home half the week, exploring the rest. Searching for steady ground in love.',
    interests: ['Aviation', 'Skiing', 'Wine', 'Fitness'],
    image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'wealthy',
    income: 210000,
    personality: 'confident',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Airline Captain',
    education: 'Flight Academy Graduate',
  },
  {
    id: '54',
    name: 'Penelope Ward',
    age: 25,
    bio: 'Sustainable fashion CEO ♻️ Building eco-friendly wardrobes and hoping to meet a purpose-driven partner.',
    interests: ['Fashion', 'Startups', 'Pilates', 'Art'],
    image: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'millionaire',
    income: 310000,
    personality: 'innovative',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Fashion CEO',
    education: 'Sustainable Design Degree',
  },
  {
    id: '55',
    name: 'Sebastian Ibarra',
    age: 28,
    bio: 'Chef-owner of a Michelin-starred kitchen 🍽️ Can handle heat in the kitchen and in relationships.',
    interests: ['Cooking', 'Travel', 'Wine', 'Boxing'],
    image: 'https://images.unsplash.com/photo-1544723795-432537f4b081?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 230000,
    personality: 'passionate',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1544723795-432537f4b081?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Chef & Restaurateur',
    education: 'Culinary Institute Graduate',
  },
  {
    id: '56',
    name: 'Caleb Wright',
    age: 26,
    bio: 'Physical therapist helping athletes recover 💪 Looking for someone to share sunrise hikes with.',
    interests: ['Sports Medicine', 'Hiking', 'Basketball', 'Nutrition'],
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 78000,
    personality: 'supportive',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Physical Therapist',
    education: 'Doctorate in Physical Therapy',
  },
  {
    id: '57',
    name: 'Dylan Mitchell',
    age: 29,
    bio: 'Music producer with a home studio 🎵 Seeking someone who appreciates a good vinyl collection.',
    interests: ['Music Production', 'Vinyl Records', 'Jazz', 'Photography'],
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 145000,
    personality: 'creative',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Music Producer',
    education: 'Audio Engineering Degree',
  },
  {
    id: '58',
    name: 'Ryan Torres',
    age: 31,
    bio: 'Emergency room doctor saving lives daily 🏥 Need someone patient—my schedule is unpredictable.',
    interests: ['Medicine', 'Running', 'Cooking', 'Travel'],
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 290000,
    personality: 'dedicated',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'ER Physician',
    education: 'Medical Degree',
  },
  {
    id: '59',
    name: 'Jordan Blake',
    age: 24,
    bio: 'Pro gamer and streamer 🎮 Looking for someone who won\'t mind me talking to chat during dinner.',
    interests: ['Gaming', 'Streaming', 'Anime', 'Tech'],
    image: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'wealthy',
    income: 180000,
    personality: 'energetic',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1463453091185-61582044d556?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Professional Gamer',
    education: 'Self-Taught',
  },
  {
    id: '60',
    name: 'Mason Park',
    age: 27,
    bio: 'Venture capitalist backing the next big thing 📈 Want to build empires together?',
    interests: ['Investing', 'Startups', 'Golf', 'Wine'],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'millionaire',
    income: 450000,
    personality: 'ambitious',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Venture Capitalist',
    education: 'MBA from Stanford',
  },
  {
    id: '61',
    name: 'Tyler Simmons',
    age: 25,
    bio: 'Personal trainer who practices what he preaches 🏋️ Looking for a gym partner and life partner.',
    interests: ['Fitness', 'Meal Prep', 'Hiking', 'Dogs'],
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 55000,
    personality: 'motivated',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Personal Trainer',
    education: 'Sports Science Degree',
  },
  {
    id: '62',
    name: 'Brandon Lee',
    age: 30,
    bio: 'Criminal defense attorney ⚖️ I argue for a living, but I\'d rather agree with you on everything.',
    interests: ['Law', 'Jazz', 'Whiskey', 'Chess'],
    image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'wealthy',
    income: 195000,
    personality: 'intelligent',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Defense Attorney',
    education: 'Law Degree',
  },
  {
    id: '63',
    name: 'Cole Anderson',
    age: 28,
    bio: 'Wildlife photographer capturing nature\'s beauty 📷 Seeking someone for sunset shoots.',
    interests: ['Photography', 'Wildlife', 'Camping', 'Conservation'],
    image: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=500&h=600&fit=crop&crop=face',
    distance: 6,
    wealth: 'average',
    income: 68000,
    personality: 'patient',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Wildlife Photographer',
    education: 'Photography Degree',
  },
  {
    id: '64',
    name: 'Austin Cooper',
    age: 26,
    bio: 'Software engineer at a big tech company 💻 Will write you code comments as love letters.',
    interests: ['Coding', 'Gaming', 'Board Games', 'Coffee'],
    image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'wealthy',
    income: 165000,
    personality: 'nerdy',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Software Engineer',
    education: 'Computer Science Degree',
  },
  {
    id: '65',
    name: 'Elijah Foster',
    age: 29,
    bio: 'Pilot flying international routes ✈️ I\'ll take you anywhere—literally and figuratively.',
    interests: ['Aviation', 'Travel', 'Photography', 'Scuba'],
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 175000,
    personality: 'adventurous',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Commercial Pilot',
    education: 'Aviation Degree',
  },
  {
    id: '66',
    name: 'Nathan Hayes',
    age: 32,
    bio: 'Real estate developer transforming skylines 🏗️ Let\'s build something together.',
    interests: ['Architecture', 'Investing', 'Tennis', 'Wine'],
    image: 'https://images.unsplash.com/photo-1502767089025-6572583495b4?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'millionaire',
    income: 520000,
    personality: 'driven',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1502767089025-6572583495b4?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Real Estate Developer',
    education: 'Business Degree',
  },
  {
    id: '67',
    name: 'Luke Bennett',
    age: 27,
    bio: 'Craft brewery owner pouring passion into every pint 🍺 Seeking my brewing partner.',
    interests: ['Brewing', 'Food', 'Hiking', 'Live Music'],
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'average',
    income: 85000,
    personality: 'laid-back',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Brewery Owner',
    education: 'Business Administration',
  },
  {
    id: '68',
    name: 'Hunter Morgan',
    age: 25,
    bio: 'Professional soccer player ⚽ Looking for someone who doesn\'t mind weekend games.',
    interests: ['Soccer', 'Fitness', 'Travel', 'Video Games'],
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'wealthy',
    income: 280000,
    personality: 'competitive',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Professional Athlete',
    education: 'Sports Management',
  },
  {
    id: '69',
    name: 'Gavin Reed',
    age: 28,
    bio: 'Marine biologist exploring the deep 🐠 Seeking someone who loves the ocean as much as I do.',
    interests: ['Marine Life', 'Diving', 'Surfing', 'Conservation'],
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'average',
    income: 62000,
    personality: 'curious',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Marine Biologist',
    education: 'Marine Biology PhD',
  },
  {
    id: '70',
    name: 'Dominic Russo',
    age: 30,
    bio: 'Restaurateur with family recipes from Italy 🍝 Will cook for you on the first date.',
    interests: ['Cooking', 'Wine', 'Family', 'Soccer'],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 195000,
    personality: 'warm',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Restaurant Owner',
    education: 'Culinary Arts',
  },
];

export default function DatingApp({ onBack }: DatingAppProps) {
  const insets = useSafeAreaInsets();
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const { buttonPress, haptic } = useFeedback(settings.hapticFeedback);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [scrollIndicatorOpacity, setScrollIndicatorOpacity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollIndicatorAnim = useRef(new Animated.Value(1)).current;
  const likeButtonScale = useRef(new Animated.Value(1)).current;
  const passButtonScale = useRef(new Animated.Value(1)).current;

  // Filter profiles based on player's gender preference
  const availableProfiles = React.useMemo(() => {
    const playerGender = gameState.userProfile?.sex || 'male';
    // Show profiles of opposite gender (or same if gay dating in future)
    // For now: male players see female profiles, female players see male profiles
    const targetGender = playerGender === 'male' ? 'female' : 'male';
    return mockProfiles.filter(p => p.gender === targetGender);
  }, [gameState.userProfile?.sex]);

  const currentProfile = availableProfiles[currentProfileIndex % availableProfiles.length];

  // Reset index if out of bounds when profiles change
  useEffect(() => {
    if (currentProfileIndex >= availableProfiles.length) {
      setCurrentProfileIndex(0);
    }
  }, [availableProfiles.length, currentProfileIndex]);

  // Initialize scroll indicator state
  useEffect(() => {
    if (currentProfileIndex >= availableProfiles.length - 3) {
      setShowScrollIndicator(true);
    } else {
      setShowScrollIndicator(false);
    }
  }, [currentProfileIndex, availableProfiles.length]);

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
      // Check if player already has a partner
      const existingPartner = gameState.relationships?.find(r => r.type === 'partner');
      
      if (existingPartner) {
        Alert.alert(
          'Already Have a Partner',
          `You already have a partner (${existingPartner.name}). You can only have one partner at a time.`
        );
        nextProfile();
        return;
      }

      // Add to contacts as partner with 50 relationship score
      const weeklyIncome = Math.floor(currentProfile.income / 52);
      
      const newPartner = {
        id: `partner_${currentProfile.id}`,
        name: currentProfile.name,
        type: 'partner' as const,
        relationshipScore: 50,
        personality: currentProfile.personality,
        gender: currentProfile.gender,
        age: currentProfile.age,
        income: weeklyIncome,
        actions: {},
        weeksAtZero: 0,
      };

      setGameState(prev => ({
        ...prev,
        relationships: [...(prev.relationships || []), newPartner],
      }));
      
      saveGame();
      setMatches(prev => [...prev, currentProfile]);
      
      Alert.alert(
        'It\'s a Match! 💕',
        `${currentProfile.name} has been added to your contacts as a partner!`,
        [{ text: 'OK' }]
      );
    }
    nextProfile();
  }, [currentProfile, gameState.relationships, setGameState, saveGame]);

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
      scaleAnim.setValue(1);
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
    // State.END = 5 in react-native-gesture-handler
    if (event.nativeEvent.state === 5) {
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
    const nextIndex = (currentProfileIndex + 1) % availableProfiles.length;
    setCurrentProfileIndex(nextIndex);
    setCurrentPhotoIndex(0);
    
    // Show scroll indicator if we're near the end of profiles
    if (nextIndex >= availableProfiles.length - 3) {
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


  const rotateInterpolate = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-30deg', '0deg', '30deg'],
  });

  // Check if player already has a partner
  const existingPartner = gameState.relationships?.find(r => r.type === 'partner');

  const swipeEnabled = false;

  const renderCardContent = () => {
    if (!currentProfile) {
      return null;
    }
    return (
      <BlurView intensity={100} tint={settings.darkMode ? 'dark' : 'light'} style={styles.cardBlur}>
          <View style={styles.profileImageContainer}>
            <Image source={{ uri: currentProfile.image }} style={styles.profileImage} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
              style={styles.imageGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            
            {/* Profile Navigation */}
            <View style={styles.photoNavigation}>
              <TouchableOpacity style={styles.photoNavButton} onPress={() => {
                Alert.alert(
                  currentProfile.name,
                  `${currentProfile.bio}\n\nJob: ${currentProfile.job}\nEducation: ${currentProfile.education}\nInterests: ${currentProfile.interests.join(', ')}`
                );
              }}>
                <Text style={styles.photoNavText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoNavButton} onPress={() => {
                Alert.alert(
                  currentProfile.name,
                  `${currentProfile.bio}\n\nJob: ${currentProfile.job}\nEducation: ${currentProfile.education}\nInterests: ${currentProfile.interests.join(', ')}`
                );
              }}>
                <Text style={styles.photoNavText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Glassmorphism Wealth Badge */}
            <BlurView intensity={60} tint="light" style={styles.wealthBadge}>
              <View style={styles.wealthBadgeContent}>
                <Text style={styles.wealthIcon}>{getWealthIcon(currentProfile.wealth)}</Text>
                <Text style={styles.wealthText}>
                  {currentProfile.wealth.charAt(0).toUpperCase() + currentProfile.wealth.slice(1)}
                </Text>
              </View>
            </BlurView>
          </View>
          
          {/* Glassmorphism Info Section */}
          <BlurView intensity={80} tint={settings.darkMode ? 'dark' : 'light'} style={styles.profileInfo}>
            <View style={styles.profileHeader}>
              <View style={styles.profileNameContainer}>
                <View style={styles.profileNameRow}>
                  <Text style={[styles.profileName, settings.darkMode && styles.profileNameDark]}>
                    {currentProfile.name}, {currentProfile.age}
                  </Text>
                  <View style={styles.ageBadge}>
                    <Text style={styles.ageBadgeText}>{currentProfile.age}</Text>
                  </View>
                </View>
                <View style={styles.profileStats}>
                  <MapPin size={14} color={settings.darkMode ? '#9FA4B3' : '#6B7280'} />
                  <Text style={[styles.distanceText, settings.darkMode && styles.distanceTextDark]}>
                    {currentProfile.distance} miles away
                  </Text>
                  <View style={[styles.onlineIndicator, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.onlineText, { color: '#10B981' }]}>Online</Text>
                </View>
              </View>
            </View>

            <View style={styles.bioContainer}>
              <Text style={[styles.profileBio, settings.darkMode && styles.profileBioDark]}>
                {currentProfile.bio}
              </Text>
            </View>
            
            {/* Quick Stats with Glassmorphism */}
            <View style={styles.quickStatsContainer}>
              <BlurView intensity={40} tint={settings.darkMode ? 'dark' : 'light'} style={styles.quickStat}>
                <Star size={14} color="#F59E0B" />
                <Text style={[styles.quickStatText, settings.darkMode && styles.quickStatTextDark]}>
                  {currentProfile.personality}
                </Text>
              </BlurView>
              <BlurView intensity={40} tint={settings.darkMode ? 'dark' : 'light'} style={styles.quickStat}>
                <Users size={14} color="#10B981" />
                <Text style={[styles.quickStatText, settings.darkMode && styles.quickStatTextDark]}>
                  {currentProfile.job}
                </Text>
              </BlurView>
            </View>
            
            {/* Interest Tags with Glassmorphism */}
            <View style={styles.interestsPreviewContainer}>
              {currentProfile.interests.slice(0, 3).map((interest, index) => (
                <BlurView key={index} intensity={40} tint={settings.darkMode ? 'dark' : 'light'} style={styles.interestTagPreview}>
                  <Text style={[styles.interestTagPreviewText, settings.darkMode && styles.interestTagPreviewTextDark]}>
                    {interest}
                  </Text>
                </BlurView>
              ))}
              {currentProfile.interests.length > 3 && (
                <BlurView intensity={40} tint={settings.darkMode ? 'dark' : 'light'} style={styles.moreInterestsTag}>
                  <Text style={[styles.moreInterestsText, settings.darkMode && styles.moreInterestsTextDark]}>
                    +{currentProfile.interests.length - 3}
                  </Text>
                </BlurView>
              )}
            </View>
            
            {/* Glassmorphism View Details Button */}
            <TouchableOpacity style={styles.viewDetailsButton} onPress={() => {
              Alert.alert(
                currentProfile.name,
                `${currentProfile.bio}\n\nJob: ${currentProfile.job}\nEducation: ${currentProfile.education}\nInterests: ${currentProfile.interests.join(', ')}`
              );
            }}>
              <BlurView intensity={60} tint={settings.darkMode ? 'dark' : 'light'} style={styles.viewDetailsButtonBlur}>
                <Text style={[styles.viewDetailsButtonText, settings.darkMode && styles.viewDetailsButtonTextDark]}>
                  View Full Profile
                </Text>
                <ChevronDown size={18} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </BlurView>
            </TouchableOpacity>
        </BlurView>
      </BlurView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Glassmorphism Background with Animated Gradient */}
      <LinearGradient
        colors={settings.darkMode 
          ? ['#0F172A', '#1E293B', '#334155'] 
          : ['#E0E7FF', '#F3E8FF', '#FCE7F3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Glassmorphism Header */}
      <MotiView
        from={{ opacity: 0, translateY: -50 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
        style={styles.headerContainer}
      >
        <BlurView intensity={80} tint={settings.darkMode ? 'dark' : 'light'} style={styles.headerBlur}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={onBack}>
              <BlurView intensity={60} tint={settings.darkMode ? 'dark' : 'light'} style={styles.headerButtonBlur}>
                <ArrowLeft size={20} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </BlurView>
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <View style={styles.headerTitleContainer}>
                <Heart size={20} color="#FF6B9D" />
                <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
                  Dating
                </Text>
                <Sparkles size={16} color="#FF6B9D" />
              </View>
              <Text style={[styles.headerSubtitle, settings.darkMode && styles.headerSubtitleDark]}>
                Find your perfect match
              </Text>
            </View>
            
            <TouchableOpacity style={styles.headerButton} onPress={() => {
              Alert.alert(
                'Reset Profiles',
                'Do you want to reset and start over?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Reset', 
                    onPress: () => {
                      resetProfiles();
                      Alert.alert('Reset', 'Profiles have been reset!');
                    }
                  }
                ]
              );
            }}>
              <BlurView intensity={60} tint={settings.darkMode ? 'dark' : 'light'} style={styles.headerButtonBlur}>
                <Settings size={20} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </BlurView>
      </MotiView>

      {/* Main Content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.content, existingPartner && styles.contentLocked]}
        showsVerticalScrollIndicator={true}
        bounces={true}
        nestedScrollEnabled={true}
      >
        {existingPartner ? (
          // Partner relationship panel
          <View style={styles.lockedContainer}>
            <BlurView intensity={80} tint={settings.darkMode ? 'dark' : 'light'} style={styles.lockedCard}>
              <View style={styles.lockedIcon}>
                <Text style={styles.lockedIconText}>💕</Text>
              </View>
              <Text style={[styles.lockedTitle, settings.darkMode && styles.lockedTitleDark]}>
                {existingPartner.engagementWeek ? 'Engaged to ' : 'Dating '}{existingPartner.name}
              </Text>
              <Text style={[styles.lockedMessage, settings.darkMode && styles.lockedMessageDark]}>
                Relationship: {existingPartner.relationshipScore}% • Dates: {existingPartner.datesCount || 0}
              </Text>
              
              {/* Special Action Buttons (only proposal/wedding) */}
              <View style={styles.partnerActions}>
                {!existingPartner.engagementWeek && existingPartner.relationshipScore >= 60 && (
                  <TouchableOpacity
                    style={[styles.partnerActionBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => setShowProposalModal(true)}
                  >
                    <Circle size={scale(18)} color="#FFF" fill="#FFF" />
                    <Text style={styles.partnerActionText}>Propose</Text>
                  </TouchableOpacity>
                )}

                {existingPartner.engagementWeek && (
                  <TouchableOpacity
                    style={[styles.partnerActionBtn, { backgroundColor: '#22C55E' }]}
                    onPress={() => Alert.alert('Coming Soon', 'Wedding planning will be available in the next update!')}
                  >
                    <Calendar size={scale(18)} color="#FFF" />
                    <Text style={styles.partnerActionText}>Plan Wedding</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Text style={[styles.partnerHint, settings.darkMode && styles.partnerHintDark]}>
                💡 Use Contacts app for dates & gifts
              </Text>

              <Text style={[styles.lockedSubtext, settings.darkMode && styles.lockedSubtextDark]}>
                {existingPartner.relationshipScore < 60 
                  ? 'Build your relationship to unlock proposal!'
                  : existingPartner.engagementWeek 
                    ? 'Congratulations on your engagement!' 
                    : 'Your relationship is strong enough to propose!'}
              </Text>
            </BlurView>
          </View>
        ) : currentProfile && (
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            style={styles.profileCardContainer}
          >
            {swipeEnabled ? (
              <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
                <Animated.View
                  style={[
                    styles.profileCard,
                    {
                      transform: [
                        { translateX },
                        { translateY },
                        { rotate: rotateInterpolate },
                        { scale: scaleAnim },
                      ],
                    },
                  ]}
                >
                  {renderCardContent()}
                </Animated.View>
              </PanGestureHandler>
            ) : (
              <Animated.View style={styles.profileCard}>{renderCardContent()}</Animated.View>
            )}
        </MotiView>
        )}

        {/* Scroll Indicator with Glassmorphism */}
        {showScrollIndicator && (
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            style={styles.scrollIndicatorContainer}
          >
            <Animated.View style={[styles.scrollIndicator, { opacity: scrollIndicatorAnim }]}>
              <BlurView intensity={80} tint={settings.darkMode ? 'dark' : 'light'} style={styles.scrollIndicatorBlur}>
                <ChevronDown size={18} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.scrollIndicatorText, settings.darkMode && styles.scrollIndicatorTextDark]}>
                  More Profiles
                </Text>
                <ChevronDown size={18} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </BlurView>
            </Animated.View>
          </MotiView>
        )}

        {/* Matches Section with Glassmorphism */}
        {matches.length > 0 && (
          <View style={styles.matchesSection}>
            <Text style={[styles.matchesTitle, settings.darkMode && styles.matchesTitleDark]}>
              Your Matches
            </Text>
            <View style={styles.matchesList}>
              {matches.map((match, index) => (
                <BlurView key={index} intensity={60} tint={settings.darkMode ? 'dark' : 'light'} style={styles.matchItem}>
                  <Image source={{ uri: match.image }} style={styles.matchImage} />
                  <View style={styles.matchInfo}>
                    <Text style={[styles.matchName, settings.darkMode && styles.matchNameDark]}>
                      {match.name}, {match.age}
                    </Text>
                    <Text style={[styles.matchJob, settings.darkMode && styles.matchJobDark]}>
                      {match.job}
                    </Text>
                    <View style={styles.matchWealth}>
                      <Text style={styles.wealthIcon}>{getWealthIcon(match.wealth)}</Text>
                      <Text style={[styles.matchWealthText, settings.darkMode && styles.matchWealthTextDark]}>
                        {match.wealth}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.matchIncome}>
                    <DollarSign size={16} color={settings.darkMode ? '#9FA4B3' : '#6B7280'} />
                    <Text style={[styles.matchIncomeText, settings.darkMode && styles.matchIncomeTextDark]}>
                      Hidden
                    </Text>
                  </View>
                </BlurView>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Glassmorphism Floating Action Buttons - Only show when no partner */}
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
              <BlurView intensity={80} tint="light" style={styles.actionButtonBlur}>
                <View style={[styles.actionButtonInner, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <X size={28} color="#FFFFFF" />
                </View>
              </BlurView>
            </Animated.View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.likeButton} 
            onPress={handleLikeWithLoading}
            disabled={isLoading}
          >
            <Animated.View style={{ transform: [{ scale: likeButtonScale }] }}>
              <BlurView intensity={80} tint="light" style={styles.actionButtonBlur}>
                <View style={[styles.actionButtonInner, { backgroundColor: 'rgba(16, 185, 129, 0.3)' }]}>
                  <Heart size={28} color="#FFFFFF" />
                </View>
              </BlurView>
            </Animated.View>
          </TouchableOpacity>
        </MotiView>
      )}

      {/* Proposal Modal */}
      <Modal
        visible={showProposalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProposalModal(false)}
      >
        <View style={styles.proposalModalOverlay}>
          <View style={[styles.proposalModalContent, settings.darkMode && styles.proposalModalContentDark]}>
            <Text style={[styles.proposalModalTitle, settings.darkMode && { color: '#F9FAFB' }]}>
              Choose an Engagement Ring
            </Text>
            <Text style={[styles.proposalModalSubtitle, settings.darkMode && { color: '#9CA3AF' }]}>
              Better rings increase your chances of success!
            </Text>
            
            <ScrollView style={styles.ringList} showsVerticalScrollIndicator={false}>
              {ENGAGEMENT_RINGS.map(ring => {
                const isSelected = selectedRingId === ring.id;
                const canAfford = gameState.stats.money >= ring.price;
                
                return (
                  <TouchableOpacity
                    key={ring.id}
                    style={[
                      styles.ringOption,
                      isSelected && styles.ringOptionSelected,
                      !canAfford && styles.ringOptionDisabled,
                    ]}
                    onPress={() => canAfford && setSelectedRingId(ring.id)}
                    disabled={!canAfford}
                  >
                    <View style={[styles.ringTier, { backgroundColor: getTierColor(ring.qualityTier) }]}>
                      <Text style={styles.ringTierText}>{ring.qualityTier.toUpperCase()}</Text>
    </View>
                    <View style={styles.ringInfo}>
                      <Text style={[styles.ringName, settings.darkMode && { color: '#F9FAFB' }]}>
                        {ring.name}
                      </Text>
                      <Text style={[styles.ringDesc, settings.darkMode && { color: '#9CA3AF' }]} numberOfLines={1}>
                        {ring.description}
                      </Text>
                    </View>
                    <View style={styles.ringPriceContainer}>
                      <Text style={[styles.ringPrice, !canAfford && { color: '#EF4444' }]}>
                        ${ring.price.toLocaleString()}
                      </Text>
                      <Text style={[styles.ringBonus, settings.darkMode && { color: '#9CA3AF' }]}>
                        +{ring.acceptanceBonus}% chance
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.proposalModalButtons}>
              <TouchableOpacity
                style={[styles.proposalCancelBtn]}
                onPress={() => {
                  setShowProposalModal(false);
                  setSelectedRingId(null);
                }}
              >
                <Text style={styles.proposalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.proposalConfirmBtn, !selectedRingId && { opacity: 0.5 }]}
                disabled={!selectedRingId}
                onPress={() => {
                  if (!selectedRingId || !existingPartner) return;
                  const result = proposeMarriage(
                    gameState,
                    setGameState,
                    existingPartner.id,
                    selectedRingId,
                    { updateMoney, updateStats }
                  );
                  if (result.success) {
                    saveGame();
                    setShowProposalModal(false);
                    setSelectedRingId(null);
                    Alert.alert(
                      result.accepted ? '💍 They Said Yes!' : '💔 Not Ready Yet',
                      result.message
                    );
                  } else {
                    Alert.alert('Cannot Propose', result.message);
                  }
                }}
              >
                <Circle size={scale(18)} color="#FFF" fill="#FFF" />
                <Text style={styles.proposalConfirmText}>Propose</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerBlur: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(25px) saturate(180%)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
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
    color: '#1F2937',
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  headerSubtitleDark: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120, // Add space for floating buttons
  },
  contentLocked: {
    paddingTop: scale(64),
  },
  profileCardContainer: {
    marginBottom: 16,
  },
  profileCard: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  cardBlur: {
    borderRadius: 36,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(25px) saturate(180%)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
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
    height: 120,
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
    top: 24,
    right: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  wealthBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  wealthIcon: {
    fontSize: 18,
  },
  wealthText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    ...Platform.select({
      web: { textShadow: '0px 1px 1px rgba(0, 0, 0, 0.3)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
    }),
  },
  profileInfo: {
    padding: 24,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  viewDetailsButton: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  viewDetailsButtonBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  viewDetailsButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  viewDetailsButtonTextDark: {
    color: '#FFFFFF',
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
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '700',
  },
  profileNameDark: {
    color: '#FFFFFF',
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
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  distanceTextDark: {
    color: '#9FA4B3',
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
    borderRadius: 24,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
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
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailLabelDark: {
    color: '#9FA4B3',
  },
  detailValue: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  detailValueDark: {
    color: '#FFFFFF',
  },
  bioContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  profileBio: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  profileBioDark: {
    color: '#F3F4F6',
  },
  interestsSection: {
    marginTop: 8,
  },
  interestsTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  interestsTitleDark: {
    color: '#FFFFFF',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestTag: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  interestText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  interestTextDark: {
    color: '#FFFFFF',
  },
  scrollIndicatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  scrollIndicator: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  scrollIndicatorBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 28,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  scrollIndicatorText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollIndicatorTextDark: {
    color: '#FFFFFF',
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
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  likeButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  actionButtonBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(25px) saturate(180%)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  actionButtonInner: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
  },
  matchesSection: {
    marginTop: 16,
  },
  matchesTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  matchesTitleDark: {
    color: '#FFFFFF',
  },
  matchesList: {
    gap: 12,
  },
  matchItem: {
    padding: 16,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  matchImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  matchNameDark: {
    color: '#FFFFFF',
  },
  matchJob: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 4,
  },
  matchJobDark: {
    color: '#9FA4B3',
  },
  matchWealth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchWealthText: {
    color: '#6B7280',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  matchWealthTextDark: {
    color: '#9FA4B3',
  },
  matchIncome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchIncomeText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  matchIncomeTextDark: {
    color: '#9FA4B3',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBackdropBlur: {
    ...StyleSheet.absoluteFillObject,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 36,
    overflow: 'hidden',
  },
  modalBlur: {
    padding: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 36,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(25px) saturate(180%)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.25)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  modalTitle: {
    color: '#1F2937',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  matchContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  matchImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  matchImageBlur: {
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  matchModalImage: {
    width: 120,
    height: 120,
    resizeMode: 'cover',
  },
  matchModalName: {
    color: '#1F2937',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  matchModalNameDark: {
    color: '#FFFFFF',
  },
  matchModalJob: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 16,
  },
  matchModalJobDark: {
    color: '#9FA4B3',
  },
  matchModalDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  matchModalDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  matchModalDetailText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  matchModalDetailTextDark: {
    color: '#FFFFFF',
  },
  matchModalMessage: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  matchModalMessageDark: {
    color: '#9FA4B3',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalButtonBlur: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  modalButtonInner: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  cancelButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonTextDark: {
    color: '#FFFFFF',
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
    borderRadius: 24,
    overflow: 'hidden',
  },
  settingsButtonBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  settingsButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButtonTextDark: {
    color: '#FFFFFF',
  },
  profileDetailsModal: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 36,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  profileDetailsBlur: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 36,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(25px) saturate(180%)',
      },
    }),
  },
  profileDetailsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
  },
  profileDetailsInfoHeader: {
    marginBottom: 20,
  },
  profileDetailsTitle: {
    color: '#1F2937',
    fontSize: 22,
    fontWeight: '700',
  },
  profileDetailsTitleDark: {
    color: '#FFFFFF',
  },
  closeDetailsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  closeButtonBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  profileDetailsScrollView: {
    flex: 1,
  },
  profileDetailsContent: {
    paddingBottom: 20,
    paddingHorizontal: 0,
  },
  profileDetailsImageContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  profileDetailsImage: {
    width: '100%',
    height: 320,
    resizeMode: 'cover',
  },
  profileDetailsWealthBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  profileDetailsInfo: {
    padding: 24,
  },
  profileDetailsName: {
    color: '#1F2937',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  profileDetailsNameDark: {
    color: '#FFFFFF',
  },
  lockedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: scale(32),
    paddingBottom: scale(32),
  },
  lockedCard: {
    padding: 32,
    borderRadius: 36,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(25px) saturate(180%)',
      },
    }),
  },
  lockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  lockedIconText: {
    fontSize: 36,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  lockedTitleDark: {
    color: '#FFFFFF',
  },
  lockedMessage: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  lockedMessageDark: {
    color: '#D1D5DB',
  },
  lockedSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  lockedSubtextDark: {
    color: '#9CA3AF',
  },
  // New UX Enhancement Styles
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  quickStatText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 100,
  },
  quickStatTextDark: {
    color: '#D1D5DB',
  },
  interestsPreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 12,
    gap: 10,
  },
  interestTagPreview: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  interestTagPreviewText: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
  },
  interestTagPreviewTextDark: {
    color: '#FFFFFF',
  },
  moreInterestsTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px) saturate(180%)',
      },
    }),
  },
  moreInterestsText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  moreInterestsTextDark: {
    color: '#9CA3AF',
  },
  // Partner action styles
  partnerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginTop: scale(16),
    marginBottom: scale(12),
  },
  partnerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(12),
    gap: scale(6),
  },
  partnerActionText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  partnerHint: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: scale(8),
  },
  partnerHintDark: {
    color: '#9CA3AF',
  },
  // Proposal modal styles
  proposalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  proposalModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: scale(20),
    maxHeight: '80%',
  },
  proposalModalContentDark: {
    backgroundColor: '#1F2937',
  },
  proposalModalTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  proposalModalSubtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: scale(4),
    marginBottom: scale(16),
  },
  ringList: {
    maxHeight: scale(320),
  },
  ringOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    marginBottom: scale(8),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringOptionSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  ringOptionDisabled: {
    opacity: 0.5,
  },
  ringTier: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
  },
  ringTierText: {
    color: '#FFFFFF',
    fontSize: fontScale(9),
    fontWeight: '700',
  },
  ringInfo: {
    flex: 1,
    marginLeft: scale(10),
  },
  ringName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  ringDesc: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
  },
  ringPriceContainer: {
    alignItems: 'flex-end',
  },
  ringPrice: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#22C55E',
  },
  ringBonus: {
    fontSize: fontScale(10),
    color: '#6B7280',
  },
  proposalModalButtons: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: scale(16),
  },
  proposalCancelBtn: {
    flex: 1,
    paddingVertical: scale(14),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    alignItems: 'center',
  },
  proposalCancelText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#6B7280',
  },
  proposalConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: scale(14),
    backgroundColor: '#F59E0B',
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
  },
  proposalConfirmText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});