import type { ImageSourcePropType } from 'react-native';
import type { MediaArtKey } from '@/lib/content/mediaArtwork';

/** One bundled family for composer, category tiles, history and detail screens. */
export const MEDIA_ART: Record<MediaArtKey, ImageSourcePropType> = {
  chat: require('@/assets/images/media-v2/after-hours.webp'),
  rpg: require('@/assets/images/media-v2/lantern-isles.webp'),
  competitive: require('@/assets/images/media-v2/relay-arena.webp'),
  creative: require('@/assets/images/media-v2/pocket-borough.webp'),
  speedrun: require('@/assets/images/media-v2/rooftop-rush.webp'),
};
