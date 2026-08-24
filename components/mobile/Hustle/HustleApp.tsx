/**
 * HustleApp - root shell for the in-game business platform.
 *
 * Mounts when the player taps the Company tile. Owns the internal nav state
 * machine (no React Navigation nested container) and the modal host. Three
 * routes:
 *   - dashboard (default) - multi-company overview
 *   - detail (companyId)  - single-company deep view
 *   - create              - found a new company
 *
 * Modals route through PulseApp-style state machine in this component:
 * hire, campaign, scandal, IPO, acquisition.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { HUSTLE_GRADIENT } from './styles/hustleTheme';
import DashboardScreen from './screens/DashboardScreen';
import CompanyDetailScreen from './screens/CompanyDetailScreen';
import CreateCompanyScreen from './screens/CreateCompanyScreen';
import HireEmployeeModal from './modals/HireEmployeeModal';
import LaunchCampaignModal from './modals/LaunchCampaignModal';
import ResolveScandalModal from './modals/ResolveScandalModal';
import IPOModal from './modals/IPOModal';
import AcquireModal from './modals/AcquireModal';

const LinearGradient = Gradient;

type HustleRoute =
  | { kind: 'dashboard' }
  | { kind: 'detail'; companyId: string }
  | { kind: 'create' };

interface HustleAppProps {
  onBack: () => void;
}

export default function HustleApp({ onBack }: HustleAppProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const [route, setRoute] = useState<HustleRoute>({ kind: 'dashboard' });
  const [modal, setModal] = useState<
    | null
    | { kind: 'hire' | 'campaign' | 'scandal' | 'ipo' | 'acquire'; companyId: string }
  >(null);

  const companies = gameState.companies ?? [];

  const openDetail = useCallback((companyId: string) => setRoute({ kind: 'detail', companyId }), []);
  const openCreate = useCallback(() => setRoute({ kind: 'create' }), []);
  const backToDashboard = useCallback(() => setRoute({ kind: 'dashboard' }), []);

  const renderHeader = (title: string, onHeaderBack: () => void) => (
    <View style={styles.header}>
      <Pressable onPress={onHeaderBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
        <ArrowLeft size={scale(22)} color={theme.text} />
      </Pressable>

      <View style={styles.headerCenter}>
        {title === 'hustle' ? (
          <LinearGradient
            colors={HUSTLE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.wordmarkPill}
          >
            <Text style={styles.wordmarkText}>hustle</Text>
          </LinearGradient>
        ) : (
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      <View style={styles.headerBtn} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {route.kind === 'dashboard' && (
        <>
          {renderHeader('hustle', onBack)}
          <DashboardScreen onOpenCompany={openDetail} onCreateCompany={openCreate} />
        </>
      )}

      {route.kind === 'create' && (
        <CreateCompanyScreen
          onBack={backToDashboard}
          onCreated={(id) => setRoute({ kind: 'detail', companyId: id })}
        />
      )}

      {route.kind === 'detail' && (
        <CompanyDetailScreen
          companyId={route.companyId}
          onBack={backToDashboard}
          onOpenHire={() => setModal({ kind: 'hire', companyId: route.companyId })}
          onOpenCampaign={() => setModal({ kind: 'campaign', companyId: route.companyId })}
          onOpenScandal={() => setModal({ kind: 'scandal', companyId: route.companyId })}
          onOpenIPO={() => setModal({ kind: 'ipo', companyId: route.companyId })}
          onOpenAcquisitions={() => setModal({ kind: 'acquire', companyId: route.companyId })}
        />
      )}

      {/* Modals */}
      {modal?.kind === 'hire' && (
        <HireEmployeeModal visible companyId={modal.companyId} onDismiss={() => setModal(null)} />
      )}
      {modal?.kind === 'campaign' && (
        <LaunchCampaignModal visible companyId={modal.companyId} onDismiss={() => setModal(null)} />
      )}
      {modal?.kind === 'scandal' && (
        <ResolveScandalModal visible companyId={modal.companyId} onDismiss={() => setModal(null)} />
      )}
      {modal?.kind === 'ipo' && (
        <IPOModal visible companyId={modal.companyId} onDismiss={() => setModal(null)} />
      )}
      {modal?.kind === 'acquire' && (
        <AcquireModal visible companyId={modal.companyId} onDismiss={() => setModal(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  wordmarkPill: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  wordmarkText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
