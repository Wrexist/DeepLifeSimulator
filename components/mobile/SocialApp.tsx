import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Users, MessageCircle, Heart, UserPlus, Settings, Send, MoreHorizontal, Camera, UserCheck } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

interface SocialAppProps {
  onBack: () => void;
}

interface Post {
  id: string;
  author: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: string;
  isLiked: boolean;
  photo?: string;
  authorPhoto?: string;
  isPlayerPost?: boolean;
}

interface Person {
  id: string;
  name: string;
  age: number;
  bio: string;
  photo: string;
  interests: string[];
  isAdded: boolean;
}

const randomPeople: Person[] = [
  {
    id: '1',
    name: 'Jessica Kim',
    age: 24,
    bio: 'Coffee enthusiast and book lover 📚',
    photo: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face',
    interests: ['Reading', 'Coffee', 'Travel'],
    isAdded: false,
  },
  {
    id: '2',
    name: 'David Thompson',
    age: 28,
    bio: 'Software developer by day, musician by night 🎸',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    interests: ['Music', 'Coding', 'Gaming'],
    isAdded: false,
  },
  {
    id: '3',
    name: 'Maria Garcia',
    age: 26,
    bio: 'Fitness trainer and yoga instructor 🧘‍♀️',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    interests: ['Fitness', 'Yoga', 'Healthy Living'],
    isAdded: false,
  },
  {
    id: '4',
    name: 'James Wilson',
    age: 30,
    bio: 'Photographer capturing life\'s beautiful moments 📸',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    interests: ['Photography', 'Travel', 'Art'],
    isAdded: false,
  },
  {
    id: '5',
    name: 'Sophie Anderson',
    age: 22,
    bio: 'Student studying environmental science 🌱',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    interests: ['Environment', 'Science', 'Hiking'],
    isAdded: false,
  },
  {
    id: '6',
    name: 'Ryan Park',
    age: 27,
    bio: 'Chef creating culinary masterpieces 👨‍🍳',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    interests: ['Cooking', 'Food', 'Travel'],
    isAdded: false,
  },
  {
    id: '7',
    name: 'Lisa Chen',
    age: 25,
    bio: 'Graphic designer with a passion for creativity 🎨',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    interests: ['Design', 'Art', 'Technology'],
    isAdded: false,
  },
  {
    id: '8',
    name: 'Tom Martinez',
    age: 29,
    bio: 'Entrepreneur building the next big thing 💼',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
    interests: ['Business', 'Technology', 'Innovation'],
    isAdded: false,
  },
];

const randomPosts: Post[] = [
  {
    id: 'random1',
    author: 'Sarah Johnson',
    content: 'Just finished my morning workout! 💪 Feeling energized and ready for the day. #fitness #motivation',
    likes: 24,
    comments: 8,
    timestamp: '2h ago',
    isLiked: false,
    photo: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random2',
    author: 'Mike Chen',
    content: 'Amazing sunset at the beach today. Sometimes you just need to pause and appreciate the beauty around you. 🌅',
    likes: 156,
    comments: 23,
    timestamp: '4h ago',
    isLiked: true,
    photo: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random3',
    author: 'Emma Davis',
    content: 'New coffee shop opened downtown! The latte art is incredible. ☕️ Anyone want to join me for a coffee date?',
    likes: 89,
    comments: 15,
    timestamp: '6h ago',
    isLiked: false,
    photo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random4',
    author: 'Alex Rodriguez',
    content: 'Working on some exciting new projects. Can\'t wait to share what we\'ve been building! 🚀 #startup #innovation',
    likes: 203,
    comments: 31,
    timestamp: '8h ago',
    isLiked: false,
    authorPhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random5',
    author: 'Jessica Kim',
    content: 'Just finished reading an amazing book! 📚 The character development was incredible. Any book recommendations?',
    likes: 67,
    comments: 12,
    timestamp: '1d ago',
    isLiked: false,
    authorPhoto: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random6',
    author: 'David Thompson',
    content: 'Late night coding session with some great music playing. Sometimes the best ideas come at 2 AM! 🎵💻',
    likes: 134,
    comments: 18,
    timestamp: '1d ago',
    isLiked: false,
    authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random7',
    author: 'Maria Garcia',
    content: 'Morning yoga session complete! 🧘‍♀️ Starting the day with positive energy and mindfulness. Namaste!',
    likes: 98,
    comments: 14,
    timestamp: '2d ago',
    isLiked: false,
    photo: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random8',
    author: 'James Wilson',
    content: 'Captured this incredible moment during golden hour. Photography is all about being at the right place at the right time! 📸',
    likes: 287,
    comments: 42,
    timestamp: '2d ago',
    isLiked: false,
    photo: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random9',
    author: 'Sophie Anderson',
    content: 'Field research day! 🌱 Studying the local ecosystem and documenting biodiversity. Nature never ceases to amaze me.',
    likes: 76,
    comments: 9,
    timestamp: '3d ago',
    isLiked: false,
    photo: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random10',
    author: 'Ryan Park',
    content: 'New recipe experiment in the kitchen! 👨‍🍳 This fusion dish turned out better than expected. Food is art!',
    likes: 145,
    comments: 23,
    timestamp: '3d ago',
    isLiked: false,
    photo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
    authorPhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random11',
    author: 'Lisa Chen',
    content: 'Working on a new design project! 🎨 Creativity flows best when you\'re inspired by the world around you.',
    likes: 112,
    comments: 16,
    timestamp: '4d ago',
    isLiked: false,
    authorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 'random12',
    author: 'Tom Martinez',
    content: 'Pitch meeting went amazing! 💼 Sometimes you have to believe in your vision even when others don\'t see it yet.',
    likes: 189,
    comments: 28,
    timestamp: '4d ago',
    isLiked: false,
    authorPhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face',
  },
];

