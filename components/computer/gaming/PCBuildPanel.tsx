import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Settings, Video as VideoIcon, Activity, Zap, Snowflake, Crown, Square } from 'lucide-react-native';
import { GameSettings, GamingStreamingState } from '@/contexts/game/types';
import { getComponentModel, getNextUpgradePrice, getComponentEffect } from './utils';

interface PCBuildPanelProps {
  settings: GameSettings;
  styles: any;
  gamingData: GamingStreamingState;
  money: number;
  upgradeComponent: (key: string) => void;
}

export default function PCBuildPanel({
  settings,
  styles,
  gamingData,
  money,
  upgradeComponent
}: PCBuildPanelProps) {
  const lv = gamingData.pcUpgradeLevels || {
    cpu: 0, gpu: 0, ram: 0, ssd: 0, motherboard: 0, cooling: 0, psu: 0, case: 0
  };

  const componentsList = [
    { key: 'cpu', name: 'CPU' },
    { key: 'gpu', name: 'GPU' },
    { key: 'ram', name: 'RAM' },
    { key: 'ssd', name: 'SSD' },
    { key: 'cooling', name: 'Cooling' },
    { key: 'motherboard', name: 'Motherboard' },
    { key: 'psu', name: 'PSU' },
    { key: 'case', name: 'Case' },
  ];

  const canAfford = (price: number | null) => price != null && money >= price;

  return (
    <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>PC Components</Text>
      {componentsList.map(c => {
        // Type guard and explicit typing to fix TypeScript error
        // (PCUpgradeLevels only allows keys from the type)
        type PCUpgradeKey = keyof typeof lv;
        const key = c.key as PCUpgradeKey;
        const level: number = lv && lv[key] !== undefined ? lv[key] : 0;
        const price = getNextUpgradePrice(c.key, level);
        const currentModel = getComponentModel(c.key, level);
        const nextModel = getComponentModel(c.key, level + 1);
        const atMax = price == null;
        return (
          <View key={c.key} style={[styles.shopRow, settings.darkMode && styles.shopRowDark]}>
            <View style={styles.shopRowLeft}>
              {c.key === 'cpu' && <Settings size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {c.key === 'gpu' && <VideoIcon size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {c.key === 'ram' && <Activity size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {c.key === 'ssd' && <Zap size={20} color={settings.darkMode ? '#F59E0B' : '#D97706'} />}
              {c.key === 'cooling' && <Snowflake size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {c.key === 'motherboard' && <Crown size={20} color={settings.darkMode ? '#60A5FA' : '#2563EB'} />}
              {c.key === 'psu' && <Zap size={20} color={settings.darkMode ? '#34D399' : '#059669'} />}
              {c.key === 'case' && <Square size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {c.key === 'network' && <Activity size={20} color={settings.darkMode ? '#A78BFA' : '#7C3AED'} />}
              <View style={styles.shopTextBox}>
                <Text style={[styles.shopName, settings.darkMode && styles.shopNameDark]}>{c.name} • {currentModel}</Text>
                <Text style={[styles.shopDesc, settings.darkMode && styles.shopDescDark]}>{getComponentEffect(c.key)}</Text>
                <Text style={[styles.smallLabel, settings.darkMode && styles.smallLabelDark]}>
                  {atMax ? 'Max level reached' : `Next: ${nextModel}`}
                </Text>
              </View>
            </View>
            {atMax ? (
              <View style={styles.ownedBadgeBox}><Text style={styles.ownedText}>Max</Text></View>
            ) : (
              <TouchableOpacity
                onPress={() => upgradeComponent(c.key)}
                disabled={!canAfford(price)}
                style={[styles.priceChip, { opacity: !canAfford(price) ? 0.5 : 1 }]}
              >
                <Text style={styles.buyButtonText}>Upgrade ${price}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

