import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bitcoin, Zap, DollarSign, TrendingUp, TrendingDown, Cpu, Activity, HardDrive, Coins, Building2, CheckCircle, Sparkles, AlertTriangle, X } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { CoinEffect } from '@/components/ui/ParticleEffects';
import { useFeedback } from '@/utils/feedbackSystem';
import { logger } from '@/utils/logger';
import { getShadow } from '@/utils/shadow';
import { scale, fontScale, responsivePadding, responsiveBorderRadius } from '@/utils/scaling';
import { validateMoney, validatePositiveNumber } from '@/utils/validation';

const { width: screenWidth } = Dimensions.get('window');

// Move constants outside component to prevent recreation on every render
const CRYPTO_MINING_MULTIPLIERS = {
  'btc': 1.0,    // Bitcoin - hardest to mine, highest reward
  'eth': 0.8,    // Ethereum - high difficulty, good reward
  'sol': 0.6,    // Solana - medium difficulty
  'link': 0.5,   // Chainlink - medium difficulty
  'dot': 0.4,    // Polkadot - easier to mine
  'matic': 0.3,  // Polygon - easier to mine
  'ada': 0.2,    // Cardano - easy to mine
  'xrp': 0.1,    // Ripple - easiest to mine, lowest reward
} as const;

const MINERS_DATA: Omit<Miner, 'owned' | 'durability'>[] = [
  { id: 'basic', name: 'Basic Miner', price: 2500, weeklyEarnings: 22, powerConsumption: 10, maxDurability: 100, repairCost: 125 },
  { id: 'advanced', name: 'Advanced Miner', price: 10000, weeklyEarnings: 105, powerConsumption: 35, maxDurability: 100, repairCost: 500 },
  { id: 'pro', name: 'Pro Miner', price: 40000, weeklyEarnings: 438, powerConsumption: 100, maxDurability: 100, repairCost: 2000 },
  { id: 'industrial', name: 'Industrial Miner', price: 125000, weeklyEarnings: 1575, powerConsumption: 250, maxDurability: 100, repairCost: 6250 },
  { id: 'quantum', name: 'Quantum Miner', price: 500000, weeklyEarnings: 7000, powerConsumption: 500, maxDurability: 100, repairCost: 25000 },
  { id: 'mega', name: 'Mega Miner', price: 2500000, weeklyEarnings: 35000, powerConsumption: 2000, maxDurability: 100, repairCost: 125000 },
  { id: 'giga', name: 'Giga Miner', price: 10000000, weeklyEarnings: 140000, powerConsumption: 5000, maxDurability: 100, repairCost: 500000 },
  { id: 'tera', name: 'Tera Miner', price: 50000000, weeklyEarnings: 700000, powerConsumption: 15000, maxDurability: 100, repairCost: 2500000 },
];

interface BitcoinMiningAppProps {
  onBack: () => void;
}

interface Miner {
  id: string;
  name: string;
  price: number;
  weeklyEarnings: number;
  powerConsumption: number;
  owned: number;
  durability: number;
  maxDurability: number;
  repairCost: number;
}

interface Crypto {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  owned: number;
}

