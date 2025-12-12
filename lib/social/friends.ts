import { v4 as uuidv4 } from 'uuid';

export interface Friend {
  id: string;
  userId: string; // Unique user identifier
  name: string;
  avatar?: string;
  level?: number;
  netWorth?: number;
  lastActive?: number;
  status: 'pending' | 'accepted' | 'blocked';
  sentBy: 'me' | 'them';
  addedAt: number;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface FriendComparison {
  friendId: string;
  friendName: string;
  stats: {
    netWorth: number;
    age: number;
    careerLevel: number;
    topSkill: number;
    achievements: number;
  };
  myStats: {
    netWorth: number;
    age: number;
    careerLevel: number;
    topSkill: number;
    achievements: number;
  };
}

/**
 * Create a new friend request
 */
export function createFriendRequest(
  fromUserId: string,
  fromUserName: string,
  toUserId: string,
  fromUserAvatar?: string
): FriendRequest {
  return {
    id: uuidv4(),
    fromUserId,
    fromUserName,
    fromUserAvatar,
    toUserId,
    timestamp: Date.now(),
    status: 'pending',
  };
}

/**
 * Accept a friend request
 */
export function acceptFriendRequest(request: FriendRequest): Friend {
  return {
    id: uuidv4(),
    userId: request.fromUserId,
    name: request.fromUserName,
    avatar: request.fromUserAvatar,
    status: 'accepted',
    sentBy: 'them',
    addedAt: Date.now(),
  };
}

/**
 * Compare stats with a friend
 */
export function compareWithFriend(
  friend: Friend,
  myStats: {
    netWorth: number;
    age: number;
    careerLevel: number;
    topSkill: number;
    achievements: number;
  },
  friendStats: {
    netWorth: number;
    age: number;
    careerLevel: number;
    topSkill: number;
    achievements: number;
  }
): FriendComparison {
  return {
    friendId: friend.id,
    friendName: friend.name,
    stats: friendStats,
    myStats,
  };
}

/**
 * Send a gift to a friend
 */
export interface Gift {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  type: 'gems' | 'money' | 'item';
  amount?: number;
  itemId?: string;
  message?: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

export function createGift(
  fromUserId: string,
  fromUserName: string,
  toUserId: string,
  type: 'gems' | 'money' | 'item',
  amount?: number,
  itemId?: string,
  message?: string
): Gift {
  return {
    id: uuidv4(),
    fromUserId,
    fromUserName,
    toUserId,
    type,
    amount,
    itemId,
    message,
    timestamp: Date.now(),
    status: 'pending',
  };
}

