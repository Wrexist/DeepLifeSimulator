import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';



import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Dimensions, Animated } from 'react-native';



import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';



const LinearGradient = LinearGradientFallback;



import { ArrowLeft, Bitcoin, Zap, DollarSign, TrendingUp, TrendingDown, Cpu, Activity, HardDrive, Coins, Building2, CheckCircle, Sparkles, AlertTriangle, X, BarChart3, Users, Lock, Sun, Wind, Settings, TrendingDown as TrendingDownIcon, Award, Target, ChevronRight, ChevronLeft, ShoppingCart, Plus, Minus } from 'lucide-react-native';



import { useGame } from '@/contexts/GameContext';
import { useCompanyActions } from '@/contexts/game/CompanyActionsContext';
import * as MiningActions from '@/contexts/game/actions/MiningActions';



import { MotiView, MotiText } from '@/components/anim/MotiStub';



import { CoinEffect } from '@/components/ui/ParticleEffects';



import { useFeedback } from '@/utils/feedbackSystem';



import { logger } from '@/utils/logger';



import { getShadow } from '@/utils/shadow';



import { scale, fontScale, responsivePadding, getResponsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';



import { validateMoney, validatePositiveNumber } from '@/utils/validation';
import { getInflatedPrice } from '@/lib/economy/inflation';







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



// Base crypto earnings per miner type (in crypto, not dollars)
// These represent weekly crypto amounts earned directly
const CRYPTO_EARNINGS_PER_MINER: Record<string, number> = {
  basic: 0.0005,      // ~$22 worth at BTC price
  advanced: 0.0024,   // ~$105 worth
  pro: 0.01,          // ~$438 worth
  industrial: 0.036,  // ~$1575 worth
  quantum: 0.16,      // ~$7000 worth
  mega: 0.8,          // ~$35000 worth
  giga: 3.2,          // ~$140000 worth
  tera: 16.0,         // ~$700000 worth
};







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



  } else if (a > 10_000) {



    // Thousands (K) - only for numbers above 10,000



    formatted = `${(a / 1_000).toFixed(2)}K`;



  } else {



    // Regular numbers (0-10,000) - show full number



    formatted = a.toLocaleString();



  }



  



  // Remove trailing zeros and decimal point if not needed



  formatted = formatted.replace(/\.00$/, '').replace(/\.0$/, '');



  



  return `$${sign}${formatted}`;



};



// Format crypto amount with appropriate decimal places
const formatCrypto = (amount: number, decimals: number = 6): string => {
  if (amount === 0 || !isFinite(amount)) return '0';
  if (amount < 0.000001 && amount > 0) {
    return amount.toExponential(2);
  }
  // Format with decimals and remove trailing zeros
  const formatted = amount.toFixed(decimals);
  // Remove trailing zeros and decimal point if not needed
  return formatted.replace(/\.?0+$/, '');
};







