/**
 * Not-found route. Shipped as the stock white Expo template for its whole
 * life — the one screen in the app with no theming. Now dressed as a small
 * branded dead-end with a way home.
 */
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Compass } from 'lucide-react-native';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale } from '@/utils/scaling';
import { accent, colors } from '@/lib/config/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconBubble}>
          <Compass size={scale(32)} color={colors.light.textMuted} />
        </View>
        <Text style={styles.title}>This screen doesn&apos;t exist</Text>
        <Text style={styles.body}>The road you took leads nowhere — but your life is still waiting.</Text>
        <Link href="/" style={styles.link} accessibilityRole="button" accessibilityLabel="Back to your life">
          <Text style={styles.linkText}>Back to your life</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
    backgroundColor: colors.dark.background,
  },
  iconBubble: {
    width: scale(72),
    height: scale(72),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: colors.dark.text,
    textAlign: 'center',
  },
  body: {
    fontSize: fontScale(14),
    color: colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
  link: {
    marginTop: responsiveSpacing.lg,
    borderWidth: 1,
    borderColor: accent.info,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.xl,
  },
  linkText: {
    color: accent.info,
    fontSize: fontScale(14),
    fontWeight: '700',
  },
});
