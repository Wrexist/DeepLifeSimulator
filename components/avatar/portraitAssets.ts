import type { ImageSourcePropType } from 'react-native';
import type { PortraitId } from '@/lib/avatar/portraits';

export const PORTRAIT_ASSETS: Record<PortraitId, ImageSourcePropType> = {
  'portrait-v1:ember': require('@/assets/images/portraits/ember.webp'),
  'portrait-v1:cedar': require('@/assets/images/portraits/cedar.webp'),
  'portrait-v1:river': require('@/assets/images/portraits/river.webp'),
  'portrait-v1:dawn': require('@/assets/images/portraits/dawn.webp'),
  'portrait-v1:sage': require('@/assets/images/portraits/sage.webp'),
  'portrait-v1:indigo': require('@/assets/images/portraits/indigo.webp'),
};
