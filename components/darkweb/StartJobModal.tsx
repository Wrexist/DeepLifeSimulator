import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X, Target } from 'lucide-react-native';
import { DarkWebJobTemplate, JOB_TEMPLATES } from '@/lib/darkweb/jobs';
import { DarkWebState } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  visible: boolean;
  darkWeb: DarkWebState;
  darkMode: boolean;
  onClose: () => void;
  onStart: (templateId: string) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  'data-theft': 'Data Theft',
  fraud: 'Fraud',
  corporate: 'Corporate',
  crypto: 'Crypto',
};

export default function StartJobModal({ visible, darkWeb, darkMode, onClose, onStart }: Props) {
  const theme = getThemeColors(darkMode);
  const [selected, setSelected] = useState<DarkWebJobTemplate | null>(null);

  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  const meetsSkillReqs = (tpl: DarkWebJobTemplate): boolean => {
    if (!tpl.requiresSkills) return true;
    for (const [skill, min] of Object.entries(tpl.requiresSkills)) {
      const lvl = darkWeb.skills[skill as keyof typeof darkWeb.skills]?.level ?? 0;
      if (lvl < (min ?? 0)) return false;
    }
    return true;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Start a Job</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: scale(420) }} contentContainerStyle={{ gap: responsiveSpacing.sm }}>
            {JOB_TEMPLATES.map((tpl) => {
              const eligible = meetsSkillReqs(tpl);
              const active = selected?.id === tpl.id;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  disabled={!eligible}
                  onPress={() => setSelected(tpl)}
                  style={[
                    styles.tplCard,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: active ? accent.info : theme.border,
                      borderWidth: active ? 2 : 1,
                      opacity: eligible ? 1 : 0.5,
                    },
                  ]}
                >
                  <View style={styles.tplHeader}>
                    <Target size={scale(14)} color={accent.info} />
                    <Text style={[styles.tplName, { color: theme.text }]}>{tpl.name}</Text>
                    <Text style={[styles.tplPayout, { color: accent.success }]}>
                      {tpl.payoutBtc.toFixed(3)} ₿
                    </Text>
                  </View>
                  <Text style={[styles.tplDesc, { color: theme.textMuted }]}>{tpl.description}</Text>
                  <View style={styles.tplFoot}>
                    <Text style={[styles.tplMeta, { color: theme.textMuted }]}>
                      {CATEGORY_LABEL[tpl.category]} · {tpl.stages.length} stages
                    </Text>
                    {tpl.requiresSkills && (
                      <Text
                        style={[
                          styles.tplMeta,
                          { color: eligible ? theme.textMuted : accent.danger },
                        ]}
                      >
                        Needs:{' '}
                        {Object.entries(tpl.requiresSkills)
                          .map(([s, lvl]) => `${s} ${lvl}`)
                          .join(', ')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            disabled={!selected}
            onPress={() => selected && onStart(selected.id)}
            style={[styles.confirm, { backgroundColor: selected ? accent.info : theme.border }]}
          >
            <Text style={styles.confirmText}>Start Job</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  tplCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    gap: 4,
  },
  tplHeader: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  tplName: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '700' },
  tplPayout: { fontSize: responsiveFontSize.sm, fontWeight: '800' },
  tplDesc: { fontSize: responsiveFontSize.sm },
  tplFoot: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  tplMeta: { fontSize: responsiveFontSize.xs },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontSize: responsiveFontSize.md, fontWeight: '700' },
});
