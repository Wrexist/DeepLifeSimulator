import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Mic, Camera, Zap, Star, Award } from 'lucide-react-native';
import { GameSettings, GamingStreamingState } from '@/contexts/game/types';
import { getEquipmentEffect } from './utils';

interface EquipmentPanelProps {
  settings: GameSettings;
  styles: any;
  gamingData: GamingStreamingState;
  money: number;
  buyEquipment: (key: string, price: number) => void;
}

export default function EquipmentPanel({
  settings,
  styles,
  gamingData,
  money,
  buyEquipment
}: EquipmentPanelProps) {
  const eq = gamingData.equipment || {
    microphone: false, webcam: false, gamingChair: false, greenScreen: false, lighting: false
  };

  const equipmentList = [
    { key: 'microphone', name: 'Microphone', price: 300 },
    { key: 'webcam', name: 'Webcam', price: 400 },
    { key: 'lighting', name: 'Lighting', price: 200 },
    { key: 'gamingChair', name: 'Gaming Chair', price: 600 },
    { key: 'greenScreen', name: 'Green Screen', price: 500 },
  ];

  return (
    <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>Equipment</Text>
      {equipmentList.map(item => {
        const owned = item.key === 'microphone' ? eq.microphone :
                     item.key === 'webcam' ? eq.webcam :
                     item.key === 'lighting' ? eq.lighting :
                     item.key === 'gamingChair' ? eq.gamingChair :
                     item.key === 'greenScreen' ? eq.greenScreen : false;
        return (
          <View key={item.key} style={[styles.shopRow, settings.darkMode && styles.shopRowDark]}>
            <View style={styles.shopRowLeft}>
              {item.key === 'microphone' && <Mic size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {item.key === 'webcam' && <Camera size={20} color={settings.darkMode ? '#F9FAFB' : '#111827'} />}
              {item.key === 'lighting' && <Zap size={20} color={settings.darkMode ? '#FCD34D' : '#92400E'} />}
              {item.key === 'gamingChair' && <Star size={20} color={settings.darkMode ? '#F59E0B' : '#D97706'} />}
              {item.key === 'greenScreen' && <Award size={20} color={settings.darkMode ? '#60A5FA' : '#2563EB'} />}
              <View style={styles.shopTextBox}>
                <Text style={[styles.shopName, settings.darkMode && styles.shopNameDark]}>{item.name}</Text>
                <Text style={[styles.shopDesc, settings.darkMode && styles.shopDescDark]}>{getEquipmentEffect(item.key)}</Text>
              </View>
            </View>
            {owned ? (
              <View style={styles.ownedBadgeBox}><Text style={styles.ownedText}>Owned</Text></View>
            ) : (
              <TouchableOpacity
                onPress={() => buyEquipment(item.key, item.price)}
                disabled={money < item.price}
                style={[styles.priceChip, { opacity: money < item.price ? 0.5 : 1 }]}
              >
                <Text style={styles.buyButtonText}>Buy ${item.price}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

