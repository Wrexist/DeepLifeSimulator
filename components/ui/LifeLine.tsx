import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { uiPalette } from '@/lib/config/theme';

/** Original Deep Life street-line: home, work, then the open road.
 * Decorative identity artwork, never a financial chart or progress indicator.
 */
export default function LifeLine({ color = uiPalette.muted }: { color?: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 80" fill="none" accessible={false}>
      <Path d="M0 64H36V42L54 27L72 42V64H96V18H127V64H144V36H166V64H191C208 64 208 42 225 42S242 64 259 64H320"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M49 64V50H59V64M105 29H117M105 39H117M105 49H117M151 46H159"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={285} cy={64} r={4} fill={color} />
    </Svg>
  );
}
