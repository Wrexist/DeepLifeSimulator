import type { ImageSourcePropType } from 'react-native';

/**
 * Custom app-icon PNGs (assets/images/AppIcons/), keyed by the app `id` used in
 * the mobile.tsx / computer.tsx `appsList` arrays. Any id NOT present here falls
 * back to its Lucide glyph on a gradient, so the set can be filled in
 * incrementally — a missing icon never breaks the grid.
 *
 * Note the id ↔ filename aliases: the launcher ids don't all match the app's
 * display name. Spark is `tinder`, Pulse is `social`, Crypto is `bitcoin`, Dark
 * Web is `onion`, YouVideo is `gaming`, Garage is `vehicle`, Politics is
 * `political`, and Pets is `pet` on the phone but `paw` on the computer — both
 * point at pets.png.
 */
const APP_ICON_ASSETS: Record<string, ImageSourcePropType> = {
  // Phone apps
  tinder: require('@/assets/images/AppIcons/spark.webp'),
  contacts: require('@/assets/images/AppIcons/contacts.webp'),
  social: require('@/assets/images/AppIcons/pulse.webp'),
  stocks: require('@/assets/images/AppIcons/stocks.webp'),
  bank: require('@/assets/images/AppIcons/bank.webp'),
  education: require('@/assets/images/AppIcons/education.webp'),
  company: require('@/assets/images/AppIcons/hustle.webp'),
  pet: require('@/assets/images/AppIcons/pets.webp'),
  // Computer / desktop apps
  paw: require('@/assets/images/AppIcons/pets.webp'),
  bitcoin: require('@/assets/images/AppIcons/crypto.webp'),
  realestate: require('@/assets/images/AppIcons/realestate.webp'),
  onion: require('@/assets/images/AppIcons/darkweb.webp'),
  gaming: require('@/assets/images/AppIcons/youvideo.webp'),
  streaming: require('@/assets/images/AppIcons/streaming.webp'),
  travel: require('@/assets/images/AppIcons/travel.webp'),
  political: require('@/assets/images/AppIcons/politics.webp'),
  statistics: require('@/assets/images/AppIcons/statistics.webp'),
  vehicle: require('@/assets/images/AppIcons/garage.webp'),
};

/** The custom PNG for an app id, or undefined to fall back to the Lucide glyph. */
export function getAppIconAsset(id: string): ImageSourcePropType | undefined {
  return APP_ICON_ASSETS[id];
}
