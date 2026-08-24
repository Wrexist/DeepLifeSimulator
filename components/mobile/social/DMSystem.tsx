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
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
 View,
 Text,
 StyleSheet,
 TouchableOpacity,
 ScrollView,
 Modal,
 TextInput,
} from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { MS_PER_HOUR, MS_PER_DAY, MS_PER_WEEK } from '@/lib/config/gameConstants';
import {
 ArrowLeft,
 Mail,
 Send,
 Lock,
 Gift,
 MapPin,
 DollarSign,
 Briefcase,
 Heart,
 Sparkles,
 CheckCircle,
 Star,
 MessageCircle,
 Search,
 Eye,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { useTimerManager } from '@/hooks/useTimerManager';
import { scale, fontScale } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import type { DMConversation, DMMessage } from '@/contexts/game/types';
const LinearGradient = Gradient;

// DMConversation & DMMessage are shared with game state and imported from
// contexts/game/types so the persisted inbox + threads share one definition.
type ClueType = 'location'|'money'|'career'|'relationship'|'item'|'secret'|'quest';

interface ClueData {
 hint: string;
 reward?: string;
 action?: string;
 destination?: string;
 requirement?: string;
 completed?: boolean;
}

// Mysterious contacts that send clues
const MYSTERIOUS_CONTACTS: Omit<DMConversation, 'id'|'lastMessage'|'timestamp'|'unreadCount'|'isPinned'>[] = [
 {
 senderName: 'The Informant',
 senderHandle: 'shadow_info',
 senderAvatar: '',
 isVerified: false,
 isMysterious: true,
 clueType: 'money',
 },
 {
 senderName: 'Career Whisperer',
 senderHandle: 'career_insider',
 senderAvatar: '',
 isVerified: true,
 isMysterious: true,
 clueType: 'career',
 },
 {
 senderName: 'Anonymous Traveler',
 senderHandle: 'world_seeker',
 senderAvatar: '',
 isVerified: false,
 isMysterious: true,
 clueType: 'location',
 },
 {
 senderName: 'Love Oracle',
 senderHandle: 'heart_guide',
 senderAvatar: '',
 isVerified: false,
 isMysterious: true,
 clueType: 'relationship',
 },
 {
 senderName: 'Treasure Hunter',
 senderHandle: 'finder_keeper',
 senderAvatar: '',
 isVerified: true,
 isMysterious: true,
 clueType: 'item',
 },
 {
 senderName: 'The Curator',
 senderHandle: 'hidden_knowledge',
 senderAvatar: '',
 isVerified: false,
 isMysterious: true,
 clueType: 'secret',
 },
 {
 senderName: 'Quest Master',
 senderHandle: 'adventure_awaits',
 senderAvatar: '',
 isVerified: true,
 isMysterious: true,
 clueType: 'quest',
 },
];

// One-time cash tip paid the first time each mysterious contact's clue is
// revealed. Kept modest so the seven contacts can't bankroll a run, and gated
// one-time by the persisted `revealedDMClues` flag (see handleRevealClue).
const CLUE_REWARD_CASH: Record<ClueType, number> = {
 money: 500,
 career: 400,
 location: 300,
 relationship: 300,
 item: 350,
 secret: 450,
 quest: 600,
};

// Clue templates by type. Every clue references a mechanic that actually exists
// in this week-based sim - no intraday stock timing, casino, or calendar-day
// drops - so acting on a tip always leads somewhere real.
const CLUE_TEMPLATES: Record<ClueType, { message: string; hint: string; reward: string; action: string }[]> = {
 money: [
 {
 message: "The Stocks app moves every week. Buy the dips, hold the winners, and let patience beat the panic sellers.",
 hint: "Invest through the Stocks app",
 reward: "A stronger portfolio",
 action: "Open the Stocks app and invest"},
 {
 message:"Rental property pays you passively every single week. One solid building in the Real Estate app beats a dozen risky bets.",
 hint: "Passive income from property",
 reward: "Weekly rental income",
 action: "Buy a rental in the Real Estate app"},
 {
 message:"Park spare cash in a Bank savings account - the interest compounds every week while you get on with your life.",
 hint: "Savings interest compounds weekly",
 reward: "Compounding interest",
 action: "Deposit savings in the Bank app"},
 {
 message:"Want real leverage? Finish the Entrepreneurship course, then found your own company - it turns your skills into weekly revenue.",
 hint: "Companies pay weekly revenue",
 reward: "Business income",
 action: "Study Entrepreneurship, then found a company"},
 ],
 career: [
 {
 message:"Promotions aren't luck. Keep working your job each week and your promotion progress fills - the next level is just persistence.",
 hint: "Work fills promotion progress",
 reward: "A higher salary",
 action: "Work your job in the Work tab"},
 {
 message:"The best-paid careers are gated behind degrees. Every course you finish opens new listings in the Work tab.",
 hint: "Education unlocks careers",
 reward: "Higher-paying roles",
 action: "Complete a course in the Education app"},
 {
 message:"Elite careers want proof you can lead. A business education in the Education app is what fast-tracks you there.",
 hint: "Business study unlocks elite careers",
 reward: "Advanced career access",
 action: "Study business in the Education app"},
 {
 message:"Running your own company builds the reputation top employers notice. Entrepreneurs get the calls others don't.",
 hint: "Entrepreneurship builds reputation",
 reward: "Reputation for elite careers",
 action: "Found a company in the Hustle app"},
 ],
 location: [
 {
 message:"The Travel app has destinations most players skip. Every trip you take lifts your happiness and broadens your horizons.",
 hint: "Travel boosts happiness",
 reward: "Happiness from new places",
 action: "Book a trip in the Travel app"},
 {
 message:"Feeling burnt out? A change of scenery is a real stat boost - don't let your passport gather dust.",
 hint: "New destinations lift your stats",
 reward: "+Happiness",
 action: "Travel somewhere new in the Travel app"},
 {
 message:"Happiness fuels everything else you do. When it dips, a well-timed getaway keeps the rest of your life running smooth.",
 hint: "Keep happiness topped up",
 reward: "Balanced stats",
 action: "Take a trip when happiness drops"},
 ],
 relationship: [
 {
 message:"Someone's been curious about you. Open the Contacts app and reach out before the moment passes.",
 hint: "A new connection is waiting",
 reward: "A new relationship",
 action: "Reach out in the Contacts app"},
 {
 message:"Thoughtful gifts strengthen bonds faster than words ever will. Match the gift to what the person actually values.",
 hint: "Gifts strengthen bonds",
 reward: "Faster relationship growth",
 action: "Give gifts to people you're close to"},
 {
 message:"Relationships fade if you neglect them. Regular contact keeps the people who matter close.",
 hint: "Nurture relationships each week",
 reward: "Slower relationship decay",
 action: "Stay in touch in the Contacts app"},
 ],
 item: [
 {
 message:"The Onion browser trades in things no normal store carries. It's risky, but the inventory is genuinely one of a kind.",
 hint: "The dark web has rare items",
 reward: "Unique gear",
 action: "Browse the Onion app carefully"},
 {
 message:"Vehicles are assets, not just rides. Buy smart in the vehicle shop and your garage holds real value.",
 hint: "Vehicles hold value",
 reward: "Asset value",
 action: "Buy a vehicle you can afford"},
 {
 message:"A pet is more than company - caring for one lifts your happiness every week. Adopt when you're ready.",
 hint: "Pets boost happiness weekly",
 reward: "Weekly happiness",
 action: "Adopt a pet in the Pet app"},
 ],
 secret: [
 {
 message:"When the time comes, Prestige resets your life but keeps powerful legacy bonuses. The long game rewards those who let go.",
 hint: "Prestige keeps legacy bonuses",
 reward: "Legacy bonuses",
 action: "Explore Prestige when it unlocks"},
 {
 message:"There's a hidden skill tree in the crime system. Level up stealth, hacking, or lockpicking to unlock powerful perks.",
 hint: "Crime skills have talent trees",
 reward: "Crime perks",
 action: "Level crime skills in the Work tab"},
 {
 message:"The Statistics app tracks everything you do. Some achievements pay out real bonuses the moment you claim them.",
 hint: "Achievements pay out on claim",
 reward: "Achievement bonuses",
 action: "Claim achievements in the Statistics app"},
 ],
 quest: [
 {
 message:"Here's a real goal: become a millionaire before you turn 30. Stack income, invest, and watch your net worth climb.",
 hint: "An early-wealth milestone",
 reward: "Bragging rights",
 action: "Grow your net worth early"},
 {
 message:"Try to visit every country in a single lifetime. Few manage it - and the journey itself keeps your happiness high.",
 hint: "A world-traveler goal",
 reward: "Happiness along the way",
 action: "Keep exploring the Travel app"},
 {
 message:"The ultimate challenge: push every stat to 100 and hold it there. Balance is the hardest game of all.",
 hint: "A perfect-stats goal",
 reward: "True mastery",
 action: "Balance health, happiness, energy & fitness"},
 ],
};

interface DMSystemProps {
 onBack: () => void;
}

export default function DMSystem({ onBack }: DMSystemProps) {
 const { gameState, setGameState, saveGame } = useGame();
 // Auto-cleaned timers so the delayed NPC reply can't setState after the DM closes.
 const timers = useTimerManager();
 const [selectedConversation, setSelectedConversation] = useState<DMConversation | null>(null);
 const [conversations, setConversations] = useState<DMConversation[]>([]);
 const [messages, setMessages] = useState<DMMessage[]>([]);
 const [messageInput, setMessageInput] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [showClueModal, setShowClueModal] = useState(false);
 const [currentClue, setCurrentClue] = useState<{ type: ClueType; data: ClueData; rewardCash: number; claimed: boolean } | null>(null);
 const [revealedClues, setRevealedClues] = useState<string[]>([]);
 // Same-frame double-press latch for the one-time clue payout (econ-5). React
 // state cannot serve as this gate: both presses in a frame read the same
 // pre-update value.
 const grantedCluesRef = useRef<Set<string>>(new Set());

 // Initialize conversations from game state.
 // The inbox is generated ONCE, persisted, and read back from game state on
 // every later mount. We only ever TOP UP (append) when there are too few -
 // never regenerate or replace - so senders/badges stay stable.
 useEffect(() => {
 const savedConversations = gameState.dmConversations || [];
 const savedRevealedClues = gameState.revealedDMClues || [];

 if (savedConversations.length < 3) {
 const newConversations = generateNewConversations(3 - savedConversations.length, savedConversations);
 if (newConversations.length > 0) {
 const merged = [...savedConversations, ...newConversations];
 setConversations(merged);
 // Persist the freshly generated inbox so it survives remounts.
 setGameState(prev => ({ ...prev, dmConversations: merged }));
 saveGame();
 } else {
 setConversations(savedConversations);
 }
 } else {
 setConversations(savedConversations);
 }

 setRevealedClues(savedRevealedClues);
 // revealedDMClues is intentionally NOT a dependency: revealing a clue must
 // not re-run this effect (doing so is what used to scramble the inbox).
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [gameState.dmConversations]);

 // Generate new mysterious conversations. Ids are derived from the sender
 // handle so they are STABLE across remounts - this keeps persisted clue-reveal
 // flags and message threads matched to their conversation. `existing` is the
 // set we exclude (and never discard) so top-ups append rather than replace.
 const generateNewConversations = useCallback((count: number, existing: DMConversation[]): DMConversation[] => {
 const availableContacts = MYSTERIOUS_CONTACTS.filter(
 c => !existing.find(conv => conv.senderHandle === c.senderHandle)
 );

 return availableContacts.slice(0, count).map((contact) => {
 const clueType = contact.clueType ||'secret';
 const templates = CLUE_TEMPLATES[clueType];
 const template = templates[Math.floor(Math.random() * templates.length)];

 return {
 id: `dm_${contact.senderHandle}`,
...contact,
 lastMessage: "New message...",
 timestamp: Date.now() - Math.random() * MS_PER_DAY, // Random time in last 24h
 unreadCount: 1,
 isPinned: false,
 clueData: {
 hint: template.hint,
 reward: template.reward,
 action: template.action,
 },
 };
 });
 }, []);

 // Generate messages for a conversation. Prefer the PERSISTED thread so the
 // player's sent replies + the NPC auto-replies survive closing/reopening;
 // fall back to the generated intro template only when nothing is stored yet.
 const generateMessagesForConversation = useCallback((conversation: DMConversation): DMMessage[] => {
 if (conversation.messages && conversation.messages.length > 0) {
 return conversation.messages;
 }
 const clueType = conversation.clueType || 'secret';
 const templates = CLUE_TEMPLATES[clueType];
 const template = templates[Math.floor(Math.random() * templates.length)];
 
 return [
 {
 id: `msg_${conversation.id}_1`,
 senderId: conversation.senderHandle,
 content: "Hey there...",
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

 // Mark as read AND seed the persisted thread (unreadCount + messages) into
 // game state, so both the cleared badge and the thread survive a remount.
 setConversations(prev => prev.map(c =>
 c.id === conversation.id ? {...c, unreadCount: 0, messages: msgs }: c
 ));
 setGameState(prev => ({
...prev,
 dmConversations: (prev.dmConversations || []).map(c =>
 c.id === conversation.id ? {...c, unreadCount: 0, messages: msgs }: c
 ),
 }));
 saveGame();
 }, [generateMessagesForConversation, setGameState, saveGame]);

 // Handle revealing a clue
 const handleRevealClue = useCallback((message: DMMessage) => {
 if (!message.hasClue ||!message.clueType ||!message.clueData) return;

 const clueId = `${selectedConversation?.id}_clue`;
 const firstReveal = !revealedClues.includes(clueId);
 const rewardCash = CLUE_REWARD_CASH[message.clueType] ?? 0;

 if (firstReveal && !grantedCluesRef.current.has(clueId)) {
 // Synchronous latch: `firstReveal` is derived from React state, so two
 // presses in the same frame both read it as true. This closes before any
 // state is touched. 2026-07-28 audit econ-5.
 grantedCluesRef.current.add(clueId);
 setRevealedClues(prev => (prev.includes(clueId) ? prev: [...prev, clueId]));

 // Gate and grant in ONE updater, keyed on the PERSISTED flag. It used to be
 // two dispatches - a flag write, then a separate updateMoney - so the gate
 // was component state while the payout was its own transaction, and the
 // money could land twice for one reveal. Now the persisted list is both the
 // gate and the record, re-checked against `prev` inside the updater, and the
 // credit rides the canonical applyMoneyDelta path (ceiling + NaN guards,
 // daily-summary tracking).
 setGameState(prev => {
 if ((prev.revealedDMClues || []).includes(clueId)) return prev;
 const credit = rewardCash > 0
? applyMoneyDelta(prev, rewardCash, `Acted on a tip from ${selectedConversation?.senderName ?? 'a mysterious contact'}`)
: {};
 if (rewardCash > 0 && !credit) return prev; // money guard rejected it
 return {
...prev,
...credit,
 revealedDMClues: [...(prev.revealedDMClues || []), clueId],
 };
 });
 // Defer the save past the commit + parent ref-sync so the granted money AND
 // the reveal flag both persist (a synchronous save captures the pre-grant state).
 setTimeout(() => { void saveGame(); }, 0);
 }

 setCurrentClue({
 type: message.clueType,
 data: message.clueData,
 rewardCash,
 claimed: !firstReveal,
 });
 setShowClueModal(true);

 // Update message as revealed - locally AND in the persisted thread so the
 // "Clue Revealed" state sticks after the DM is closed and reopened.
 setMessages(prev => prev.map(m =>
 m.id === message.id ? {...m, clueRevealed: true }: m
 ));
 const revealedConvId = selectedConversation?.id;
 if (revealedConvId) {
 setGameState(prev => ({
...prev,
 dmConversations: (prev.dmConversations || []).map(c =>
 c.id === revealedConvId
 ? {...c, messages: (c.messages || []).map(m => m.id === message.id ? {...m, clueRevealed: true }: m) }
 : c
 ),
 }));
 // On first reveal the deferred save above captures this too; only re-views
 // need a save here (the message-revealed flag is already persisted anyway).
 if (!firstReveal) saveGame();
 }
 }, [selectedConversation, revealedClues, setGameState, saveGame]);

 // Persist a message into a conversation's stored thread (game state) so the
 // full exchange is durable - this is what stops sent replies from vanishing.
 const persistMessageToConversation = useCallback((conversationId: string, message: DMMessage) => {
 setConversations(prev => prev.map(c =>
 c.id === conversationId ? {...c, messages: [...(c.messages || []), message] }: c
 ));
 setGameState(prev => ({
...prev,
 dmConversations: (prev.dmConversations || []).map(c =>
 c.id === conversationId ? {...c, messages: [...(c.messages || []), message] }: c
 ),
 }));
 saveGame();
 }, [setGameState, saveGame]);

 // Handle sending a reply
 const handleSendMessage = useCallback(() => {
 if (!messageInput.trim() ||!selectedConversation) return;

 const conversationId = selectedConversation.id;
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
 persistMessageToConversation(conversationId, newMessage);

 // Generate a response after a short delay
 timers.setTimeout(() => {
 const responses = [
 "Interesting...",
 "I see you understand. Good luck!",
 "Use this information wisely.",
 "There's more where that came from... stay tuned.",
 "The path to success is paved with secrets.",
 "You're smarter than I thought!",
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
 persistMessageToConversation(conversationId, responseMessage);
 }, 1500);
 }, [messageInput, selectedConversation, persistMessageToConversation]);

 // Get clue type icon and color
 const getClueTypeInfo = (type: ClueType) => {
 switch (type) {
 case 'money':
 return { icon: DollarSign, color: '#10B981', label: 'Money Tip'};
 case'career':
 return { icon: Briefcase, color: '#3B82F6', label: 'Career Hint'};
 case'location':
 return { icon: MapPin, color: '#8B5CF6', label: 'Location Secret'};
 case'relationship':
 return { icon: Heart, color: '#EC4899', label: 'Relationship Advice'};
 case'item':
 return { icon: Gift, color: '#F59E0B', label: 'Item Discovery'};
 case'secret':
 return { icon: Lock, color: '#6366F1', label: 'Hidden Secret'};
 case'quest':
 return { icon: Star, color: '#EAB308', label: 'Quest'};
 default:
 return { icon: MessageCircle, color:'#94A3B8', label: 'Message'};
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
 <TouchableOpacity
 onPress={onBack}
 style={styles.backButton}
 accessibilityRole="button"
 accessibilityLabel="Back"
 >
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
 <Search size={scale(18)} color="#94A3B8" />
 <TextInput
 style={styles.searchInput}
 placeholder="Search messages..."
 placeholderTextColor="#94A3B8"
 value={searchQuery}
 onChangeText={setSearchQuery}
 />
 </View>

 {/* Conversations */}
 <ScrollView style={styles.conversationsScroll} showsVerticalScrollIndicator={false}>
 {filteredConversations.length === 0 ? (
 <View style={styles.emptyState}>
 <Mail size={scale(48)} color="#94A3B8" />
 <Text style={styles.emptyStateText}>No messages yet</Text>
 <Text style={styles.emptyStateSubtext}>
 Mysterious contacts will reach out with tips and secrets...
 </Text>
 </View>
 ): (
 filteredConversations.map(conversation => {
 const clueInfo = conversation.clueType ? getClueTypeInfo(conversation.clueType): null;
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
 <CheckCircle size={14} color="#3B82F6" />
 )}
 {clueInfo && ClueIcon && (
 <View style={[styles.clueTypeBadge, { backgroundColor:`${clueInfo.color}20`}]}>
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
 accessibilityRole="button"
 accessibilityLabel="Back to messages"
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
 message.isPlayer ? styles.playerMessage: styles.otherMessage,
 ]}
 >
 <Text style={[
 styles.messageText,
 message.isPlayer && styles.playerMessageText,
 ]}>
 {message.content}
 </Text>
 
 {/* Clue button */}
 {message.hasClue &&!message.clueRevealed && (
 <TouchableOpacity
 style={styles.revealClueButton}
 onPress={() => handleRevealClue(message)}
 >
 <LinearGradient
 colors={['#F59E0B','#D97706']}
 style={styles.revealClueButtonGradient}
 >
 <Eye size={14} color="#FFF"/>
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
 placeholderTextColor="#94A3B8"
 value={messageInput}
 onChangeText={setMessageInput}
 multiline
 />
 <TouchableOpacity
 style={[styles.sendButton,!messageInput.trim() && styles.sendButtonDisabled]}
 onPress={handleSendMessage}
 disabled={!messageInput.trim()}
 accessibilityRole="button"
 accessibilityLabel="Send message"
 accessibilityState={{ disabled: !messageInput.trim() }}
 >
 <Send size={scale(20)} color={messageInput.trim() ?'#3B82F6': '#94A3B8'} />
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
 animationType="fade"onRequestClose={() => setShowClueModal(false)}
 >
 <View style={styles.modalOverlay}>
 <View style={styles.clueModal}>
 <LinearGradient
 colors={[`${clueInfo.color}40`,'#1E293B']}
 style={styles.clueModalGradient}
 >
 {/* Header */}
 <View style={styles.clueModalHeader}>
 <View style={[styles.clueModalIcon, { backgroundColor: `${clueInfo.color}30`}]}>
 <ClueIcon size={32} color={clueInfo.color} />
 </View>
 <Text style={styles.clueModalType}>{clueInfo.label}</Text>
 </View>

 {/* Content */}
 <View style={styles.clueModalContent}>
 <Text style={styles.clueModalHint}>{currentClue.data.hint}</Text>
 
 {currentClue.rewardCash > 0 && (
 <View style={styles.clueRewardSection}>
 <Text style={styles.clueRewardLabel}>
 {currentClue.claimed ? 'Reward (already claimed):' : 'Reward added to your balance:'}
 </Text>
 <Text style={styles.clueRewardValue}> +${currentClue.rewardCash.toLocaleString()}</Text>
 </View>
 )}
 
 {currentClue.data.action && (
 <View style={styles.clueActionSection}>
 <Text style={styles.clueActionLabel}>What to do:</Text>
 <Text style={styles.clueActionValue}>{currentClue.data.action}</Text>
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
 {selectedConversation ? renderMessageThread(): renderConversationList()}
 {renderClueModal()}
 </View>
 );
}

// Format timestamp helper
function formatTimestamp(timestamp: number): string {
 const now = Date.now();
 const diff = now - timestamp;
 
 if (diff < 60000) return'Now';
 if (diff < MS_PER_HOUR) return `${Math.floor(diff / 60000)}m`;
 if (diff < MS_PER_DAY) return `${Math.floor(diff / MS_PER_HOUR)}h`;
 if (diff < MS_PER_WEEK) return `${Math.floor(diff / MS_PER_DAY)}d`;
 return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: '#0F172A',
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
 borderBottomColor: '#334155',
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
 backgroundColor: '#3B82F6',
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
 backgroundColor: '#1E293B',
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
 borderBottomColor: '#334155',
 },
 avatar: {
 width: scale(50),
 height: scale(50),
 borderRadius: scale(25),
 backgroundColor: '#334155',
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
 color: '#94A3B8',
 marginTop: scale(2),
 },
 conversationPreview: {
 fontSize: fontScale(13),
 color: '#94A3B8',
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
 color: '#94A3B8',
 },
 unreadDot: {
 backgroundColor: '#3B82F6',
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
 color: '#94A3B8',
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
 borderBottomColor: '#334155',
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
 color: '#94A3B8',
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
 backgroundColor: '#334155',
 alignSelf: 'flex-start',
 borderBottomLeftRadius: scale(4),
 ...getPlatformShadows(3, 0.18, 2, 6),
 },
 playerMessage: {
 backgroundColor: '#3B82F6',
 alignSelf: 'flex-end',
 borderBottomRightRadius: scale(4),
 ...getPlatformShadows(3, 0.28, 2, 6),
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
 color: '#94A3B8',
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
 borderTopColor: '#334155',
 backgroundColor: '#0F172A',
 ...getPlatformShadows(8, 0.3, -4, 16),
 },
 messageInput: {
 flex: 1,
 backgroundColor: '#1E293B',
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
 color: '#94A3B8',
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
 color: '#94A3B8',
 marginBottom: scale(4),
 },
 clueActionValue: {
 fontSize: fontScale(14),
 color: '#60A5FA',
 fontWeight: '600',
 },
 clueModalButton: {
 backgroundColor: '#3B82F6',
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


