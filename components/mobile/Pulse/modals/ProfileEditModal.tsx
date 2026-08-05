/**
 * ProfileEditModal — edit display name, handle, bio, location, website.
 *
 * The verified flag, follower counts, and the lineage-bound first/last name
 * are NOT editable here — verified is granted via Pulse Pro IAP, follower
 * counts are derived from gameplay, and the legal name is a save-bound
 * identity field. The plan's §2.7 ProfileEditModal explicitly preserved
 * validation behavior; this re-write keeps the simple-but-strict checks:
 *
 *   - displayName: 1–40 chars, trimmed
 *   - handle:      3–20 chars, [a–z0–9_] only, lowercased on save
 *   - bio:         0–160 chars
 *   - location:    0–40 chars
 *   - website:     blank or starts with http(s):// + domain
 *
 * Writes directly to `gameState.userProfile` via setGameState — no separate
 * action because UserProfile edits don't need cross-system side effects.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

const LinearGradient = LinearGradientFallback;

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

interface ProfileEditModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function ProfileEditModal({ visible, onDismiss }: ProfileEditModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = gameState.userProfile ?? {};

  const initial = useMemo(() => ({
    displayName: profile.displayName || profile.name || profile.handle || '',
    handle: profile.handle || profile.username || '',
    bio: profile.bio || '',
    location: profile.location || '',
    website: profile.website || '',
  }), [profile]);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [location, setLocation] = useState(initial.location);
  const [website, setWebsite] = useState(initial.website);
  const [error, setError] = useState<string | null>(null);

  // Reset local state when the modal opens with a different profile.
  React.useEffect(() => {
    if (visible) {
      setDisplayName(initial.displayName);
      setHandle(initial.handle);
      setBio(initial.bio);
      setLocation(initial.location);
      setWebsite(initial.website);
      setError(null);
    }
  }, [visible, initial]);

  const validate = useCallback((): string | null => {
    const d = displayName.trim();
    if (d.length < 1 || d.length > 40) return 'Display name must be 1–40 characters.';
    const h = handle.trim().toLowerCase();
    if (!HANDLE_RE.test(h)) return 'Handle: 3–20 chars, lowercase letters, numbers, underscore only.';
    if (bio.length > 160) return 'Bio must be ≤ 160 characters.';
    if (location.length > 40) return 'Location must be ≤ 40 characters.';
    if (website && !URL_RE.test(website.trim())) return 'Website must start with http:// or https://';
    return null;
  }, [displayName, handle, bio, location, website]);

  const handleSave = useCallback(() => {
    const err = validate();
    if (err) {
      setError(err);
      pulseHaptics.error();
      return;
    }
    setGameState((prev: any) => ({
      ...prev,
      userProfile: {
        ...prev.userProfile,
        displayName: displayName.trim(),
        handle: handle.trim().toLowerCase(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
      },
    }));
    saveGame?.();
    pulseHaptics.success();
    onDismiss();
  }, [validate, displayName, handle, bio, location, website, setGameState, saveGame, onDismiss]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, { zIndex: Z_INDEX.MODAL }]}
      >
        {/* Real inset, not a scaled constant — see ComposeModal for the why. */}
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + responsiveSpacing.md },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
              hitSlop={8}
              style={styles.headerBtn}
            >
              <X size={fontScale(20)} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>Edit profile</Text>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              style={styles.saveBtn}
            >
              <LinearGradient
                colors={PULSE_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnFill}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Field
              label="Display name"
              value={displayName}
              onChange={(v) => { setDisplayName(v); if (error) setError(null); }}
              maxLength={40}
              placeholder="Your public name"
              theme={theme}
            />
            <Field
              label="Handle"
              value={handle}
              onChange={(v) => { setHandle(v.replace(/\s/g, '')); if (error) setError(null); }}
              maxLength={20}
              placeholder="lowercase_handle"
              autoCapitalize="none"
              theme={theme}
              prefix="@"
            />
            <Field
              label="Bio"
              value={bio}
              onChange={(v) => { setBio(v); if (error) setError(null); }}
              maxLength={160}
              placeholder="A short bio."
              multiline
              theme={theme}
              showCount
            />
            <Field
              label="Location"
              value={location}
              onChange={(v) => { setLocation(v); if (error) setError(null); }}
              maxLength={40}
              placeholder="City, region"
              theme={theme}
            />
            <Field
              label="Website"
              value={website}
              onChange={(v) => { setWebsite(v); if (error) setError(null); }}
              maxLength={200}
              placeholder="https://example.com"
              autoCapitalize="none"
              keyboardType="url"
              theme={theme}
            />

            {error ? (
              <Text style={[styles.errorText, { color: PULSE_COLORS.danger }]}>{error}</Text>
            ) : null}

            <Text style={[styles.legal, { color: theme.textMuted }]}>
              Verified badge and follower count are not editable here.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Subcomponent: Field ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'email-address';
  theme: any;
  prefix?: string;
  showCount?: boolean;
}

function Field({
  label, value, onChange, maxLength, placeholder, multiline, autoCapitalize, keyboardType, theme, prefix, showCount,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
        {showCount ? (
          <Text style={[styles.fieldCount, { color: value.length > maxLength * 0.9 ? PULSE_COLORS.warning : theme.textMuted }]}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
      <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
        {prefix ? <Text style={[styles.prefix, { color: theme.textSecondary }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          maxLength={maxLength}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          style={[styles.input, multiline && styles.inputMultiline, { color: theme.text }]}
        />
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.md,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontScale(17),
    fontWeight: '700',
  },
  saveBtn: {
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  saveBtnFill: {
    paddingHorizontal: scale(18),
    paddingVertical: scale(8),
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
  },
  field: {
    marginBottom: responsiveSpacing.md,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(6),
  },
  fieldLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldCount: {
    fontSize: fontScale(11),
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(10),
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: responsiveSpacing.sm,
  },
  prefix: {
    fontSize: fontScale(15),
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: fontScale(15),
    paddingVertical: responsiveSpacing.sm,
  },
  inputMultiline: {
    minHeight: scale(70),
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: fontScale(12),
    marginTop: responsiveSpacing.sm,
    textAlign: 'center',
  },
  legal: {
    fontSize: fontScale(10),
    textAlign: 'center',
    marginTop: responsiveSpacing.md,
  },
});
