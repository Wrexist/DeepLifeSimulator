# Responsive Design Guide

## Översikt

Denna guide beskriver hur man använder det nya responsive design systemet i DeepLife Simulator för att säkerställa att appen fungerar perfekt på alla iOS-enheter.

## Enheter som stöds

### iPhone
- **Small**: iPhone SE (2nd & 3rd gen), iPhone 6/7/8 (375x667)
- **Medium**: iPhone X/XS, iPhone 11/12/13 (375-390x812-844)
- **Large**: iPhone 6/7/8 Plus, iPhone XR/XS Max, iPhone 11/12/13 Pro Max (414-428x736-926)
- **XLarge**: iPhone 14/15 Pro Max (430x932)

### iPad
- **iPad**: Standard iPad (768x1024)
- **iPad Pro 11"**: (834x1194)
- **iPad Pro 12.9"**: (1024x1366)

## Scaling Functions

### Grundläggande Scaling

```typescript
import { scale, verticalScale, moderateScale, fontScale } from '@/utils/scaling';

// Skala baserat på skärmbredd
const width = scale(100);

// Skala baserat på skärmhöjd
const height = verticalScale(50);

// Måttlig skalning (mindre aggressiv)
const moderate = moderateScale(100, 0.5);

// Font skalning
const fontSize = fontScale(16);
```

### Responsive Utilities

```typescript
import { 
  responsivePadding, 
  responsiveFontSize, 
  responsiveSpacing, 
  responsiveBorderRadius,
  responsiveIconSize 
} from '@/utils/scaling';

// Padding
const padding = responsivePadding.medium; // 16px (skalad)

// Font storlekar
const titleSize = responsiveFontSize['2xl']; // 20px (skalad)

// Spacing
const gap = responsiveSpacing.md; // 12px (skalad)

// Border radius
const radius = responsiveBorderRadius.xl; // 16px (skalad)

// Icon storlekar
const iconSize = responsiveIconSize.lg; // 24px (skalad)
```

### Enhetsspecifika funktioner

```typescript
import { 
  isSmallDevice, 
  isLargeDevice, 
  isIPad, 
  getDeviceType 
} from '@/utils/scaling';

// Kontrollera enhetstyp
if (isSmallDevice()) {
  // Anpassa för små enheter
}

if (isLargeDevice()) {
  // Anpassa för stora enheter
}

if (isIPad()) {
  // Anpassa för iPad
}

const deviceType = getDeviceType(); // 'small' | 'medium' | 'large' | 'xlarge'
```

## Responsive Components

### ResponsiveLayout

```typescript
import ResponsiveLayout from '@/components/ResponsiveLayout';

<ResponsiveLayout
  padding="medium"
  spacing="large"
  direction="row"
  justify="space-between"
  align="center"
  wrap={true}
>
  {/* Innehåll */}
</ResponsiveLayout>
```

### ResponsiveGrid

```typescript
import { ResponsiveGrid } from '@/components/ResponsiveLayout';

<ResponsiveGrid columns={3} gap={12}>
  <View>Item 1</View>
  <View>Item 2</View>
  <View>Item 3</View>
</ResponsiveGrid>
```

### ResponsiveText

```typescript
import { ResponsiveText } from '@/components/ResponsiveLayout';

<ResponsiveText 
  size="2xl" 
  weight="bold" 
  color="#333" 
  align="center"
>
  Titel
</ResponsiveText>
```

### ResponsiveButton

```typescript
import { ResponsiveButton } from '@/components/ResponsiveLayout';

<ResponsiveButton 
  size="medium" 
  onPress={() => {}} 
  disabled={false}
>
  Klicka här
</ResponsiveButton>
```

## Best Practices

### 1. Använd alltid responsive funktioner

```typescript
// ❌ Fel - fasta värden
const styles = StyleSheet.create({
  container: {
    padding: 20,
    fontSize: 16,
  }
});

// ✅ Rätt - responsive värden
const styles = StyleSheet.create({
  container: {
    padding: responsivePadding.medium,
    fontSize: responsiveFontSize.base,
  }
});
```

### 2. Anpassa för olika enheter

```typescript
const styles = StyleSheet.create({
  container: {
    padding: isSmallDevice() ? responsivePadding.small : responsivePadding.medium,
    fontSize: isLargeDevice() ? responsiveFontSize.lg : responsiveFontSize.base,
  }
});
```

### 3. Använd procentuella bredder för grids

```typescript
// ❌ Fel - fasta bredder
const cardWidth = 120;

// ✅ Rätt - procentuella bredder
const cardWidth = responsiveWidth(30); // 30% av skärmbredden
```

### 4. Testa på olika enheter

```typescript
// Använd device detection för debugging
console.log('Device type:', getDeviceType());
console.log('Screen dimensions:', screenDimensions);
```

## Exempel på Implementation

### App Grid (Mobile/Computer screens)

```typescript
const styles = StyleSheet.create({
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: responsiveGrid.gap,
  },
  appCard: {
    width: responsiveCard.width, // Automatisk bredd baserat på enhet
    aspectRatio: 1,
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveCard.padding,
  },
});
```

### TopStatsBar

```typescript
const styles = StyleSheet.create({
  moneyGradient: {
    minWidth: isSmallDevice() ? scale(60) : scale(65),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  nextWeekButton: {
    minWidth: isSmallDevice() ? scale(90) : scale(100),
    paddingHorizontal: scale(14),
  },
});
```

## Felsökning

### Vanliga problem

1. **Text är för liten på stora enheter**
   - Använd `fontScale()` istället för fasta värden
   - Kontrollera `responsiveFontSize` värden

2. **Layout ser olika ut på olika enheter**
   - Använd `ResponsiveLayout` komponenten
   - Testa med `isSmallDevice()` och `isLargeDevice()`

3. **Grid ser inte bra ut på iPad**
   - Använd `isIPad()` för iPad-specifika anpassningar
   - Öka antalet kolumner för iPad

### Debugging

```typescript
import { screenDimensions, getDeviceType } from '@/utils/scaling';

// Lägg till i komponenter för debugging
useEffect(() => {
  console.log('Screen:', screenDimensions);
  console.log('Device type:', getDeviceType());
}, []);
```

## Framtida Förbättringar

- [ ] Stöd för landscape orientation
- [ ] Mer avancerade breakpoints
- [ ] Automatisk testing på olika enheter
- [ ] Performance optimering för stora enheter
