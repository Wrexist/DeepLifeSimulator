import { GamingStreamingState } from '@/contexts/game/types';

export const getComponentModel = (type: string, level: number): string => {
  const maps: Record<string, string[]> = {
    cpu: ['Stock CPU', 'Ryzen 5 / Core i5', 'Ryzen 7 / Core i7', 'Ryzen 9 / Core i9'],
    gpu: ['Integrated GPU', 'RTX 3060', 'RTX 4070', 'RTX 4080'],
    ram: ['8GB DDR4', '16GB DDR4', '32GB DDR5', '64GB DDR5'],
    ssd: ['SATA SSD', 'NVMe Gen3', 'NVMe Gen4', 'NVMe Gen5'],
    motherboard: ['Entry ATX', 'B-Series', 'X-Series'],
    cooling: ['Stock Cooler', 'Tower Air', '240mm AIO', '360mm AIO'],
    psu: ['500W Bronze', '650W Gold', '850W Gold'],
    case: ['Compact Case', 'Mid Tower', 'Airflow Case'],
    network: ['Basic 50 Mbps', '100 Mbps', '500 Mbps', '1 Gbps'],
  };
  const arr = maps[type] || ['Level 0', 'Level 1', 'Level 2', 'Level 3'];
  const idx = Math.max(0, Math.min(level, arr.length - 1));
  return arr[idx];
};

export const getNextUpgradePrice = (type: string, level: number): number | null => {
  const pricing: Record<string, number[]> = {
    cpu: [800, 1200, 1600],
    gpu: [900, 1400, 2000],
    ram: [200, 300, 400],
    ssd: [150, 250, 350],
    cooling: [120, 220, 320],
    motherboard: [200, 350],
    psu: [150, 250],
    case: [120, 200],
    network: [100, 200, 400],
  };
  const arr = pricing[type] || [];
  return level < arr.length ? arr[level] : null;
};

export const getEquipmentEffect = (k: string): string => {
  switch (k) {
    case 'microphone': return 'Improves video quality → higher CTR and RPM';
    case 'webcam': return 'Adds facecam → boosts engagement and CTR';
    case 'lighting': return 'Better lighting → faster uploads and slight quality gain';
    case 'gamingChair': return 'Comfort → reduces stream energy drain';
    case 'greenScreen': return 'Clean background → small quality boost';
    default: return '';
  }
};

export const getComponentEffect = (k: string): string => {
  switch (k) {
    case 'cpu': return 'Faster rendering, small energy savings';
    case 'gpu': return 'Much faster rendering, visual quality boost';
    case 'ram': return 'Quicker renders, smoother workflow';
    case 'ssd': return 'Faster uploads and general speed';
    case 'cooling': return 'Lower temps → less energy drain while streaming';
    case 'motherboard': return 'Enables higher-tier CPU/RAM speeds';
    case 'psu': return 'Stable power delivery for upgrades';
    case 'case': return 'Airflow → helps cooling efficiency';
    case 'network': return 'Internet plan → faster uploads';
    default: return '';
  }
};

export const getRenderTimeMs = (gamingData: GamingStreamingState): number => {
  // base 8000ms reduced by components
  const lv = gamingData.pcUpgradeLevels || {
    cpu: 0, gpu: 0, ram: 0, ssd: 0, motherboard: 0, cooling: 0, psu: 0, case: 0
  };
  let t = 8000;
  t *= Math.pow(0.9, lv.ram || 0); // RAM -10% per level
  t *= Math.pow(0.85, lv.gpu || 0); // GPU -15% per level
  t *= Math.pow(0.9, lv.cpu || 0); // CPU -10% per level (render)
  return Math.max(3000, Math.round(t));
};

export const getUploadTimeMs = (gamingData: GamingStreamingState): number => {
  // base 6000ms reduced by SSD + small lighting prep
  const eq = gamingData.equipment || {
    microphone: false, webcam: false, gamingChair: false, greenScreen: false, lighting: false
  };
  const lv = gamingData.pcUpgradeLevels || {
    cpu: 0, gpu: 0, ram: 0, ssd: 0, motherboard: 0, cooling: 0, psu: 0, case: 0
  };
  let t = 6000;
  t *= Math.pow(0.85, lv.ssd || 0); // SSD -15% per level
  // network is not a PC upgrade; should base this on eq.network instead, which is the equipment
  // Note: network is not part of GamingEquipment, so we default to 0
  const networkLevel = 0;
  t *= Math.pow(0.9, networkLevel); // Network upgrade -10% per level
  if (eq.lighting) t *= 0.95;
  return Math.max(2000, Math.round(t));
};








