import React from 'react';
import { View, StyleSheet, useWindowDimensions, Text, TouchableOpacity } from 'react-native';
import { 
  responsivePadding, 
  responsiveSpacing, 
  responsiveIconSize,
  isSmallDevice, 
  isLargeDevice, 
  isIPad,
  screenDimensions 
} from '@/utils/scaling';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  style?: any;
  padding?: 'none' | 'small' | 'medium' | 'large';
  spacing?: 'none' | 'small' | 'medium' | 'large';
  direction?: 'row' | 'column';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
}

export default function ResponsiveLayout({
  children,
  style,
  padding = 'medium',
  spacing = 'medium',
  direction = 'column',
  justify = 'start',
  align = 'start',
  wrap = false,
}: ResponsiveLayoutProps) {
  const { width, height } = useWindowDimensions();

  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'small':
        return responsivePadding.small;
      case 'large':
        return responsivePadding.large;
      default:
        return responsivePadding.medium;
    }
  };

  const getSpacing = () => {
    switch (spacing) {
      case 'none':
        return 0;
      case 'small':
        return responsiveSpacing.sm;
      case 'large':
        return responsiveSpacing.lg;
      default:
        return responsiveSpacing.md;
    }
  };

  const containerStyle = [
    styles.container,
    {
      // Increase padding on tablets to use dead space better
      padding: isIPad() ? getPadding() * 1.5 : getPadding(),
      gap: getSpacing(),
      flexDirection: direction,
      justifyContent: justify,
      alignItems: align,
      flexWrap: wrap ? 'wrap' : 'nowrap',
    },
    style,
  ];

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
});

// Responsive Grid Component
interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
  style?: any;
}

export function ResponsiveGrid({ 
  children, 
  columns = 3, 
  gap = responsiveSpacing.md,
  style 
}: ResponsiveGridProps) {
  const isTablet = isIPad();
  const actualColumns = isTablet ? Math.min(columns + 1, 4) : columns;
  const actualGap = isSmallDevice() ? gap * 0.8 : gap;

  return (
    <View style={[
      styles.grid,
      {
        gap: actualGap,
      },
      style
    ]}>
      {React.Children.map(children, (child) => (
        <View style={{ 
          width: `${100 / actualColumns}%`,
          paddingHorizontal: actualGap / 2 
        }}>
          {child}
        </View>
      ))}
    </View>
  );
}

// Responsive Card Component
interface ResponsiveCardProps {
  children: React.ReactNode;
  style?: any;
  padding?: 'small' | 'medium' | 'large';
}

export function ResponsiveCard({ 
  children, 
  style, 
  padding = 'medium' 
}: ResponsiveCardProps) {
  const getCardPadding = () => {
    switch (padding) {
      case 'small':
        return responsiveSpacing.sm;
      case 'large':
        return responsiveSpacing.lg;
      default:
        return responsiveSpacing.md;
    }
  };

  return (
    <View style={[
      styles.card,
      {
        padding: getCardPadding(),
        borderRadius: responsiveSpacing.md,
      },
      style
    ]}>
      {children}
    </View>
  );
}

// Responsive Text Component
interface ResponsiveTextProps {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  weight?: 'normal' | 'bold' | '600' | '700' | '800';
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: any;
}

export function ResponsiveText({ 
  children, 
  size = 'base', 
  weight = 'normal',
  color = '#000000',
  align = 'left',
  style 
}: ResponsiveTextProps) {
  const { responsiveFontSize } = require('@/utils/scaling');
  
  const fontSizeMap = {
    xs: responsiveFontSize.xs,
    sm: responsiveFontSize.sm,
    base: responsiveFontSize.base,
    lg: responsiveFontSize.lg,
    xl: responsiveFontSize.xl,
    '2xl': responsiveFontSize['2xl'],
    '3xl': responsiveFontSize['3xl'],
    '4xl': responsiveFontSize['4xl'],
    '5xl': responsiveFontSize['5xl'],
  };

  return (
    <Text style={[
      {
        fontSize: fontSizeMap[size],
        fontWeight: weight,
        color: color,
        textAlign: align,
      },
      style
    ]}>
      {children}
    </Text>
  );
}

// Responsive Button Component
interface ResponsiveButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function ResponsiveButton({ 
  children, 
  onPress, 
  style, 
  size = 'medium',
  disabled = false 
}: ResponsiveButtonProps) {
  const { responsiveButton } = require('@/utils/scaling');
  
  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return {
          height: responsiveButton.heightSmall,
          paddingHorizontal: responsiveButton.paddingHorizontalSmall,
        };
      case 'large':
        return {
          height: responsiveButton.heightLarge,
          paddingHorizontal: responsiveButton.paddingHorizontalLarge,
        };
      default:
        return {
          height: responsiveButton.height,
          paddingHorizontal: responsiveButton.paddingHorizontal,
        };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonSize(),
        disabled && styles.buttonDisabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {children}
    </TouchableOpacity>
  );
}