// Memoized formatMoney function outside component
const formatMoney = (amount: number): string => {
  const a = Math.floor(Math.abs(amount) || 0);
  const sign = amount < 0 ? '-' : '';
  
  let formatted: string;
  
  if (a >= 1_000_000_000_000_000) {
    // Quadrillions (Q)
    formatted = `${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
  } else if (a >= 1_000_000_000_000) {
    // Trillions (T)
    formatted = `${(a / 1_000_000_000_000).toFixed(2)}T`;
  } else if (a >= 1_000_000_000) {
    // Billions (B)
    formatted = `${(a / 1_000_000_000).toFixed(2)}B`;
  } else if (a >= 1_000_000) {
    // Millions (M)
    formatted = `${(a / 1_000_000).toFixed(2)}M`;
  } else if (a >= 1_000) {
    // Thousands (K)
    formatted = `${(a / 1_000).toFixed(2)}K`;
  } else {
    // Regular numbers
    formatted = a.toString();
  }
  
  // Remove trailing zeros and decimal point if not needed
  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');
  
  return `$${sign}${formatted}`;
};

export default function BitcoinMiningApp({ onBack }: BitcoinMiningAppProps) {
  const { gameState, buyCrypto, sellCrypto, swapCrypto, buyMiner, sellMiner, buyWarehouse, upgradeWarehouse, selectMiningCrypto, selectWarehouseMiningCrypto, setGameState, saveGame } = useGame();
  const { success, buttonPress } = useFeedback(gameState.settings.hapticFeedback);
  const [activeTab, setActiveTab] = useState<'miners' | 'crypto'>('miners');

  // Extract settings for dark mode support
  const { settings } = gameState;
  const isDarkMode = settings?.darkMode ?? false;

  // Extract frequently used values from gameState to avoid unnecessary re-renders
  const warehouse = gameState.warehouse;
  const cryptos = gameState.cryptos;
  const money = gameState.stats.money;
  const [selectedStock, setSelectedStock] = useState<Crypto | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investAmountError, setInvestAmountError] = useState<string | undefined>();
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [swapFrom, setSwapFrom] = useState<Crypto | null>(null);
  const [swapTo, setSwapTo] = useState<Crypto | null>(null);
  const [swapAmount, setSwapAmount] = useState('');
  const [swapAmountError, setSwapAmountError] = useState<string | undefined>();
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [sellCryptoItem, setSellCryptoItem] = useState<Crypto | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellAmountError, setSellAmountError] = useState<string | undefined>();
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAutoRepairModal, setShowAutoRepairModal] = useState(false);
  const [showPurchaseSuccessModal, setShowPurchaseSuccessModal] = useState(false);
  const [purchasedMinerName, setPurchasedMinerName] = useState('');
  const [showWarehouseFullModal, setShowWarehouseFullModal] = useState(false);
  const [warehouseCapacity, setWarehouseCapacity] = useState(0);
  const [showCoinEffect, setShowCoinEffect] = useState(false);
  const [showSellConfirmModal, setShowSellConfirmModal] = useState(false);
  const [minerToSell, setMinerToSell] = useState<Miner | null>(null);
  const modalScaleAnim = useRef(new Animated.Value(0)).current;
  const sellModalScaleAnim = useRef(new Animated.Value(0)).current;
  const warehouseModalScaleAnim = useRef(new Animated.Value(0)).current;

  // Modal animation effects
  useEffect(() => {
    if (showWarehouseFullModal) {
      Animated.spring(warehouseModalScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      warehouseModalScaleAnim.setValue(0);
    }
  }, [showWarehouseFullModal, warehouseModalScaleAnim]);

  useEffect(() => {
    if (showPurchaseSuccessModal) {
      setShowCoinEffect(true);
      success();
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.setValue(0);
      setShowCoinEffect(false);
    }
  }, [showPurchaseSuccessModal, modalScaleAnim, success]);

  // Sell modal animation effect
  useEffect(() => {
    if (showSellConfirmModal) {
      sellModalScaleAnim.setValue(0);
      Animated.spring(sellModalScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      sellModalScaleAnim.setValue(0);
    }
  }, [showSellConfirmModal, sellModalScaleAnim]);

  // Get crypto policy effects (must be defined before renderMinerCard uses it)
  const cryptoEffects = gameState.politics?.activePolicyEffects?.crypto;

  // Memoize miners array with owned counts from gameState
  // BUG FIX: Get durability from warehouse state (defaults to 100 for new miners)
  const miners = useMemo<Miner[]>(() => {
    return MINERS_DATA.map(minerData => ({
      ...minerData,
      owned: warehouse?.miners[minerData.id] || 0,
      durability: warehouse?.minerDurability?.[minerData.id] ?? 100, // Get from state or default to 100
    }));
  }, [warehouse?.miners, warehouse?.minerDurability]);

  const handleBuyMiner = useCallback((miner: Miner) => {
    buttonPress();
    
    // Check if this is the first purchase of this miner type
    const currentOwned = warehouse?.miners[miner.id] || 0;
    const isFirstPurchase = currentOwned === 0;
    
    const result = buyMiner(miner.id, miner.name, miner.price);
    
    if (result.success) {
      // Only show the success modal on first purchase
      if (isFirstPurchase) {
        setPurchasedMinerName(miner.name);
        setShowPurchaseSuccessModal(true);
      } else {
        // Just show a brief success feedback for subsequent purchases
        success();
      }
    } else {
      if (result.message?.includes('Warehouse is full')) {
        const maxCapacity = 10 + (warehouse?.level || 0) * 5;
        setWarehouseCapacity(maxCapacity);
        setShowWarehouseFullModal(true);
      } else {
        Alert.alert('Purchase Failed', result.message || 'Unable to purchase miner');
      }
    }
  }, [warehouse, buyMiner, buttonPress, success]);

  const executeSell = useCallback(async (miner: Miner) => {
    try {
      logger.info('Executing sell for miner:', { minerId: miner.id, minerName: miner.name, price: miner.price });
      setShowSellConfirmModal(false);
      const result = await sellMiner(miner.id, miner.name, miner.price);
      logger.info('Sell result:', result);
      
      if (result.success) {
        success();
        setMinerToSell(null);
        // Show success message briefly
        Alert.alert('Success', result.message || `Sold ${miner.name}!`);
      } else {
        Alert.alert('Sell Failed', result.message || 'Unable to sell miner');
      }
    } catch (error) {
      logger.error('Error selling miner:', error);
      setMinerToSell(null);
      Alert.alert('Error', `An error occurred while selling the miner: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [sellMiner, success]);

  // BUG FIX: Handle manual repair of miners
  const handleRepairMiner = useCallback((miner: Miner) => {
    if (!warehouse) {
      Alert.alert('No Warehouse', 'You need a warehouse to repair miners.');
      return;
    }
    
    const currentDurability = warehouse.minerDurability?.[miner.id] ?? 100;
    if (currentDurability >= 100) {
      Alert.alert('Perfect Condition', 'This miner is already at 100% health!');
      return;
    }
    
    const repairCost = miner.repairCost * (warehouse.miners[miner.id] || 0);
    if (gameState.stats.money < repairCost) {
      Alert.alert('Insufficient Funds', `You need ${formatMoney(repairCost)} to repair all ${miner.name} miners.`);
      return;
    }
    
    Alert.alert(
      `Repair ${miner.name}`,
      `Repair all ${warehouse.miners[miner.id] || 0} ${miner.name} miners to 100% health for ${formatMoney(repairCost)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Repair',
          onPress: () => {
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                money: prev.stats.money - repairCost,
              },
              warehouse: prev.warehouse ? {
                ...prev.warehouse,
                minerDurability: {
                  ...prev.warehouse.minerDurability,
                  [miner.id]: 100,
                },
              } : undefined,
            }));
            saveGame();
            Alert.alert('Repaired!', `All ${miner.name} miners have been repaired to 100% health.`);
          },
        },
      ]
    );
  }, [warehouse, gameState.stats.money, setGameState, saveGame]);

  const handleSellMiner = useCallback((miner: Miner) => {
    buttonPress();
    
    // Check if miner is actually owned
    const owned = warehouse?.miners[miner.id] || 0;
    logger.debug('handleSellMiner called', { owned, minerId: miner.id });
    
    if (owned === 0) {
      Alert.alert('Cannot Sell', `You don't own any ${miner.name}s to sell.`);
      return;
    }
    
    // Set the miner to sell and show confirmation modal
    setMinerToSell(miner);
    setShowSellConfirmModal(true);
  }, [warehouse, buttonPress]);

  // Memoize renderMinerCard to prevent unnecessary re-renders
  const renderMinerCard = useCallback((miner: Miner) => {
    const owned = warehouse?.miners[miner.id] || 0;
    const canAfford = money >= miner.price;
    const hasWarehouse = !!warehouse;
    
    // Calculate total weekly earnings for all owned miners of this type
    const hasMiningTarget = warehouse?.selectedCrypto;
    const selectedCrypto = warehouse?.selectedCrypto;
    const difficultyMultiplier = selectedCrypto ? CRYPTO_MINING_MULTIPLIERS[selectedCrypto as keyof typeof CRYPTO_MINING_MULTIPLIERS] || 1.0 : 1.0;
    const miningBonus = cryptoEffects?.miningBonus || 0;
    const policyBonus = 1 + (miningBonus / 100);
    const totalWeeklyEarningsForType = hasMiningTarget 
      ? miner.weeklyEarnings * owned * difficultyMultiplier * policyBonus
      : miner.weeklyEarnings * owned;
    
    return (
      <View key={miner.id} style={styles.minerCard}>
        <LinearGradient
          colors={isDarkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.minerCardGradient}
        >
          <View style={styles.minerHeader}>
            <View style={styles.minerIconContainer}>
              <Cpu size={24} color="#F59E0B" />
            </View>
            <View style={styles.minerInfo}>
              <Text style={[styles.minerName, isDarkMode && styles.minerNameDark]}>
                {miner.name}
              </Text>
              <Text style={[styles.minerOwned, isDarkMode && styles.minerOwnedDark]}>
                Owned: {owned}
              </Text>
            </View>
            <View style={styles.minerPrice}>
              <Text style={[styles.priceText, isDarkMode && styles.priceTextDark]}>
                {formatMoney(miner.price)}
              </Text>
            </View>
          </View>
          
          <View style={styles.minerStats}>
            <View style={styles.minerStat}>
              <DollarSign size={16} color="#10B981" />
              <Text style={[styles.minerStatText, isDarkMode && styles.minerStatTextDark]}>
                {owned > 0 ? `${formatMoney(totalWeeklyEarningsForType)}/week` : `${formatMoney(miner.weeklyEarnings)}/week`}
              </Text>
            </View>
            <View style={styles.minerStat}>
              <Zap size={16} color="#F59E0B" />
              <Text style={[styles.minerStatText, isDarkMode && styles.minerStatTextDark]}>
                {miner.powerConsumption}W
              </Text>
            </View>
            <View style={styles.minerStat}>
              <Activity size={16} color="#3B82F6" />
              <Text style={[styles.minerStatText, isDarkMode && styles.minerStatTextDark]}>
                {miner.durability}% Health
              </Text>
            </View>
          </View>
          
          {hasWarehouse ? (
            <View style={styles.minerActions}>
              {owned > 0 && (
                <>
                  {/* BUG FIX: Show repair button if durability is below 100% */}
                  {miner.durability < 100 && (
                    <TouchableOpacity
                      style={styles.repairMinerButton}
                      onPress={() => handleRepairMiner(miner)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#F59E0B', '#D97706']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.repairMinerButtonGradient}
                      >
                        <Text style={styles.repairMinerButtonText}>
                          Repair ({formatMoney(miner.repairCost * owned)})
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.sellMinerButton}
                    onPress={() => {
                      logger.debug('Sell button pressed for miner:', { minerId: miner.id, minerName: miner.name });
                      handleSellMiner(miner);
                    }}
                    activeOpacity={0.8}
                    disabled={false}
                  >
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sellMinerButtonGradient}
                    >
                      <Text style={styles.sellMinerButtonText}>
                        Sell ({formatMoney(Math.floor(miner.price * 0.5))})
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.buyMinerButton, !canAfford && styles.disabledButton, owned > 0 && styles.buyMinerButtonWithSell]}
                onPress={() => handleBuyMiner(miner)}
                disabled={!canAfford}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={canAfford ? ['#10B981', '#059669'] : ['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buyMinerButtonGradient}
                >
                  <Text style={styles.buyMinerButtonText}>
                    {canAfford ? 'Purchase Miner' : 'Insufficient Funds'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noCompanyWarning}>
              <Text style={[styles.noCompanyText, isDarkMode && styles.noCompanyTextDark]}>
                You need a warehouse to purchase miners
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  }, [warehouse, money, isDarkMode, handleBuyMiner, handleSellMiner, cryptoEffects]);

  const handleInvest = useCallback(() => {
    if (!selectedStock) return;
    
    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0 || amount > money) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount within your budget.');
      return;
    }

    buyCrypto(selectedStock.id, amount);
    
    Alert.alert(
      'Investment Successful',
      `You bought ${(amount / selectedStock.price).toFixed(6)} ${selectedStock.symbol}`
    );
    
    setShowInvestModal(false);
    setSelectedStock(null);
    setInvestAmount('');
  }, [selectedStock, investAmount, money, buyCrypto]);

  const handleSellCryptoPress = useCallback((crypto: Crypto) => {
    setSellCryptoItem(crypto);
    setSellAmount('');
    setShowSellModal(true);
  }, []);

  const confirmSellCrypto = useCallback(() => {
    if (!sellCryptoItem) return;
    const amountNum = parseFloat(sellAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to sell.');
      return;
    }

    const units = amountNum / sellCryptoItem.price;
    if (units > sellCryptoItem.owned) {
      Alert.alert('Not Enough Crypto', 'You do not own that much to sell.');
      return;
    }

    sellCrypto(sellCryptoItem.id, units);
    Alert.alert('Sold!', `Sold ${units.toFixed(6)} ${sellCryptoItem.symbol}`);

    setShowSellModal(false);
    setSellCryptoItem(null);
    setSellAmount('');
  }, [sellCryptoItem, sellAmount, sellCrypto]);


  const handleSwap = useCallback(() => {
    if (!swapFrom || !swapTo) return;

    const amountNum = parseFloat(swapAmount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > swapFrom.owned) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount within your holdings.');
      return;
    }

    const toShares = (amountNum * swapFrom.price) / swapTo.price;
    swapCrypto(swapFrom.id, swapTo.id, amountNum);

    Alert.alert(
      'Swap Complete',
      `Swapped ${amountNum.toFixed(4)} ${swapFrom.symbol} for ${toShares.toFixed(4)} ${swapTo.symbol}`
    );

    setShowSwapModal(false);
    setSwapFrom(null);
    setSwapTo(null);
    setSwapAmount('');
  }, [swapFrom, swapTo, swapAmount, swapCrypto]);

  // Memoize expensive calculations
  const miningBonus = cryptoEffects?.miningBonus || 0;
  const totalWeeklyEarnings = useMemo(() => {
    return miners.reduce((total, miner) => {
      const owned = warehouse?.miners[miner.id] || 0;
      // Only earn if a mining target is selected
      const hasMiningTarget = warehouse?.selectedCrypto;
      if (!hasMiningTarget) return total;
      
      // Apply crypto-specific mining difficulty multiplier
      const selectedCrypto = warehouse?.selectedCrypto;
      const difficultyMultiplier = selectedCrypto ? CRYPTO_MINING_MULTIPLIERS[selectedCrypto as keyof typeof CRYPTO_MINING_MULTIPLIERS] || 1.0 : 1.0;
      
      // Apply mining bonus from policies
      const policyBonus = 1 + (miningBonus / 100);
      
      return total + (miner.weeklyEarnings * owned * difficultyMultiplier * policyBonus);
    }, 0);
  }, [miners, warehouse?.miners, warehouse?.selectedCrypto, miningBonus]);

  const totalPowerConsumption = useMemo(() => {
    return miners.reduce((total, miner) => {
      const owned = warehouse?.miners[miner.id] || 0;
      return total + (miner.powerConsumption * owned);
    }, 0);
  }, [miners, warehouse?.miners]);

  const weeklyPowerCost = useMemo(() => totalPowerConsumption * 0.40, [totalPowerConsumption]); // $0.40 per power unit per week

  const getAutoRepairStatus = useCallback(() => {
    if (!warehouse) return { canAfford: false, reason: 'No warehouse' };
    if (!warehouse.selectedCrypto) return { canAfford: false, reason: 'No crypto selected' };
    
    const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
    if (!selectedCrypto) return { canAfford: false, reason: 'Crypto not found' };
    
    const weeklyCryptoCost = 5000 / selectedCrypto.price;
    const canAfford = selectedCrypto.owned >= weeklyCryptoCost;
    
    return {
      canAfford,
      reason: canAfford ? 'Ready to hire' : `Need ${(weeklyCryptoCost - selectedCrypto.owned).toFixed(6)} more ${selectedCrypto.symbol}`,
      needed: weeklyCryptoCost,
      owned: selectedCrypto.owned,
      crypto: selectedCrypto
    };
  }, [warehouse, cryptos]);

  const getWarehouseUpgradeStatus = useCallback(() => {
    if (!warehouse) {
      const canAfford = money >= 25000;
      return {
        canAfford,
        reason: canAfford ? 'Ready to buy' : `Need ${formatMoney(25000 - money)} more`,
        cost: 25000,
        action: 'Buy Warehouse'
      };
    }
    
    const upgradeCost = 15000 * warehouse.level;
    const canAfford = money >= upgradeCost;
    
    return {
      canAfford,
      reason: canAfford ? 'Ready to upgrade' : `Need ${formatMoney(upgradeCost - money)} more`,
      cost: upgradeCost,
      action: 'Upgrade Warehouse'
    };
  }, [warehouse, money]);

  const handleFireAutoRepair = useCallback(() => {
    logger.debug('handleFireAutoRepair called');
    
    if (!warehouse) {
      logger.warn('No warehouse found during auto-repair fire attempt');
      return;
    }
    
    if (!warehouse.autoRepairEnabled) {
      logger.warn('Auto-repair not enabled during fire attempt');
      return;
    }
    
    // Update warehouse state to disable auto-repair
    setGameState(prev => ({
      ...prev,
      warehouse: prev.warehouse ? {
        ...prev.warehouse,
        autoRepairEnabled: false,
        autoRepairWeeklyCost: undefined,
        autoRepairCryptoId: undefined,
      } : undefined
    }));
    
    // Save the game state
    saveGame();
    
    logger.info('Auto-repair fired successfully!');
    Alert.alert('Auto-Repair Fired!', 'Your auto-repair technician has been dismissed. You will need to manually repair your miners.');
  }, [warehouse, setGameState, saveGame]);

  const handleHireAutoRepair = useCallback(() => {
    logger.debug('handleHireAutoRepair called', { warehouse });
    
    // Check if user has a warehouse
    if (!warehouse) {
      logger.warn('No warehouse found during auto-repair hire attempt');
      Alert.alert(
        'Warehouse Required', 
        'You need to own a warehouse to hire auto-repair technicians.\n\n' +
        '💡 Auto-repair technicians will automatically maintain your miners to prevent breakdowns and lost earnings.\n\n' +
        'Buy a warehouse first to store miners and enable auto-repair services.',
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Buy Warehouse', 
            style: 'default',
            onPress: () => {
              setShowAutoRepairModal(false);
              // The buy warehouse button should be visible in the UI
            }
          }
        ]
      );
      return;
    }
    
    const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
    logger.debug('found selectedCrypto:', selectedCrypto);
    
    if (!selectedCrypto) {
      logger.warn('No selected crypto found during auto-repair hire attempt');
      Alert.alert(
        'No Cryptocurrency Selected', 
        'Please select a cryptocurrency to mine before hiring auto-repair technicians.\n\n' +
        '💡 Auto-repair technicians are paid in the cryptocurrency you are mining.\n\n' +
        'Select a cryptocurrency from the list above to enable auto-repair services.',
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Select Crypto', 
            style: 'default',
            onPress: () => {
              setShowAutoRepairModal(false);
              // Focus on crypto selection
            }
          }
        ]
      );
      return;
    }

    const weeklyCryptoCost = 5000 / selectedCrypto.price; // $5,000 worth of crypto per week
    const currentCryptoOwned = selectedCrypto.owned;
    
    logger.debug('Auto-repair cost calculation', { weeklyCryptoCost, currentCryptoOwned });
    
    if (currentCryptoOwned < weeklyCryptoCost) {
      logger.info('Not enough crypto for auto-repair', { current: currentCryptoOwned, needed: weeklyCryptoCost });
      const neededAmount = weeklyCryptoCost - currentCryptoOwned;
      const neededValue = neededAmount * selectedCrypto.price;
      
      Alert.alert(
        'Insufficient Cryptocurrency', 
        `You need ${weeklyCryptoCost.toFixed(6)} ${selectedCrypto.symbol} to hire auto-repair technician.\n\n` +
        `You currently have: ${currentCryptoOwned.toFixed(6)} ${selectedCrypto.symbol}\n` +
        `You still need: ${neededAmount.toFixed(6)} ${selectedCrypto.symbol} ($${neededValue.toFixed(2)})\n\n` +
        `💡 How to get more ${selectedCrypto.symbol}:\n` +
        `• Buy ${selectedCrypto.symbol} in the Crypto Market tab\n` +
        `• Mine ${selectedCrypto.symbol} with your miners\n` +
        `• Wait for your miners to generate more ${selectedCrypto.symbol}`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Buy Crypto', 
            style: 'default',
            onPress: () => {
              setShowAutoRepairModal(false);
              setActiveTab('crypto');
            }
          }
        ]
      );
      return;
    }

    // Check if auto-repair is already enabled
    if (warehouse?.autoRepairEnabled) {
      logger.warn('Auto-repair already enabled');
      Alert.alert('Already Enabled', 'Auto-repair is already enabled for your warehouse.');
      return;
    }

    // Deduct crypto instead of money
    const cryptoToDeduct = weeklyCryptoCost;
    const cryptoId = selectedCrypto.id;
    
    logger.debug('About to update state with cryptoToDeduct:', { cryptoToDeduct });
    
    // Update crypto holdings and warehouse state
    setGameState(prev => {
      // logger.debug('setGameState called with prev:', prev); // Commented out to reduce noise
      const newState = {
        ...prev,
        cryptos: prev.cryptos.map(crypto => 
          crypto.id === cryptoId 
            ? { ...crypto, owned: crypto.owned - cryptoToDeduct }
            : crypto
        ),
        warehouse: prev.warehouse ? {
          ...prev.warehouse,
          autoRepairEnabled: true,
          autoRepairWeeklyCost: weeklyCryptoCost,
          autoRepairCryptoId: cryptoId,
        } : undefined
      };
      // logger.debug('newState:', newState); // Commented out to reduce noise
      return newState;
    });
    
    // Save the game state
    saveGame();
    
    logger.info('Auto-repair hired successfully!');
    Alert.alert('Auto-Repair Hired!', `Your miners will now be automatically repaired weekly for ${cryptoToDeduct.toFixed(6)} ${selectedCrypto.symbol}.`);
    setShowAutoRepairModal(false);
  }, [warehouse, cryptos, setGameState, saveGame, setActiveTab]);


  const handleSelectCrypto = useCallback((cryptoId: string) => {
    if (warehouse) {
      selectWarehouseMiningCrypto(cryptoId);
    } else {
      selectMiningCrypto(cryptoId);
    }
  }, [warehouse, selectWarehouseMiningCrypto, selectMiningCrypto]);



  // Memoize renderCryptoCard to prevent unnecessary re-renders
  const renderCryptoCard = useCallback((crypto: Crypto) => {
    const isSelected = warehouse?.selectedCrypto === crypto.id;
    const changeColor = crypto.change >= 0 ? '#10B981' : '#EF4444';
    
    return (
      <View key={crypto.id} style={styles.cryptoCard}>
        <LinearGradient
          colors={isSelected ? ['#10B981', '#059669'] : ['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cryptoCardGradient}
        >
          <View style={styles.cryptoHeader}>
            <View style={styles.cryptoInfo}>
              <Text style={styles.cryptoSymbol}>{crypto.symbol}</Text>
              <Text style={styles.cryptoName}>{crypto.name}</Text>
            </View>
            <View style={styles.cryptoPrice}>
              <Text style={styles.cryptoPriceText}>{formatMoney(crypto.price)}</Text>
              <View style={styles.cryptoChange}>
                {crypto.change >= 0 ? (
                  <TrendingUp size={14} color={changeColor} />
                ) : (
                  <TrendingDown size={14} color={changeColor} />
                )}
                <Text style={[styles.cryptoChangeText, { color: changeColor }]}>
                  {crypto.changePercent.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cryptoHoldings}>
            <Text style={styles.cryptoHoldingsText}>
              Owned: {crypto.owned.toFixed(6)} {crypto.symbol}
            </Text>
            <Text style={styles.cryptoValueText}>
              Value: {formatMoney(crypto.owned * crypto.price)}
            </Text>
          </View>

          <View style={styles.cryptoActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setSelectedStock(crypto);
                setInvestAmount('');
                setShowInvestModal(true);
              }}
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>Buy</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setSwapFrom(crypto);
                setSwapTo(null);
                setSwapAmount('');
                setShowSwapModal(true);
              }}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>Swap</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleSellCryptoPress(crypto)}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>Sell</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }, [warehouse, handleSellCryptoPress]);

  // Memoize renderMiningSelection to prevent unnecessary re-renders
  const renderMiningSelection = useCallback(() => {
    if (!warehouse) {
      return (
        <View style={styles.miningSelectionContainer}>
          <Text style={styles.miningSelectionTitle}>Select Cryptocurrency to Mine:</Text>
          <View style={styles.cryptoOptions}>
            {cryptos.slice(0, 4).map(crypto => (
              <TouchableOpacity
                key={crypto.id}
                style={styles.cryptoOption}
                onPress={() => handleSelectCrypto(crypto.id)}
              >
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cryptoOptionGradient}
                >
                  <Text style={styles.cryptoOptionText}>{crypto.symbol}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.miningSelectionNote}>
            Choose a cryptocurrency to start mining. You&apos;ll need to buy miners first.
          </Text>
        </View>
      );
    }

    const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
    return (
      <View style={styles.miningSelectionContainer}>
        <Text style={styles.miningSelectionTitle}>Mining Target:</Text>
        <View style={styles.cryptoOptions}>
          {cryptos.slice(0, 4).map(crypto => {
            const difficulty = CRYPTO_MINING_MULTIPLIERS[crypto.id as keyof typeof CRYPTO_MINING_MULTIPLIERS] || 1.0;
            const difficultyText = difficulty >= 0.8 ? 'Hard' : difficulty >= 0.5 ? 'Medium' : 'Easy';
            const difficultyColor = difficulty >= 0.8 ? '#EF4444' : difficulty >= 0.5 ? '#F59E0B' : '#10B981';
            
            return (
              <TouchableOpacity
                key={crypto.id}
                style={styles.cryptoOption}
                onPress={() => handleSelectCrypto(crypto.id)}
              >
                <LinearGradient
                  colors={warehouse?.selectedCrypto === crypto.id ? ['#10B981', '#059669'] : ['#3B82F6', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cryptoOptionGradient}
                >
                  <Text style={styles.cryptoOptionText}>{crypto.symbol}</Text>
                  <Text style={[styles.difficultyText, { color: difficultyColor }]}>{difficultyText}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedCrypto && (
          <View style={styles.miningEarnings}>
            <LinearGradient
              colors={['rgba(16, 185, 129, 0.1)', 'rgba(5, 150, 105, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.miningEarningsCard}
            >
              <View style={styles.miningEarningsHeader}>
                <Bitcoin size={20} color="#10B981" />
                <Text style={styles.miningEarningsTitle}>Mining Performance</Text>
              </View>
              
              <View style={styles.miningEarningsRow}>
                <View style={styles.miningEarningsItem}>
                  <Text style={[styles.miningEarningsLabel, isDarkMode && styles.miningEarningsLabelDark]}>Weekly Mining</Text>
                  <Text style={styles.miningEarningsValue}>
                    {(totalWeeklyEarnings / selectedCrypto.price).toFixed(6)} {selectedCrypto.symbol}
                  </Text>
                  <Text style={[styles.miningEarningsSubtext, isDarkMode && styles.miningEarningsSubtextDark]}>
                    ≈ {formatMoney(totalWeeklyEarnings)}
                  </Text>
                </View>
                
                <View style={styles.miningEarningsItem}>
                  <Text style={[styles.miningEarningsLabel, isDarkMode && styles.miningEarningsLabelDark]}>Warehouse</Text>
                  <Text style={styles.miningEarningsValue}>
                    Level {warehouse?.level || 0}
                  </Text>
                  <Text style={[styles.miningEarningsSubtext, isDarkMode && styles.miningEarningsSubtextDark]}>
                    Max: {10 + (warehouse?.level || 0) * 5} miners
                  </Text>
                </View>
              </View>
              
              <View style={styles.miningEarningsUpgrade}>
                <Text style={styles.miningEarningsUpgradeText}>
                  🏭 Warehouse Level: {warehouse?.level || 0} (Max: {10 + (warehouse?.level || 0) * 5} miners)
                </Text>
                <Text style={styles.miningEarningsUpgradeText}>
                  💡 Upgrade warehouse to store more miners and increase earnings!
                </Text>
                {warehouse?.autoRepairEnabled && (
                  <View style={styles.autoRepairStatus}>
                    <CheckCircle size={16} color="#10B981" />
                    <Text style={[styles.miningEarningsUpgradeText, { color: '#10B981' }]}>
                      🔧 Auto-Repair Active - Miners automatically maintained
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        )}
      </View>
    );
  }, [warehouse, cryptos, totalWeeklyEarnings, handleSelectCrypto, isDarkMode]);

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
      style={styles.container}
    >
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <LinearGradient
            colors={['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backButtonGradient}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>Bitcoin Mining</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.summaryContainer}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Bitcoin size={20} color="#10B981" />
                <Text style={[styles.summaryLabel, isDarkMode && styles.summaryLabelDark]}>Weekly Mining</Text>
                <Text style={styles.summaryValue}>
                  {warehouse?.selectedCrypto ? 
                    `${(totalWeeklyEarnings / (cryptos.find(c => c.id === warehouse?.selectedCrypto)?.price || 1)).toFixed(6)} ${cryptos.find(c => c.id === warehouse?.selectedCrypto)?.symbol || ''}` 
                    : '0.000000'
                  }
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <DollarSign size={20} color="#EF4444" />
                <Text style={styles.summaryLabel}>Power Cost</Text>
                <Text style={styles.summaryValue}>-{formatMoney(weeklyPowerCost)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Bitcoin size={20} color="#10B981" />
                <Text style={styles.summaryLabel}>Net Crypto</Text>
                <Text style={styles.summaryValue}>
                  {warehouse?.selectedCrypto ? 
                    `${((totalWeeklyEarnings - weeklyPowerCost) / (cryptos.find(c => c.id === warehouse?.selectedCrypto)?.price || 1)).toFixed(6)} ${cryptos.find(c => c.id === warehouse?.selectedCrypto)?.symbol || ''}` 
                    : '0.000000'
                  }
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Zap size={20} color="#F59E0B" />
                <Text style={styles.summaryLabel}>Power Usage</Text>
                <Text style={styles.summaryValue}>{totalPowerConsumption}W</Text>
              </View>
              <View style={styles.summaryItem}>
                <Bitcoin size={20} color="#F7931A" />
                <Text style={styles.summaryLabel}>Mining</Text>
                <Text style={styles.summaryValue}>
                  {warehouse?.selectedCrypto ? cryptos.find(c => c.id === warehouse?.selectedCrypto)?.symbol : 'None'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Activity size={20} color="#3B82F6" />
                <Text style={styles.summaryLabel}>Auto-Repair</Text>
                <Text style={styles.summaryValue}>
                  {warehouse?.autoRepairEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.upgradeButtonsContainer}>
          {warehouse?.autoRepairEnabled ? (
            // Auto-repair is enabled - show fire button
            <TouchableOpacity
              style={styles.autoRepairButton}
              onPress={() => {
                Alert.alert(
                  'Fire Auto-Repair Technician?',
                  'Are you sure you want to dismiss your auto-repair technician? You will need to manually repair your miners.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Fire', 
                      style: 'destructive',
                      onPress: handleFireAutoRepair
                    }
                  ]
                );
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.autoRepairButtonGradient}
              >
                <CheckCircle size={18} color="#FFFFFF" />
                <Text style={styles.autoRepairButtonText}>Auto-Repair Active</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            // Auto-repair is not enabled - show hire button with status
            (() => {
              const autoRepairStatus = getAutoRepairStatus();
              return (
                <View style={styles.autoRepairContainer}>
                    <TouchableOpacity
                      style={[styles.autoRepairButton, !autoRepairStatus.canAfford && styles.disabledButton]}
                      onPress={() => {
                        logger.debug('Auto-repair button pressed');
                        if (!warehouse) {
                          Alert.alert('No Warehouse', 'You need to own a warehouse to hire auto-repair technicians.');
                          return;
                        }
                        if (!warehouse.selectedCrypto) {
                          Alert.alert('No Crypto Selected', 'Please select a cryptocurrency to mine before hiring auto-repair.');
                          return;
                        }
                        setShowAutoRepairModal(true);
                      }}
                      activeOpacity={0.8}
                      disabled={!autoRepairStatus.canAfford}
                    >
                    <LinearGradient
                      colors={autoRepairStatus.canAfford ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.autoRepairButtonGradient}
                    >
                      <Activity size={18} color="#FFFFFF" />
                      <Text style={styles.autoRepairButtonText}>Auto-Repair ($5k/w)</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  {/* Status indicator */}
                  <View style={[styles.statusIndicator, autoRepairStatus.canAfford ? styles.statusReady : styles.statusInsufficient]}>
                    <Text style={[styles.statusText, autoRepairStatus.canAfford ? styles.statusTextReady : styles.statusTextInsufficient]}>
                      {autoRepairStatus.reason}
                    </Text>
                  </View>
                </View>
              );
            })()
          )}
          
          {(() => {
            const warehouseStatus = getWarehouseUpgradeStatus();
            return (
              <View style={styles.warehouseContainer}>
                <TouchableOpacity
                  style={[styles.warehouseButton, !warehouseStatus.canAfford && styles.disabledButton]}
                  onPress={() => {
                    if (!warehouse) {
                      const result = buyWarehouse();
                      if (result.success) {
                        Alert.alert('Success', result.message);
                      } else {
                        Alert.alert('Error', result.message);
                      }
                    } else {
                      const result = upgradeWarehouse();
                      if (result.success) {
                        Alert.alert('Success', result.message);
                      } else {
                        Alert.alert('Error', result.message);
                      }
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={!warehouseStatus.canAfford}
                >
                  <LinearGradient
                    colors={warehouseStatus.canAfford ? 
                      (!warehouse ? ['#10B981', '#059669'] : ['#3B82F6', '#1D4ED8']) : 
                      ['#6B7280', '#4B5563']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.warehouseButtonGradient}
                  >
                    <Building2 size={18} color="#FFFFFF" />
                    <Text style={styles.warehouseButtonText}>
                      {warehouseStatus.action} ({formatMoney(warehouseStatus.cost)})
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                {/* Status indicator */}
                <View style={[styles.statusIndicator, warehouseStatus.canAfford ? styles.statusReady : styles.statusInsufficient]}>
                  <Text style={[styles.statusText, warehouseStatus.canAfford ? styles.statusTextReady : styles.statusTextInsufficient]}>
                    {warehouseStatus.reason}
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'miners' && styles.activeTab]}
            onPress={() => setActiveTab('miners')}
          >
            <LinearGradient
              colors={activeTab === 'miners' ? ['#10B981', '#059669', '#047857'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <HardDrive size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Mining Hardware</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'crypto' && styles.activeTab]}
            onPress={() => setActiveTab('crypto')}
          >
            <LinearGradient
              colors={activeTab === 'crypto' ? ['#F59E0B', '#D97706', '#B45309'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Coins size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Crypto Market</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.itemsContainer}>
          {activeTab === 'miners' 
            ? (
              <>
                {renderMiningSelection()}
                {miners.map(renderMinerCard)}
              </>
            )
            : cryptos.map(renderCryptoCard)
          }
        </View>
      </ScrollView>

      {/* Investment Modal */}
      <Modal visible={showInvestModal} transparent animationType="fade" onRequestClose={() => setShowInvestModal(false)}>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Invest in {selectedStock?.symbol}</Text>
            <Text style={styles.modalDescription}>
              Enter the dollar amount you want to invest
            </Text>
            <TextInput
              style={[styles.modalInput, investAmountError && styles.inputError]}
              placeholder="Amount to invest ($)"
              placeholderTextColor={isDarkMode ? "#FFFFFF" : "#9CA3AF"}
              value={investAmount}
              onChangeText={(text) => {
                setInvestAmount(text);
                if (text) {
                  const validation = validateMoney(text, 1, money);
                  if (!validation.valid) {
                    setInvestAmountError(validation.error);
                  } else {
                    setInvestAmountError(undefined);
                  }
                } else {
                  setInvestAmountError(undefined);
                }
              }}
              keyboardType="numeric"
            />
            {investAmountError && (
              <Text style={styles.errorText}>{investAmountError}</Text>
            )}
            {investAmount && selectedStock && (
              <View style={styles.investmentPreview}>
                <Text style={styles.investmentPreviewText}>
                  You&apos;ll receive: {(parseFloat(investAmount) / selectedStock.price).toFixed(6)} {selectedStock.symbol}
                </Text>
                <Text style={[styles.investmentPreviewSubtext, isDarkMode && styles.investmentPreviewSubtextDark]}>
                  At {formatMoney(selectedStock.price)} per {selectedStock.symbol}
                </Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowInvestModal(false)}
                accessibilityLabel="Cancel investment"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleInvest}
                accessibilityLabel="Confirm investment"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#3B82F6', '#1D4ED8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Invest</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Sell Modal */}
      <Modal visible={showSellModal} transparent animationType="fade" onRequestClose={() => setShowSellModal(false)}>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Sell {sellCryptoItem?.symbol}</Text>
            <TextInput
              style={[styles.modalInput, sellAmountError && styles.inputError]}
              placeholder="Amount to sell"
              placeholderTextColor={isDarkMode ? "#FFFFFF" : "#9CA3AF"}
              value={sellAmount}
              onChangeText={(text) => {
                setSellAmount(text);
                if (text && sellCryptoItem) {
                  const maxAmount = sellCryptoItem.owned;
                  const validation = validatePositiveNumber(text, 0.000001, maxAmount);
                  if (!validation.valid) {
                    setSellAmountError(validation.error);
                  } else {
                    setSellAmountError(undefined);
                  }
                } else {
                  setSellAmountError(undefined);
                }
              }}
              keyboardType="numeric"
            />
            {sellAmountError && (
              <Text style={styles.errorText}>{sellAmountError}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSellModal(false)}
                accessibilityLabel="Cancel sell"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={confirmSellCrypto}
                accessibilityLabel="Confirm sell"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Sell</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Auto-Repair Modal */}
      <Modal visible={showAutoRepairModal} transparent animationType="fade" onRequestClose={() => setShowAutoRepairModal(false)}>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            {(() => {
              const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
              return (
                <>
                  <Text style={styles.modalTitle}>Hire Auto-Repair Technician</Text>
                  <Text style={styles.modalDescription}>
                    For $5,000 worth of crypto per week, you can hire a technician who will automatically repair your miners when they break down, preventing downtime and lost earnings.
                  </Text>
                  <Text style={styles.modalDescription}>
                    💡 Benefits:
                    • Prevents miner breakdowns
                    • Maintains maximum efficiency
                    • No manual repair needed
                    • Payment in your mined crypto
                  </Text>
                  <Text style={styles.modalDescription}>
                    ⚠️ Requirements:
                    • Must own a warehouse
                    • Must select a cryptocurrency to mine
                    • Must have enough crypto for weekly payment
                  </Text>
                  
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalButton}
                      onPress={() => setShowAutoRepairModal(false)}
                    >
                      <LinearGradient
                        colors={['#6B7280', '#4B5563']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modalButtonGradient}
                      >
                        <Text style={styles.modalButtonText}>Cancel</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalButton}
                      onPress={() => {
                        logger.debug('Hire button pressed in modal');
                        handleHireAutoRepair();
                      }}
                    >
                      <LinearGradient
                        colors={['#3B82F6', '#1D4ED8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modalButtonGradient}
                      >
                        <Text style={styles.modalButtonText}>
                          {selectedCrypto ? `Hire (${(5000 / selectedCrypto.price).toFixed(6)} ${selectedCrypto.symbol}/week)` : 'Hire ($5k/w in crypto)'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </LinearGradient>
        </View>
      </Modal>

      {/* Swap Modal */}
      <Modal visible={showSwapModal} transparent animationType="fade" onRequestClose={() => setShowSwapModal(false)}>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Swap Cryptocurrency</Text>
            <Text style={styles.modalDescription}>
              Swap your cryptocurrency for another. Enter the amount you want to swap.
            </Text>
            
            {swapFrom && (
              <View style={styles.swapInfo}>
                <Text style={styles.swapInfoText}>
                  From: {swapFrom.symbol} (Owned: {swapFrom.owned.toFixed(6)})
                </Text>
                <Text style={styles.swapInfoText}>
                  Value: {formatMoney(swapFrom.owned * swapFrom.price)}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Amount to swap"
              placeholderTextColor={isDarkMode ? "#FFFFFF" : "#9CA3AF"}
              value={swapAmount}
              onChangeText={setSwapAmount}
              keyboardType="numeric"
            />

            <Text style={styles.modalDescription}>
              Select the cryptocurrency you want to swap to:
            </Text>

            <View style={styles.swapOptions}>
              {cryptos.map(crypto => (
                <TouchableOpacity
                  key={crypto.id}
                  style={styles.swapOption}
                  onPress={() => setSwapTo(crypto)}
                >
                  <LinearGradient
                    colors={swapTo?.id === crypto.id ? ['#10B981', '#059669'] : ['#374151', '#1F2937']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.swapOptionGradient}
                  >
                    <Text style={styles.swapOptionText}>{crypto.symbol}</Text>
                    <Text style={styles.swapOptionPrice}>{formatMoney(crypto.price)}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            {swapFrom && swapTo && swapAmount && (
              <View style={styles.swapPreview}>
                <View style={styles.swapPreviewHeader}>
                  <Text style={styles.swapPreviewTitle}>Swap Preview</Text>
                </View>
                <View style={styles.swapPreviewContent}>
                  <View style={styles.swapPreviewRow}>
                    <Text style={[styles.swapPreviewLabel, isDarkMode && styles.swapPreviewLabelDark]}>You&apos;re giving:</Text>
                    <Text style={styles.swapPreviewValue}>
                      {parseFloat(swapAmount).toFixed(6)} {swapFrom.symbol}
                    </Text>
                  </View>
                  <View style={styles.swapPreviewRow}>
                    <Text style={styles.swapPreviewLabel}>You&apos;ll receive:</Text>
                    <Text style={styles.swapPreviewValue}>
                      {((parseFloat(swapAmount) || 0) * swapFrom.price / swapTo.price).toFixed(6)} {swapTo.symbol}
                    </Text>
                  </View>
                  <View style={styles.swapPreviewRow}>
                    <Text style={styles.swapPreviewLabel}>Value:</Text>
                    <Text style={styles.swapPreviewValue}>
                      {formatMoney((parseFloat(swapAmount) || 0) * swapFrom.price)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowSwapModal(false);
                  setSwapFrom(null);
                  setSwapTo(null);
                  setSwapAmount('');
                }}
              >
                <LinearGradient
                  colors={['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSwap}
                disabled={!swapFrom || !swapTo || !swapAmount}
              >
                <LinearGradient
                  colors={(!swapFrom || !swapTo || !swapAmount) ? ['#6B7280', '#4B5563'] : ['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Swap</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Enhanced Purchase Success Modal */}
      <Modal visible={showPurchaseSuccessModal} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.enhancedModalContainer, 
              {
                transform: [{ scale: modalScaleAnim }],
                opacity: modalScaleAnim,
              }
            ]}
          >
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827', '#0F172A'] : ['#F8FAFC', '#FFFFFF', '#F1F5F9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.enhancedModalGradient}
            >
              {/* Background Glow Effect */}
              <View style={[styles.glowEffect, { backgroundColor: '#F59E0B' }]} />
              
              {/* Header with Icon Animation */}
              <MotiView
                from={{ scale: 0, rotate: '-180deg' }}
                animate={{ scale: 1, rotate: '0deg' }}
                transition={{
                  type: 'spring',
                  damping: 12,
                  stiffness: 200,
                  delay: 300,
                }}
                style={styles.enhancedModalHeader}
              >
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706', '#92400E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                  >
                    <Cpu size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.iconRing} />
                  <View style={styles.iconRingOuter} />
                </View>
              </MotiView>
              
              {/* Title Animation */}
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'timing',
                  duration: 600,
                  delay: 500,
                }}
                style={styles.enhancedModalTitleContainer}
              >
                <Text style={[styles.enhancedModalTitle, isDarkMode && styles.enhancedModalTitleDark]}>
                  Miner Purchased Successfully!
                </Text>
                <View style={styles.titleUnderline} />
              </MotiView>
              
              {/* Content Animation */}
              <MotiView
                from={{ opacity: 0, translateY: 30 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'timing',
                  duration: 600,
                  delay: 700,
                }}
                style={styles.enhancedModalContent}
              >
                <View style={styles.minerInfoCard}>
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8', '#1E40AF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.minerInfoGradient}
                  >
                    <View style={styles.minerInfoHeader}>
                      <CheckCircle size={20} color="#FFFFFF" />
                      <Text style={styles.minerInfoTitle}>
                        {purchasedMinerName}
                      </Text>
                    </View>
                    <Text style={styles.minerInfoDescription}>
                      Your new miner is now operational and ready to mine cryptocurrency!
                    </Text>
                    
                    <View style={styles.benefitsContainer}>
                      <View style={styles.benefitRow}>
                        <Sparkles size={16} color="#FBBF24" />
                        <Text style={styles.benefitText}>Mining power increased</Text>
                      </View>
                      <View style={styles.benefitRow}>
                        <DollarSign size={16} color="#10B981" />
                        <Text style={styles.benefitText}>Weekly earnings boosted</Text>
                      </View>
                      <View style={styles.benefitRow}>
                        <TrendingUp size={16} color="#8B5CF6" />
                        <Text style={styles.benefitText}>Portfolio diversified</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </MotiView>
              
              {/* Button Animation */}
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  damping: 15,
                  stiffness: 200,
                  delay: 1000,
                }}
                style={styles.enhancedModalActions}
              >
                <TouchableOpacity
                  style={styles.enhancedModalButton}
                  onPress={() => {
                    success();
                    setShowCoinEffect(false);
                    Animated.timing(modalScaleAnim, {
                      toValue: 0,
                      duration: 300,
                      useNativeDriver: true,
                    }).start(() => {
                      setShowPurchaseSuccessModal(false);
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669', '#047857']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.enhancedModalButtonGradient}
                  >
                    <CheckCircle size={20} color="#FFFFFF" />
                    <Text style={styles.enhancedModalButtonText}>Awesome!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            </LinearGradient>
          </Animated.View>
        </View>
        
        {/* Particle Effects */}
        <CoinEffect 
          visible={showCoinEffect} 
          onComplete={() => setShowCoinEffect(false)} 
        />
      </Modal>

      {/* Warehouse Full Modal */}
      <Modal visible={showWarehouseFullModal} transparent animationType="fade" onRequestClose={() => setShowWarehouseFullModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.warehouseModalContainer,
              {
                transform: [{ scale: warehouseModalScaleAnim }],
                opacity: warehouseModalScaleAnim,
              }
            ]}
          >
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827', '#0F172A'] : ['#F8FAFC', '#FFFFFF', '#F1F5F9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.warehouseModalGradient}
            >
              {/* Close Button */}
              <TouchableOpacity
                style={styles.warehouseModalCloseButton}
                onPress={() => setShowWarehouseFullModal(false)}
              >
                <X size={20} color={isDarkMode ? '#FFFFFF' : '#6B7280'} />
              </TouchableOpacity>

              {/* Icon Header */}
              <View style={styles.warehouseModalIconContainer}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.warehouseModalIconGradient}
                >
                  <Building2 size={48} color="#FFFFFF" />
                </LinearGradient>
              </View>

              {/* Title */}
              <View style={styles.warehouseModalHeader}>
                <Text style={[styles.warehouseModalTitle, isDarkMode && styles.warehouseModalTitleDark]}>
                  Warehouse at Full Capacity
                </Text>
              </View>

              {/* Capacity Info Card */}
              <View style={styles.warehouseCapacityCard}>
                <LinearGradient
                  colors={isDarkMode ? ['#374151', '#1F2937'] : ['#E5E7EB', '#F3F4F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.warehouseCapacityGradient}
                >
                  <View style={styles.warehouseCapacityRow}>
                    <View style={styles.warehouseCapacityItem}>
                      <Text style={[styles.warehouseCapacityLabel, isDarkMode && styles.warehouseCapacityLabelDark]}>
                        Current Capacity
                      </Text>
                      <Text style={[styles.warehouseCapacityValue, isDarkMode && styles.warehouseCapacityValueDark]}>
                        {warehouseCapacity} / {warehouseCapacity}
                      </Text>
                    </View>
                    <View style={styles.warehouseCapacityDivider} />
                    <View style={styles.warehouseCapacityItem}>
                      <Text style={[styles.warehouseCapacityLabel, isDarkMode && styles.warehouseCapacityLabelDark]}>
                        Warehouse Level
                      </Text>
                      <Text style={[styles.warehouseCapacityValue, isDarkMode && styles.warehouseCapacityValueDark]}>
                        Level {warehouse?.level || 0}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* Message */}
              <View style={styles.warehouseModalContent}>
                <Text style={[styles.warehouseModalMessage, isDarkMode && styles.warehouseModalMessageDark]}>
                  Your warehouse has reached its maximum storage capacity of {warehouseCapacity} miners. You cannot purchase additional miners until you upgrade your warehouse.
                </Text>
                
                <View style={styles.warehouseModalBenefits}>
                  <Text style={[styles.warehouseModalBenefitsTitle, isDarkMode && styles.warehouseModalBenefitsTitleDark]}>
                    💡 Upgrade Benefits:
                  </Text>
                  <View style={styles.warehouseModalBenefitsList}>
                    <View style={styles.warehouseModalBenefitItem}>
                      <Text style={styles.warehouseModalBenefitIcon}>✓</Text>
                      <Text style={[styles.warehouseModalBenefitText, isDarkMode && styles.warehouseModalBenefitTextDark]}>
                        +5 additional miner slots per level
                      </Text>
                    </View>
                    <View style={styles.warehouseModalBenefitItem}>
                      <Text style={styles.warehouseModalBenefitIcon}>✓</Text>
                      <Text style={[styles.warehouseModalBenefitText, isDarkMode && styles.warehouseModalBenefitTextDark]}>
                        Increased mining capacity
                      </Text>
                    </View>
                    <View style={styles.warehouseModalBenefitItem}>
                      <Text style={styles.warehouseModalBenefitIcon}>✓</Text>
                      <Text style={[styles.warehouseModalBenefitText, isDarkMode && styles.warehouseModalBenefitTextDark]}>
                        Higher potential earnings
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.warehouseModalActions}>
                <TouchableOpacity
                  style={styles.warehouseModalButtonSecondary}
                  onPress={() => setShowWarehouseFullModal(false)}
                >
                  <LinearGradient
                    colors={['#6B7280', '#4B5563']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.warehouseModalButtonGradient}
                  >
                    <Text style={styles.warehouseModalButtonText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.warehouseModalButtonPrimary}
                  onPress={() => {
                    setShowWarehouseFullModal(false);
                    // Scroll to warehouse button or highlight it
                  }}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.warehouseModalButtonGradient}
                  >
                    <Building2 size={18} color="#FFFFFF" />
                    <Text style={[styles.warehouseModalButtonText, { marginLeft: 8 }]}>Upgrade Warehouse</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>

      {/* Sell Confirmation Modal */}
      <Modal visible={showSellConfirmModal} transparent animationType="fade" onRequestClose={() => setShowSellConfirmModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContainer,
              isDarkMode && styles.modalContainerDark,
              {
                transform: [{ scale: sellModalScaleAnim }],
                opacity: sellModalScaleAnim,
              },
            ]}
          >
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              {/* Close Button */}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowSellConfirmModal(false);
                  setMinerToSell(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={isDarkMode ? '#FFFFFF' : '#6B7280'} />
              </TouchableOpacity>

              {/* Header with Icon */}
              <View style={styles.modalHeader}>
                <View style={[styles.sellModalIconContainer, isDarkMode && styles.sellModalIconContainerDark]}>
                  <AlertTriangle size={32} color="#EF4444" />
                </View>
                <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                  Sell Miner
                </Text>
                <Text style={[styles.modalSubtitle, isDarkMode && styles.modalSubtitleDark]}>
                  Confirm your sale
                </Text>
              </View>
              
              {/* Content */}
              <View style={styles.modalContent}>
                {minerToSell && (
                  <>
                    {/* Miner Info Card */}
                    <View style={[styles.sellMinerInfoCard, isDarkMode && styles.sellMinerInfoCardDark]}>
                      <View style={styles.sellMinerInfoRow}>
                        <Cpu size={24} color="#F59E0B" />
                        <View style={styles.sellMinerInfoText}>
                          <Text style={[styles.sellMinerName, isDarkMode && styles.sellMinerNameDark]}>
                            {minerToSell.name}
                          </Text>
                          <Text style={[styles.sellMinerDetails, isDarkMode && styles.sellMinerDetailsDark]}>
                            Purchase Price: {formatMoney(minerToSell.price)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Sell Price Highlight */}
                    <View style={[styles.sellPriceContainer, isDarkMode && styles.sellPriceContainerDark]}>
                      <View style={styles.sellPriceIconContainer}>
                        <DollarSign size={28} color="#10B981" />
                      </View>
                      <View style={styles.sellPriceTextContainer}>
                        <Text style={[styles.sellPriceLabel, isDarkMode && styles.sellPriceLabelDark]}>
                          You will receive
                        </Text>
                        <Text style={[styles.sellPriceAmount, isDarkMode && styles.sellPriceAmountDark]}>
                          {formatMoney(Math.floor(minerToSell.price * 0.5))}
                        </Text>
                      </View>
                    </View>

                    {/* Warning Message */}
                    <View style={[styles.sellWarningBox, isDarkMode && styles.sellWarningBoxDark]}>
                      <AlertTriangle size={16} color="#F59E0B" />
                      <Text style={[styles.sellWarningText, isDarkMode && styles.sellWarningTextDark]}>
                        This is 50% of the original purchase price. This action cannot be undone.
                      </Text>
                    </View>
                  </>
                )}
              </View>
              
              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.sellCancelButton]}
                  onPress={() => {
                    setShowSellConfirmModal(false);
                    setMinerToSell(null);
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#6B7280', '#4B5563']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.sellConfirmButton]}
                  onPress={() => {
                    if (minerToSell) {
                      executeSell(minerToSell);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626', '#B91C1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <DollarSign size={18} color="#FFFFFF" />
                    <Text style={[styles.modalButtonText, { marginLeft: 8 }]}>Confirm Sell</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: 'transparent',
  },
  placeholder: {
    width: 48,
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    ...getShadow(8, '#000'),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  summaryLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 0,
    marginBottom: 20,
    gap: 12,
    borderRadius: 16,
    overflow: 'visible',
    ...getShadow(8, '#000'),
  },
  tab: {
    flex: 1,
    minHeight: 60,
    borderRadius: 10,
    overflow: 'hidden',
    ...getShadow(4, '#000'),
  },
  activeTab: {
    ...getShadow(8, '#3B82F6'),
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    minHeight: 60,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 80,
    flexGrow: 1,
    justifyContent: 'center',
  },
  itemsContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  minerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  minerCardGradient: {
    padding: 20,
  },
  minerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  minerInfo: {
    flex: 1,
  },
  minerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  minerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  minerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minerStatText: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  minerPrice: {
    alignItems: 'flex-end',
  },
  minerPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7931A',
  },
  minerOwned: {
    marginBottom: 16,
  },
  minerOwnedText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  minerOwnedTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  minerEarningsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  cryptoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cryptoCardGradient: {
    padding: 20,
  },
  cryptoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cryptoInfo: {
    flex: 1,
  },
  cryptoSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cryptoName: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  cryptoPrice: {
    alignItems: 'flex-end',
  },
  cryptoPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7931A',
    marginBottom: 4,
  },
  cryptoChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cryptoChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cryptoHoldings: {
    marginBottom: 16,
  },
  cryptoHoldingsText: {
    fontSize: 14,
    color: '#E5E7EB',
    marginBottom: 2,
  },
  cryptoValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cryptoActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainerDark: {
    // Additional dark mode styles if needed
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  miningSelectionContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  miningSelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cryptoOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 8,
    marginBottom: 16,
  },
  cryptoOption: {
    width: '48%', // Adjust as needed for 2 columns
    borderRadius: 8,
    overflow: 'hidden',
  },
  cryptoOptionGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cryptoOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  miningSelectionNote: {
    fontSize: 12,
    color: '#E5E7EB',
    marginBottom: 12,
  },
  currentMiningContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  currentMiningGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  currentMiningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  miningEarnings: {
    marginTop: 16,
  },
  miningEarningsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  miningEarningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  miningEarningsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  miningEarningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  miningEarningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  miningEarningsLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  miningEarningsLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  miningEarningsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  miningEarningsSubtext: {
    fontSize: 11,
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  miningEarningsSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  miningEarningsUpgrade: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  miningEarningsUpgradeText: {
    fontSize: 12,
    color: '#10B981',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  autoRepairCostText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginTop: 4,
  },
  warehouseLevelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 4,
  },
  warehouseInfoText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  warehouseInfoTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  upgradeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 0,
    gap: 12,
  },
  autoRepairButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  autoRepairButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  autoRepairButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  warehouseButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warehouseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  warehouseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 20,
    lineHeight: 20,
  },
  durabilityInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  durabilityText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 4,
  },
  repairButton: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  fullDurabilityButton: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  repairButtonGradient: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  repairButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  swapInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  swapInfoText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  swapOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  swapOption: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  swapOptionGradient: {
    padding: 12,
    alignItems: 'center',
  },
  swapOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  swapOptionPrice: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  swapPreview: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  swapPreviewHeader: {
    marginBottom: 12,
  },
  swapPreviewTitle: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  swapPreviewContent: {
    gap: 8,
  },
  swapPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  swapPreviewLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  swapPreviewLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  swapPreviewValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  swapPreviewText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    textAlign: 'center',
  },
  investmentPreview: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  investmentPreviewText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  investmentPreviewSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  investmentPreviewSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Enhanced Modal Styles
  enhancedModalContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    width: screenWidth * 0.9,
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  enhancedModalGradient: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    opacity: 0.1,
    borderRadius: 30,
  },
  enhancedModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#F59E0B',
    opacity: 0.3,
  },
  iconRingOuter: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#F59E0B',
    opacity: 0.2,
  },
  enhancedModalTitleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  enhancedModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  enhancedModalTitleDark: {
    color: '#FFFFFF',
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  enhancedModalContent: {
    width: '100%',
    marginBottom: 24,
  },
  minerInfoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  minerInfoGradient: {
    padding: 20,
  },
  minerInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  minerInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  minerInfoDescription: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitsContainer: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  enhancedModalActions: {
    width: '100%',
  },
  enhancedModalButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  enhancedModalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  enhancedModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Miner Card Styles - Additional styles (duplicates removed, keeping unique ones)
  minerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  minerNameDark: {
    color: '#FFFFFF',
  },
  minerOwnedDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  priceTextDark: {
    color: '#34D399',
  },
  minerStatTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  minerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  buyMinerButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  buyMinerButtonWithSell: {
    flex: 1,
  },
  buyMinerButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyMinerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sellMinerButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 44, // Ensure touch target is large enough
  },
  sellMinerButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Ensure touch target is large enough
  },
  sellMinerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  repairMinerButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 44,
  },
  repairMinerButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  repairMinerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  noCompanyWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noCompanyText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
    textAlign: 'center',
  },
  noCompanyTextDark: {
    color: '#F87171',
  },
  autoRepairStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  autoRepairContainer: {
    flex: 1,
  },
  warehouseContainer: {
    flex: 1,
  },
  statusIndicator: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  statusReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusInsufficient: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusTextReady: {
    color: '#10B981',
  },
  statusTextInsufficient: {
    color: '#EF4444',
  },
  // Sell Modal Specific Styles
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalSubtitleDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sellModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  sellModalIconContainerDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  sellMinerInfoCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  sellMinerInfoCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  sellMinerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellMinerInfoText: {
    flex: 1,
  },
  sellMinerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 4,
  },
  sellMinerNameDark: {
    color: '#FBBF24',
  },
  sellMinerDetails: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sellMinerDetailsDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sellPriceContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sellPriceContainerDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  sellPriceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellPriceTextContainer: {
    flex: 1,
  },
  sellPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sellPriceLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sellPriceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
  },
  sellPriceAmountDark: {
    color: '#34D399',
  },
  sellWarningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  sellWarningBoxDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  sellWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 18,
  },
  sellWarningTextDark: {
    color: '#FBBF24',
  },
  sellCancelButton: {
    flex: 1,
    marginRight: 6,
  },
  sellConfirmButton: {
    flex: 1,
    marginLeft: 6,
  },
  // Warehouse Full Modal Styles
  warehouseModalContainer: {
    width: '90%',
    maxWidth: 450,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  warehouseModalGradient: {
    padding: 28,
    borderRadius: 24,
  },
  warehouseModalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  warehouseModalIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  warehouseModalIconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warehouseModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  warehouseModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  warehouseModalTitleDark: {
    color: '#F9FAFB',
  },
  warehouseCapacityCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  warehouseCapacityGradient: {
    padding: 20,
    borderRadius: 16,
  },
  warehouseCapacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  warehouseCapacityItem: {
    flex: 1,
    alignItems: 'center',
  },
  warehouseCapacityDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 16,
  },
  warehouseCapacityLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  warehouseCapacityLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  warehouseCapacityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  warehouseCapacityValueDark: {
    color: '#F9FAFB',
  },
  warehouseModalContent: {
    marginBottom: 24,
  },
  warehouseModalMessage: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  warehouseModalMessageDark: {
    color: '#D1D5DB',
  },
  warehouseModalBenefits: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  warehouseModalBenefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  warehouseModalBenefitsTitleDark: {
    color: '#60A5FA',
  },
  warehouseModalBenefitsList: {
    gap: 10,
  },
  warehouseModalBenefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warehouseModalBenefitIcon: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: 'bold',
    marginTop: 2,
  },
  warehouseModalBenefitText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  warehouseModalBenefitTextDark: {
    color: '#E5E7EB',
  },
  warehouseModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  warehouseModalButtonPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  warehouseModalButtonSecondary: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  warehouseModalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  warehouseModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
