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
  tinder: require('@/assets/images/AppIcons/spark.png'),
  contacts: require('@/assets/images/AppIcons/contacts.png'),
  social: require('@/assets/images/AppIcons/pulse.png'),
  stocks: require('@/assets/images/AppIcons/stocks.png'),
  bank: require('@/assets/images/AppIcons/bank.png'),
  education: require('@/assets/images/AppIcons/education.png'),
  company: require('@/assets/images/AppIcons/hustle.png'),
  pet: require('@/assets/images/AppIcons/pets.png'),
  // Computer / desktop apps
  paw: require('@/assets/images/AppIcons/pets.png'),
  bitcoin: require('@/assets/images/AppIcons/crypto.png'),
  realestate: require('@/assets/images/AppIcons/realestate.png'),
  onion: require('@/assets/images/AppIcons/darkweb.png'),
  gaming: require('@/assets/images/AppIcons/youvideo.png'),
  streaming: require('@/assets/images/AppIcons/streaming.png'),
  travel: require('@/assets/images/AppIcons/travel.png'),
  political: require('@/assets/images/AppIcons/politics.png'),
  statistics: require('@/assets/images/AppIcons/statistics.png'),
  vehicle: require('@/assets/images/AppIcons/garage.png'),
};

/** The custom PNG for an app id, or undefined to fall back to the Lucide glyph. */
export function getAppIconAsset(id: string): ImageSourcePropType | undefined {
  return APP_ICON_ASSETS[id];
}
