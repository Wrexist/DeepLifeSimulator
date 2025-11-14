import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, useColorScheme, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bitcoin, Zap, DollarSign, TrendingUp, TrendingDown, Cpu, Activity, HardDrive, Coins, Building2, CheckCircle, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { MotiView } from 'moti';
import { CoinEffect } from '@/components/ui/ParticleEffects';
import { useFeedback } from '@/utils/feedbackSystem';

const { width: screenWidth } = Dimensions.get('window');

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

export default function BitcoinMiningApp({ onBack }: BitcoinMiningAppProps) {
  const { gameState, buyCrypto, sellCrypto, swapCrypto, buyMiner, buyWarehouse, upgradeWarehouse, selectMiningCrypto, selectWarehouseMiningCrypto, setGameState, saveGame } = useGame();
  const { success, buttonPress } = useFeedback(gameState.settings.hapticFeedback);
  const [activeTab, setActiveTab] = useState<'miners' | 'crypto'>('miners');

  const formatMoney = (amount: number) => {
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
  const [selectedStock, setSelectedStock] = useState<Crypto | null>(null);
  const isDarkMode = useColorScheme() === 'dark';
  const [investAmount, setInvestAmount] = useState('');
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [swapFrom, setSwapFrom] = useState<Crypto | null>(null);
  const [swapTo, setSwapTo] = useState<Crypto | null>(null);
  const [swapAmount, setSwapAmount] = useState('');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [sellCryptoItem, setSellCryptoItem] = useState<Crypto | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAutoRepairModal, setShowAutoRepairModal] = useState(false);
  const [showPurchaseSuccessModal, setShowPurchaseSuccessModal] = useState(false);
  const [purchasedMinerName, setPurchasedMinerName] = useState('');
  const [showWarehouseFullModal, setShowWarehouseFullModal] = useState(false);
  const [warehouseCapacity, setWarehouseCapacity] = useState(0);
  const [showCoinEffect, setShowCoinEffect] = useState(false);
  const modalScaleAnim = useRef(new Animated.Value(0)).current;

  // Modal animation effect
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

  // Crypto mining difficulty multipliers (based on real-world mining difficulty)
  const cryptoMiningMultipliers = {
    'btc': 1.0,    // Bitcoin - hardest to mine, highest reward
    'eth': 0.8,    // Ethereum - high difficulty, good reward
    'sol': 0.6,    // Solana - medium difficulty
    'link': 0.5,   // Chainlink - medium difficulty
    'dot': 0.4,    // Polkadot - easier to mine
    'matic': 0.3,  // Polygon - easier to mine
    'ada': 0.2,    // Cardano - easy to mine
    'xrp': 0.1,    // Ripple - easiest to mine, lowest reward
  };

  const miners: Miner[] = [
    { id: 'basic', name: 'Basic Miner', price: 2500, weeklyEarnings: 22, powerConsumption: 10, owned: 0, durability: 100, maxDurability: 100, repairCost: 125 },
    { id: 'advanced', name: 'Advanced Miner', price: 10000, weeklyEarnings: 105, powerConsumption: 35, owned: 0, durability: 100, maxDurability: 100, repairCost: 500 },
    { id: 'pro', name: 'Pro Miner', price: 40000, weeklyEarnings: 438, powerConsumption: 100, owned: 0, durability: 100, maxDurability: 100, repairCost: 2000 },
    { id: 'industrial', name: 'Industrial Miner', price: 125000, weeklyEarnings: 1575, powerConsumption: 250, owned: 0, durability: 100, maxDurability: 100, repairCost: 6250 },
    { id: 'quantum', name: 'Quantum Miner', price: 500000, weeklyEarnings: 7000, powerConsumption: 500, owned: 0, durability: 100, maxDurability: 100, repairCost: 25000 },
    { id: 'mega', name: 'Mega Miner', price: 2500000, weeklyEarnings: 35000, powerConsumption: 2000, owned: 0, durability: 100, maxDurability: 100, repairCost: 125000 },
    { id: 'giga', name: 'Giga Miner', price: 10000000, weeklyEarnings: 140000, powerConsumption: 5000, owned: 0, durability: 100, maxDurability: 100, repairCost: 500000 },
    { id: 'tera', name: 'Tera Miner', price: 50000000, weeklyEarnings: 700000, powerConsumption: 15000, owned: 0, durability: 100, maxDurability: 100, repairCost: 2500000 },
  ];

  const handleBuyMiner = (miner: Miner) => {
    buttonPress();
    
    const result = buyMiner(miner.id, miner.name, miner.price);
    
    if (result.success) {
      setPurchasedMinerName(miner.name);
      setShowPurchaseSuccessModal(true);
    } else {
      if (result.message?.includes('Warehouse is full')) {
        const currentMiners = Object.values(gameState.warehouse?.miners || {}).reduce((sum, count) => sum + count, 0);
        const maxCapacity = 10 + (gameState.warehouse?.level || 0) * 5;
        setWarehouseCapacity(maxCapacity);
        setShowWarehouseFullModal(true);
      } else {
        Alert.alert('Purchase Failed', result.message || 'Unable to purchase miner');
      }
    }
  };

  const renderMinerCard = (miner: Miner) => {
    const owned = gameState.warehouse?.miners[miner.id] || 0;
    const canAfford = gameState.stats.money >= miner.price;
    const hasWarehouse = !!gameState.warehouse;
    
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
                ${miner.weeklyEarnings}/week
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
            <TouchableOpacity
              style={[styles.buyMinerButton, !canAfford && styles.disabledButton]}
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
  };

  const handleInvest = () => {
    if (!selectedStock) return;
    
    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0 || amount > gameState.stats.money) {
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
  };

  const handleSellCryptoPress = (crypto: Crypto) => {
    setSellCryptoItem(crypto);
    setSellAmount('');
    setShowSellModal(true);
  };

  const confirmSellCrypto = () => {
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
  };

  const confirmSellAllCrypto = () => {
    if (!sellCryptoItem) return;
    sellCrypto(sellCryptoItem.id, sellCryptoItem.owned);
    Alert.alert('Sold!', `Sold all ${sellCryptoItem.symbol}`);
    setShowSellModal(false);
    setSellCryptoItem(null);
    setSellAmount('');
  };

  const handleSwap = () => {
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
  };

  const totalWeeklyEarnings = miners.reduce((total, miner) => {
    const owned = gameState.warehouse?.miners[miner.id] || 0;
    // Only earn if a mining target is selected
    const hasMiningTarget = gameState.warehouse?.selectedCrypto;
    if (!hasMiningTarget) return total;
    
    // Apply crypto-specific mining difficulty multiplier
    const selectedCrypto = gameState.warehouse?.selectedCrypto;
    const difficultyMultiplier = selectedCrypto ? cryptoMiningMultipliers[selectedCrypto as keyof typeof cryptoMiningMultipliers] || 1.0 : 1.0;
    
    return total + (miner.weeklyEarnings * owned * difficultyMultiplier);
  }, 0);

  const totalPowerConsumption = miners.reduce((total, miner) => {
    const owned = gameState.warehouse?.miners[miner.id] || 0;
    return total + (miner.powerConsumption * owned);
  }, 0);

  const weeklyPowerCost = totalPowerConsumption * 0.40; // $0.40 per power unit per week (increased from $0.25)
  const netWeeklyEarnings = totalWeeklyEarnings - weeklyPowerCost;

  // Helper functions to check if player has enough funds
  const canAffordAutoRepair = () => {
    if (!gameState.warehouse?.selectedCrypto) return false;
    const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto);
    if (!selectedCrypto) return false;
    const weeklyCryptoCost = 5000 / selectedCrypto.price;
    return selectedCrypto.owned >= weeklyCryptoCost;
  };

  const canAffordWarehouseUpgrade = () => {
    if (!gameState.warehouse) return gameState.stats.money >= 25000; // Buy warehouse cost
    const upgradeCost = 15000 * gameState.warehouse.level;
    return gameState.stats.money >= upgradeCost;
  };

  const getAutoRepairStatus = () => {
    if (!gameState.warehouse) return { canAfford: false, reason: 'No warehouse' };
    if (!gameState.warehouse.selectedCrypto) return { canAfford: false, reason: 'No crypto selected' };
    
    const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto);
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
  };

  const getWarehouseUpgradeStatus = () => {
    if (!gameState.warehouse) {
      const canAfford = gameState.stats.money >= 25000;
      return {
        canAfford,
        reason: canAfford ? 'Ready to buy' : `Need ${formatMoney(25000 - gameState.stats.money)} more`,
        cost: 25000,
        action: 'Buy Warehouse'
      };
    }
    
    const upgradeCost = 15000 * gameState.warehouse.level;
    const canAfford = gameState.stats.money >= upgradeCost;
    
    return {
      canAfford,
              reason: canAfford ? 'Ready to upgrade' : `Need ${formatMoney(upgradeCost - gameState.stats.money)} more`,
      cost: upgradeCost,
      action: 'Upgrade Warehouse'
    };
  };

  const handleFireAutoRepair = () => {
    console.log('handleFireAutoRepair called');
    
    if (!gameState.warehouse) {
      console.log('No warehouse found');
      return;
    }
    
    if (!gameState.warehouse.autoRepairEnabled) {
      console.log('Auto-repair not enabled');
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
    
    console.log('Auto-repair fired successfully!');
    Alert.alert('Auto-Repair Fired!', 'Your auto-repair technician has been dismissed. You will need to manually repair your miners.');
  };

  const handleHireAutoRepair = () => {
    console.log('handleHireAutoRepair called');
    console.log('gameState.warehouse:', gameState.warehouse);
    
    // Check if user has a warehouse
    if (!gameState.warehouse) {
      console.log('No warehouse found');
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
    
    const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto);
    console.log('found selectedCrypto:', selectedCrypto);
    
    if (!selectedCrypto) {
      console.log('No selected crypto found');
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
    
    console.log('weeklyCryptoCost:', weeklyCryptoCost);
    console.log('currentCryptoOwned:', currentCryptoOwned);
    
    if (currentCryptoOwned < weeklyCryptoCost) {
      console.log('Not enough crypto:', currentCryptoOwned, 'needed:', weeklyCryptoCost);
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
    if (gameState.warehouse.autoRepairEnabled) {
      console.log('Auto-repair already enabled');
      Alert.alert('Already Enabled', 'Auto-repair is already enabled for your warehouse.');
      return;
    }

    // Deduct crypto instead of money
    const cryptoToDeduct = weeklyCryptoCost;
    const cryptoId = selectedCrypto.id;
    
    console.log('About to update state with cryptoToDeduct:', cryptoToDeduct);
    
    // Update crypto holdings and warehouse state
    setGameState(prev => {
      console.log('setGameState called with prev:', prev);
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
      console.log('newState:', newState);
      return newState;
    });
    
    // Save the game state
    saveGame();
    
    console.log('Auto-repair hired successfully!');
    Alert.alert('Auto-Repair Hired!', `Your miners will now be automatically repaired weekly for ${cryptoToDeduct.toFixed(6)} ${selectedCrypto.symbol}.`);
    setShowAutoRepairModal(false);
  };

  const handleRepairMiner = (minerId: string) => {
    const miner = miners.find(m => m.id === minerId);
    if (!miner) return;
    
    const owned = gameState.company?.miners[minerId] || 0;
    const totalRepairCost = miner.repairCost * owned;
    
    if (gameState.stats.money < totalRepairCost) {
      Alert.alert('Cannot Repair', `You need ${formatMoney(totalRepairCost)} to repair all ${owned} ${miner.name}s.`);
      return;
    }
    
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - totalRepairCost }
    }));
    Alert.alert('Repair Complete!', `All ${owned} ${miner.name}s have been repaired for ${formatMoney(totalRepairCost)}.`);
  };

  const handleUpgradeWarehouse = () => {
    const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.company?.selectedCrypto);
    if (!selectedCrypto) {
      Alert.alert('No Crypto Selected', 'Please select a cryptocurrency to mine before upgrading warehouse.');
      return;
    }

    const warehouseUpgradeCost = 0.001; // 0.001 BTC
    const currentCryptoOwned = selectedCrypto.owned;
    
    if (currentCryptoOwned < warehouseUpgradeCost) {
      Alert.alert('Not Enough Crypto', `You need ${warehouseUpgradeCost.toFixed(6)} ${selectedCrypto.symbol} to upgrade warehouse.`);
      return;
    }

    // Calculate current warehouse capacity
    const currentWarehouseLevel = gameState.company?.warehouseLevel || 0;
    const currentCapacity = 10 + currentWarehouseLevel * 5;
    const newCapacity = currentCapacity + 5;

    // Deduct crypto and upgrade warehouse
    const cryptoId = selectedCrypto.id;
    setGameState(prev => ({
      ...prev,
      cryptos: prev.cryptos.map(crypto => 
        crypto.id === cryptoId 
          ? { ...crypto, owned: crypto.owned - warehouseUpgradeCost }
          : crypto
      ),
      company: prev.company ? {
        ...prev.company,
        warehouseLevel: (prev.company.warehouseLevel || 0) + 1
      } : prev.company,
    }));
    
    Alert.alert('Warehouse Upgraded!', `Your warehouse capacity has been increased from ${currentCapacity} to ${newCapacity} miners!`);
  };

  const handleSelectCrypto = (cryptoId: string) => {
    if (gameState.warehouse) {
      selectWarehouseMiningCrypto(cryptoId);
    } else {
      selectMiningCrypto(cryptoId);
    }
  };



  const renderCryptoCard = (crypto: Crypto) => {
    const isSelected = gameState.company?.selectedCrypto === crypto.id;
    const changeColor = crypto.change >= 0 ? '#10B981' : '#EF4444';
    const changeIcon = crypto.change >= 0 ? TrendingUp : TrendingDown;
    
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
  };

  const renderMiningSelection = () => {
    if (!gameState.warehouse) {
      return (
        <View style={styles.miningSelectionContainer}>
          <Text style={styles.miningSelectionTitle}>Select Cryptocurrency to Mine:</Text>
          <View style={styles.cryptoOptions}>
            {gameState.cryptos.slice(0, 4).map(crypto => (
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
            Choose a cryptocurrency to start mining. You'll need to buy miners first.
          </Text>
        </View>
      );
    }

    const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto);
    return (
      <View style={styles.miningSelectionContainer}>
        <Text style={styles.miningSelectionTitle}>Mining Target:</Text>
        <View style={styles.cryptoOptions}>
          {gameState.cryptos.slice(0, 4).map(crypto => {
            const difficulty = cryptoMiningMultipliers[crypto.id as keyof typeof cryptoMiningMultipliers] || 1.0;
            const difficultyText = difficulty >= 0.8 ? 'Hard' : difficulty >= 0.5 ? 'Medium' : 'Easy';
            const difficultyColor = difficulty >= 0.8 ? '#EF4444' : difficulty >= 0.5 ? '#F59E0B' : '#10B981';
            
            return (
              <TouchableOpacity
                key={crypto.id}
                style={styles.cryptoOption}
                onPress={() => handleSelectCrypto(crypto.id)}
              >
                <LinearGradient
                  colors={gameState.warehouse?.selectedCrypto === crypto.id ? ['#10B981', '#059669'] : ['#3B82F6', '#1D4ED8']}
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
                  <Text style={styles.miningEarningsLabel}>Weekly Mining</Text>
                  <Text style={styles.miningEarningsValue}>
                    {(totalWeeklyEarnings / selectedCrypto.price).toFixed(6)} {selectedCrypto.symbol}
                  </Text>
                  <Text style={styles.miningEarningsSubtext}>
                    ≈ {formatMoney(totalWeeklyEarnings)}
                  </Text>
                </View>
                
                <View style={styles.miningEarningsItem}>
                  <Text style={styles.miningEarningsLabel}>Warehouse</Text>
                  <Text style={styles.miningEarningsValue}>
                    Level {gameState.warehouse?.level || 0}
                  </Text>
                  <Text style={styles.miningEarningsSubtext}>
                    Max: {10 + (gameState.warehouse?.level || 0) * 5} miners
                  </Text>
                </View>
              </View>
              
              <View style={styles.miningEarningsUpgrade}>
                <Text style={styles.miningEarningsUpgradeText}>
                  🏭 Warehouse Level: {gameState.warehouse?.level || 0} (Max: {10 + (gameState.warehouse?.level || 0) * 5} miners)
                </Text>
                <Text style={styles.miningEarningsUpgradeText}>
                  💡 Upgrade warehouse to store more miners and increase earnings!
                </Text>
                {gameState.warehouse?.autoRepairEnabled && (
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
        <Text style={styles.headerTitle}>Bitcoin Mining</Text>
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
                <Text style={styles.summaryLabel}>Weekly Mining</Text>
                <Text style={styles.summaryValue}>
                  {gameState.warehouse?.selectedCrypto ? 
                    `${(totalWeeklyEarnings / (gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto)?.price || 1)).toFixed(6)} ${gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto)?.symbol || ''}` 
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
                  {gameState.warehouse?.selectedCrypto ? 
                    `${((totalWeeklyEarnings - weeklyPowerCost) / (gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto)?.price || 1)).toFixed(6)} ${gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto)?.symbol || ''}` 
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
                  {gameState.warehouse?.selectedCrypto ? gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto)?.symbol : 'None'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Activity size={20} color="#3B82F6" />
                <Text style={styles.summaryLabel}>Auto-Repair</Text>
                <Text style={styles.summaryValue}>
                  {gameState.company?.autoRepairEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.upgradeButtonsContainer}>
          {gameState.warehouse?.autoRepairEnabled ? (
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
                      console.log('Auto-repair button pressed');
                      if (!gameState.warehouse) {
                        Alert.alert('No Warehouse', 'You need to own a warehouse to hire auto-repair technicians.');
                        return;
                      }
                      if (!gameState.warehouse.selectedCrypto) {
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
                    if (!gameState.warehouse) {
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
                      (!gameState.warehouse ? ['#10B981', '#059669'] : ['#3B82F6', '#1D4ED8']) : 
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
            : gameState.cryptos.map(renderCryptoCard)
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
              style={styles.modalInput}
              placeholder="Amount to invest ($)"
              placeholderTextColor="#9CA3AF"
              value={investAmount}
              onChangeText={setInvestAmount}
              keyboardType="numeric"
            />
            {investAmount && selectedStock && (
              <View style={styles.investmentPreview}>
                <Text style={styles.investmentPreviewText}>
                  You'll receive: {(parseFloat(investAmount) / selectedStock.price).toFixed(6)} {selectedStock.symbol}
                </Text>
                <Text style={styles.investmentPreviewSubtext}>
                  At {formatMoney(selectedStock.price)} per {selectedStock.symbol}
                </Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowInvestModal(false)}
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
              style={styles.modalInput}
              placeholder="Amount to sell"
              placeholderTextColor="#9CA3AF"
              value={sellAmount}
              onChangeText={setSellAmount}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSellModal(false)}
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
              const selectedCrypto = gameState.cryptos.find(c => c.id === gameState.warehouse?.selectedCrypto);
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
                        console.log('Hire button pressed in modal');
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
              placeholderTextColor="#9CA3AF"
              value={swapAmount}
              onChangeText={setSwapAmount}
              keyboardType="numeric"
            />

            <Text style={styles.modalDescription}>
              Select the cryptocurrency you want to swap to:
            </Text>

            <View style={styles.swapOptions}>
              {gameState.cryptos.map(crypto => (
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
                    <Text style={styles.swapPreviewLabel}>You're giving:</Text>
                    <Text style={styles.swapPreviewValue}>
                      {parseFloat(swapAmount).toFixed(6)} {swapFrom.symbol}
                    </Text>
                  </View>
                  <View style={styles.swapPreviewRow}>
                    <Text style={styles.swapPreviewLabel}>You'll receive:</Text>
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
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <LinearGradient
              colors={isDarkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                  📦 Warehouse Full
                </Text>
              </View>
              
              <View style={styles.modalContent}>
                <Text style={[styles.modalMessage, isDarkMode && styles.modalMessageDark]}>
                  Your warehouse is full! You can store up to {warehouseCapacity} miners.
                </Text>
                <Text style={[styles.modalSubtext, isDarkMode && styles.modalSubtextDark]}>
                  Upgrade your warehouse to store more miners and increase your mining capacity.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowWarehouseFullModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Understood</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    color: '#FFFFFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  activeTab: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
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
    paddingBottom: 40,
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
    alignItems: 'center',
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
  },
  upgradeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
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
  
  // Miner Card Styles
  minerCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  minerCardGradient: {
    padding: 16,
  },
  minerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  minerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  minerInfo: {
    flex: 1,
  },
  minerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  minerNameDark: {
    color: '#FFFFFF',
  },
  minerOwned: {
    fontSize: 14,
    color: '#6B7280',
  },
  minerOwnedDark: {
    color: '#9CA3AF',
  },
  minerPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  priceTextDark: {
    color: '#34D399',
  },
  minerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  minerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  minerStatText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  minerStatTextDark: {
    color: '#9CA3AF',
  },
  buyMinerButton: {
    borderRadius: 8,
    overflow: 'hidden',
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
});