export default function BitcoinMiningApp({ onBack }: BitcoinMiningAppProps) {



  const { gameState, buyCrypto, sellCrypto, swapCrypto, buyMiner, sellMiner, buyWarehouse, upgradeWarehouse, selectMiningCrypto, setGameState, saveGame } = useGame();
  const { buyMinerUpgrade, joinMiningPool, leaveMiningPool, stakeCrypto, claimStakingRewards, upgradeEnergySystem, upgradeAutomation } = useCompanyActions();



  const { success, buttonPress } = useFeedback(gameState.settings.hapticFeedback);



  const [activeTab, setActiveTab] = useState<'miners' | 'crypto' | 'upgrades' | 'pools' | 'staking' | 'statistics' | 'energy' | 'automation'>('miners');







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

  // Staking modal state
  const [stakeCryptoId, setStakeCryptoId] = useState<string>('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockWeeks, setLockWeeks] = useState(1);
  const [showStakeModal, setShowStakeModal] = useState(false);

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



    // Only allow repair when health is under 50%
    if (currentDurability >= 50) {



      Alert.alert('Cannot Repair', `You can only repair miners when their health is below 50%. Current health: ${Math.round(currentDurability)}%`);



      return;



    }



    if (currentDurability >= 100) {



      Alert.alert('Perfect Condition', 'This miner is already at 100% health!');



      return;



    }



    



    // Calculate dynamic repair cost based on health percentage
    const healthToRestore = 100 - currentDurability;
    const healthPercentage = healthToRestore / 100; // How much health needs to be restored (0-1)
    const baseRepairCost = miner.repairCost; // Base cost to repair from 0% to 100%
    const dynamicRepairCost = baseRepairCost * healthPercentage; // Cost proportional to health needed
    const repairCost = dynamicRepairCost * (warehouse.miners[miner.id] || 0);



    if (gameState.stats.money < repairCost) {



      Alert.alert('Insufficient Funds', `You need ${formatMoney(repairCost)} to repair all ${miner.name} miners from ${Math.round(currentDurability)}% to 100% health.`);



      return;



    }



    



    Alert.alert(



      `Repair ${miner.name}`,



      `Repair all ${warehouse.miners[miner.id] || 0} ${miner.name} miners from ${Math.round(currentDurability)}% to 100% health for ${formatMoney(repairCost)}?`,



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



    



    // Calculate crypto earnings for this miner type
    const hasMiningTarget = warehouse?.selectedCrypto;
    const selectedCrypto = warehouse?.selectedCrypto;
    const selectedCryptoData = selectedCrypto ? cryptos.find(c => c.id === selectedCrypto) : null;
    const cryptoSymbol = selectedCryptoData?.symbol || '';

    // Calculate crypto earnings per miner (considering all bonuses)
    let singleMinerCryptoEarnings = 0;
    let totalCryptoEarningsForType = 0;

    if (hasMiningTarget && selectedCrypto) {
      // Base crypto earnings per miner
      const baseCryptoEarnings = CRYPTO_EARNINGS_PER_MINER[miner.id] || 0;
      
      // Apply crypto-specific difficulty multiplier
      const difficultyMultiplier = CRYPTO_MINING_MULTIPLIERS[selectedCrypto as keyof typeof CRYPTO_MINING_MULTIPLIERS] || 1.0;
      singleMinerCryptoEarnings = baseCryptoEarnings * difficultyMultiplier;

      // Apply upgrades (efficiency upgrades)
      const upgrades = warehouse.upgrades?.filter(u => u.minerId === miner.id) || [];
      upgrades.forEach(upgrade => {
        const definition = Object.values(MiningActions.MINER_UPGRADE_DEFINITIONS).flat().find(d => d.id === upgrade.id);
        if (definition && definition.type === 'efficiency') {
          singleMinerCryptoEarnings *= (1 + definition.effectPerLevel * upgrade.level);
        }
      });

      // Apply pool bonus
      if (warehouse.activePool) {
        const pool = warehouse.pools?.find(p => p.id === warehouse.activePool && p.cryptoId === selectedCrypto);
        if (pool && pool.bonusMultiplier) {
          singleMinerCryptoEarnings *= pool.bonusMultiplier;
          // Apply pool fee
          singleMinerCryptoEarnings *= (1 - (pool.fee || 0));
        }
      }

      // Apply automation bonus
      const automationBonus = (warehouse.automationLevel || 0) * 0.02; // 2% per level
      singleMinerCryptoEarnings *= (1 + automationBonus);

      // Apply policy bonus (mining bonus from crypto policies)
      const miningBonus = cryptoEffects?.miningBonus || 0;
      const policyBonus = 1 + (miningBonus / 100);
      singleMinerCryptoEarnings *= policyBonus;

      // Apply difficulty multiplier (global mining difficulty)
      const difficulty = warehouse.difficultyMultiplier || 1.0;
      singleMinerCryptoEarnings /= difficulty;

      // Calculate total for all owned miners
      totalCryptoEarningsForType = singleMinerCryptoEarnings * owned;
    }

    // Keep dollar calculation for backward compatibility (not displayed)
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



              <Text style={[styles.healthText, isDarkMode && styles.healthTextDark]}>



                {Math.round(miner.durability)}% Health



              </Text>



            </View>



          </View>



          



          <View style={styles.minerStats}>



            <View style={styles.minerStat}>



              <Coins size={16} color="#10B981" />



              <Text style={[styles.minerStatText, isDarkMode && styles.minerStatTextDark]}>



                {hasMiningTarget && selectedCryptoData ? (
                  owned > 0 
                    ? `${formatCrypto(totalCryptoEarningsForType)} ${cryptoSymbol}/week`
                    : `${formatCrypto(singleMinerCryptoEarnings)} ${cryptoSymbol}/week`
                ) : (
                  'Select crypto to mine'
                )}



              </Text>



            </View>



            <View style={styles.minerStat}>



              <Zap size={16} color="#F59E0B" />



              <Text style={[styles.minerStatText, isDarkMode && styles.minerStatTextDark]}>



                {miner.powerConsumption}W



              </Text>



            </View>



          </View>



          



          {hasWarehouse ? (



            <View style={styles.minerActionsContainer}>



              {/* Repair button - show on its own row if needed */}



              {owned > 0 && miner.durability < 50 && (



                <TouchableOpacity



                  style={styles.repairMinerButtonFullWidth}



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



              {/* Sell and Buy buttons - always side by side when owned, or just buy when not owned */}



              <View style={styles.minerActions}>



                {owned > 0 && (



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



                      <View style={styles.minerButtonContent}>



                        <Minus size={18} color="#FFFFFF" />



                        <Text style={styles.sellMinerButtonText}>



                          Sell {formatMoney(Math.floor(miner.price * 0.5))}



                        </Text>



                      </View>



                    </LinearGradient>



                  </TouchableOpacity>



                )}



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



                    <View style={styles.minerButtonContent}>



                      <Plus size={18} color="#FFFFFF" />



                      <Text style={styles.buyMinerButtonText}>



                        {canAfford ? 'Purchase Miner' : 'Insufficient Funds'}



                      </Text>



                    </View>



                  </LinearGradient>



                </TouchableOpacity>



              </View>



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



        'Auto-repair technicians will automatically maintain your miners to prevent breakdowns and lost earnings.\n\n' +



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



        'Auto-repair technicians are paid in the cryptocurrency you are mining.\n\n' +



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



        `How to get more ${selectedCrypto.symbol}:\n` +



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



    try {



      if (warehouse) {



        // Update warehouse selectedCrypto directly



        setGameState(prev => ({



          ...prev,



          warehouse: prev.warehouse ? {



            ...prev.warehouse,



            selectedCrypto: cryptoId,



          } : undefined,



        }));



        saveGame();



        success(`Selected ${cryptoId.toUpperCase()} for mining`);



      } else {



        // Use company mining crypto selection



        if (selectMiningCrypto) {



          selectMiningCrypto(cryptoId);



        } else {



          logger.warn('selectMiningCrypto not available');



        }



      }



    } catch (error) {



      logger.error('Error selecting crypto:', error);



      Alert.alert('Error', 'Failed to select cryptocurrency. Please try again.');



    }



  }, [warehouse, selectMiningCrypto, setGameState, saveGame, success]);















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



                    ~ {formatMoney(totalWeeklyEarnings)}



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



                <Text style={styles.miningEarningsUpgradeText}> Warehouse Level: {warehouse?.level || 0} (Max: {10 + (warehouse?.level || 0) * 5} miners)



                </Text>



                <Text style={styles.miningEarningsUpgradeText}>



                  Upgrade warehouse to store more miners and increase earnings!



                </Text>



                {warehouse?.autoRepairEnabled && (



                  <View style={styles.autoRepairStatus}>



                    <CheckCircle size={16} color="#10B981" />



                    <Text style={[styles.miningEarningsUpgradeText, { color: '#10B981' }]}>



                      Auto-Repair Active - Miners automatically maintained



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

  // Render function for Upgrades tab
  const renderUpgradesTab = useCallback(() => {
    if (!warehouse) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            You need a warehouse to access upgrades
          </Text>
        </View>
      );
    }

    const upgradeCategories = Object.keys(MiningActions.MINER_UPGRADE_DEFINITIONS);
    const ownedMiners = miners.filter(m => m.owned > 0);
    
    if (ownedMiners.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            Buy miners first to unlock upgrades
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.upgradesContainer}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Miner Upgrades
        </Text>
        <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
          Enhance your miners with powerful upgrades
        </Text>

        {ownedMiners.map(miner => {
          const minerUpgrades = warehouse.upgrades?.filter(u => u.minerId === miner.id) || [];
          
          return (
            <View key={miner.id} style={[styles.minerUpgradeSection, isDarkMode && styles.minerUpgradeSectionDark]}>
              <Text style={[styles.minerUpgradeTitle, isDarkMode && styles.minerUpgradeTitleDark]}>
                {miner.name} ({miner.owned} owned)
              </Text>
              
              {upgradeCategories.map(category => {
                const categoryUpgrades = MiningActions.MINER_UPGRADE_DEFINITIONS[category] || [];
                return categoryUpgrades.map(upgradeDef => {
                  const existingUpgrade = minerUpgrades.find(u => u.id === upgradeDef.id);
                  const currentLevel = existingUpgrade?.level || 0;
                  const canUpgrade = currentLevel < upgradeDef.maxLevel;
                  
                  const costMultiplier = 1.5;
                  const nextLevelCost = currentLevel === 0
                    ? upgradeDef.baseCost
                    : Math.round(upgradeDef.baseCost * Math.pow(costMultiplier, currentLevel));
                  
                  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && 
                    isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 
                    ? gameState.economy.priceIndex 
                    : 1;
                  const cost = getInflatedPrice(nextLevelCost, priceIndex);
                  const canAfford = money >= cost;

                  return (
                    <View key={upgradeDef.id} style={[styles.upgradeCard, isDarkMode && styles.upgradeCardDark]}>
                      <View style={styles.upgradeHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.upgradeName, isDarkMode && styles.upgradeNameDark]}>
                            {upgradeDef.name}
                          </Text>
                          <Text style={[styles.upgradeDescription, isDarkMode && styles.upgradeDescriptionDark]}>
                            {upgradeDef.description}
                          </Text>
                          <Text style={[styles.upgradeLevel, isDarkMode && styles.upgradeLevelDark]}>
                            Level: {currentLevel}/{upgradeDef.maxLevel}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.upgradeButton, (!canAfford || !canUpgrade) && styles.upgradeButtonDisabled]}
                          onPress={() => {
                            if (canAfford && canUpgrade) {
                              const result = buyMinerUpgrade(upgradeDef.id, miner.id);
                              if (result.success) {
                                success();
                              }
                            }
                          }}
                          disabled={!canAfford || !canUpgrade}
                        >
                          <LinearGradient
                            colors={canAfford && canUpgrade ? ['#8B5CF6', '#7C3AED'] : ['#6B7280', '#4B5563']}
                            style={styles.upgradeButtonGradient}
                          >
                            <Text style={styles.upgradeButtonText}>
                              {!canUpgrade ? 'Max Level' : formatMoney(cost)}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                });
              })}
            </View>
          );
        })}
      </ScrollView>
    );
  }, [warehouse, miners, money, isDarkMode, buyMinerUpgrade, success, gameState.economy?.priceIndex]);

  // Render function for Pools tab
  const renderPoolsTab = useCallback(() => {
    if (!warehouse || !warehouse.selectedCrypto) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            Select a cryptocurrency to mine first
          </Text>
        </View>
      );
    }

    const availablePools = MiningActions.MINING_POOLS.filter(p => p.cryptoId === warehouse.selectedCrypto);
    const activePoolId = warehouse.activePool;
    const activePool = activePoolId ? availablePools.find(p => p.id === activePoolId) : null;

    return (
      <ScrollView style={styles.poolsContainer}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Mining Pools
        </Text>
        <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
          Join pools to boost your mining earnings with bonuses
        </Text>

        {activePool && (
          <View style={[styles.activePoolCard, isDarkMode && styles.activePoolCardDark]}>
            <View style={styles.activePoolHeader}>
              <CheckCircle size={24} color="#10B981" />
              <Text style={[styles.activePoolTitle, isDarkMode && styles.activePoolTitleDark]}>
                Active Pool: {activePool.name}
              </Text>
            </View>
            <Text style={[styles.activePoolInfo, isDarkMode && styles.activePoolInfoDark]}>
              Bonus: +{((activePool.bonusMultiplier - 1) * 100).toFixed(0)}% | Fee: {(activePool.fee * 100).toFixed(0)}%
            </Text>
            <TouchableOpacity
              style={styles.leavePoolButton}
              onPress={() => {
                const result = leaveMiningPool();
                if (result.success) {
                  success();
                }
              }}
            >
              <Text style={styles.leavePoolButtonText}>Leave Pool</Text>
            </TouchableOpacity>
          </View>
        )}

        {availablePools.map(pool => {
          const isJoined = pool.id === activePoolId;
          
          return (
            <View key={pool.id} style={[styles.poolCard, isDarkMode && styles.poolCardDark]}>
              <View style={styles.poolHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.poolName, isDarkMode && styles.poolNameDark]}>
                    {pool.name}
                  </Text>
                  <View style={styles.poolStats}>
                    <View style={styles.poolStat}>
                      <TrendingUp size={16} color="#10B981" />
                      <Text style={[styles.poolStatText, isDarkMode && styles.poolStatTextDark]}>
                        +{((pool.bonusMultiplier - 1) * 100).toFixed(0)}% Bonus
                      </Text>
                    </View>
                    <View style={styles.poolStat}>
                      <DollarSign size={16} color="#F59E0B" />
                      <Text style={[styles.poolStatText, isDarkMode && styles.poolStatTextDark]}>
                        {(pool.fee * 100).toFixed(0)}% Fee
                      </Text>
                    </View>
                  </View>
                </View>
                {!isJoined && (
                  <TouchableOpacity
                    style={styles.joinPoolButton}
                    onPress={() => {
                      const result = joinMiningPool(pool.id);
                      if (result.success) {
                        success();
                      }
                    }}
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      style={styles.joinPoolButtonGradient}
                    >
                      <Text style={styles.joinPoolButtonText}>Join</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {availablePools.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
              No pools available for selected crypto
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }, [warehouse, isDarkMode, joinMiningPool, leaveMiningPool, success]);

  // Render function for Staking tab
  const renderStakingTab = useCallback(() => {
    if (!warehouse) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            You need a warehouse to stake crypto
          </Text>
        </View>
      );
    }

    const stakingPositions = warehouse.stakingPositions || [];
    const selectedCryptoForStaking = cryptos.find(c => c.id === stakeCryptoId);

    return (
      <>
        <ScrollView style={styles.stakingContainer}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Crypto Staking
          </Text>
          <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
            Lock your crypto to earn passive rewards
          </Text>

          <TouchableOpacity
            style={[styles.stakeButton, isDarkMode && styles.stakeButtonDark]}
            onPress={() => setShowStakeModal(true)}
          >
            <LinearGradient
              colors={['#EC4899', '#DB2777']}
              style={styles.stakeButtonGradient}
            >
              <Lock size={20} color="#FFFFFF" />
              <Text style={styles.stakeButtonText}>Stake Crypto</Text>
            </LinearGradient>
          </TouchableOpacity>

          {stakingPositions.length > 0 && (
            <TouchableOpacity
              style={[styles.claimButton, isDarkMode && styles.claimButtonDark]}
              onPress={() => {
                const result = claimStakingRewards();
                if (result.success) {
                  success();
                }
              }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.claimButtonGradient}
              >
                <Award size={20} color="#FFFFFF" />
                <Text style={styles.claimButtonText}>Claim Rewards</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {stakingPositions.map((position, index) => {
            const crypto = cryptos.find(c => c.id === position.cryptoId);
            const absoluteWeek = gameState.weeksLived || 0;
            const startAbsoluteWeek = position.startAbsoluteWeek
              ?? Math.max(0, absoluteWeek - ((gameState.week - position.startWeek + 4) % 4));
            const weeksPassed = Math.max(0, absoluteWeek - startAbsoluteWeek);
            const weeksRemaining = Math.max(0, position.lockWeeks - weeksPassed);
            const weeklyReward = position.amount * position.rewardRate;
            const accumulatedRewards = weeklyReward * Math.max(0, weeksPassed);
            const isReady = weeksRemaining === 0;

            return (
              <View key={index} style={[styles.stakingPositionCard, isDarkMode && styles.stakingPositionCardDark]}>
                <View style={styles.stakingPositionHeader}>
                  <View style={styles.stakingPositionHeaderLeft}>
                    <Coins size={20} color={isReady ? '#10B981' : '#EC4899'} />
                    <Text style={[styles.stakingPositionCrypto, isDarkMode && styles.stakingPositionCryptoDark]}>
                      {crypto?.symbol.toUpperCase() || position.cryptoId}
                    </Text>
                  </View>
                  {weeksRemaining > 0 ? (
                    <View style={[styles.stakingPositionStatusBadge, styles.stakingPositionStatusLocked]}>
                      <Text style={styles.stakingPositionStatusText}>
                        {weeksRemaining} week{weeksRemaining > 1 ? 's' : ''} left
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.stakingPositionStatusBadge, styles.stakingPositionStatusReady]}>
                      <Text style={styles.stakingPositionStatusText}>
                        Ready
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.stakingPositionDetails}>
                  <View style={styles.stakingPositionDetailRow}>
                    <Text style={[styles.stakingPositionDetailLabel, isDarkMode && styles.stakingPositionDetailLabelDark]}>
                      Staked Amount:
                    </Text>
                    <Text style={[styles.stakingPositionDetailValue, isDarkMode && styles.stakingPositionDetailValueDark]}>
                      {formatCrypto(position.amount)} {crypto?.symbol.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.stakingPositionDetailRow}>
                    <Text style={[styles.stakingPositionDetailLabel, isDarkMode && styles.stakingPositionDetailLabelDark]}>
                      Weekly Reward:
                    </Text>
                    <Text style={[styles.stakingPositionDetailValue, styles.stakingPositionRewardValue, isDarkMode && styles.stakingPositionRewardValueDark]}>
                      {formatCrypto(weeklyReward)} {crypto?.symbol.toUpperCase()} ({(position.rewardRate * 100).toFixed(0)}%)
                    </Text>
                  </View>
                  {weeksPassed > 0 && (
                    <View style={styles.stakingPositionDetailRow}>
                      <Text style={[styles.stakingPositionDetailLabel, isDarkMode && styles.stakingPositionDetailLabelDark]}>
                        Accumulated:
                      </Text>
                      <Text style={[styles.stakingPositionDetailValue, styles.stakingPositionAccumulatedValue, isDarkMode && styles.stakingPositionAccumulatedValueDark]}>
                        {formatCrypto(accumulatedRewards)} {crypto?.symbol.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {stakingPositions.length === 0 && (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
                No active staking positions. Tap "Stake Crypto" to start earning rewards.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Stake Modal - Redesigned */}
        <Modal visible={showStakeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.stakingModalContent, isDarkMode && styles.stakingModalContentDark]}>
              {/* Header */}
              <View style={styles.stakingModalHeader}>
                <View style={styles.stakingModalHeaderLeft}>
                  <Coins size={28} color="#EC4899" />
                  <Text style={[styles.stakingModalTitle, isDarkMode && styles.stakingModalTitleDark]}>
                    Stake Crypto
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setShowStakeModal(false);
                    setStakeAmount('');
                    setStakeCryptoId('');
                    setLockWeeks(1);
                  }}
                  style={styles.stakingModalCloseButton}
                >
                  <X size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.stakingModalScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.stakingModalScrollContent}
              >
                {/* Crypto Selection */}
                <View style={styles.stakingSection}>
                  <Text style={[styles.stakingSectionTitle, isDarkMode && styles.stakingSectionTitleDark]}>
                    Select Crypto
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.stakingCryptoSelector}
                    contentContainerStyle={styles.stakingCryptoSelectorContent}
                  >
                    {cryptos.map(crypto => {
                      const hasBalance = crypto.owned > 0;
                      const isSelected = stakeCryptoId === crypto.id;
                      return (
                        <TouchableOpacity
                          key={crypto.id}
                          style={[
                            styles.stakingCryptoCard,
                            isSelected && styles.stakingCryptoCardActive,
                            !hasBalance && styles.stakingCryptoCardDisabled,
                            isDarkMode && styles.stakingCryptoCardDark,
                            isSelected && isDarkMode && styles.stakingCryptoCardActiveDark
                          ]}
                          onPress={() => {
                            if (hasBalance) {
                              setStakeCryptoId(crypto.id);
                              setStakeAmount('');
                            } else {
                              Alert.alert('No Balance', `You don't have any ${crypto.symbol.toUpperCase()}. Buy some in the Market tab first.`);
                            }
                          }}
                        >
                          <Text style={[
                            styles.stakingCryptoSymbol,
                            isSelected && styles.stakingCryptoSymbolActive,
                            isDarkMode && styles.stakingCryptoSymbolDark,
                            isSelected && isDarkMode && styles.stakingCryptoSymbolActiveDark
                          ]}>
                            {crypto.symbol.toUpperCase()}
                          </Text>
                          {hasBalance ? (
                            <Text style={[
                              styles.stakingCryptoBalance,
                              isSelected && styles.stakingCryptoBalanceActive,
                              isDarkMode && styles.stakingCryptoBalanceDark
                            ]}>
                              {formatCrypto(crypto.owned)}
                            </Text>
                          ) : (
                            <Text style={[styles.stakingCryptoNoBalance, isDarkMode && styles.stakingCryptoNoBalanceDark]}>
                              No balance
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {selectedCryptoForStaking && (
                  <>
                    {/* Amount Input */}
                    <View style={styles.stakingSection}>
                      <View style={styles.stakingAmountHeader}>
                        <Text style={[styles.stakingSectionTitle, isDarkMode && styles.stakingSectionTitleDark]}>
                          Amount to Stake
                        </Text>
                        <TouchableOpacity
                          onPress={() => setStakeAmount(selectedCryptoForStaking.owned.toString())}
                          style={styles.stakingMaxButton}
                        >
                          <Text style={styles.stakingMaxButtonText}>MAX</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.stakingAmountInputContainer, isDarkMode && styles.stakingAmountInputContainerDark]}>
                        <TextInput
                          style={[styles.stakingAmountInput, isDarkMode && styles.stakingAmountInputDark]}
                          value={stakeAmount}
                          onChangeText={(text) => {
                            // Allow only numbers and decimal point
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            // Prevent multiple decimal points
                            const parts = cleaned.split('.');
                            if (parts.length > 2) {
                              setStakeAmount(parts[0] + '.' + parts.slice(1).join(''));
                            } else {
                              setStakeAmount(cleaned);
                            }
                          }}
                          placeholder="0.000000"
                          placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                          keyboardType="numeric"
                        />
                        <Text style={[styles.stakingAmountSymbol, isDarkMode && styles.stakingAmountSymbolDark]}>
                          {selectedCryptoForStaking.symbol.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.stakingAmountHint, isDarkMode && styles.stakingAmountHintDark]}>
                        Available: {formatCrypto(selectedCryptoForStaking.owned)} {selectedCryptoForStaking.symbol.toUpperCase()}
                      </Text>
                    </View>

                    {/* Lock Period Selection */}
                    <View style={styles.stakingSection}>
                      <Text style={[styles.stakingSectionTitle, isDarkMode && styles.stakingSectionTitleDark]}>
                        Lock Period
                      </Text>
                      <Text style={[styles.stakingSectionSubtitle, isDarkMode && styles.stakingSectionSubtitleDark]}>
                        Longer lock periods earn higher weekly rewards
                      </Text>
                      <View style={styles.stakingLockPeriodGrid}>
                        {[1, 2, 3, 4].map(weeks => {
                          const rewardRate = weeks === 1 ? 0.02 : weeks === 2 ? 0.03 : weeks === 3 ? 0.04 : 0.05;
                          const isSelected = lockWeeks === weeks;
                          const amount = parseFloat(stakeAmount) || 0;
                          const weeklyReward = amount * rewardRate;
                          const totalReward = weeklyReward * weeks;
                          
                          return (
                            <TouchableOpacity
                              key={weeks}
                              style={[
                                styles.stakingLockPeriodCard,
                                isSelected && styles.stakingLockPeriodCardActive,
                                isDarkMode && styles.stakingLockPeriodCardDark,
                                isSelected && isDarkMode && styles.stakingLockPeriodCardActiveDark
                              ]}
                              onPress={() => setLockWeeks(weeks)}
                            >
                              <View style={styles.stakingLockPeriodContent}>
                                <Text style={[
                                  styles.stakingLockPeriodWeeks,
                                  isSelected && styles.stakingLockPeriodWeeksActive,
                                  isDarkMode && styles.stakingLockPeriodWeeksDark
                                ]}>
                                  {weeks} Week{weeks > 1 ? 's' : ''}
                                </Text>
                                <Text style={[
                                  styles.stakingLockPeriodRewardRate,
                                  isSelected && styles.stakingLockPeriodRewardRateActive,
                                  isDarkMode && styles.stakingLockPeriodRewardRateDark
                                ]}>
                                  {(rewardRate * 100).toFixed(0)}% per week
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Expected Returns */}
                    {parseFloat(stakeAmount) > 0 && (
                      <View style={[styles.stakingReturnsCard, isDarkMode && styles.stakingReturnsCardDark]}>
                        <Text style={[styles.stakingReturnsTitle, isDarkMode && styles.stakingReturnsTitleDark]}>
                          Expected Returns
                        </Text>
                        <View style={styles.stakingReturnsRow}>
                          <Text style={[styles.stakingReturnsLabel, isDarkMode && styles.stakingReturnsLabelDark]}>
                            Weekly Reward:
                          </Text>
                          <Text style={[styles.stakingReturnsValue, isDarkMode && styles.stakingReturnsValueDark]}>
                            {formatCrypto((parseFloat(stakeAmount) || 0) * (lockWeeks === 1 ? 0.02 : lockWeeks === 2 ? 0.03 : lockWeeks === 3 ? 0.04 : 0.05))} {selectedCryptoForStaking.symbol.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.stakingReturnsRow}>
                          <Text style={[styles.stakingReturnsLabel, isDarkMode && styles.stakingReturnsLabelDark]}>
                            Total After {lockWeeks} Week{lockWeeks > 1 ? 's' : ''}:
                          </Text>
                          <Text style={[styles.stakingReturnsValue, isDarkMode && styles.stakingReturnsValueDark]}>
                            {formatCrypto((parseFloat(stakeAmount) || 0) * (1 + (lockWeeks === 1 ? 0.02 : lockWeeks === 2 ? 0.03 : lockWeeks === 3 ? 0.04 : 0.05) * lockWeeks))} {selectedCryptoForStaking.symbol.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Stake Button */}
                    <TouchableOpacity
                      style={styles.stakingConfirmButton}
                      onPress={() => {
                        const amount = parseFloat(stakeAmount);
                        if (amount <= 0) {
                          Alert.alert('Invalid Amount', 'Please enter a valid amount to stake.');
                          return;
                        }
                        if (amount > selectedCryptoForStaking.owned) {
                          Alert.alert('Insufficient Balance', `You only have ${formatCrypto(selectedCryptoForStaking.owned)} ${selectedCryptoForStaking.symbol.toUpperCase()}.`);
                          return;
                        }
                        if (!stakeCryptoId) {
                          Alert.alert('Select Crypto', 'Please select a crypto to stake.');
                          return;
                        }
                        const result = stakeCrypto(stakeCryptoId, amount, lockWeeks);
                        if (result.success) {
                          setShowStakeModal(false);
                          setStakeAmount('');
                          setStakeCryptoId('');
                          setLockWeeks(1);
                          success();
                        }
                      }}
                      disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || parseFloat(stakeAmount) > (selectedCryptoForStaking?.owned || 0)}
                    >
                      <LinearGradient
                        colors={
                          (!stakeAmount || parseFloat(stakeAmount) <= 0 || parseFloat(stakeAmount) > (selectedCryptoForStaking?.owned || 0))
                            ? ['#6B7280', '#4B5563']
                            : ['#EC4899', '#DB2777']
                        }
                        style={styles.stakingConfirmButtonGradient}
                      >
                        <Lock size={20} color="#FFFFFF" />
                        <Text style={styles.stakingConfirmButtonText}>
                          Stake {stakeAmount ? formatCrypto(parseFloat(stakeAmount)) : '0'} {selectedCryptoForStaking.symbol.toUpperCase()}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  }, [warehouse, cryptos, isDarkMode, stakeCrypto, claimStakingRewards, success, gameState.week, gameState.weeksLived, stakeCryptoId, stakeAmount, lockWeeks, showStakeModal]);

  // Render function for Statistics tab
  const renderStatisticsTab = useCallback(() => {
    if (!warehouse || !warehouse.statistics) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            Statistics will appear after you start mining
          </Text>
        </View>
      );
    }

    const stats = warehouse.statistics;
    const totalCryptoValue = Object.entries(stats.totalCryptoMined || {}).reduce((sum, [cryptoId, amount]) => {
      const crypto = cryptos.find(c => c.id === cryptoId);
      return sum + (amount * (crypto?.price || 0));
    }, 0);
    const netValue = totalCryptoValue - stats.totalPowerCost;
    const bestCrypto = Object.entries(stats.totalCryptoMined || {})
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    return (
      <ScrollView style={styles.statisticsContainer}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Mining Statistics
        </Text>

        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Total Crypto Value</Text>
          <Text style={styles.statValue}>{formatMoney(totalCryptoValue)}</Text>
          <Text style={[styles.statSubtext, isDarkMode && styles.statSubtextDark]}>
            Combined value of all mined crypto
          </Text>
        </View>

        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Total Power Cost</Text>
          <Text style={styles.statValue}>{formatMoney(stats.totalPowerCost)}</Text>
        </View>

        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Net Profit</Text>
          <Text style={[styles.statValue, netValue >= 0 ? styles.statValuePositive : styles.statValueNegative]}>
            {formatMoney(netValue)}
          </Text>
        </View>

        {bestCrypto && (
          <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
            <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Best Performing Crypto</Text>
            <Text style={styles.statValue}>
              {cryptos.find(c => c.id === bestCrypto)?.symbol.toUpperCase() || bestCrypto}
            </Text>
            <Text style={[styles.statSubtext, isDarkMode && styles.statSubtextDark]}>
              {stats.totalCryptoMined[bestCrypto].toFixed(6)} mined
            </Text>
          </View>
        )}

        <Text style={[styles.sectionSubtitle, isDarkMode && styles.sectionSubtitleDark]}>
          Crypto Mined (Total)
        </Text>
        {Object.keys(stats.totalCryptoMined || {}).length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
              No crypto mined yet. Start mining to see statistics.
            </Text>
          </View>
        ) : (
          Object.entries(stats.totalCryptoMined || {}).map(([cryptoId, amount]) => {
            const crypto = cryptos.find(c => c.id === cryptoId);
            const value = amount * (crypto?.price || 0);
            return (
              <View key={cryptoId} style={[styles.cryptoStatCard, isDarkMode && styles.cryptoStatCardDark]}>
                <View style={styles.cryptoStatHeader}>
                  <Text style={[styles.cryptoStatSymbol, isDarkMode && styles.cryptoStatSymbolDark]}>
                    {crypto?.symbol.toUpperCase() || cryptoId}
                  </Text>
                  <Text style={[styles.cryptoStatAmount, isDarkMode && styles.cryptoStatAmountDark]}>
                    {amount.toFixed(6)}
                  </Text>
                </View>
                <Text style={[styles.statSubtext, isDarkMode && styles.statSubtextDark]}>
                  ≈ {formatMoney(value)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }, [warehouse, cryptos, isDarkMode, formatMoney]);

  // Render function for Energy tab
  const renderEnergyTab = useCallback(() => {
    if (!warehouse) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            You need a warehouse to manage energy
          </Text>
        </View>
      );
    }

    const currentEnergyType = warehouse.energyType || 'standard';
    const energyEfficiency = warehouse.energyEfficiency || 0;

    return (
      <ScrollView style={styles.energyContainer}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Energy Management
        </Text>
        <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
          Reduce power costs with renewable energy systems
        </Text>

        <View style={[styles.currentEnergyCard, isDarkMode && styles.currentEnergyCardDark]}>
          <Text style={[styles.currentEnergyLabel, isDarkMode && styles.currentEnergyLabelDark]}>
            Current System
          </Text>
          <Text style={[styles.currentEnergyType, isDarkMode && styles.currentEnergyTypeDark]}>
            {MiningActions.ENERGY_TYPES[currentEnergyType]?.name || 'Standard Grid'}
          </Text>
          {energyEfficiency > 0 && (
            <Text style={[styles.currentEnergyEfficiency, isDarkMode && styles.currentEnergyEfficiencyDark]}>
              Power Cost Reduction: {(energyEfficiency * 100).toFixed(0)}%
            </Text>
          )}
        </View>

        {Object.entries(MiningActions.ENERGY_TYPES).filter(([key]) => key !== 'standard').map(([key, energy]) => {
          const priceIndex = typeof gameState.economy?.priceIndex === 'number' && 
            isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 
            ? gameState.economy.priceIndex 
            : 1;
          const cost = getInflatedPrice(energy.cost, priceIndex);
          const canAfford = money >= cost;
          const isCurrent = currentEnergyType === key;

          return (
            <View key={key} style={[styles.energyCard, isDarkMode && styles.energyCardDark]}>
              <View style={styles.energyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.energyName, isDarkMode && styles.energyNameDark]}>
                    {energy.name}
                  </Text>
                  <Text style={[styles.energyDescription, isDarkMode && styles.energyDescriptionDark]}>
                    Reduces power costs by {(energy.efficiency * 100).toFixed(0)}%
                  </Text>
                </View>
                {isCurrent ? (
                  <CheckCircle size={24} color="#10B981" />
                ) : (
                  <TouchableOpacity
                    style={[styles.energyUpgradeButton, !canAfford && styles.energyUpgradeButtonDisabled]}
                    onPress={() => {
                      if (canAfford) {
                        const result = upgradeEnergySystem(key as 'solar' | 'wind' | 'hybrid');
                        if (result.success) {
                          success();
                        }
                      }
                    }}
                    disabled={!canAfford}
                  >
                    <LinearGradient
                      colors={canAfford ? ['#F59E0B', '#D97706'] : ['#6B7280', '#4B5563']}
                      style={styles.energyUpgradeButtonGradient}
                    >
                      <Text style={styles.energyUpgradeButtonText}>
                        {formatMoney(cost)}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }, [warehouse, money, isDarkMode, upgradeEnergySystem, success, gameState.economy?.priceIndex]);

  // Render function for Automation tab
  const renderAutomationTab = useCallback(() => {
    if (!warehouse) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
            You need a warehouse to manage automation
          </Text>
        </View>
      );
    }

    const automationLevel = warehouse.automationLevel || 0;
    const maxLevel = 5;
    const automationBonus = automationLevel * 0.02; // 2% per level

    const baseCost = 25000;
    const costMultiplier = 1.8;
    const nextLevelCost = Math.round(baseCost * Math.pow(costMultiplier, automationLevel));
    
    const priceIndex = typeof gameState.economy?.priceIndex === 'number' && 
      isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 
      ? gameState.economy.priceIndex 
      : 1;
    const cost = getInflatedPrice(nextLevelCost, priceIndex);
    const canAfford = money >= cost;
    const canUpgrade = automationLevel < maxLevel;

    return (
      <ScrollView style={styles.automationContainer}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          Automation System
        </Text>
        <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
          Increase mining efficiency with automation upgrades
        </Text>

        <View style={[styles.automationCard, isDarkMode && styles.automationCardDark]}>
          <View style={styles.automationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.automationLevel, isDarkMode && styles.automationLevelDark]}>
                Level {automationLevel}/{maxLevel}
              </Text>
              <Text style={[styles.automationBonus, isDarkMode && styles.automationBonusDark]}>
                Mining Efficiency Bonus: +{(automationBonus * 100).toFixed(0)}%
              </Text>
            </View>
            {canUpgrade && (
              <TouchableOpacity
                style={[styles.automationUpgradeButton, !canAfford && styles.automationUpgradeButtonDisabled]}
                onPress={() => {
                  if (canAfford) {
                    const result = upgradeAutomation();
                    if (result.success) {
                      success();
                    }
                  }
                }}
                disabled={!canAfford}
              >
                <LinearGradient
                  colors={canAfford ? ['#10B981', '#059669'] : ['#6B7280', '#4B5563']}
                  style={styles.automationUpgradeButtonGradient}
                >
                  <Settings size={20} color="#FFFFFF" />
                  <Text style={styles.automationUpgradeButtonText}>
                    Upgrade ({formatMoney(cost)})
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          {!canUpgrade && (
            <Text style={[styles.automationMaxLevel, isDarkMode && styles.automationMaxLevelDark]}>
              Maximum automation level reached
            </Text>
          )}
        </View>
      </ScrollView>
    );
  }, [warehouse, money, isDarkMode, upgradeAutomation, success, gameState.economy?.priceIndex]);







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







        <View style={styles.tabsWrapper}>
          <View style={styles.tabScrollHint}>
            <ChevronLeft size={16} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.tabScrollHintText, isDarkMode && styles.tabScrollHintTextDark]}>
              Scroll for more tabs
            </Text>
            <ChevronRight size={16} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabScrollContainer}
            contentContainerStyle={styles.tabContainer}
          >
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
              <Text style={styles.tabText}>Hardware</Text>
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
              <Text style={styles.tabText}>Market</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'upgrades' && styles.activeTab]}
            onPress={() => setActiveTab('upgrades')}
          >
            <LinearGradient
              colors={activeTab === 'upgrades' ? ['#8B5CF6', '#7C3AED', '#6D28D9'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <TrendingUp size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Upgrades</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'pools' && styles.activeTab]}
            onPress={() => setActiveTab('pools')}
          >
            <LinearGradient
              colors={activeTab === 'pools' ? ['#3B82F6', '#2563EB', '#1D4ED8'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Users size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Pools</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'staking' && styles.activeTab]}
            onPress={() => setActiveTab('staking')}
          >
            <LinearGradient
              colors={activeTab === 'staking' ? ['#EC4899', '#DB2777', '#BE185D'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Lock size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Staking</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'statistics' && styles.activeTab]}
            onPress={() => setActiveTab('statistics')}
          >
            <LinearGradient
              colors={activeTab === 'statistics' ? ['#06B6D4', '#0891B2', '#0E7490'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <BarChart3 size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Stats</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'energy' && styles.activeTab]}
            onPress={() => setActiveTab('energy')}
          >
            <LinearGradient
              colors={activeTab === 'energy' ? ['#F59E0B', '#D97706', '#B45309'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Sun size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Energy</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'automation' && styles.activeTab]}
            onPress={() => setActiveTab('automation')}
          >
            <LinearGradient
              colors={activeTab === 'automation' ? ['#10B981', '#059669', '#047857'] : ['#374151', '#1F2937', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Settings size={18} color="#FFFFFF" />
              <Text style={styles.tabText}>Auto</Text>
            </LinearGradient>
          </TouchableOpacity>
          </ScrollView>
        </View>







        <View style={styles.itemsContainer}>
          {activeTab === 'miners' ? (
            <>
              {renderMiningSelection()}
              {miners.map(renderMinerCard)}
            </>
          ) : activeTab === 'crypto' ? (
            cryptos.map(renderCryptoCard)
          ) : activeTab === 'upgrades' ? (
            renderUpgradesTab()
          ) : activeTab === 'pools' ? (
            renderPoolsTab()
          ) : activeTab === 'staking' ? (
            renderStakingTab()
          ) : activeTab === 'statistics' ? (
            renderStatisticsTab()
          ) : activeTab === 'energy' ? (
            renderEnergyTab()
          ) : activeTab === 'automation' ? (
            renderAutomationTab()
          ) : null}
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



          <View style={[styles.autoRepairModalContent, isDarkMode && styles.autoRepairModalContentDark]}>
            {/* Header */}
            <View style={styles.autoRepairModalHeader}>
              <View style={styles.autoRepairModalHeaderLeft}>
                <Users size={28} color="#3B82F6" />
                <Text style={[styles.autoRepairModalTitle, isDarkMode && styles.autoRepairModalTitleDark]}>
                  Auto-Repair Technician
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowAutoRepairModal(false)}
                style={styles.autoRepairModalCloseButton}
              >
                <X size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.autoRepairModalScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.autoRepairModalScrollContent}
            >
              {/* Description */}
              <View style={styles.autoRepairSection}>
                <Text style={[styles.autoRepairDescription, isDarkMode && styles.autoRepairDescriptionDark]}>
                  Hire a professional technician to automatically maintain your miners. They'll repair any miner that drops below 50% health, keeping your operation running smoothly.
                </Text>
              </View>

              {/* Benefits */}
              <View style={styles.autoRepairSection}>
                <Text style={[styles.autoRepairSectionTitle, isDarkMode && styles.autoRepairSectionTitleDark]}>
                  Benefits
                </Text>
                <View style={styles.autoRepairBenefitsList}>
                  {[
                    { icon: CheckCircle, text: 'Automatic repairs when health < 50%', color: '#10B981' },
                    { icon: Activity, text: 'Maintains maximum mining efficiency', color: '#3B82F6' },
                    { icon: Zap, text: 'No manual intervention needed', color: '#F59E0B' },
                    { icon: Coins, text: 'Payment in your mined cryptocurrency', color: '#EC4899' },
                  ].map((benefit, index) => {
                    const IconComponent = benefit.icon;
                    return (
                      <View key={index} style={styles.autoRepairBenefitItem}>
                        <IconComponent size={20} color={benefit.color} />
                        <Text style={[styles.autoRepairBenefitText, isDarkMode && styles.autoRepairBenefitTextDark]}>
                          {benefit.text}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Cost Information */}
              {(() => {
                const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
                const weeklyCryptoCost = selectedCrypto ? 5000 / selectedCrypto.price : 0;
                const hasEnoughCrypto = selectedCrypto && selectedCrypto.owned >= weeklyCryptoCost;

                return (
                  <View style={styles.autoRepairSection}>
                    <Text style={[styles.autoRepairSectionTitle, isDarkMode && styles.autoRepairSectionTitleDark]}>
                      Weekly Cost
                    </Text>
                    {selectedCrypto ? (
                      <View style={[styles.autoRepairCostCard, isDarkMode && styles.autoRepairCostCardDark]}>
                        <View style={styles.autoRepairCostRow}>
                          <Text style={[styles.autoRepairCostLabel, isDarkMode && styles.autoRepairCostLabelDark]}>
                            Amount:
                          </Text>
                          <Text style={[styles.autoRepairCostValue, isDarkMode && styles.autoRepairCostValueDark]}>
                            {formatCrypto(weeklyCryptoCost)} {selectedCrypto.symbol.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.autoRepairCostRow}>
                          <Text style={[styles.autoRepairCostLabel, isDarkMode && styles.autoRepairCostLabelDark]}>
                            Value:
                          </Text>
                          <Text style={[styles.autoRepairCostValue, isDarkMode && styles.autoRepairCostValueDark]}>
                            $5,000/week
                          </Text>
                        </View>
                        <View style={styles.autoRepairCostRow}>
                          <Text style={[styles.autoRepairCostLabel, isDarkMode && styles.autoRepairCostLabelDark]}>
                            Your Balance:
                          </Text>
                          <Text style={[
                            styles.autoRepairCostValue,
                            hasEnoughCrypto ? styles.autoRepairCostValueSuccess : styles.autoRepairCostValueError,
                            isDarkMode && (hasEnoughCrypto ? styles.autoRepairCostValueSuccessDark : styles.autoRepairCostValueErrorDark)
                          ]}>
                            {formatCrypto(selectedCrypto.owned)} {selectedCrypto.symbol.toUpperCase()}
                          </Text>
                        </View>
                        {!hasEnoughCrypto && (
                          <View style={styles.autoRepairWarning}>
                            <AlertTriangle size={16} color="#F59E0B" />
                            <Text style={[styles.autoRepairWarningText, isDarkMode && styles.autoRepairWarningTextDark]}>
                              Insufficient balance. You need {formatCrypto(weeklyCryptoCost - selectedCrypto.owned)} more {selectedCrypto.symbol.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.autoRepairCostCard, styles.autoRepairCostCardError, isDarkMode && styles.autoRepairCostCardErrorDark]}>
                        <AlertTriangle size={20} color="#EF4444" />
                        <Text style={[styles.autoRepairErrorText, isDarkMode && styles.autoRepairErrorTextDark]}>
                          Please select a cryptocurrency to mine first
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Requirements */}
              <View style={styles.autoRepairSection}>
                <Text style={[styles.autoRepairSectionTitle, isDarkMode && styles.autoRepairSectionTitleDark]}>
                  Requirements
                </Text>
                <View style={styles.autoRepairRequirementsList}>
                  {[
                    { met: !!warehouse, text: 'Own a warehouse' },
                    { met: !!warehouse?.selectedCrypto, text: 'Select a cryptocurrency to mine' },
                    { met: (() => {
                      const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
                      return selectedCrypto && selectedCrypto.owned >= (5000 / (selectedCrypto.price || 1));
                    })(), text: 'Have enough crypto for weekly payment' },
                  ].map((req, index) => (
                    <View key={index} style={styles.autoRepairRequirementItem}>
                      {req.met ? (
                        <CheckCircle size={18} color="#10B981" />
                      ) : (
                        <X size={18} color="#EF4444" />
                      )}
                      <Text style={[
                        styles.autoRepairRequirementText,
                        req.met ? styles.autoRepairRequirementMet : styles.autoRepairRequirementUnmet,
                        isDarkMode && (req.met ? styles.autoRepairRequirementMetDark : styles.autoRepairRequirementUnmetDark)
                      ]}>
                        {req.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Hire Button */}
              {(() => {
                const selectedCrypto = cryptos.find(c => c.id === warehouse?.selectedCrypto);
                const weeklyCryptoCost = selectedCrypto ? 5000 / selectedCrypto.price : 0;
                const hasEnoughCrypto = selectedCrypto && selectedCrypto.owned >= weeklyCryptoCost;
                const canHire = !!warehouse && !!selectedCrypto && hasEnoughCrypto;

                return (
                  <TouchableOpacity
                    style={styles.autoRepairHireButton}
                    onPress={() => {
                      if (canHire) {
                        logger.debug('Hire button pressed in modal');
                        handleHireAutoRepair();
                      }
                    }}
                    disabled={!canHire}
                  >
                    <LinearGradient
                      colors={canHire ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                      style={styles.autoRepairHireButtonGradient}
                    >
                      <Users size={20} color="#FFFFFF" />
                      <Text style={styles.autoRepairHireButtonText}>
                        {canHire ? 'Hire Technician' : 'Requirements Not Met'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })()}
            </ScrollView>
          </View>
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



                    Upgrade Benefits:



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
    gap: 4,
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
  healthText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 4,
  },
  healthTextDark: {
    color: '#9CA3AF',
  },



  minerStatTextDark: {



    color: '#FFFFFF',



    textShadowColor: 'rgba(0, 0, 0, 0.75)',



    textShadowOffset: { width: -1, height: 1 },



    textShadowRadius: 2,



  },



  minerActionsContainer: {



    gap: 8,



  },



  minerActions: {



    flexDirection: 'row',



    gap: 8,



  },



  buyMinerButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 52,
    ...getShadow(2),
  },



  buyMinerButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  minerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },



  buyMinerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },



  sellMinerButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 52,
    ...getShadow(2),
  },



  sellMinerButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },



  sellMinerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },



  repairMinerButton: {



    flex: 1,



    borderRadius: 8,



    overflow: 'hidden',



    minHeight: 44,



  },



  repairMinerButtonFullWidth: {



    width: '100%',



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

  // New tab styles
  tabsWrapper: {
    marginBottom: 20,
  },
  tabScrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tabScrollHintText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontStyle: 'italic',
  },
  tabScrollHintTextDark: {
    color: '#9CA3AF',
  },
  tabScrollContainer: {
    marginBottom: 0,
  },

  // Empty state styles
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: fontScale(16),
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyStateTextDark: {
    color: '#9CA3AF',
  },

  // Section styles
  sectionTitle: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  sectionDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: 20,
  },
  sectionDescriptionDark: {
    color: '#9CA3AF',
  },
  sectionSubtitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionSubtitleDark: {
    color: '#F9FAFB',
  },

  // Upgrades tab styles
  upgradesContainer: {
    flex: 1,
  },
  minerUpgradeSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  minerUpgradeSectionDark: {
    backgroundColor: '#1F2937',
  },
  minerUpgradeTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  minerUpgradeTitleDark: {
    color: '#F9FAFB',
  },
  upgradeCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  upgradeCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upgradeName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  upgradeNameDark: {
    color: '#F9FAFB',
  },
  upgradeDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: 4,
  },
  upgradeDescriptionDark: {
    color: '#9CA3AF',
  },
  upgradeLevel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
  },
  upgradeLevelDark: {
    color: '#6B7280',
  },
  upgradeButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 100,
  },
  upgradeButtonDisabled: {
    opacity: 0.5,
  },
  upgradeButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },

  // Pools tab styles
  poolsContainer: {
    flex: 1,
  },
  activePoolCard: {
    padding: 20,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  activePoolCardDark: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  activePoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activePoolTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#065F46',
    marginLeft: 8,
  },
  activePoolTitleDark: {
    color: '#10B981',
  },
  activePoolInfo: {
    fontSize: fontScale(14),
    color: '#047857',
    marginBottom: 12,
  },
  activePoolInfoDark: {
    color: '#34D399',
  },
  leavePoolButton: {
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    alignItems: 'center',
  },
  leavePoolButtonText: {
    color: '#DC2626',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  poolCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  poolCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poolName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  poolNameDark: {
    color: '#F9FAFB',
  },
  poolStats: {
    flexDirection: 'row',
    gap: 16,
  },
  poolStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  poolStatText: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  poolStatTextDark: {
    color: '#9CA3AF',
  },
  joinPoolButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 80,
  },
  joinPoolButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinPoolButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },

  // Staking tab styles
  stakingContainer: {
    flex: 1,
  },
  stakingPositionCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    ...getShadow(2),
  },
  stakingPositionCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  stakingPositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stakingPositionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stakingPositionCrypto: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  stakingPositionCryptoDark: {
    color: '#F9FAFB',
  },
  stakingPositionStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  stakingPositionStatusLocked: {
    backgroundColor: '#FEF3C7',
  },
  stakingPositionStatusReady: {
    backgroundColor: '#D1FAE5',
  },
  stakingPositionStatusText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#111827',
  },
  stakingPositionDetails: {
    gap: 10,
  },
  stakingPositionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stakingPositionDetailLabel: {
    fontSize: fontScale(13),
    color: '#6B7280',
    fontWeight: '500',
  },
  stakingPositionDetailLabelDark: {
    color: '#9CA3AF',
  },
  stakingPositionDetailValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  stakingPositionDetailValueDark: {
    color: '#F9FAFB',
  },
  stakingPositionRewardValue: {
    color: '#10B981',
    fontWeight: '700',
  },
  stakingPositionRewardValueDark: {
    color: '#34D399',
  },
  stakingPositionAccumulatedValue: {
    color: '#EC4899',
    fontWeight: '700',
  },
  stakingPositionAccumulatedValueDark: {
    color: '#F472B6',
  },

  // Statistics tab styles
  statisticsContainer: {
    flex: 1,
  },
  statCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  statLabel: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: 8,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#111827',
  },
  statValuePositive: {
    color: '#10B981',
  },
  statValueNegative: {
    color: '#EF4444',
  },
  statSubtext: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginTop: 4,
  },
  statSubtextDark: {
    color: '#6B7280',
  },
  cryptoStatCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cryptoStatCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  cryptoStatSymbol: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  cryptoStatSymbolDark: {
    color: '#F9FAFB',
  },
  cryptoStatAmount: {
    fontSize: fontScale(16),
    color: '#6B7280',
  },
  cryptoStatAmountDark: {
    color: '#9CA3AF',
  },

  // Energy tab styles
  energyContainer: {
    flex: 1,
  },
  currentEnergyCard: {
    padding: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  currentEnergyCardDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  currentEnergyLabel: {
    fontSize: fontScale(12),
    color: '#1E40AF',
    marginBottom: 4,
  },
  currentEnergyLabelDark: {
    color: '#93C5FD',
  },
  currentEnergyType: {
    fontSize: fontScale(20),
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  currentEnergyTypeDark: {
    color: '#DBEAFE',
  },
  currentEnergyEfficiency: {
    fontSize: fontScale(14),
    color: '#3B82F6',
  },
  currentEnergyEfficiencyDark: {
    color: '#93C5FD',
  },
  energyCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  energyCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  energyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  energyName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  energyNameDark: {
    color: '#F9FAFB',
  },
  energyDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  energyDescriptionDark: {
    color: '#9CA3AF',
  },
  energyUpgradeButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 100,
  },
  energyUpgradeButtonDisabled: {
    opacity: 0.5,
  },
  energyUpgradeButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyUpgradeButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },

  // Automation tab styles
  automationContainer: {
    flex: 1,
  },
  automationCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  automationCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  automationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  automationLevel: {
    fontSize: fontScale(20),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  automationLevelDark: {
    color: '#F9FAFB',
  },
  automationBonus: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  automationBonusDark: {
    color: '#9CA3AF',
  },
  automationUpgradeButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 150,
  },
  automationUpgradeButtonDisabled: {
    opacity: 0.5,
  },
  automationUpgradeButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  automationUpgradeButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  automationMaxLevel: {
    fontSize: fontScale(14),
    color: '#10B981',
    marginTop: 12,
    textAlign: 'center',
  },
  automationMaxLevelDark: {
    color: '#34D399',
  },

  // Staking button styles
  stakeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  stakeButtonDark: {
    // Same as regular
  },
  stakeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  stakeButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  claimButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  claimButtonDark: {
    // Same as regular
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
  },

  // Modal styles for staking
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  inputLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  inputLabelDark: {
    color: '#F9FAFB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: fontScale(16),
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#4B5563',
    color: '#F9FAFB',
    backgroundColor: '#374151',
  },
  cryptoSelector: {
    marginBottom: 16,
  },
  cryptoSelectorOptionDisabled: {
    opacity: 0.5,
  },
  cryptoSelectorBalance: {
    fontSize: fontScale(10),
    color: '#10B981',
    marginTop: responsiveSpacing.xs,
  },
  cryptoSelectorBalanceDark: {
    color: '#34D399',
  },
  cryptoSelectorOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  cryptoSelectorOptionDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  cryptoSelectorOptionActive: {
    borderColor: '#EC4899',
    backgroundColor: '#FCE7F3',
  },
  cryptoSelectorText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  cryptoSelectorTextDark: {
    color: '#F9FAFB',
  },
  lockPeriodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  lockPeriodOption: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  lockPeriodOptionDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  lockPeriodOptionActive: {
    borderColor: '#EC4899',
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
  },
  lockPeriodText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  lockPeriodTextDark: {
    color: '#F9FAFB',
  },
  lockPeriodReward: {
    fontSize: fontScale(12),
    color: '#10B981',
    fontWeight: '600',
  },
  lockPeriodRewardDark: {
    color: '#34D399',
  },
  modalConfirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  modalConfirmButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
  },

  // Redesigned Staking Modal Styles
  stakingModalContent: {
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
    minHeight: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...getShadow(4),
  },
  stakingModalContentDark: {
    backgroundColor: '#1F2937',
  },
  stakingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stakingModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stakingModalTitle: {
    fontSize: fontScale(28),
    fontWeight: '700',
    color: '#111827',
  },
  stakingModalTitleDark: {
    color: '#F9FAFB',
  },
  stakingModalCloseButton: {
    padding: 4,
  },
  stakingModalScroll: {
    flex: 1,
  },
  stakingModalScrollContent: {
    padding: 24,
    gap: 28,
    paddingBottom: 32,
  },
  stakingSection: {
    gap: 12,
  },
  stakingSectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
  },
  stakingSectionTitleDark: {
    color: '#F9FAFB',
  },
  stakingSectionSubtitle: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: -4,
  },
  stakingSectionSubtitleDark: {
    color: '#9CA3AF',
  },
  stakingCryptoSelector: {
    marginTop: 8,
  },
  stakingCryptoSelectorContent: {
    gap: 12,
    paddingRight: 4,
  },
  stakingCryptoCard: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    minWidth: 120,
    gap: 8,
  },
  stakingCryptoCardDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  stakingCryptoCardActive: {
    borderColor: '#EC4899',
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
  },
  stakingCryptoCardActiveDark: {
    borderColor: '#EC4899',
    backgroundColor: '#831843',
  },
  stakingCryptoCardDisabled: {
    opacity: 0.4,
  },
  stakingCryptoSymbol: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  stakingCryptoSymbolDark: {
    color: '#F9FAFB',
  },
  stakingCryptoSymbolActive: {
    color: '#EC4899',
  },
  stakingCryptoSymbolActiveDark: {
    color: '#F9FAFB',
  },
  stakingCryptoBalance: {
    fontSize: fontScale(12),
    color: '#10B981',
    fontWeight: '600',
  },
  stakingCryptoBalanceActive: {
    color: '#EC4899',
  },
  stakingCryptoBalanceDark: {
    color: '#34D399',
  },
  stakingCryptoNoBalance: {
    fontSize: fontScale(11),
    color: '#9CA3AF',
  },
  stakingCryptoNoBalanceDark: {
    color: '#6B7280',
  },
  stakingAmountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stakingMaxButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#EC4899',
  },
  stakingMaxButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  stakingAmountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 60,
  },
  stakingAmountInputContainerDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  stakingAmountInput: {
    flex: 1,
    fontSize: fontScale(22),
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 16,
  },
  stakingAmountInputDark: {
    color: '#F9FAFB',
  },
  stakingAmountSymbol: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 12,
  },
  stakingAmountSymbolDark: {
    color: '#9CA3AF',
  },
  stakingAmountHint: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: 6,
  },
  stakingAmountHintDark: {
    color: '#9CA3AF',
  },
  stakingLockPeriodGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  stakingLockPeriodCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  stakingLockPeriodCardDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  stakingLockPeriodCardActive: {
    borderColor: '#EC4899',
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
  },
  stakingLockPeriodCardActiveDark: {
    borderColor: '#EC4899',
    backgroundColor: '#831843',
  },
  stakingLockPeriodContent: {
    alignItems: 'center',
    gap: 6,
  },
  stakingLockPeriodWeeks: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  stakingLockPeriodWeeksDark: {
    color: '#F9FAFB',
  },
  stakingLockPeriodWeeksActive: {
    color: '#EC4899',
  },
  stakingLockPeriodRewardRate: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#10B981',
  },
  stakingLockPeriodRewardRateDark: {
    color: '#34D399',
  },
  stakingLockPeriodRewardRateActive: {
    color: '#EC4899',
  },
  stakingLockPeriodRewardLabel: {
    fontSize: fontScale(10),
    fontWeight: '500',
    color: '#6B7280',
  },
  stakingLockPeriodRewardLabelDark: {
    color: '#9CA3AF',
  },
  stakingLockPeriodRewardLabelActive: {
    color: '#EC4899',
  },
  stakingReturnsCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 16,
  },
  stakingReturnsCardDark: {
    backgroundColor: '#064E3B',
    borderColor: '#34D399',
  },
  stakingReturnsTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  stakingReturnsTitleDark: {
    color: '#34D399',
  },
  stakingReturnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stakingReturnsLabel: {
    fontSize: fontScale(13),
    color: '#059669',
    fontWeight: '500',
  },
  stakingReturnsLabelDark: {
    color: '#6EE7B7',
  },
  stakingReturnsValue: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#10B981',
  },
  stakingReturnsValueDark: {
    color: '#34D399',
  },
  stakingConfirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  stakingConfirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 28,
    minHeight: 60,
  },
  stakingConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(18),
    fontWeight: '700',
  },

  // Auto-Repair Modal Styles
  autoRepairModalContent: {
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
    minHeight: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: getResponsiveBorderRadius(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  autoRepairModalContentDark: {
    backgroundColor: '#1F2937',
  },
  autoRepairModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  autoRepairModalHeaderDark: {
    borderBottomColor: '#374151',
  },
  autoRepairModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  autoRepairModalTitle: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#111827',
  },
  autoRepairModalTitleDark: {
    color: '#F9FAFB',
  },
  autoRepairModalCloseButton: {
    padding: 8,
    borderRadius: 8,
  },
  autoRepairModalScroll: {
    flex: 1,
  },
  autoRepairModalScrollContent: {
    padding: scale(20),
    gap: scale(20),
  },
  autoRepairSection: {
    gap: scale(12),
  },
  autoRepairDescription: {
    fontSize: fontScale(15),
    lineHeight: 22,
    color: '#6B7280',
  },
  autoRepairDescriptionDark: {
    color: '#9CA3AF',
  },
  autoRepairSectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  autoRepairSectionTitleDark: {
    color: '#F9FAFB',
  },
  autoRepairBenefitsList: {
    gap: scale(12),
  },
  autoRepairBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  autoRepairBenefitText: {
    fontSize: fontScale(14),
    color: '#374151',
    flex: 1,
  },
  autoRepairBenefitTextDark: {
    color: '#D1D5DB',
  },
  autoRepairCostCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: getResponsiveBorderRadius(12),
    padding: scale(16),
    gap: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  autoRepairCostCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  autoRepairCostCardError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoRepairCostCardErrorDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#991B1B',
  },
  autoRepairCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoRepairCostLabel: {
    fontSize: fontScale(14),
    color: '#6B7280',
    fontWeight: '500',
  },
  autoRepairCostLabelDark: {
    color: '#9CA3AF',
  },
  autoRepairCostValue: {
    fontSize: fontScale(15),
    color: '#111827',
    fontWeight: '600',
  },
  autoRepairCostValueDark: {
    color: '#F9FAFB',
  },
  autoRepairCostValueSuccess: {
    color: '#10B981',
  },
  autoRepairCostValueSuccessDark: {
    color: '#34D399',
  },
  autoRepairCostValueError: {
    color: '#EF4444',
  },
  autoRepairCostValueErrorDark: {
    color: '#F87171',
  },
  autoRepairWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: scale(12),
    backgroundColor: '#FFFBEB',
    borderRadius: getResponsiveBorderRadius(8),
    marginTop: 4,
  },
  autoRepairWarningDark: {
    backgroundColor: '#78350F',
  },
  autoRepairWarningText: {
    fontSize: fontScale(13),
    color: '#92400E',
    flex: 1,
  },
  autoRepairWarningTextDark: {
    color: '#FCD34D',
  },
  autoRepairErrorText: {
    fontSize: fontScale(14),
    color: '#DC2626',
    flex: 1,
  },
  autoRepairErrorTextDark: {
    color: '#FCA5A5',
  },
  autoRepairRequirementsList: {
    gap: scale(10),
  },
  autoRepairRequirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  autoRepairRequirementText: {
    fontSize: fontScale(14),
    flex: 1,
  },
  autoRepairRequirementMet: {
    color: '#059669',
  },
  autoRepairRequirementMetDark: {
    color: '#34D399',
  },
  autoRepairRequirementUnmet: {
    color: '#DC2626',
  },
  autoRepairRequirementUnmetDark: {
    color: '#F87171',
  },
  autoRepairHireButton: {
    borderRadius: getResponsiveBorderRadius(12),
    overflow: 'hidden',
    marginTop: scale(8),
  },
  autoRepairHireButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: scale(18),
    paddingHorizontal: scale(24),
    minHeight: 56,
  },
  autoRepairHireButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },

});







