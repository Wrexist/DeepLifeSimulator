import { LUXURY_ART } from '@/lib/content/luxuryArtAssets';
import React, { useState } from 'react';
import { Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Car, Gem, MapPin, PawPrint } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { uiPalette } from '@/lib/config/theme';
import { PETS_ART, TRAVEL_ART, VEHICLES_ART } from '@/lib/content/lifeArtAssets';

type Family = 'pets' | 'travel' | 'vehicles' | 'luxury';
const maps: Record<Family, Record<string, ImageSourcePropType>> = {
  luxury: LUXURY_ART, pets: PETS_ART, travel: TRAVEL_ART, vehicles: VEHICLES_ART,
};
const icons = { luxury: Gem, pets: PawPrint, travel: MapPin, vehicles: Car };

/** Decorative artwork: the owning row provides the accessible name and action. */
export default function CatalogArt({ family, id, style }: {
  family: Family; id: string; style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${family}:${id}`;
  const source = Object.prototype.hasOwnProperty.call(maps[family], id) ? maps[family][id] : undefined;
  const Icon = icons[family];
  return (
    <View style={[styles.frame, { backgroundColor: uiPalette.artCanvas }, style]}
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {source && failed !== key ? (
        <Image key={key} source={source} style={styles.image} resizeMode="contain"
          accessible={false} onError={() => setFailed(key)} />
      ) : <Icon size={24} color={theme.textSecondary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
