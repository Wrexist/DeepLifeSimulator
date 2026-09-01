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
import { StyleSheet, View } from 'react-native';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { formatMoney } from '@/utils/moneyFormatting';
import { HUSTLE_COLORS } from './styles/hustleTheme';
import DashboardScreen from './screens/DashboardScreen';
import CompanyDetailScreen from './screens/CompanyDetailScreen';
import CreateCompanyScreen from './screens/CreateCompanyScreen';
import HireEmployeeModal from './modals/HireEmployeeModal';
import LaunchCampaignModal from './modals/LaunchCampaignModal';
import ResolveScandalModal from './modals/ResolveScandalModal';
import IPOModal from './modals/IPOModal';
import AcquireModal from './modals/AcquireModal';

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

  // The app quotes founding costs, salaries and upgrade prices on every
  // screen; the balance they are checked against belongs in the bar.
  const cash = gameState.stats?.money ?? 0;

  const openDetail = useCallback((companyId: string) => setRoute({ kind: 'detail', companyId }), []);
  const openCreate = useCallback(() => setRoute({ kind: 'create' }), []);
  const backToDashboard = useCallback(() => setRoute({ kind: 'dashboard' }), []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {route.kind === 'dashboard' && (
        <>
          <AppHeader
            title="hustle"
            onBack={onBack}
            centered
            right={<CashChip value={formatMoney(cash)} tint={HUSTLE_COLORS.accent} />}
          />
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
});
