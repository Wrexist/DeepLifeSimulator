import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Check, X } from 'lucide-react-native';
import { FriendRequest as FriendRequestType } from '@/lib/social/friends';

interface FriendRequestProps {
  request: FriendRequestType;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export default function FriendRequest({
  request,
  onAccept,
  onReject,
}: FriendRequestProps) {
  const handleAccept = useCallback(() => {
    onAccept(request.id);
  }, [request.id, onAccept]);

  const handleReject = useCallback(() => {
    onReject(request.id);
  }, [request.id, onReject]);

  return (
    <View style={styles.container}>
      <View style={styles.userInfo}>
        {request.fromUserAvatar ? (
          <Image
            source={{ uri: request.fromUserAvatar }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={24} color="#6B7280" />
          </View>
        )}
        <View style={styles.details}>
          <Text style={styles.name}>{request.fromUserName}</Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(request.timestamp)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={handleAccept}
        >
          <Check size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={handleReject}
        >
          <X size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${days} days ago`;
}

const styles = StyleSheet.create({
  container: {
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  details: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

