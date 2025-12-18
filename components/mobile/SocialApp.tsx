/**
 * Social App - X.com Style Redesign
 * 
 * Complete social media experience with profile customization,
 * X.com-style feed, photo uploads, and engagement features
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import {
  ArrowLeft,
  Home,
  Search,
  Bell,
  Mail,
  Feather,
  User,
  TrendingUp,
  Hash,
  BadgeCheck,
  Heart,
  DollarSign,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';
import ProfileHeader from './social/ProfileHeader';
import PostCard from './social/PostCard';
import PostComposer from './social/PostComposer';
import ProfileEditModal, { ProfileData } from './social/ProfileEditModal';
import DMSystem from './social/DMSystem';
import { 
  calculateFollowerGrowth, 
  checkViralChance, 
  getInfluenceLevelInfo,
  getEnergyCost,
  getHealthCost,
  getHappinessGain,
  getCooldownTime,
  canCreateContent,
  calculatePostAdRevenue,
  calculatePostEngagement,
  calculateNewFollowersFromPost,
  calculateWeeklyImpressionEarnings,
  calculateTipsRevenue,
  type ContentType,
  type InfluenceLevel,
} from '@/lib/social/socialMedia';
import type { SocialPost } from '@/contexts/game/types';
import { PLACEHOLDER_IMAGES } from '@/utils/imageUtils';

interface SocialAppProps {
  onBack: () => void;
}

type TabType = 'feed' | 'profile' | 'trending' | 'notifications' | 'messages';

// Generate fake trending topics
const TRENDING_TOPICS = [
  { tag: '#TechNews', posts: '125K', category: 'Technology' },
  { tag: '#MondayMotivation', posts: '89K', category: 'Lifestyle' },
  { tag: '#GameDay', posts: '234K', category: 'Sports' },
  { tag: '#NewMusic', posts: '67K', category: 'Entertainment' },
  { tag: '#CryptoUpdate', posts: '156K', category: 'Finance' },
  { tag: '#FoodieLife', posts: '45K', category: 'Food' },
  { tag: '#TravelTuesday', posts: '78K', category: 'Travel' },
  { tag: '#FitnessGoals', posts: '93K', category: 'Health' },
];

// Generate fake feed posts with realistic engagement based on follower counts
const generateFakePosts = (): SocialPost[] => {
  // Authors with varying follower counts for realistic engagement simulation
  const fakeAuthors = [
    { name: 'Tech Daily', handle: 'techdaily', verified: true, followers: 2_500_000, photo: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=100&h=100&fit=crop' },
    { name: 'Sarah Johnson', handle: 'sarahjohnson', verified: false, followers: 8_500, photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
    { name: 'Gaming World', handle: 'gamingworld', verified: true, followers: 850_000, photo: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop' },
    { name: 'Mike Chen', handle: 'mikechen', verified: false, followers: 3_200, photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
    { name: 'Fitness Pro', handle: 'fitnesspro', verified: true, followers: 125_000, photo: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100&h=100&fit=crop' },
    { name: 'News Now', handle: 'newsnow', verified: true, followers: 5_000_000, photo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=100&h=100&fit=crop' },
    { name: 'Coffee Lover', handle: 'coffeelover', verified: false, followers: 450, photo: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop' },
    { name: 'Travel Bug', handle: 'travelbug', verified: false, followers: 45_000, photo: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=100&h=100&fit=crop' },
  ];
  
  const contents = [
    'Just launched our new product! Check it out at the link in bio 🚀',
    'Amazing sunset today. Nature never disappoints 🌅',
    'New game releases this week! Which one are you most excited for? 🎮',
    'Working on something exciting. Stay tuned! 👀',
    'Morning workout done! Consistency is key 💪',
    'Breaking: Major tech company announces new AI features',
    'Best coffee shop in the city. Fight me ☕',
    'Finally finished that book I\'ve been reading. Highly recommend! 📚',
    'Travel tip: Always pack a portable charger. Trust me.',
    'Just hit a new personal record at the gym! 🏋️',
  ];
  
  // Helper to calculate realistic engagement for fake posts
  const getRealisticEngagement = (followers: number, hasPhoto: boolean) => {
    // Engagement rate decreases as followers increase (realistic pattern)
    let engagementRate: number;
    if (followers < 1_000) {
      engagementRate = 0.08 + Math.random() * 0.07; // 8-15%
    } else if (followers < 10_000) {
      engagementRate = 0.04 + Math.random() * 0.04; // 4-8%
    } else if (followers < 100_000) {
      engagementRate = 0.02 + Math.random() * 0.02; // 2-4%
    } else if (followers < 1_000_000) {
      engagementRate = 0.01 + Math.random() * 0.01; // 1-2%
    } else {
      engagementRate = 0.005 + Math.random() * 0.01; // 0.5-1.5%
    }
    
    // Photos get slightly more engagement
    if (hasPhoto) engagementRate *= 1.3;
    
    // Random variation
    engagementRate *= (0.7 + Math.random() * 0.6);
    
    const likes = Math.max(1, Math.floor(followers * engagementRate));
    const comments = Math.max(0, Math.floor(likes * (0.01 + Math.random() * 0.04)));
    const reposts = Math.max(0, Math.floor(likes * (0.05 + Math.random() * 0.10)));
    const views = Math.floor(likes * (10 + Math.random() * 20));
    const bookmarks = Math.max(0, Math.floor(likes * (0.01 + Math.random() * 0.02)));
    
    return { likes, comments, reposts, views, bookmarks };
  };
  
  return contents.map((content, index) => {
    const author = fakeAuthors[index % fakeAuthors.length];
    const hasPhoto = Math.random() > 0.5;
    const engagement = getRealisticEngagement(author.followers, hasPhoto);
    
    return {
      id: `fake-${index}`,
      authorId: `author-${index}`,
      authorName: author.name,
      authorHandle: author.handle,
      authorPhoto: author.photo,
      authorVerified: author.verified,
      content,
      photo: hasPhoto ? `https://images.unsplash.com/photo-${1550000000000 + index * 10000}?w=400&h=300&fit=crop` : undefined,
      timestamp: Date.now() - (index * 3600000),
      gameWeek: 1,
      likes: engagement.likes,
      reposts: engagement.reposts,
      replies: engagement.comments,
      bookmarks: engagement.bookmarks,
      views: engagement.views,
      isLiked: Math.random() > 0.7,
      isReposted: Math.random() > 0.9,
      isBookmarked: false,
      isPlayerPost: false,
      isViral: false,
    };
  });
};

export default function SocialApp({ onBack }: SocialAppProps) {
  const { gameState, setGameState, updateMoney, saveGame } = useGame();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [showComposer, setShowComposer] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fakePosts] = useState(generateFakePosts);
  
  const userProfile = gameState.userProfile || {
    name: 'Player',
    handle: '@player',
    bio: 'Living my best life!',
    followers: 0,
    following: 0,
    gender: 'male' as const,
    seekingGender: 'female' as const,
  };
  
  const socialMedia = gameState.socialMedia || {
    followers: 0,
    influenceLevel: 'novice' as const,
    totalPosts: 0,
    viralPosts: 0,
    brandPartnerships: 0,
    engagementRate: 0,
    recentPosts: [],
  };
  
  const influenceInfo = useMemo(
    () => getInfluenceLevelInfo(socialMedia.influenceLevel || 'novice'),
    [socialMedia.influenceLevel]
  );
  
  // Get player posts from state
  const playerPosts: SocialPost[] = useMemo(() => {
    const recentPosts = socialMedia.recentPosts || [];
    return recentPosts.map((post, index) => ({
      id: post.id || `player-${index}`,
      authorId: 'player',
      authorName: userProfile.displayName || userProfile.name || 'Player',
      authorHandle: userProfile.username || userProfile.handle?.replace('@', '') || 'player',
      authorPhoto: userProfile.profilePhoto,
      authorVerified: userProfile.verified || false,
      content: post.content,
      photo: post.photo,
      timestamp: post.timestamp,
      gameWeek: gameState.week || 1,
      likes: post.likes,
      reposts: Math.floor(post.likes * 0.1),
      replies: post.comments,
      bookmarks: Math.floor(post.likes * 0.05),
      views: post.likes * 10,
        isLiked: false,
      isReposted: false,
      isBookmarked: false,
        isPlayerPost: true,
      isViral: post.isViral,
    }));
  }, [socialMedia.recentPosts, userProfile, gameState.week]);
  
  // Combined feed with player posts interspersed
  const feedPosts = useMemo(() => {
    const combined = [...fakePosts];
    playerPosts.forEach((post, index) => {
      // Insert player posts at various positions
      const insertIndex = Math.min(index * 3, combined.length);
      combined.splice(insertIndex, 0, post);
    });
    return combined.slice(0, 20); // Limit feed size
  }, [fakePosts, playerPosts]);
  
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handlePost = useCallback(async (content: string, photo?: string) => {
    const contentType: ContentType = photo ? 'photo' : 'text';
    
    // Check if player can create content
    const canPost = canCreateContent(
      gameState.stats.energy,
      contentType,
      socialMedia.lastPostWeek,
      gameState.week
    );
    
    if (!canPost.canCreate) {
      Alert.alert('Cannot Post', canPost.reason || 'You cannot create content right now.');
      return;
    }
    
    // Calculate costs and gains
      const energyCost = getEnergyCost(contentType);
      const healthCost = getHealthCost(contentType);
    
    if (gameState.stats.energy < energyCost) {
      Alert.alert('Not Enough Energy', `You need ${energyCost} energy to post. Rest or drink coffee!`);
      return;
    }
    
    // Check for viral chance first
    const isViral = checkViralChance(socialMedia.influenceLevel, contentType);
    
    // Calculate realistic engagement based on followers (scales naturally)
    const engagement = calculatePostEngagement(
      socialMedia.followers,
        contentType,
      isViral
    );
    
    // Calculate new followers from this post's engagement
    const followerGrowth = calculateNewFollowersFromPost(
      socialMedia.followers,
      engagement,
      isViral
    );
    
    // Calculate earnings based on engagement
    const earnings = calculatePostAdRevenue(
      socialMedia.followers,
      socialMedia.influenceLevel,
      contentType
    );
    
    // Calculate happiness gain (posting feels good!)
    const happinessGain = getHappinessGain(contentType, isViral);
    
    // Use the realistic engagement values
    const postLikes = engagement.likes;
    const postComments = engagement.comments;
    const postReposts = engagement.reposts;
    const postViews = engagement.views;
    
    // Create new post
    const newPost = {
      id: `post-${Date.now()}`,
            content,
      likes: postLikes,
      comments: postComments,
      reposts: postReposts,
      views: postViews,
      timestamp: Date.now(),
            contentType,
      photo,
            isViral,
    };
    
    // Update game state - posting costs energy & health but gives happiness!
    setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
        energy: Math.max(0, prev.stats.energy - energyCost),
        health: Math.max(0, prev.stats.health - healthCost),
        happiness: Math.min(100, prev.stats.happiness + happinessGain),
        },
        socialMedia: {
        ...prev.socialMedia!,
        followers: (prev.socialMedia?.followers || 0) + followerGrowth + (isViral ? 1000 : 0),
        totalPosts: (prev.socialMedia?.totalPosts || 0) + 1,
        viralPosts: (prev.socialMedia?.viralPosts || 0) + (isViral ? 1 : 0),
        lastPostWeek: prev.week,
        lastPostTime: Date.now(),
        totalEarnings: (prev.socialMedia?.totalEarnings || 0) + earnings,
        recentPosts: [
          newPost,
          ...(prev.socialMedia?.recentPosts || []).slice(0, 19),
        ],
      },
      // Update lifetime statistics
      lifetimeStatistics: prev.lifetimeStatistics ? {
        ...prev.lifetimeStatistics,
        totalPostsMade: prev.lifetimeStatistics.totalPostsMade + 1,
        totalViralPosts: prev.lifetimeStatistics.totalViralPosts + (isViral ? 1 : 0),
      } : prev.lifetimeStatistics,
    }));
    
    // Add earnings
    if (earnings > 0) {
      updateMoney(earnings, 'Social media ad revenue', false);
    }
    
    saveGame();
  }, [gameState, socialMedia, setGameState, updateMoney, saveGame]);
  
  const handleLikePost = useCallback((postId: string) => {
    // Just a visual toggle for non-player posts (no state change needed)
  }, []);
  
  const handleBookmarkPost = useCallback((postId: string) => {
      setGameState(prev => {
      const bookmarks = prev.userProfile?.bookmarkedPosts || [];
      const isBookmarked = bookmarks.includes(postId);
        return {
          ...prev,
        userProfile: {
          ...prev.userProfile!,
          bookmarkedPosts: isBookmarked 
            ? bookmarks.filter(id => id !== postId)
            : [...bookmarks, postId],
          },
        };
      });
    saveGame();
  }, [setGameState, saveGame]);
  
  const handleSaveProfile = useCallback(async (data: ProfileData) => {
    setGameState(prev => ({
      ...prev,
      userProfile: {
        ...prev.userProfile!,
        displayName: data.displayName,
        bio: data.bio,
        location: data.location,
        website: data.website,
        profilePhoto: data.profilePhoto,
        headerPhoto: data.headerPhoto,
      },
    }));
    saveGame();
  }, [setGameState, saveGame]);

  const renderFeedTab = useCallback(() => (
    <FlatList
      data={feedPosts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PostCard
          id={item.id}
          authorName={item.authorName}
          authorHandle={item.authorHandle}
          authorPhoto={item.authorPhoto}
          authorVerified={item.authorVerified}
          content={item.content}
          photo={item.photo}
          timestamp={new Date(item.timestamp).toISOString()}
          likes={item.likes}
          reposts={item.reposts}
          replies={item.replies}
          views={item.views}
          bookmarks={item.bookmarks}
          isLiked={item.isLiked}
          isReposted={item.isReposted}
          isBookmarked={(userProfile.bookmarkedPosts || []).includes(item.id)}
          isPlayerPost={item.isPlayerPost}
          isViral={item.isViral}
          onLike={() => handleLikePost(item.id)}
          onBookmark={() => handleBookmarkPost(item.id)}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#1D9BF0"
        />
      }
      ListHeaderComponent={
        <View style={styles.feedHeader}>
          <Text style={styles.feedHeaderTitle}>For You</Text>
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  ), [feedPosts, userProfile.bookmarkedPosts, refreshing, handleRefresh, handleLikePost, handleBookmarkPost]);
  
  const renderProfileTab = useCallback(() => (
    <ScrollView 
      style={styles.profileScroll}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader
        displayName={userProfile.displayName || userProfile.name || 'Player'}
        username={userProfile.username || userProfile.handle?.replace('@', '') || 'player'}
        bio={userProfile.bio || ''}
        profilePhoto={userProfile.profilePhoto}
        headerPhoto={userProfile.headerPhoto}
        followers={socialMedia.followers}
        following={userProfile.following || 0}
        posts={socialMedia.totalPosts || 0}
        verified={userProfile.verified || false}
        location={userProfile.location}
        website={userProfile.website}
        joinedDate={userProfile.joinedDate}
        isOwnProfile={true}
        onEditProfile={() => setShowEditProfile(true)}
      />
      
      {/* Influence Level Card */}
      <View style={styles.influenceCard}>
        <View style={styles.influenceHeader}>
          <TrendingUp size={scale(20)} color="#1D9BF0" />
          <Text style={styles.influenceTitle}>Influence Level</Text>
            </View>
        <View style={styles.influenceInfo}>
          <Text style={styles.influenceLevel}>{influenceInfo.name}</Text>
          <Text style={styles.influenceDescription}>{influenceInfo.description}</Text>
          </View>
        <View style={styles.influenceStats}>
          <View style={styles.influenceStat}>
            <Text style={styles.influenceStatValue}>{socialMedia.viralPosts || 0}</Text>
            <Text style={styles.influenceStatLabel}>Viral Posts</Text>
        </View>
          <View style={styles.influenceStat}>
            <Text style={styles.influenceStatValue}>
              ${(socialMedia.totalEarnings || 0).toFixed(0)}
          </Text>
            <Text style={styles.influenceStatLabel}>Total Earnings</Text>
      </View>
          <View style={styles.influenceStat}>
            <Text style={styles.influenceStatValue}>{socialMedia.brandPartnerships || 0}</Text>
            <Text style={styles.influenceStatLabel}>Brand Deals</Text>
                    </View>
                   </View>
                </View>

      {/* Monetization Card - X.com Creator Program Style */}
      <View style={styles.monetizationCard}>
        <View style={styles.monetizationHeader}>
          <Text style={styles.monetizationTitle}>💰 Creator Monetization</Text>
          {socialMedia.followers >= 500 ? (
            <View style={styles.monetizationBadge}>
              <Text style={styles.monetizationBadgeText}>ACTIVE</Text>
                </View>
          ) : (
            <View style={[styles.monetizationBadge, styles.monetizationBadgeInactive]}>
              <Text style={styles.monetizationBadgeText}>LOCKED</Text>
          </View>
        )}
        </View>
        
        {socialMedia.followers >= 500 ? (
          <>
            <Text style={styles.monetizationSubtitle}>
              Earn money from your posts based on impressions
            </Text>
            <View style={styles.monetizationStats}>
              <View style={styles.monetizationStatRow}>
                <Text style={styles.monetizationStatLabel}>Weekly Est. Earnings:</Text>
                <Text style={styles.monetizationStatValue}>{influenceInfo.weeklyEarnings}</Text>
              </View>
              <View style={styles.monetizationStatRow}>
                <Text style={styles.monetizationStatLabel}>CPM Rate:</Text>
                <Text style={styles.monetizationStatValue}>
                  ${socialMedia.influenceLevel === 'celebrity' ? '5.00' : 
                    socialMedia.influenceLevel === 'influencer' ? '3.00' : 
                    socialMedia.influenceLevel === 'popular' ? '1.50' : 
                    socialMedia.influenceLevel === 'rising' ? '0.50' : '0.10'}/1K
                </Text>
              </View>
              <View style={styles.monetizationStatRow}>
                <Text style={styles.monetizationStatLabel}>Total Earned:</Text>
                <Text style={[styles.monetizationStatValue, styles.monetizationEarnings]}>
                  ${(socialMedia.totalEarnings || 0).toFixed(2)}
                </Text>
              </View>
                    </View>
            <Text style={styles.monetizationTip}>
              💡 Post regularly and go viral to maximize earnings!
                      </Text>
          </>
        ) : (
          <View style={styles.monetizationLocked}>
            <Text style={styles.monetizationLockedText}>
              🔒 Reach 500 followers to unlock monetization
                      </Text>
            <View style={styles.monetizationProgress}>
              <View style={[
                styles.monetizationProgressBar, 
                { width: `${Math.min(100, (socialMedia.followers / 500) * 100)}%` }
              ]} />
                    </View>
            <Text style={styles.monetizationProgressText}>
              {socialMedia.followers}/500 followers
                      </Text>
                  </View>
            )}
          </View>
      
      {/* Player's Posts */}
      <View style={styles.postsSection}>
        <Text style={styles.postsSectionTitle}>Your Posts</Text>
        {playerPosts.length === 0 ? (
          <View style={styles.noPostsContainer}>
            <Feather size={scale(40)} color="#71767B" />
            <Text style={styles.noPostsText}>No posts yet</Text>
            <Text style={styles.noPostsSubtext}>Share your first post with the world!</Text>
            <TouchableOpacity 
              style={styles.createPostButton}
              onPress={() => setShowComposer(true)}
            >
              <Text style={styles.createPostButtonText}>Create Post</Text>
            </TouchableOpacity>
              </View>
        ) : (
          playerPosts.map(post => (
            <PostCard
              key={post.id}
              id={post.id}
              authorName={post.authorName}
              authorHandle={post.authorHandle}
              authorPhoto={post.authorPhoto}
              authorVerified={post.authorVerified}
              content={post.content}
              photo={post.photo}
              timestamp={new Date(post.timestamp).toISOString()}
              likes={post.likes}
              reposts={post.reposts}
              replies={post.replies}
              views={post.views}
              bookmarks={post.bookmarks}
              isLiked={post.isLiked}
              isReposted={post.isReposted}
              isBookmarked={false}
              isPlayerPost={true}
              isViral={post.isViral}
            />
          ))
        )}
              </View>
    </ScrollView>
  ), [userProfile, socialMedia, influenceInfo, playerPosts]);
  
  const renderTrendingTab = useCallback(() => (
    <ScrollView style={styles.trendingScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.trendingTitle}>Trending</Text>
      <Text style={styles.trendingSubtitle}>What's happening now</Text>
      
      {TRENDING_TOPICS.map((topic, index) => (
        <TouchableOpacity key={index} style={styles.trendingItem}>
          <View style={styles.trendingItemHeader}>
            <Text style={styles.trendingCategory}>{topic.category}</Text>
            <Text style={styles.trendingPosition}>#{index + 1}</Text>
              </View>
          <Text style={styles.trendingTag}>{topic.tag}</Text>
          <Text style={styles.trendingPosts}>{topic.posts} posts</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  ), []);
  
  const renderNotificationsTab = useCallback(() => (
    <ScrollView style={styles.notificationsScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.notificationsTitle}>Notifications</Text>
      
      {socialMedia.followers > 0 ? (
        <>
          <View style={styles.notificationItem}>
            <View style={styles.notificationIcon}>
              <Heart size={scale(20)} color="#F91880" fill="#F91880" />
                  </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationText}>
                <Text style={styles.notificationBold}>@someone</Text> liked your post
                    </Text>
              <Text style={styles.notificationTime}>2h ago</Text>
                  </View>
                  </View>
          <View style={styles.notificationItem}>
            <View style={styles.notificationIcon}>
              <User size={scale(20)} color="#1D9BF0" />
                  </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationText}>
                <Text style={styles.notificationBold}>@newuser</Text> followed you
              </Text>
              <Text style={styles.notificationTime}>5h ago</Text>
            </View>
          </View>
                    </>
                  ) : (
        <View style={styles.noNotifications}>
          <Bell size={scale(40)} color="#71767B" />
          <Text style={styles.noNotificationsText}>No notifications yet</Text>
          <Text style={styles.noNotificationsSubtext}>
            Start posting to grow your audience!
          </Text>
          </View>
        )}
      </ScrollView>
  ), [socialMedia.followers]);

  // Render Messages/DM Tab
  const renderMessagesTab = useCallback(() => (
    <DMSystem onBack={() => setActiveTab('feed')} />
  ), []);
  
  const renderContent = useCallback(() => {
    switch (activeTab) {
      case 'feed':
        return renderFeedTab();
      case 'profile':
        return renderProfileTab();
      case 'trending':
        return renderTrendingTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'messages':
        return renderMessagesTab();
      default:
        return renderFeedTab();
    }
  }, [activeTab, renderFeedTab, renderProfileTab, renderTrendingTab, renderNotificationsTab, renderMessagesTab]);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={scale(24)} color="#E7E9EA" />
                  </TouchableOpacity>
        <Text style={styles.headerTitle}>Social</Text>
        <View style={styles.headerRight} />
              </View>
      
      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
            </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
                  <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('feed')}
        >
          <Home 
            size={scale(24)} 
            color={activeTab === 'feed' ? '#E7E9EA' : '#71767B'}
            fill={activeTab === 'feed' ? '#E7E9EA' : 'transparent'}
          />
                </TouchableOpacity>
              <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('trending')}
        >
          <Search 
            size={scale(24)} 
            color={activeTab === 'trending' ? '#E7E9EA' : '#71767B'} 
          />
              </TouchableOpacity>
              <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('notifications')}
        >
          <Bell 
            size={scale(24)} 
            color={activeTab === 'notifications' ? '#E7E9EA' : '#71767B'} 
          />
              </TouchableOpacity>
                <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('messages')}
        >
          <Mail 
            size={scale(24)} 
            color={activeTab === 'messages' ? '#E7E9EA' : '#71767B'}
          />
              </TouchableOpacity>
                <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('profile')}
        >
          <User 
            size={scale(24)} 
            color={activeTab === 'profile' ? '#E7E9EA' : '#71767B'}
            fill={activeTab === 'profile' ? '#E7E9EA' : 'transparent'}
          />
                </TouchableOpacity>
            </View>
            
      {/* Floating Action Button */}
            <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowComposer(true)}
            >
        <Feather size={scale(24)} color="#FFFFFF" />
            </TouchableOpacity>
      
      {/* Post Composer Modal */}
      <PostComposer
        visible={showComposer}
        onClose={() => setShowComposer(false)}
        onPost={handlePost}
        profilePhoto={userProfile.profilePhoto}
        displayName={userProfile.displayName || userProfile.name || 'Player'}
        username={userProfile.username || userProfile.handle?.replace('@', '') || 'player'}
        verified={userProfile.verified}
      />
      
      {/* Profile Edit Modal */}
      <ProfileEditModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        onSave={handleSaveProfile}
        initialData={{
          displayName: userProfile.displayName || userProfile.name || 'Player',
          username: userProfile.username || userProfile.handle?.replace('@', '') || 'player',
          bio: userProfile.bio || '',
          location: userProfile.location,
          website: userProfile.website,
          profilePhoto: userProfile.profilePhoto,
          headerPhoto: userProfile.headerPhoto,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  backButton: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  headerRight: {
    width: scale(32),
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: scale(12),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
    backgroundColor: '#000000',
  },
  tabItem: {
    padding: scale(8),
  },
  fab: {
    position: 'absolute',
    right: scale(16),
    bottom: scale(80),
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#1D9BF0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  feedHeader: {
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  feedHeaderTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  profileScroll: {
    flex: 1,
  },
  influenceCard: {
    margin: scale(16),
    padding: scale(16),
    backgroundColor: '#16181C',
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#2F3336',
  },
  influenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  influenceTitle: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  influenceInfo: {
    marginBottom: scale(16),
  },
  influenceLevel: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#1D9BF0',
    marginBottom: scale(4),
  },
  influenceDescription: {
    fontSize: fontScale(14),
    color: '#71767B',
  },
  influenceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  influenceStat: {
    alignItems: 'center',
  },
  influenceStatValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  influenceStatLabel: {
    fontSize: fontScale(12),
    color: '#71767B',
    marginTop: scale(2),
  },
  postsSection: {
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  postsSectionTitle: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#E7E9EA',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  noPostsContainer: {
    alignItems: 'center',
    padding: scale(40),
  },
  noPostsText: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
    marginTop: scale(16),
  },
  noPostsSubtext: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginTop: scale(4),
    marginBottom: scale(20),
  },
  createPostButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(24),
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: 'bold',
  },
  trendingScroll: {
    flex: 1,
    padding: scale(16),
  },
  trendingTitle: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#E7E9EA',
    marginBottom: scale(4),
  },
  trendingSubtitle: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginBottom: scale(20),
  },
  trendingItem: {
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  trendingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  trendingCategory: {
    fontSize: fontScale(12),
    color: '#71767B',
  },
  trendingPosition: {
    fontSize: fontScale(12),
    color: '#71767B',
  },
  trendingTag: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#E7E9EA',
    marginBottom: scale(2),
  },
  trendingPosts: {
    fontSize: fontScale(13),
    color: '#71767B',
  },
  notificationsScroll: {
    flex: 1,
    padding: scale(16),
  },
  notificationsTitle: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#E7E9EA',
    marginBottom: scale(20),
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  notificationIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#16181C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: fontScale(15),
    color: '#E7E9EA',
    lineHeight: fontScale(20),
  },
  notificationBold: {
    fontWeight: 'bold',
  },
  notificationTime: {
    fontSize: fontScale(13),
    color: '#71767B',
    marginTop: scale(4),
  },
  noNotifications: {
    alignItems: 'center',
    paddingVertical: scale(60),
  },
  noNotificationsText: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
    marginTop: scale(16),
  },
  noNotificationsSubtext: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginTop: scale(4),
    textAlign: 'center',
  },
  // Monetization Card Styles
  monetizationCard: {
    margin: scale(16),
    marginTop: 0,
    padding: scale(16),
    backgroundColor: '#16181C',
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#2F3336',
  },
  monetizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  monetizationTitle: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  monetizationBadge: {
    backgroundColor: '#00BA7C',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(4),
  },
  monetizationBadgeInactive: {
    backgroundColor: '#71767B',
  },
  monetizationBadgeText: {
    fontSize: fontScale(10),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  monetizationSubtitle: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginBottom: scale(16),
  },
  monetizationStats: {
    backgroundColor: '#000000',
    borderRadius: scale(8),
    padding: scale(12),
    marginBottom: scale(12),
  },
  monetizationStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(6),
  },
  monetizationStatLabel: {
    fontSize: fontScale(14),
    color: '#71767B',
  },
  monetizationStatValue: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  monetizationEarnings: {
    color: '#00BA7C',
    fontSize: fontScale(16),
  },
  monetizationTip: {
    fontSize: fontScale(13),
    color: '#1D9BF0',
    textAlign: 'center',
  },
  monetizationLocked: {
    alignItems: 'center',
    paddingVertical: scale(8),
  },
  monetizationLockedText: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginBottom: scale(12),
  },
  monetizationProgress: {
    width: '100%',
    height: scale(8),
    backgroundColor: '#2F3336',
    borderRadius: scale(4),
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  monetizationProgressBar: {
    height: '100%',
    backgroundColor: '#1D9BF0',
    borderRadius: scale(4),
  },
  monetizationProgressText: {
    fontSize: fontScale(12),
    color: '#71767B',
  },
});
