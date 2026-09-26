import type { ImageSourcePropType } from 'react-native';
import type { MediaArtKey } from '@/lib/content/mediaArtwork';

/** One bundled family for composer, category tiles, history and detail screens. */
export const MEDIA_ART: Record<MediaArtKey, ImageSourcePropType> = {
  chat: require('@/assets/images/media/after-hours.webp'),
  rpg: require('@/assets/images/media/lantern-isles.webp'),
  competitive: require('@/assets/images/media/relay-arena.webp'),
  creative: require('@/assets/images/media/pocket-borough.webp'),
  speedrun: require('@/assets/images/media/rooftop-rush.webp'),
};