export default function SocialApp({ onBack }: SocialAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'feed' | 'friends'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>(randomPeople);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const likeAnimations = useRef<{ [key: string]: Animated.Value }>({});
  const postAnimations = useRef<{ [key: string]: Animated.Value }>({});

  // Initialize posts with random selection
  useEffect(() => {
    let isMounted = true;
    const shuffledPosts = [...randomPosts].sort(() => Math.random() - 0.5);
    const selectedPosts = shuffledPosts.slice(0, Math.min(15, shuffledPosts.length));
    
    if (isMounted) {
      setPosts(selectedPosts);
      
      // Initialize animations for posts
      selectedPosts.forEach(post => {
        if (!postAnimations.current[post.id]) {
          postAnimations.current[post.id] = new Animated.Value(0);
        }
        const animation = Animated.timing(postAnimations.current[post.id], {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        });
        
        if (isMounted) {
          animation.start();
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLike = useCallback((postId: string) => {
    // Initialize animation if not exists
    if (!likeAnimations.current[postId]) {
      likeAnimations.current[postId] = new Animated.Value(1);
    }

    // Animate like button
    Animated.sequence([
      Animated.timing(likeAnimations.current[postId], {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimations.current[postId], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          isLiked: !post.isLiked,
        };
      }
      return post;
    }));
  }, []);

  const handleCreatePost = useCallback(() => {
    if (!newPostContent.trim()) {
      Alert.alert('Empty Post', 'Please write something before posting.');
      return;
    }

    // Generate random likes between 5 and 45 for player posts
    const randomLikes = Math.floor(Math.random() * 41) + 5; // 5 to 45

    const newPost: Post = {
      id: Date.now().toString(),
      author: 'You',
      content: newPostContent,
      likes: randomLikes,
      comments: Math.floor(Math.random() * 10), // 0 to 9 comments
      timestamp: 'Just now',
      isLiked: false,
      photo: selectedPhoto || undefined,
      authorPhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face', // Default player photo
      isPlayerPost: true,
    };

    setPosts(prev => [newPost, ...prev]);
    setNewPostContent('');
    setSelectedPhoto('');
    setShowNewPostModal(false);
    Alert.alert('Posted!', `Your post has been shared! You got ${randomLikes} likes!`);
  }, [newPostContent, selectedPhoto]);

  const handleAddPerson = useCallback((person: Person) => {
    // Add person to contacts with 0 relationship score
    const newFriend = {
      id: `friend_${person.id}`,
      name: person.name,
      type: 'friend' as const,
      relationshipScore: 0,
      personality: 'friendly',
      gender: 'male' as const,
      age: person.age,
      income: Math.floor(Math.random() * 50000) + 20000,
      actions: {},
    };

    setGameState(prev => ({
      ...prev,
      relationships: [...(prev.relationships || []), newFriend],
    }));
    saveGame();

    // Mark person as added
    setPeople(prev => prev.map(p => 
      p.id === person.id ? { ...p, isAdded: true } : p
    ));

    Alert.alert('Friend Added!', `${person.name} has been added to your contacts. You can now interact with them in the Contacts app!`);
  }, [setGameState, saveGame]);

  const handleAddFromFeed = useCallback((authorName: string) => {
    // Find the person by name
    const person = people.find(p => p.name === authorName);
    if (person && !person.isAdded) {
      setSelectedPerson(person);
      setShowAddFriendModal(true);
    } else if (person && person.isAdded) {
      Alert.alert('Already Added', `${authorName} is already in your contacts!`);
    } else {
      Alert.alert('Not Found', `${authorName} is not available to add.`);
    }
  }, [people]);

  const handleConfirmAddFriend = useCallback(() => {
    if (selectedPerson) {
      handleAddPerson(selectedPerson);
      setShowAddFriendModal(false);
      setSelectedPerson(null);
    }
  }, [selectedPerson, handleAddPerson]);

  const friends = gameState.relationships?.filter(r => r.type === 'friend') || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
          <Settings size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <MessageCircle size={20} color={activeTab === 'feed' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'feed' ? styles.tabTextActive : styles.tabTextInactive]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <UserPlus size={20} color={activeTab === 'friends' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'friends' ? styles.tabTextActive : styles.tabTextInactive]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {activeTab === 'feed' && (
          <View style={styles.feedContainer}>
            {/* Create Post Button */}
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => setShowNewPostModal(true)}
            >
              <Text style={styles.createPostText}>Create New Post</Text>
            </TouchableOpacity>

            {/* Posts */}
            {posts.map((post) => (
              <Animated.View 
                key={post.id} 
                style={[
                  styles.postCard,
                  {
                    opacity: postAnimations.current[post.id] || 1,
                    transform: [{
                      translateY: postAnimations.current[post.id]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      }) || 0,
                    }],
                  },
                ]}
              >
                <View style={styles.postHeader}>
                  <View style={styles.postAuthor}>
                    <Image 
                      source={{ uri: post.authorPhoto || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' }} 
                      style={styles.authorPhoto} 
                    />
                    <View style={styles.authorInfo}>
                      <Text style={styles.authorName}>{post.author}</Text>
                      <Text style={styles.postTimestamp}>{post.timestamp}</Text>
                    </View>
                  </View>
                                     <View style={styles.postHeaderActions}>
                     <TouchableOpacity style={styles.moreButton}>
                       <MoreHorizontal size={16} color="#9FA4B3" />
                     </TouchableOpacity>
                     {post.author !== 'You' && (
                       <TouchableOpacity 
                         style={styles.addFromFeedButton}
                         onPress={() => handleAddFromFeed(post.author)}
                       >
                         <UserPlus size={16} color="#3B82F6" />
                       </TouchableOpacity>
                     )}
                   </View>
                </View>

                <Text style={styles.postContent}>{post.content}</Text>

                {post.photo && (
                  <Image source={{ uri: post.photo }} style={styles.postImage} />
                )}

                <View style={styles.postActions}>
                  <Animated.View style={{ transform: [{ scale: likeAnimations.current[post.id] || 1 }] }}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleLike(post.id)}
                    >
                      <Heart size={16} color={post.isLiked ? '#EF4444' : '#9FA4B3'} fill={post.isLiked ? '#EF4444' : 'none'} />
                      <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                        {post.likes}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <TouchableOpacity style={styles.actionButton}>
                    <MessageCircle size={16} color="#9FA4B3" />
                    <Text style={styles.actionText}>{post.comments}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {activeTab === 'friends' && (
          <View style={styles.friendsContainer}>
            <Text style={styles.sectionTitle}>Discover New People</Text>
            <Text style={styles.sectionSubtitle}>Add people to your contacts to build relationships</Text>
            
            {people.map((person) => (
              <View key={person.id} style={styles.personCard}>
                <Image source={{ uri: person.photo }} style={styles.personPhoto} />
                
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.name}, {person.age}</Text>
                  <Text style={styles.personBio}>{person.bio}</Text>
                  
                  <View style={styles.interestsContainer}>
                    {person.interests.map((interest, index) => (
                      <View key={index} style={styles.interestTag}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.addButton, person.isAdded && styles.addedButton]}
                  onPress={() => handleAddPerson(person)}
                  disabled={person.isAdded}
                >
                  {person.isAdded ? (
                    <>
                      <UserCheck size={16} color="#10B981" />
                      <Text style={styles.addedText}>Added</Text>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} color="#FFFFFF" />
                      <Text style={styles.addButtonText}>Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Post Modal */}
      <Modal visible={showNewPostModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => setShowNewPostModal(false)}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.postInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#9FA4B3"
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              textAlignVertical="top"
            />

            {selectedPhoto && (
              <View style={styles.photoPreview}>
                <Image source={{ uri: selectedPhoto }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => setSelectedPhoto('')}
                >
                  <Text style={styles.removePhotoText}>Remove Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={() => setShowPhotoPicker(true)}
              >
                <Camera size={16} color="#3B82F6" />
                <Text style={styles.photoButtonText}>Add Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.postButton, !newPostContent.trim() && styles.disabledButton]}
                onPress={handleCreatePost}
                disabled={!newPostContent.trim()}
              >
                <Text style={styles.postButtonText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Picker Modal */}
      <Modal visible={showPhotoPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Photo</Text>
            
            <View style={styles.photoGrid}>
              {[
                'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
                'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop',
                'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&h=200&fit=crop',
                'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=200&fit=crop',
                'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop',
                'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
              ].map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.photoOption}
                  onPress={() => {
                    setSelectedPhoto(photo);
                    setShowPhotoPicker(false);
                  }}
                >
                  <Image source={{ uri: photo }} style={styles.photoOptionImage} />
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPhotoPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Settings</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <TouchableOpacity style={styles.toggleButton}>
                <Text style={styles.toggleText}>On</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Privacy</Text>
              <TouchableOpacity style={styles.toggleButton}>
                <Text style={styles.toggleText}>Public</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Auto-save Posts</Text>
              <TouchableOpacity style={styles.toggleButton}>
                <Text style={styles.toggleText}>Off</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={showAddFriendModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            
            {selectedPerson && (
              <View style={styles.addFriendContent}>
                <Image source={{ uri: selectedPerson.photo }} style={styles.addFriendPhoto} />
                <Text style={styles.addFriendName}>{selectedPerson.name}, {selectedPerson.age}</Text>
                <Text style={styles.addFriendBio}>{selectedPerson.bio}</Text>
                
                <View style={styles.interestsContainer}>
                  {selectedPerson.interests.map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
                
                <Text style={styles.addFriendMessage}>
                  Add {selectedPerson.name} to your contacts? You can then interact with them in the Contacts app to build your relationship.
                </Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddFriendModal(false);
                  setSelectedPerson(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.addFriendButton}
                onPress={handleConfirmAddFriend}
              >
                <Text style={styles.addFriendButtonText}>Add Friend</Text>
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
    fontSize: 18,
    fontWeight: '800',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    marginHorizontal: 16,
    backgroundColor: '#0F1220',
    borderRadius: 12,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    marginBottom: 16,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#101426',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  feedContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  createPostButton: {
    backgroundColor: '#0F1220',
    borderRadius: 12,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
    alignItems: 'center',
  },
  createPostText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  postCard: {
    backgroundColor: '#0F1220',
    borderRadius: 12,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  postAuthor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  postTimestamp: {
    color: '#9FA4B3',
    fontSize: 12,
    marginTop: 2,
  },
  postHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  moreButton: {
    padding: 4,
  },
  addFromFeedButton: {
    padding: 4,
  },
  postContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#9FA4B3',
    fontSize: 14,
  },
  likedText: {
    color: '#EF4444',
  },
  friendsContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#9FA4B3',
    fontSize: 14,
    marginBottom: 16,
  },
  personCard: {
    backgroundColor: '#0F1220',
    borderRadius: 12,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  personBio: {
    color: '#9FA4B3',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: '#1A1D29',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  interestText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addedButton: {
    backgroundColor: '#10B981',
  },
  addedText: {
    color: '#FFFFFF',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  postInput: {
    backgroundColor: '#1A1D29',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  photoPreview: {
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  removePhotoButton: {
    alignSelf: 'flex-start',
  },
  removePhotoText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  photoButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#6B7280',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  photoOption: {
    width: '30%',
    aspectRatio: 1,
  },
  photoOptionImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#23283B',
    borderBottomWidth: 1,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  toggleButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addFriendContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  addFriendPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  addFriendName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  addFriendBio: {
    color: '#9FA4B3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  addFriendMessage: {
    color: '#9FA4B3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },
  addFriendButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 12,
  },
  addFriendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
