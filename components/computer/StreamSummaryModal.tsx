/**
 * StreamSummaryModal - the end-of-broadcast recap.
 *
 * Ending a stream used to be a plain two-line alert (tester request,
 * 2026-10-11). This maps a finished broadcast onto the shared
 * `CreatorRecapModal` card: a verdict line, the earnings, and the five numbers
 * a broadcast moved, with confetti only for a hype train, a new best or a
 * level up.
 */
import React, { useMemo } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Clock, Eye, Gift, Heart, Star } from 'lucide-react-native';
import CreatorRecapModal, { type CreatorRecap } from './CreatorRecapModal';
import { formatMoney } from '@/utils/moneyFormatting';
import { accent, uiPalette } from '@/lib/config/theme';

const LIVE_RED = accent.danger;
const PURPLE = '#A78BFA';

export interface StreamSummary {
  game: string;
  art: ImageSourcePropType;
  /** Real seconds the broadcast ran. */
  seconds: number;
  viewers: number;
  newFollowers: number;
  newSubs: number;
  donations: number;
  earnings: number;
  hypeTrain: boolean;
  autoStopped: boolean;
  /** Beat the channel's previous best peak. */
  newBest: boolean;
  levelBefore: number;
  levelAfter: number;
}

interface Props {
  summary: StreamSummary | null;
  onClose: () => void;
  /** Offered only when another stream is actually possible right now. */
  onGoAgain?: () => void;
}

const fmt = (n: number) => formatMoney(Math.round(n || 0), false);

function fmtDuration(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${(s % 60).toString().padStart(2, '0')}s` : `${s}s`;
}

/** One line that tells the player how it went, in the order that matters most. */
function verdict(s: StreamSummary): { title: string; line: string } {
  if (s.hypeTrain) return { title: 'HYPE TRAIN!', line: 'Chat went wild - the subs kept rolling in.' };
  if (s.levelAfter > s.levelBefore) return { title: 'Level up!', line: `Your channel reached level ${s.levelAfter}.` };
  if (s.newBest) return { title: 'New personal best', line: 'Your biggest audience yet.' };
  if (s.autoStopped) return { title: 'Out of energy', line: 'You streamed until you dropped. Rest up and go again.' };
  if (s.viewers === 0) return { title: 'Quiet one', line: 'Nobody showed up this time - better gear and longer streams help.' };
  return { title: 'Stream complete', line: 'Every broadcast grows the channel a little more.' };
}

export default function StreamSummaryModal({ summary, onClose, onGoAgain }: Props) {
  const recap = useMemo<CreatorRecap | null>(() => {
    if (!summary) return null;
    const v = verdict(summary);
    return {
      art: summary.art,
      subject: summary.game,
      badge: summary.hypeTrain ? 'HYPE TRAIN' : 'STREAM ENDED',
      tint: PURPLE,
      hot: summary.hypeTrain,
      newBest: summary.newBest,
      title: v.title,
      line: v.line,
      earnings: summary.earnings,
      levelBefore: summary.levelBefore,
      levelAfter: summary.levelAfter,
      celebrate: summary.hypeTrain || summary.newBest || summary.levelAfter > summary.levelBefore,
      stats: [
        { icon: Eye, label: 'Peak viewers', value: fmt(summary.viewers), tint: LIVE_RED },
        { icon: Clock, label: 'Time live', value: fmtDuration(summary.seconds), tint: uiPalette.blue },
        { icon: Heart, label: 'New followers', value: `+${fmt(summary.newFollowers)}`, tint: '#F472B6' },
        { icon: Star, label: 'New subs', value: `+${fmt(summary.newSubs)}`, tint: PURPLE },
        { icon: Gift, label: 'Donations', value: formatMoney(summary.donations), tint: accent.gold },
      ],
    };
  }, [summary]);
  return (
    <CreatorRecapModal
      recap={recap}
      onClose={onClose}
      secondaryLabel={onGoAgain ? 'Go live again' : undefined}
      onSecondary={onGoAgain}
    />
  );
}
