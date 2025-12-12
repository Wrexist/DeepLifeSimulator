import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, UserPlus, Gift, TrendingUp } from 'lucide-react-native';
import { Friend, FriendComparison } from '@/lib/social/friends';
import { useGame } from '@/contexts/GameContext';
import { OptimizedFlatList } from '../OptimizedFlatList';
import { PerformanceOptimizedImage } from '../PerformanceOptimizedImage';

interface FriendListProps {
  friends: Friend[];
  onFriendPress?: (friend: Friend) => void;
  onSendGift?: (friend: Friend) => void;
  onCompare?: (friend: Friend) => void;
}

export default function FriendList({
  friends,
  onFriendPress,
  onSendGift,
  onCompare,
}: FriendListProps) {
  const { gameState } = useGame();

  const acceptedFriends = useMemo(
    () => friends.filter(f => f.status === 'accepted'),
    [friends]
  );

  const renderFriend = useCallback(
    ({ item: friend }: { item: Friend }) => {
      return (
        <TouchableOpacity
          style={styles.friendCard}
          onPress={() => onFriendPress?.(friend)}
          activeOpacity={0.7}
        >
          <View style={styles.friendInfo}>
            {friend.avatar ? (
              <PerformanceOptimizedImage source={{ uri: friend.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={24} color="#6B7280" />
              </View>
            )}
            <View style={styles.friendDetails}>
              <Text style={styles.friendName}>{friend.name}</Text>
              {friend.netWorth !== undefined && (
                <Text style={styles.friendStats}>
                  Net Worth: ${friend.netWorth.toLocaleString()}
                </Text>
              )}
              {friend.lastActive && (
                <Text style={styles.lastActive}>
                  Last active: {formatLastActive(friend.lastActive)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.actions}>
            {onCompare && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onCompare(friend)}
              >
                <TrendingUp size={20} color="#3B82F6" />
              </TouchableOpacity>
            )}
            {onSendGift && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onSendGift(friend)}
              >
                <Gift size={20} color="#10B981" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [onFriendPress, onSendGift, onCompare]
  );

  if (acceptedFriends.length === 0) {
    return (
      <View style={styles.emptyState}>
        <UserPlus size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>No friends yet</Text>
        <Text style={styles.emptySubtext}>
          Add friends to compare progress and send gifts!
        </Text>
      </View>
    );
  }

  return (
    <OptimizedFlatList
      data={acceptedFriends}
      renderItem={renderFriend}
      keyExtractor={(item: Friend) => item.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      itemHeight={94}
    />
  );
}

function formatLastActive(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  friendStats: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  lastActive: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

