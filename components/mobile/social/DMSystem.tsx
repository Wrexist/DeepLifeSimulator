/**
 * DM System Component for Social App
 * 
 * Features mysterious messages with clues, discoveries, and secrets
 * Players receive DMs from random people giving hints about:
 * - Hidden locations
 * - Secret items
 * - Money opportunities
 * - Career hints
 * - Relationship advice
 * - Easter eggs
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Animated,
  TextInput,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  ArrowLeft,
  Mail,
  Send,
  User,
  Lock,
  Unlock,
  Gift,
  MapPin,
  DollarSign,
  Briefcase,
  Heart,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Star,
  MessageCircle,
  Search,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Pin,
  MoreHorizontal,
  UserPlus,
  ChevronRight,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';

interface DMConversation {
  id: string;
  senderName: string;
  senderHandle: string;
  senderAvatar: string;
  isVerified: boolean;
  isMysterious: boolean;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  isPinned: boolean;
  clueType?: ClueType;
  clueData?: ClueData;
}

interface DMMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  isPlayer: boolean;
  hasClue: boolean;
  clueRevealed: boolean;
  clueType?: ClueType;
  clueData?: ClueData;
  reactions?: string[];
}

type ClueType = 'location' | 'money' | 'career' | 'relationship' | 'item' | 'secret' | 'quest';

interface ClueData {
  hint: string;
  reward?: string;
  action?: string;
  destination?: string;
  requirement?: string;
  completed?: boolean;
}

// Mysterious contacts that send clues
const MYSTERIOUS_CONTACTS: Omit<DMConversation, 'id' | 'lastMessage' | 'timestamp' | 'unreadCount' | 'isPinned'>[] = [
  {
    senderName: 'The Informant',
    senderHandle: 'shadow_info',
    senderAvatar: '🕵️',
    isVerified: false,
    isMysterious: true,
    clueType: 'money',
  },
  {
    senderName: 'Career Whisperer',
    senderHandle: 'career_insider',
    senderAvatar: '💼',
    isVerified: true,
    isMysterious: true,
    clueType: 'career',
  },
  {
    senderName: 'Anonymous Traveler',
    senderHandle: 'world_seeker',
    senderAvatar: '🌍',
    isVerified: false,
    isMysterious: true,
    clueType: 'location',
  },
  {
    senderName: 'Love Oracle',
    senderHandle: 'heart_guide',
    senderAvatar: '💖',
    isVerified: false,
    isMysterious: true,
    clueType: 'relationship',
  },
  {
    senderName: 'Treasure Hunter',
    senderHandle: 'finder_keeper',
    senderAvatar: 'ðŸ—ï¸',
    isVerified: true,
    isMysterious: true,
    clueType: 'item',
  },
  {
    senderName: 'The Curator',
    senderHandle: 'hidden_knowledge',
    senderAvatar: '📜',
    isVerified: false,
    isMysterious: true,
    clueType: 'secret',
  },
  {
    senderName: 'Quest Master',
    senderHandle: 'adventure_awaits',
    senderAvatar: '⚔️',
    isVerified: true,
    isMysterious: true,
    clueType: 'quest',
  },
];

// Clue templates by type
const CLUE_TEMPLATES: Record<ClueType, Array<{ message: string; hint: string; reward: string; action: string }>> = {
  money: [
    { 
      message: "Psst... I know a way to make some quick cash. Check the stock market around 3 PM - there's usually a dip you can exploit. 📈",
      hint: "Stock trading timing",
      reward: "Potential profit from stock dip",
      action: "Open Stocks app in afternoon"
    },
    { 
      message: "There's a hidden cash stash in the old warehouse district. Go to Real Estate and look for abandoned properties...",
      hint: "Hidden money in properties",
      reward: "Find hidden cash",
      action: "Check Real Estate for special properties"
    },
    { 
      message: "The bank offers a secret high-yield savings account to customers with over $50K. Ask about 'premium services'.",
      hint: "Premium bank services",
      reward: "Higher interest rates",
      action: "Visit Bank with $50K+"
    },
    { 
      message: "I heard there's a gambling event this weekend. High risk, but the payout is huge if you know when to fold...",
      hint: "Special gambling event",
      reward: "Big gambling winnings",
      action: "Check casino on weekends"
    },
  ],
  career: [
    { 
      message: "Your boss is retiring next month. If your relationship with them is good, you might get promoted automatically. 🏆",
      hint: "Upcoming promotion opportunity",
      reward: "Automatic promotion",
      action: "Improve boss relationship"
    },
    { 
      message: "There's a secret job listing for a high-paying position. Companies value candidates with multiple degrees...",
      hint: "Education unlocks jobs",
      reward: "Higher salary positions",
      action: "Complete more education"
    },
    { 
      message: "I know someone at the company. If you complete the business certification, they'll fast-track your interview.",
      hint: "Certification advantage",
      reward: "Job interview advantage",
      action: "Get business certification"
    },
    { 
      message: "The CEO is looking for someone with entrepreneurial experience. Starting your own company might open doors...",
      hint: "Own company = career boost",
      reward: "Executive opportunities",
      action: "Start a company"
    },
  ],
  location: [
    { 
      message: "There's a secret beach in Thailand that tourists don't know about. The travel agent has it listed as 'hidden gem'.",
      hint: "Secret travel destination",
      reward: "Unique travel experience",
      action: "Check Travel App for hidden destinations"
    },
    { 
      message: "The mountains in Switzerland have a monastery. Visiting gives you inner peace... and something more. 🧘",
      hint: "Special location bonus",
      reward: "+Stats from travel",
      action: "Travel to Switzerland"
    },
    { 
      message: "Did you know each country has a business opportunity? Some are more lucrative than others...",
      hint: "Travel business opportunities",
      reward: "Investment returns",
      action: "Explore travel business tab"
    },
  ],
  relationship: [
    { 
      message: "I noticed someone has been checking your profile... They seem interested. Maybe reach out? 💕",
      hint: "Potential new connection",
      reward: "New relationship opportunity",
      action: "Check Contacts app"
    },
    { 
      message: "A little birdie told me that expensive gifts work better on certain personality types. Romantics love jewelry!",
      hint: "Gift preferences by personality",
      reward: "Better relationship gains",
      action: "Match gifts to personalities"
    },
    { 
      message: "Relationships decay over time. But if you move in together, they stay stable longer...",
      hint: "Living together benefit",
      reward: "Slower relationship decay",
      action: "Move in with partner"
    },
  ],
  item: [
    { 
      message: "The dark web has items you won't find anywhere else. Be careful, but the rewards are worth the risk. 🕳️",
      hint: "Dark web special items",
      reward: "Unique items",
      action: "Check Onion browser"
    },
    { 
      message: "There's a collector looking for rare vehicles. If you own a classic car, they'll pay double market value!",
      hint: "Vehicle collector",
      reward: "Double vehicle sale price",
      action: "Sell classic cars"
    },
    { 
      message: "The pet shop gets rare animals on the 15th of each month. First come, first served!",
      hint: "Rare pet availability",
      reward: "Special pets",
      action: "Visit pet shop on 15th"
    },
  ],
  secret: [
    { 
      message: "Did you know you can prestige and keep some bonuses? The family legacy system is powerful...",
      hint: "Prestige system exists",
      reward: "Legacy bonuses",
      action: "Check Prestige when available"
    },
    { 
      message: "There's a skill tree hidden in the crime system. Level up your stealth to unlock it.",
      hint: "Crime skill trees",
      reward: "Crime bonuses",
      action: "Level crime skills"
    },
    { 
      message: "The statistics app tracks everything. Some achievements unlock secret bonuses when completed.",
      hint: "Achievement rewards",
      reward: "Hidden bonuses",
      action: "Check achievements in Statistics"
    },
  ],
  quest: [
    { 
      message: "A new challenge awaits: Become a millionaire before age 30. The universe rewards the ambitious...",
      hint: "Wealth quest",
      reward: "Special achievement",
      action: "Earn $1M before 30"
    },
    { 
      message: "Can you visit every country in a single lifetime? Travelers who do are blessed with happiness.",
      hint: "World traveler quest",
      reward: "+Permanent happiness",
      action: "Visit all countries"
    },
    { 
      message: "The true challenge: Max out all your stats. Few have achieved this... will you be one of them?",
      hint: "Perfect stats quest",
      reward: "Ultimate achievement",
      action: "Max all stats to 100"
    },
  ],
};

interface DMSystemProps {
  onBack: () => void;
}

export default function DMSystem({ onBack }: DMSystemProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const [selectedConversation, setSelectedConversation] = useState<DMConversation | null>(null);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClueModal, setShowClueModal] = useState(false);
  const [currentClue, setCurrentClue] = useState<{ type: ClueType; data: ClueData } | null>(null);
  const [revealedClues, setRevealedClues] = useState<string[]>([]);

  // Initialize conversations from game state
  useEffect(() => {
    const savedConversations = gameState.dmConversations || [];
    const savedRevealedClues = gameState.revealedDMClues || [];
    
    // Generate new mysterious messages if needed
    if (savedConversations.length < 3) {
      const newConversations = generateNewConversations(3 - savedConversations.length);
      setConversations([...savedConversations, ...newConversations]);
    } else {
      setConversations(savedConversations);
    }
    
    setRevealedClues(savedRevealedClues);
  }, [gameState.dmConversations, gameState.revealedDMClues]);

  // Generate new mysterious conversations
  const generateNewConversations = useCallback((count: number): DMConversation[] => {
    const availableContacts = MYSTERIOUS_CONTACTS.filter(
      c => !conversations.find(conv => conv.senderHandle === c.senderHandle)
    );
    
    return availableContacts.slice(0, count).map((contact, index) => {
      const clueType = contact.clueType || 'secret';
      const templates = CLUE_TEMPLATES[clueType];
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      return {
        id: `dm_${Date.now()}_${index}`,
        ...contact,
        lastMessage: "New message...",
        timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
        unreadCount: 1,
        isPinned: false,
        clueData: {
          hint: template.hint,
          reward: template.reward,
          action: template.action,
        },
      };
    });
  }, [conversations]);

  // Generate messages for a conversation
  const generateMessagesForConversation = useCallback((conversation: DMConversation): DMMessage[] => {
    const clueType = conversation.clueType || 'secret';
    const templates = CLUE_TEMPLATES[clueType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return [
      {
        id: `msg_${conversation.id}_1`,
        senderId: conversation.senderHandle,
        content: "Hey there... 👋",
        timestamp: conversation.timestamp - 60000,
        isPlayer: false,
        hasClue: false,
        clueRevealed: false,
      },
      {
        id: `msg_${conversation.id}_2`,
        senderId: conversation.senderHandle,
        content: "I've been watching your progress. You seem like someone who can handle... sensitive information.",
        timestamp: conversation.timestamp - 30000,
        isPlayer: false,
        hasClue: false,
        clueRevealed: false,
      },
      {
        id: `msg_${conversation.id}_3`,
        senderId: conversation.senderHandle,
        content: template.message,
        timestamp: conversation.timestamp,
        isPlayer: false,
        hasClue: true,
        clueRevealed: revealedClues.includes(`${conversation.id}_clue`),
        clueType: clueType,
        clueData: {
          hint: template.hint,
          reward: template.reward,
          action: template.action,
        },
      },
    ];
  }, [revealedClues]);

  // Handle opening a conversation
  const handleOpenConversation = useCallback((conversation: DMConversation) => {
    setSelectedConversation(conversation);
    const msgs = generateMessagesForConversation(conversation);
    setMessages(msgs);
    
    // Mark as read
    setConversations(prev => prev.map(c => 
      c.id === conversation.id ? { ...c, unreadCount: 0 } : c
    ));
  }, [generateMessagesForConversation]);

  // Handle revealing a clue
  const handleRevealClue = useCallback((message: DMMessage) => {
    if (!message.hasClue || !message.clueType || !message.clueData) return;
    
    const clueId = `${selectedConversation?.id}_clue`;
    
    if (!revealedClues.includes(clueId)) {
      setRevealedClues(prev => [...prev, clueId]);
      
      // Save to game state
      setGameState(prev => ({
        ...prev,
        revealedDMClues: [...(prev.revealedDMClues || []), clueId],
      }));
      saveGame();
    }
    
    setCurrentClue({
      type: message.clueType,
      data: message.clueData,
    });
    setShowClueModal(true);
    
    // Update message as revealed
    setMessages(prev => prev.map(m => 
      m.id === message.id ? { ...m, clueRevealed: true } : m
    ));
  }, [selectedConversation, revealedClues, setGameState, saveGame]);

  // Handle sending a reply
  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || !selectedConversation) return;

    const newMessage: DMMessage = {
      id: `msg_${Date.now()}`,
      senderId: 'player',
      content: messageInput.trim(),
      timestamp: Date.now(),
      isPlayer: true,
      hasClue: false,
      clueRevealed: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageInput('');

    // Generate a response after a short delay
    setTimeout(() => {
      const responses = [
        "Interesting... 🤔",
        "I see you understand. Good luck!",
        "Use this information wisely.",
        "There's more where that came from... stay tuned.",
        "The path to success is paved with secrets.",
        "You're smarter than I thought! 💕",
      ];
      
      const responseMessage: DMMessage = {
        id: `msg_${Date.now()}_response`,
        senderId: selectedConversation.senderHandle,
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: Date.now(),
        isPlayer: false,
        hasClue: false,
        clueRevealed: false,
      };
      
      setMessages(prev => [...prev, responseMessage]);
    }, 1500);
  }, [messageInput, selectedConversation]);

  // Get clue type icon and color
  const getClueTypeInfo = (type: ClueType) => {
    switch (type) {
      case 'money':
        return { icon: DollarSign, color: '#10B981', label: 'Money Tip' };
      case 'career':
        return { icon: Briefcase, color: '#3B82F6', label: 'Career Hint' };
      case 'location':
        return { icon: MapPin, color: '#8B5CF6', label: 'Location Secret' };
      case 'relationship':
        return { icon: Heart, color: '#EC4899', label: 'Relationship Advice' };
      case 'item':
        return { icon: Gift, color: '#F59E0B', label: 'Item Discovery' };
      case 'secret':
        return { icon: Lock, color: '#6366F1', label: 'Hidden Secret' };
      case 'quest':
        return { icon: Star, color: '#EAB308', label: 'Quest' };
      default:
        return { icon: MessageCircle, color: '#6B7280', label: 'Message' };
    }
  };

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(c => 
      c.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.senderHandle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Total unread count
  const totalUnread = useMemo(() => 
    conversations.reduce((sum, c) => sum + c.unreadCount, 0),
  [conversations]);

  // Render conversation list
  const renderConversationList = () => (
    <View style={styles.conversationList}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={scale(24)} color="#F9FAFB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={scale(18)} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversations */}
      <ScrollView style={styles.conversationsScroll} showsVerticalScrollIndicator={false}>
        {filteredConversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Mail size={scale(48)} color="#4B5563" />
            <Text style={styles.emptyStateText}>No messages yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Mysterious contacts will reach out with tips and secrets...
            </Text>
          </View>
        ) : (
          filteredConversations.map(conversation => {
            const clueInfo = conversation.clueType ? getClueTypeInfo(conversation.clueType) : null;
            const ClueIcon = clueInfo?.icon;
            
            return (
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationItem}
                onPress={() => handleOpenConversation(conversation)}
              >
                {/* Avatar */}
                <View style={[
                  styles.avatar,
                  conversation.isMysterious && styles.avatarMysterious,
                ]}>
                  <Text style={styles.avatarEmoji}>{conversation.senderAvatar}</Text>
                  {conversation.isMysterious && (
                    <View style={styles.mysteriousBadge}>
                      <Sparkles size={10} color="#FFD700" />
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationName}>
                      {conversation.senderName}
                    </Text>
                    {conversation.isVerified && (
                      <CheckCircle size={14} color="#1D9BF0" />
                    )}
                    {clueInfo && ClueIcon && (
                      <View style={[styles.clueTypeBadge, { backgroundColor: `${clueInfo.color}20` }]}>
                        <ClueIcon size={12} color={clueInfo.color} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.conversationHandle}>@{conversation.senderHandle}</Text>
                  <Text style={styles.conversationPreview} numberOfLines={1}>
                    {conversation.lastMessage}
                  </Text>
                </View>

                {/* Right side */}
                <View style={styles.conversationMeta}>
                  <Text style={styles.conversationTime}>
                    {formatTimestamp(conversation.timestamp)}
                  </Text>
                  {conversation.unreadCount > 0 && (
                    <View style={styles.unreadDot}>
                      <Text style={styles.unreadDotText}>{conversation.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  // Render message thread
  const renderMessageThread = () => {
    if (!selectedConversation) return null;

    return (
      <View style={styles.messageThread}>
        {/* Thread Header */}
        <View style={styles.threadHeader}>
          <TouchableOpacity 
            onPress={() => setSelectedConversation(null)} 
            style={styles.backButton}
          >
            <ArrowLeft size={scale(24)} color="#F9FAFB" />
          </TouchableOpacity>
          <View style={styles.threadHeaderInfo}>
            <Text style={styles.threadHeaderName}>{selectedConversation.senderName}</Text>
            <Text style={styles.threadHeaderHandle}>@{selectedConversation.senderHandle}</Text>
          </View>
          {selectedConversation.isMysterious && (
            <View style={styles.mysteriousTag}>
              <Sparkles size={14} color="#FFD700" />
              <Text style={styles.mysteriousTagText}>Mysterious</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        <ScrollView 
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(message => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isPlayer ? styles.playerMessage : styles.otherMessage,
              ]}
            >
              <Text style={[
                styles.messageText,
                message.isPlayer && styles.playerMessageText,
              ]}>
                {message.content}
              </Text>
              
              {/* Clue button */}
              {message.hasClue && !message.clueRevealed && (
                <TouchableOpacity
                  style={styles.revealClueButton}
                  onPress={() => handleRevealClue(message)}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.revealClueButtonGradient}
                  >
                    <Eye size={14} color="#FFF" />
                    <Text style={styles.revealClueButtonText}>Reveal Clue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              {/* Revealed clue badge */}
              {message.hasClue && message.clueRevealed && (
                <TouchableOpacity
                  style={styles.clueRevealedBadge}
                  onPress={() => handleRevealClue(message)}
                >
                  <CheckCircle size={12} color="#10B981" />
                  <Text style={styles.clueRevealedText}>Clue Revealed - Tap to view</Text>
                </TouchableOpacity>
              )}
              
              <Text style={[
                styles.messageTime,
                message.isPlayer && styles.playerMessageTime,
              ]}>
                {formatTimestamp(message.timestamp)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Reply..."
            placeholderTextColor="#6B7280"
            value={messageInput}
            onChangeText={setMessageInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !messageInput.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageInput.trim()}
          >
            <Send size={scale(20)} color={messageInput.trim() ? '#1D9BF0' : '#4B5563'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render clue modal
  const renderClueModal = () => {
    if (!currentClue) return null;

    const clueInfo = getClueTypeInfo(currentClue.type);
    const ClueIcon = clueInfo.icon;

    return (
      <Modal
        visible={showClueModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.clueModal}>
            <LinearGradient
              colors={[`${clueInfo.color}40`, '#1F2937']}
              style={styles.clueModalGradient}
            >
              {/* Header */}
              <View style={styles.clueModalHeader}>
                <View style={[styles.clueModalIcon, { backgroundColor: `${clueInfo.color}30` }]}>
                  <ClueIcon size={32} color={clueInfo.color} />
                </View>
                <Text style={styles.clueModalType}>{clueInfo.label}</Text>
              </View>

              {/* Content */}
              <View style={styles.clueModalContent}>
                <Text style={styles.clueModalHint}>ðŸ’¡ {currentClue.data.hint}</Text>
                
                {currentClue.data.reward && (
                  <View style={styles.clueRewardSection}>
                    <Text style={styles.clueRewardLabel}>Potential Reward:</Text>
                    <Text style={styles.clueRewardValue}>ðŸŽ {currentClue.data.reward}</Text>
                  </View>
                )}
                
                {currentClue.data.action && (
                  <View style={styles.clueActionSection}>
                    <Text style={styles.clueActionLabel}>What to do:</Text>
                    <Text style={styles.clueActionValue}>👉 {currentClue.data.action}</Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <TouchableOpacity
                style={styles.clueModalButton}
                onPress={() => setShowClueModal(false)}
              >
                <Text style={styles.clueModalButtonText}>Got it!</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {selectedConversation ? renderMessageThread() : renderConversationList()}
      {renderClueModal()}
    </View>
  );
}

// Format timestamp helper
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  
  // Conversation List styles
  conversationList: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingTop: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    padding: scale(8),
    marginRight: scale(8),
  },
  headerTitle: {
    flex: 1,
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  unreadBadge: {
    backgroundColor: '#1D9BF0',
    borderRadius: scale(12),
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: fontScale(12),
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: scale(20),
    margin: scale(16),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
  },
  searchInput: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: fontScale(14),
    marginLeft: scale(10),
  },
  conversationsScroll: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  avatar: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarMysterious: {
    backgroundColor: '#1E1E2E',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  avatarEmoji: {
    fontSize: fontScale(24),
  },
  mysteriousBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#1E1E2E',
    borderRadius: scale(8),
    padding: scale(2),
  },
  conversationContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  conversationName: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#F9FAFB',
  },
  conversationHandle: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: scale(2),
  },
  conversationPreview: {
    fontSize: fontScale(13),
    color: '#9CA3AF',
    marginTop: scale(4),
  },
  clueTypeBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(8),
    marginLeft: scale(4),
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  conversationTime: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  unreadDot: {
    backgroundColor: '#1D9BF0',
    borderRadius: scale(10),
    width: scale(20),
    height: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(6),
  },
  unreadDotText: {
    color: '#FFF',
    fontSize: fontScale(11),
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(40),
  },
  emptyStateText: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#F9FAFB',
    marginTop: scale(16),
  },
  emptyStateSubtext: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: scale(8),
  },

  // Message Thread styles
  messageThread: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingTop: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  threadHeaderInfo: {
    flex: 1,
  },
  threadHeaderName: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  threadHeaderHandle: {
    fontSize: fontScale(13),
    color: '#6B7280',
  },
  mysteriousTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  mysteriousTagText: {
    fontSize: fontScale(11),
    color: '#A78BFA',
    fontWeight: '600',
    marginLeft: scale(4),
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: scale(16),
  },
  messageBubble: {
    maxWidth: '80%',
    padding: scale(12),
    borderRadius: scale(16),
    marginBottom: scale(12),
  },
  otherMessage: {
    backgroundColor: '#1F2937',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: scale(4),
  },
  playerMessage: {
    backgroundColor: '#1D9BF0',
    alignSelf: 'flex-end',
    borderBottomRightRadius: scale(4),
  },
  messageText: {
    fontSize: fontScale(14),
    color: '#F9FAFB',
    lineHeight: fontScale(20),
  },
  playerMessageText: {
    color: '#FFF',
  },
  messageTime: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(6),
  },
  playerMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  revealClueButton: {
    marginTop: scale(10),
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  revealClueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
  },
  revealClueButtonText: {
    color: '#FFF',
    fontSize: fontScale(12),
    fontWeight: '600',
    marginLeft: scale(6),
  },
  clueRevealedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(8),
    marginTop: scale(10),
  },
  clueRevealedText: {
    color: '#10B981',
    fontSize: fontScale(11),
    marginLeft: scale(6),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    backgroundColor: '#0B0C10',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    color: '#F9FAFB',
    fontSize: fontScale(14),
    maxHeight: scale(100),
  },
  sendButton: {
    padding: scale(10),
    marginLeft: scale(8),
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Clue Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  clueModal: {
    width: '100%',
    maxWidth: scale(360),
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  clueModalGradient: {
    padding: scale(24),
  },
  clueModalHeader: {
    alignItems: 'center',
    marginBottom: scale(20),
  },
  clueModalIcon: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(12),
  },
  clueModalType: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  clueModalContent: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(20),
  },
  clueModalHint: {
    fontSize: fontScale(16),
    color: '#F9FAFB',
    fontWeight: '600',
    marginBottom: scale(16),
  },
  clueRewardSection: {
    marginBottom: scale(12),
  },
  clueRewardLabel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginBottom: scale(4),
  },
  clueRewardValue: {
    fontSize: fontScale(14),
    color: '#10B981',
    fontWeight: '600',
  },
  clueActionSection: {},
  clueActionLabel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginBottom: scale(4),
  },
  clueActionValue: {
    fontSize: fontScale(14),
    color: '#60A5FA',
    fontWeight: '600',
  },
  clueModalButton: {
    backgroundColor: '#1D9BF0',
    borderRadius: scale(10),
    paddingVertical: scale(12),
    alignItems: 'center',
  },
  clueModalButtonText: {
    color: '#FFF',
    fontSize: fontScale(16),
    fontWeight: 'bold',
  },
});


