/**
 * Dating Profiles
 * 
 * Shared dating profiles that can be used across the app
 * for social media posts and other features
 */

export interface DatingProfile {
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

export const DATING_PROFILES: DatingProfile[] = [
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
    bio: 'Student and part-time barista ☕️ Love books, music, and deep conversations.',
    interests: ['Reading', 'Music', 'Coffee', 'Philosophy'],
    image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&h=600&fit=crop&crop=face',
    distance: 1,
    wealth: 'poor',
    income: 15000,
    personality: 'intellectual',
    gender: 'female',
    seekingGender: 'male',
    photos: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Student',
    education: 'Bachelor\'s Degree (In Progress)',
  },
  {
    id: '7',
    name: 'Michael Chen',
    age: 27,
    bio: 'Software engineer who loves gaming and tech 🎮 Always up for a good conversation about the latest innovations.',
    interests: ['Gaming', 'Technology', 'Coding', 'Anime'],
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    distance: 3,
    wealth: 'average',
    income: 75000,
    personality: 'tech-savvy',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Software Engineer',
    education: 'Bachelor\'s Degree',
  },
  {
    id: '8',
    name: 'David Martinez',
    age: 29,
    bio: 'Fitness coach and nutritionist 💪 Helping people transform their lives, one workout at a time.',
    interests: ['Fitness', 'Nutrition', 'Health', 'Motivation'],
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=600&fit=crop&crop=face',
    distance: 4,
    wealth: 'average',
    income: 55000,
    personality: 'motivational',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Fitness Coach',
    education: 'Certification',
  },
  {
    id: '9',
    name: 'James Wilson',
    age: 31,
    bio: 'Investment banker with a passion for travel and fine dining 🍷 Looking for someone to share adventures with.',
    interests: ['Finance', 'Travel', 'Fine Dining', 'Wine'],
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    distance: 2,
    wealth: 'wealthy',
    income: 150000,
    personality: 'sophisticated',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Investment Banker',
    education: 'MBA',
  },
  {
    id: '10',
    name: 'Ryan Taylor',
    age: 26,
    bio: 'Musician and music producer 🎵 Creating beats and looking for someone who appreciates good vibes.',
    interests: ['Music', 'Production', 'Concerts', 'Art'],
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=600&fit=crop&crop=face',
    distance: 5,
    wealth: 'average',
    income: 40000,
    personality: 'artistic',
    gender: 'male',
    seekingGender: 'female',
    photos: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=600&fit=crop&crop=face',
    ],
    job: 'Music Producer',
    education: 'Music Degree',
  },
];

