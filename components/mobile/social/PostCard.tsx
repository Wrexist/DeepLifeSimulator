/**
 * Post Card Component - X.com Style
 * 
 * Individual post/tweet card with engagement buttons
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  MessageCircle,
  Repeat2,
  Heart,
  Bookmark,
  Share,
  BadgeCheck,
  MoreHorizontal,
  BarChart2,
} from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import { PLACEHOLDER_IMAGES } from '@/utils/imageUtils';

interface PostCardProps {
  id: string;
  authorName: string;
  authorHandle: string;
  authorPhoto?: string;
  authorVerified?: boolean;
  content: string;
  photo?: string;
  timestamp: string;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  bookmarks: number;
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  isPlayerPost?: boolean;
  isViral?: boolean;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onBookmark?: () => void;
  onShare?: () => void;
  onPress?: () => void;
  onProfilePress?: () => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  if (num === 0) return '';
  return num.toString();
};

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function PostCard({
  id,
  authorName,
  authorHandle,
  authorPhoto,
  authorVerified,
  content,
  photo,
  timestamp,
  likes,
  reposts,
  replies,
  views,
  bookmarks,
  isLiked,
  isReposted,
  isBookmarked,
  isPlayerPost,
  isViral,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  onShare,
  onPress,
  onProfilePress,
}: PostCardProps) {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Viral indicator */}
      {isViral && (
        <View style={styles.viralBanner}>
          <Text style={styles.viralText}>🔥 Viral Post</Text>
        </View>
      )}
      
      <View style={styles.content}>
        {/* Profile Photo */}
        <TouchableOpacity onPress={onProfilePress}>
          <Image
            source={{ uri: authorPhoto || PLACEHOLDER_IMAGES.profile }}
            style={styles.avatar}
          />
        </TouchableOpacity>
        
        {/* Post Content */}
        <View style={styles.postBody}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.authorInfo}>
              <TouchableOpacity 
                style={styles.nameRow}
                onPress={onProfilePress}
              >
                <Text style={styles.authorName} numberOfLines={1}>
                  {authorName}
                </Text>
                {authorVerified && (
                  <BadgeCheck size={scale(14)} color="#1D9BF0" fill="#1D9BF0" />
                )}
              </TouchableOpacity>
              <Text style={styles.authorHandle} numberOfLines={1}>
                @{authorHandle}
              </Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.timestamp}>{formatTimestamp(timestamp)}</Text>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <MoreHorizontal size={scale(18)} color="#71767B" />
            </TouchableOpacity>
          </View>
          
          {/* Post Text */}
          <Text style={styles.postText}>{content}</Text>
          
          {/* Post Image */}
          {photo && (
            <Image
              source={{ uri: photo }}
              style={styles.postImage}
              resizeMode="cover"
            />
          )}
          
          {/* Engagement Row */}
          <View style={styles.engagementRow}>
            {/* Reply */}
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={onReply}
            >
              <MessageCircle size={scale(18)} color="#71767B" />
              <Text style={styles.engagementText}>{formatNumber(replies)}</Text>
            </TouchableOpacity>
            
            {/* Repost */}
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={onRepost}
            >
              <Repeat2 
                size={scale(18)} 
                color={isReposted ? '#00BA7C' : '#71767B'} 
              />
              <Text style={[
                styles.engagementText,
                isReposted && styles.engagementTextReposted
              ]}>
                {formatNumber(reposts)}
              </Text>
            </TouchableOpacity>
            
            {/* Like */}
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={onLike}
            >
              <Heart 
                size={scale(18)} 
                color={isLiked ? '#F91880' : '#71767B'}
                fill={isLiked ? '#F91880' : 'transparent'}
              />
              <Text style={[
                styles.engagementText,
                isLiked && styles.engagementTextLiked
              ]}>
                {formatNumber(likes)}
              </Text>
            </TouchableOpacity>
            
            {/* Views (for own posts) */}
            {isPlayerPost && views > 0 && (
              <TouchableOpacity style={styles.engagementButton}>
                <BarChart2 size={scale(18)} color="#71767B" />
                <Text style={styles.engagementText}>{formatNumber(views)}</Text>
              </TouchableOpacity>
            )}
            
            {/* Bookmark */}
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={onBookmark}
            >
              <Bookmark 
                size={scale(18)} 
                color={isBookmarked ? '#1D9BF0' : '#71767B'}
                fill={isBookmarked ? '#1D9BF0' : 'transparent'}
              />
            </TouchableOpacity>
            
            {/* Share */}
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={onShare}
            >
              <Share size={scale(18)} color="#71767B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  viralBanner: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingVertical: scale(4),
    paddingHorizontal: scale(16),
  },
  viralText: {
    fontSize: fontScale(12),
    color: '#F97316',
    fontWeight: '500',
  },
  content: {
    flexDirection: 'row',
    padding: scale(12),
    paddingTop: scale(12),
  },
  avatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#1F2937',
    marginRight: scale(12),
  },
  postBody: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  authorName: {
    fontSize: fontScale(15),
    fontWeight: 'bold',
    color: '#E7E9EA',
    maxWidth: scale(120),
  },
  authorHandle: {
    fontSize: fontScale(15),
    color: '#71767B',
    marginLeft: scale(4),
    maxWidth: scale(80),
  },
  dot: {
    fontSize: fontScale(15),
    color: '#71767B',
    marginHorizontal: scale(4),
  },
  timestamp: {
    fontSize: fontScale(15),
    color: '#71767B',
  },
  moreButton: {
    padding: scale(4),
  },
  postText: {
    fontSize: fontScale(15),
    color: '#E7E9EA',
    lineHeight: fontScale(20),
    marginTop: scale(4),
    marginBottom: scale(8),
  },
  postImage: {
    width: '100%',
    height: scale(200),
    borderRadius: scale(16),
    marginBottom: scale(8),
    backgroundColor: '#1F2937',
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scale(4),
    paddingRight: scale(24),
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    padding: scale(4),
  },
  engagementText: {
    fontSize: fontScale(13),
    color: '#71767B',
  },
  engagementTextLiked: {
    color: '#F91880',
  },
  engagementTextReposted: {
    color: '#00BA7C',
  },
});

