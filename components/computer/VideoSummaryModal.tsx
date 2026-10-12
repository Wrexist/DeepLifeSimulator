/**
 * VideoSummaryModal - the YouVideo upload recap.
 *
 * Uploading ended in a two-line alert ("Uploaded - 412 views"). This maps the
 * finished upload onto the shared `CreatorRecapModal`, the same card the
 * Streaming app ends on, so both halves of the creator career celebrate the
 * same way (tester, 2026-10-11).
 */
import React, { useMemo } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Eye, Star, Tag, TrendingUp } from 'lucide-react-native';
import CreatorRecapModal, { type CreatorRecap } from './CreatorRecapModal';
import { formatMoney } from '@/utils/moneyFormatting';
import { accent, creatorBrand, uiPalette } from '@/lib/config/theme';

export interface VideoSummary {
  title: string;
  topic: string;
  art: ImageSourcePropType;
  views: number;
  newSubs: number;
  earnings: number;
  viral: boolean;
  /** Most views of any earlier upload, for the NEW BEST pill. */
  priorBestViews: number;
  levelBefore: number;
  levelAfter: number;
  /** Was this topic trending when it was uploaded? */
  trending: boolean;
}

interface Props {
  summary: VideoSummary | null;
  onClose: () => void;
  /** Offered only when another upload is actually possible right now. */
  onRecordAgain?: () => void;
}

const fmt = (n: number) => formatMoney(Math.round(n || 0), false);

function verdict(s: VideoSummary, newBest: boolean): { title: string; line: string } {
  if (s.viral) return { title: 'VIRAL HIT!', line: 'The algorithm picked it up - it is everywhere.' };
  if (s.levelAfter > s.levelBefore) return { title: 'Level up!', line: `Your channel reached level ${s.levelAfter}.` };
  if (newBest) return { title: 'Most-watched yet', line: 'Your biggest upload so far.' };
  if (s.trending) return { title: 'Rode the trend', line: 'Uploading what is hot gave it a push.' };
  return { title: 'Uploaded!', line: 'It keeps earning as people find it.' };
}

export default function VideoSummaryModal({ summary, onClose, onRecordAgain }: Props) {
  const recap = useMemo<CreatorRecap | null>(() => {
    if (!summary) return null;
    const newBest = summary.views > summary.priorBestViews && summary.views > 0;
    const v = verdict(summary, newBest);
    const tint = creatorBrand.video.action;
    return {
      art: summary.art,
      subject: summary.title,
      badge: summary.viral ? 'VIRAL' : 'UPLOADED',
      tint,
      hot: summary.viral,
      newBest,
      title: v.title,
      line: v.line,
      earnings: summary.earnings,
      levelBefore: summary.levelBefore,
      levelAfter: summary.levelAfter,
      celebrate: summary.viral || newBest || summary.levelAfter > summary.levelBefore,
      stats: [
        { icon: Eye, label: 'Views', value: fmt(summary.views), tint },
        { icon: Star, label: 'New subs', value: `+${fmt(summary.newSubs)}`, tint: '#A78BFA' },
        { icon: Tag, label: 'Topic', value: summary.topic, tint: uiPalette.blue },
        ...(summary.trending
          ? [{ icon: TrendingUp, label: 'Trend boost', value: 'Yes', tint: accent.warning }]
          : []),
      ],
    };
  }, [summary]);
  return (
    <CreatorRecapModal
      recap={recap}
      onClose={onClose}
      secondaryLabel={onRecordAgain ? 'Record another' : undefined}
      onSecondary={onRecordAgain}
    />
  );
}
