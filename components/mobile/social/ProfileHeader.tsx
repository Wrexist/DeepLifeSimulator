/**
 * Profile Header Component - X.com Style
 * 
 * Displays user profile header with cover photo, profile photo, stats, and bio
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Calendar,
  MapPin,
  Link as LinkIcon,
  BadgeCheck,
  Settings,
} from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import { PLACEHOLDER_IMAGES } from '@/utils/imageUtils';

interface ProfileHeaderProps {
  displayName: string;
  username: string;
  bio: string;
  profilePhoto?: string;
  headerPhoto?: string;
  followers: number;
  following: number;
  posts: number;
  verified: boolean;
  location?: string;
  website?: string;
  joinedDate?: string;
  isOwnProfile?: boolean;
  onEditProfile?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

const formatJoinDate = (dateStr?: string): string => {
  if (!dateStr) return 'Recently';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return 'Recently';
  }
};

export default function ProfileHeader({
  displayName,
  username,
  bio,
  profilePhoto,
  headerPhoto,
  followers,
  following,
  posts,
  verified,
  location,
  website,
  joinedDate,
  isOwnProfile = true,
  onEditProfile,
  onFollowersPress,
  onFollowingPress,
}: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Header/Cover Photo */}
      <ImageBackground
        source={{ uri: headerPhoto || PLACEHOLDER_IMAGES.header }}
        style={styles.coverPhoto}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.coverGradient}
        />
      </ImageBackground>
      
      {/* Profile Section */}
      <View style={styles.profileSection}>
        {/* Profile Photo */}
        <View style={styles.profilePhotoContainer}>
          <Image
            source={{ uri: profilePhoto || PLACEHOLDER_IMAGES.profile }}
            style={styles.profilePhoto}
          />
          {verified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={scale(16)} color="#1D9BF0" fill="#FFFFFF" />
            </View>
          )}
        </View>
        
        {/* Edit/Follow Button */}
        {isOwnProfile ? (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={onEditProfile}
          >
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Name & Username */}
      <View style={styles.nameSection}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{displayName}</Text>
          {verified && (
            <BadgeCheck size={scale(18)} color="#1D9BF0" fill="#1D9BF0" />
          )}
        </View>
        <Text style={styles.username}>@{username}</Text>
      </View>
      
      {/* Bio */}
      {bio && (
        <Text style={styles.bio}>{bio}</Text>
      )}
      
      {/* Meta Info */}
      <View style={styles.metaSection}>
        {location && (
          <View style={styles.metaItem}>
            <MapPin size={scale(14)} color="#71767B" />
            <Text style={styles.metaText}>{location}</Text>
          </View>
        )}
        {website && (
          <View style={styles.metaItem}>
            <LinkIcon size={scale(14)} color="#71767B" />
            <Text style={[styles.metaText, styles.metaLink]}>{website}</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Calendar size={scale(14)} color="#71767B" />
          <Text style={styles.metaText}>Joined {formatJoinDate(joinedDate)}</Text>
        </View>
      </View>
      
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity 
          style={styles.statItem}
          onPress={onFollowingPress}
        >
          <Text style={styles.statValue}>{formatNumber(following)}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.statItem}
          onPress={onFollowersPress}
        >
          <Text style={styles.statValue}>{formatNumber(followers)}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatNumber(posts)}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
  },
  coverPhoto: {
    height: scale(120),
    width: '100%',
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(60),
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: scale(16),
    marginTop: scale(-40),
  },
  profilePhotoContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    borderWidth: 4,
    borderColor: '#000000',
    backgroundColor: '#1F2937',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#000000',
    borderRadius: scale(10),
    padding: scale(2),
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#536471',
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    marginBottom: scale(8),
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: 'bold',
  },
  followButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    paddingHorizontal: scale(20),
    paddingVertical: scale(8),
    marginBottom: scale(8),
  },
  followButtonText: {
    color: '#000000',
    fontSize: fontScale(14),
    fontWeight: 'bold',
  },
  nameSection: {
    paddingHorizontal: scale(16),
    marginTop: scale(12),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  displayName: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  username: {
    fontSize: fontScale(15),
    color: '#71767B',
    marginTop: scale(2),
  },
  bio: {
    fontSize: fontScale(15),
    color: '#E7E9EA',
    paddingHorizontal: scale(16),
    marginTop: scale(12),
    lineHeight: fontScale(20),
  },
  metaSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: scale(16),
    marginTop: scale(12),
    gap: scale(12),
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  metaText: {
    fontSize: fontScale(14),
    color: '#71767B',
  },
  metaLink: {
    color: '#1D9BF0',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    marginTop: scale(16),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(20),
  },
  statValue: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: scale(4),
  },
  statLabel: {
    fontSize: fontScale(14),
    color: '#71767B',
  },
});

