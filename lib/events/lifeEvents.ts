/**
 * Life Events - Event Chaining System
 * 
 * System for events that can trigger follow-up events after X weeks
 */

import type { PendingChainedEvent, ChainedEvent } from '@/contexts/game/types';

/**
 * Registry of chained events
 * Maps trigger event ID to potential follow-up events
 */
export const CHAINED_EVENTS: ChainedEvent[] = [
  // Old friend returns can chain to job offer
  {
    triggerEventId: 'old_friend_returns',
    followUpEventId: 'friend_job_offer',
    delayWeeks: 4,
    condition: 'has_reconnected', // Player chose to reconnect
  },
  
  // Networking event can chain to business opportunity
  {
    triggerEventId: 'networking_event',
    followUpEventId: 'networking_opportunity',
    delayWeeks: 2,
    condition: 'attended_networking',
  },
  
  // Interview request can chain to podcast invite
  {
    triggerEventId: 'interview_request',
    followUpEventId: 'podcast_invite',
    delayWeeks: 3,
    condition: 'accepted_interview',
  },
  
  // Health scare can chain to recovery
  {
    triggerEventId: 'health_scare',
    followUpEventId: 'health_recovery',
    delayWeeks: 2,
    condition: 'did_tests',
  },
  
  // Scandal can chain to redemption
  {
    triggerEventId: 'scandal_rumor',
    followUpEventId: 'scandal_redemption',
    delayWeeks: 4,
    condition: 'released_statement',
  },
  
  // Business partnership can chain to expansion
  {
    triggerEventId: 'business_partnership',
    followUpEventId: 'partnership_expansion',
    delayWeeks: 8,
    condition: 'accepted_partnership',
  },
  
  // Fitness challenge can chain to achievement
  {
    triggerEventId: 'fitness_challenge',
    followUpEventId: 'fitness_achievement',
    delayWeeks: 4,
    condition: 'accepted_challenge',
  },
  
  // Community service can chain to recognition
  {
    triggerEventId: 'community_service',
    followUpEventId: 'community_recognition',
    delayWeeks: 6,
    condition: 'volunteered',
  },
];

/**
 * Follow-up event definitions
 */
export const FOLLOW_UP_EVENTS = {
  friend_job_offer: {
    id: 'friend_job_offer',
    description: 'Your old friend reached out again - their company has an opening they think would be perfect for you!',
    choices: [
      { id: 'interview', text: 'Schedule an interview', effects: { stats: { happiness: 10, reputation: 5 } } },
      { id: 'decline', text: 'Decline politely', effects: {} },
    ],
  },
  
  networking_opportunity: {
    id: 'networking_opportunity',
    description: 'Someone you met at the networking event has a business proposition!',
    choices: [
      { id: 'meet', text: 'Meet to discuss', effects: { money: 0, stats: { reputation: 10 } } },
      { id: 'pass', text: 'Not interested', effects: {} },
    ],
  },
  
  podcast_invite: {
    id: 'podcast_invite',
    description: 'After seeing your interview, a popular podcast wants you as a guest!',
    choices: [
      { id: 'accept', text: 'Accept the invite', effects: { stats: { reputation: 20, happiness: 10 } } },
      { id: 'decline', text: 'Too much attention', effects: {} },
    ],
  },
  
  health_recovery: {
    id: 'health_recovery',
    description: 'Great news! Your test results came back clear. The doctor recommends staying healthy.',
    choices: [
      { id: 'celebrate', text: 'Celebrate the news', effects: { stats: { happiness: 20, health: 10 } } },
      { id: 'lifestyle', text: 'Start healthier lifestyle', effects: { stats: { health: 15, fitness: 5, energy: 5 } } },
    ],
  },
  
  scandal_redemption: {
    id: 'scandal_redemption',
    description: 'The truth came out and people are apologizing for believing the rumors!',
    choices: [
      { id: 'forgive', text: 'Accept apologies gracefully', effects: { stats: { reputation: 25, happiness: 15 } } },
      { id: 'address', text: 'Make a public statement', effects: { stats: { reputation: 30 } } },
    ],
  },
  
  partnership_expansion: {
    id: 'partnership_expansion',
    description: 'Your partnership is thriving! Your partner proposes expanding to new markets.',
    choices: [
      { id: 'expand', text: 'Fund the expansion', effects: { money: -50000, stats: { reputation: 15 } } },
      { id: 'cautious', text: 'Stay conservative', effects: { stats: { happiness: 5 } } },
    ],
  },
  
  fitness_achievement: {
    id: 'fitness_achievement',
    description: 'Congratulations! You completed the 30-day fitness challenge!',
    choices: [
      { id: 'celebrate', text: 'Celebrate the achievement', effects: { stats: { fitness: 15, health: 10, happiness: 20 } } },
      { id: 'continue', text: 'Keep pushing harder', effects: { stats: { fitness: 20, health: 5, energy: -10 } } },
    ],
  },
  
  community_recognition: {
    id: 'community_recognition',
    description: 'The community center is honoring you for your volunteer work!',
    choices: [
      { id: 'accept', text: 'Accept the honor', effects: { stats: { reputation: 25, happiness: 15 } } },
      { id: 'humble', text: 'Deflect to the team', effects: { stats: { reputation: 15, happiness: 20 } } },
    ],
  },
};

/**
 * Check if an event choice triggers a chained event
 */
export function checkForChainedEvent(
  eventId: string,
  choiceId: string,
  currentWeek: number
): PendingChainedEvent | null {
  // Map choice IDs to conditions
  const conditionMap: Record<string, string[]> = {
    has_reconnected: ['reconnect', 'dinner'],
    attended_networking: ['attend'],
    accepted_interview: ['accept'],
    did_tests: ['tests', 'basic'],
    released_statement: ['statement'],
    accepted_partnership: ['accept', 'negotiate'],
    accepted_challenge: ['accept'],
    volunteered: ['volunteer'],
  };
  
  for (const chain of CHAINED_EVENTS) {
    if (chain.triggerEventId !== eventId) continue;
    
    // Check if choice matches condition
    const matchingChoices = chain.condition ? conditionMap[chain.condition] : [];
    if (matchingChoices && !matchingChoices.includes(choiceId)) continue;
    
    // Random chance (70%) to trigger chain
    if (Math.random() > 0.7) continue;
    
    return {
      eventId: chain.followUpEventId,
      triggerWeek: currentWeek + chain.delayWeeks,
      sourceEventId: eventId,
    };
  }
  
  return null;
}

/**
 * Get follow-up event if one is due
 */
export function getFollowUpEvent(
  pendingEvents: PendingChainedEvent[],
  currentWeek: number
): { event: typeof FOLLOW_UP_EVENTS[keyof typeof FOLLOW_UP_EVENTS]; pendingEvent: PendingChainedEvent } | null {
  for (const pending of pendingEvents) {
    if (pending.triggerWeek <= currentWeek) {
      const event = FOLLOW_UP_EVENTS[pending.eventId as keyof typeof FOLLOW_UP_EVENTS];
      if (event) {
        return { event, pendingEvent: pending };
      }
    }
  }
  return null;
}

/**
 * Remove triggered pending event
 */
export function removePendingEvent(
  pendingEvents: PendingChainedEvent[],
  eventId: string
): PendingChainedEvent[] {
  return pendingEvents.filter(e => e.eventId !== eventId);
}

