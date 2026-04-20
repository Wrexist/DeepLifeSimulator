import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { ArrowLeft, Lock, ShoppingCart, MessageSquare, Terminal, Bitcoin, Shield, Zap, DollarSign } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation } from '@react-navigation/native';
import { logger } from '@/utils/logger';
import { useMemoryCleanup } from '@/utils/performanceOptimization';

const { width: screenWidth } = Dimensions.get('window');

interface OnionAppProps {
  onBack: () => void;
}

export default function OnionApp({ onBack }: OnionAppProps) {
  const { gameState, setGameState, buyDarkWebItem, buyHack, performHack } = useGame();
  const { addCleanup } = useMemoryCleanup();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'shop' | 'forum' | 'terminal'>('shop');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isHacking, setIsHacking] = useState(false);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Extract frequently used values from gameState
  const darkWebItems = gameState.darkWebItems || [];
  const cryptos = gameState.cryptos || [];
  const hacks = gameState.hacks || [];
  const streetJobs = gameState.streetJobs || [];
  const energy = gameState.stats.energy;
  const isDarkMode = gameState.settings.darkMode;

  // Memoize helper functions
  const canUseTerminal = useMemo(() =>
    darkWebItems.find(i => i.id === 'usb')?.owned &&
    darkWebItems.find(i => i.id === 'vpn')?.owned,
    [darkWebItems]
  );

  const canUseForum = useMemo(() =>
    darkWebItems.find(i => i.id === 'vpn')?.owned &&
    darkWebItems.find(i => i.id === 'usb')?.owned,
    [darkWebItems]
  );

  const btcBalance = useMemo(() => 
    cryptos.find(c => c.id === 'btc')?.owned || 0,
    [cryptos]
  );

  // Helper function to calculate actual hack risk with item buffs - memoized
  const calculateActualRisk = useCallback((hack: any) => {
    const ownedItems = darkWebItems.filter(i => i.owned);
    const totalRiskReduction = ownedItems.reduce(
      (sum, i) => sum + (i.riskReduction || 0),
      0
    );
    return Math.max(0, hack.risk - totalRiskReduction);
  }, [darkWebItems]);

  // Helper to create setTimeout with cleanup
  const createTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      callback();
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    }, delay);
    timeoutRefs.current.push(timeoutId);
    addCleanup(() => {
      clearTimeout(timeoutId);
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    });
    return timeoutId;
  }, [addCleanup]);

  const hackSteps: Record<string, string[]> = {
    phishing: [
      'Crafting deceptive email',
      'Spoofing sender address',
      'Embedding malicious link',
      'Dispatching phishing campaign',
      'Awaiting victim response',
      'Harvesting credentials',
      'Accessing breached accounts',
      'Covering tracks'
    ],
    ransomware: [
      'Deploying ransomware payload',
      'Establishing persistence',
      'Encrypting target files',
      'Locking user systems',
      'Displaying ransom note',
      'Monitoring blockchain payments',
      'Decrypting after payment',
      'Wiping traces'
    ],
    sql_injection: [
      'Mapping vulnerable endpoints',
      'Injecting SQL payload',
      'Bypassing authentication',
      'Dumping database schema',
      'Extracting user records',
      'Uploading backdoor',
      'Cleaning database logs',
      'Closing connection'
    ],
    ddos: [
      'Activating botnet nodes',
      'Resolving target address',
      'Generating junk traffic',
      'Overwhelming bandwidth',
      'Monitoring downtime',
      'Sending extortion demand',
      'Reducing attack intensity',
      'Shutting down bots'
    ],
    zero_day: [
      'Identifying zero-day target',
      'Preparing exploit code',
      'Triggering vulnerability',
      'Escalating kernel privileges',
      'Exfiltrating classified data',
      'Selling exploit on market',
      'Removing exploit traces',
      'Restoring system state'
    ],
    mitm: [
      'Setting up rogue access point',
      'Intercepting packet stream',
      'Downgrading SSL sessions',
      'Capturing sensitive data',
      'Modifying packet contents',
      'Injecting malicious scripts',
      'Relaying forged responses',
      'Clearing network logs'
    ],
    keylogger: [
      'Planting keylogger agent',
      'Establishing persistence',
      'Recording keystrokes',
      'Encrypting log files',
      'Uploading logs to server',
      'Parsing stolen credentials',
      'Deleting local evidence',
      'Maintaining backdoor'
    ],
    bruteforce: [
      'Identifying login endpoint',
      'Starting brute force cycle',
      'Cycling password combinations',
      'Rotating proxy IPs',
      'Evading rate limits',
      'Cracking target password',
      'Accessing secured account',
      'Cleaning attack traces'
    ]
  };

  const runHack = useCallback((hackId: string) => {
    const hack = hacks.find(h => h.id === hackId);
    if (!hack) return;
    const steps = hackSteps[hackId] || ['Initializing attack'];
    if (energy < hack.energyCost) {
      setTerminalOutput([`> Not enough energy. ${hack.energyCost} energy required.`]);
      return;
    }
    
    // Deduct energy, happiness, and health immediately when hack starts
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        energy: prev.stats.energy - hack.energyCost,
        happiness: Math.max(0, prev.stats.happiness - 2), // Small happiness drain
        health: Math.max(0, prev.stats.health - 1) // Small health drain
      }
    }));
    
    setTerminalOutput([`> Initiating ${hack.name} sequence...`]);
    setIsHacking(true);
    steps.forEach((step, idx) => {
      createTimeout(() => {
        const percent = Math.round(((idx + 1) / steps.length) * 100);
        const barLength = 20;
        const filled = Math.round((percent / 100) * barLength);
        const bar = `[${'#'.repeat(filled)}${'-'.repeat(barLength - filled)}] ${percent}%`;
        setTerminalOutput(prev => [...prev, `${step} ${bar}`]);
        if (idx === steps.length - 1) {
          try {
            const result = performHack(hackId);
            createTimeout(() => {
              let finalLine = '';
              if (result && result.caught) {
                if (result.jailed) {
                  finalLine = `ARRESTED! Jailed for 4 weeks! Wanted level increased!`;
                  // Navigate to work tab to show prison screen
                  createTimeout(() => {
                    if (navigation && typeof navigation.navigate === 'function') {
                      navigation.navigate('work');
                    } else {
                      logger.warn('Navigation not available - user is now in jail');
                    }
                  }, 2000); // Give time for the message to be displayed
                } else {
                  finalLine = `Trace detected! -$500 | Wanted level increased! | Risk: ${Math.round((result.risk || 0) * 100)}%`;
                }
              } else if (result) {
                const btcReward = result.btcReward || 0;
                finalLine = `Hack successful! $${result.reward || 0} converted to untraceable wallet (+${btcReward.toFixed(6)} BTC) | Risk: ${Math.round((result.risk || 0) * 100)}%`;
                Alert.alert(
                  'Hack Successful!', 
                  `You earned $${result.reward || 0} and ${btcReward.toFixed(6)} BTC!\n\nYour BTC has been added to your cryptocurrency wallet.`
                );
              } else {
                finalLine = `Hack failed! Unknown error occurred.`;
              }
              setTerminalOutput(prev => [...prev, finalLine]);
              setIsHacking(false);
            }, 400);
          } catch (error) {
            logger.error('Hack error:', error);
            setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`]);
            setIsHacking(false);
          }
        }
      }, (idx + 1) * 400);
    });
  }, [hacks, energy, setGameState, performHack, createTimeout, navigation]);

  const renderShopTab = useCallback(() => (
    <ScrollView 
      style={styles.content} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.balanceContainer}>
        <LinearGradient
          colors={['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceHeader}>
            <Bitcoin size={24} color="#F7931A" />
            <Text style={styles.balanceTitle}>BTC Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>{btcBalance.toFixed(6)} BTC</Text>
        </LinearGradient>
      </View>

      <View style={styles.itemsContainer}>
        {darkWebItems.map(item => {
          const requiredBy = streetJobs
            .filter(job => job.darkWebRequirements?.includes(item.id))
            .map(job => job.name);
          return (
            <View key={item.id} style={styles.itemCard}>
              <LinearGradient
                colors={item.owned ? ['#10B981', '#059669'] : ['#1F2937', '#111827']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.itemCardGradient}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.itemDescription}>{item.description}</Text>
                    )}
                  </View>
                  <View style={styles.itemPrice}>
                    <Bitcoin size={20} color="#F7931A" />
                    <Text style={styles.itemPriceText}>{item.costBtc}</Text>
                  </View>
                </View>

                <View style={styles.itemStats}>
                  {item.riskReduction && (
                    <View style={styles.itemStat}>
                      <Shield size={16} color="#10B981" />
                      <Text style={styles.itemStatText}>
                        Risk -{Math.round(item.riskReduction * 100)}%
                      </Text>
                    </View>
                  )}
                  {item.rewardBonus && (
                    <View style={styles.itemStat}>
                      <Zap size={16} color="#F59E0B" />
                      <Text style={styles.itemStatText}>
                        Reward +{Math.round(item.rewardBonus * 100)}%
                      </Text>
                    </View>
                  )}
                </View>

                {requiredBy.length > 0 && (
                  <View style={styles.requirementsContainer}>
                    <Text style={styles.requirementsTitle}>Required for:</Text>
                    {requiredBy.map(job => (
                      <Text key={job} style={[styles.requirementText, isDarkMode && styles.requirementTextDark]}>• {job}</Text>
                    ))}
                  </View>
                )}

                {!item.owned && (
                  <TouchableOpacity
                    style={styles.buyButton}
                    onPress={() => {
                      if (btcBalance < item.costBtc) {
                        Alert.alert(
                          'Insufficient BTC', 
                          `You need ${item.costBtc} BTC to buy ${item.name}. You currently have ${btcBalance.toFixed(6)} BTC.`
                        );
                        return;
                      }
                      buyDarkWebItem(item.id);
                    }}
                  >
                    <LinearGradient
                      colors={btcBalance >= item.costBtc ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.buyButtonGradient}
                    >
                      <ShoppingCart size={16} color="#FFFFFF" />
                      <Text style={styles.buyButtonText}>
                        {btcBalance >= item.costBtc ? 'Purchase' : 'Insufficient BTC'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {item.owned && (
                  <View style={styles.ownedBadge}>
                    <Text style={styles.ownedText}>OWNED</Text>
                  </View>
                )}
              </LinearGradient>
            </View>
          );
        })}
      </View>
    </ScrollView>
  ), [darkWebItems, streetJobs, btcBalance, buyDarkWebItem, isDarkMode]);

  const renderForumTab = useCallback(() => (
    <ScrollView 
      style={styles.content} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.forumContainer}>
        <View style={styles.forumCard}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.forumCardGradient}
          >
            <View style={styles.forumHeader}>
              <MessageSquare size={24} color="#3B82F6" />
              <Text style={styles.forumTitle}>Dark Web Forum</Text>
            </View>
            
            {!canUseForum ? (
              <>
                <Text style={styles.forumDescription}>
                  Access to the forum requires additional security measures. 
                  Complete the required purchases in the Shop tab to unlock forum access.
                </Text>
                <View style={styles.forumRequirements}>
                  <Text style={styles.requirementsTitle}>Requirements:</Text>
                  <Text style={[styles.requirementText, isDarkMode && styles.requirementTextDark]}>• VPN Connection (0.007 BTC)</Text>
                  <Text style={[styles.requirementText, isDarkMode && styles.requirementTextDark]}>• USB Drive (0.012 BTC)</Text>
                </View>
                <Text style={styles.forumNote}>
                  💡 Purchase these items from the Shop tab to access the forum.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.forumDescription}>
                  Welcome to the Dark Web Forum. Here you can access hacking courses and advanced tools.
                </Text>
                <View style={styles.forumContent}>
                  <Text style={styles.forumSectionTitle}>Available Hacking Courses:</Text>
                  {hacks.map(hack => {
                    const btc = cryptos.find(c => c.id === 'btc');
                    const canAfford = btc && btc.owned >= hack.costBtc;
                    const actualRisk = calculateActualRisk(hack);
                    
                    return (
                      <View key={hack.id} style={styles.hackCourse}>
                        <View style={styles.hackCourseHeader}>
                          <View style={styles.hackCourseInfo}>
                            <Text style={styles.hackCourseName}>{hack.name}</Text>
                            <Text style={styles.hackCourseDesc}>{hack.description}</Text>
                          </View>
                          <View>
                            <Text style={styles.hackCoursePrice}>Cost: {hack.costBtc} BTC</Text>
                            <Text style={styles.hackCourseReward}>Reward: ${hack.reward}</Text>
                            <Text style={styles.hackCourseRisk}>Risk: {Math.round(actualRisk * 100)}%</Text>
                          </View>
                        </View>
                        
                        {!hack.purchased ? (
                          <TouchableOpacity
                            style={styles.hackBuyButton}
                            onPress={() => {
                              if (!canAfford) {
                                Alert.alert(
                                  'Insufficient BTC', 
                                  `You need ${hack.costBtc} BTC to buy ${hack.name}. You currently have ${btc?.owned.toFixed(6) || '0'} BTC.`
                                );
                                return;
                              }
                              buyHack(hack.id);
                              Alert.alert('Hack Purchased!', `You now have access to ${hack.name} in the Terminal tab.`);
                            }}
                          >
                            <LinearGradient
                              colors={canAfford ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.hackBuyButtonGradient}
                            >
                              <Text style={styles.hackBuyButtonText}>
                                {canAfford ? 'Purchase Hack' : 'Insufficient BTC'}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.hackOwnedBadge}>
                            <Text style={styles.hackOwnedText}>PURCHASED</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </View>
    </ScrollView>
  ), [canUseForum, hacks, cryptos, calculateActualRisk, buyHack, isDarkMode]);

  const renderTerminalTab = useCallback(() => (
    <ScrollView 
      style={styles.content} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.terminalContainer}>
        <LinearGradient
          colors={['#0F172A', '#020617']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.terminalCard}
        >
          <View style={styles.terminalHeader}>
            <Terminal size={24} color="#10B981" />
            <Text style={styles.terminalTitle}>Hack Terminal</Text>
          </View>

          {!canUseTerminal ? (
            <View style={styles.terminalLocked}>
              <Lock size={48} color={isDarkMode ? "#FFFFFF" : "#6B7280"} />
              <Text style={styles.terminalLockedTitle}>Terminal Locked</Text>
              <Text style={[styles.terminalLockedMessage, isDarkMode && styles.terminalLockedMessageDark]}>
                You need a VPN and USB drive to access the terminal safely.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.terminalOutput}>
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  ref={(scrollView) => {
                    if (scrollView && terminalOutput.length > 0) {
                      createTimeout(() => {
                        scrollView.scrollToEnd({ animated: true });
                      }, 100);
                    }
                  }}
                >
                  {terminalOutput.map((line, index) => (
                    <Text key={index} style={styles.terminalLine}>{line}</Text>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.hacksContainer}>
                <View style={styles.hacksTitleContainer}>
                  <View style={styles.hacksTitleIcon}>
                    <Terminal size={18} color="#8B5CF6" />
                  </View>
                  <Text style={styles.hacksTitle}>Available Hacks</Text>
                </View>
                {hacks.filter(hack => hack.purchased).length === 0 ? (
                  <View style={styles.noHacksContainer}>
                    <Text style={[styles.noHacksText, isDarkMode && styles.noHacksTextDark]}>No hacks purchased yet.</Text>
                    <Text style={[styles.noHacksSubtext, isDarkMode && styles.noHacksSubtextDark]}>Visit the Forum tab to buy hacking courses.</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hacksScrollContent}>
                    <View style={styles.hacksList}>
                      {hacks
                        .filter(hack => hack.purchased) // Only show purchased hacks
                        .map(hack => {
                        const canUse = !isHacking && energy >= hack.energyCost;
                        const btc = cryptos.find(c => c.id === 'btc');
                        const estimatedBtcReward = btc ? hack.reward / btc.price : 0;
                        const actualRisk = calculateActualRisk(hack);
                        
                        // Determine color scheme based on risk level
                        const riskLevel = actualRisk;
                        let gradientColors: [string, string, string];
                        let borderColor: string;
                        let glowColor: string;
                        
                        if (riskLevel >= 0.5) {
                          // High risk - red/orange theme
                          gradientColors = canUse ? ['#DC2626', '#B91C1C', '#991B1B'] : ['#6B7280', '#4B5563', '#374151'];
                          borderColor = canUse ? '#EF4444' : '#6B7280';
                          glowColor = canUse ? 'rgba(239, 68, 68, 0.4)' : 'rgba(107, 114, 128, 0.2)';
                        } else if (riskLevel >= 0.3) {
                          // Medium risk - orange/yellow theme
                          gradientColors = canUse ? ['#F59E0B', '#D97706', '#B45309'] : ['#6B7280', '#4B5563', '#374151'];
                          borderColor = canUse ? '#FBBF24' : '#6B7280';
                          glowColor = canUse ? 'rgba(251, 191, 36, 0.4)' : 'rgba(107, 114, 128, 0.2)';
                        } else {
                          // Low risk - purple/blue theme
                          gradientColors = canUse ? ['#8B5CF6', '#7C3AED', '#6D28D9'] : ['#6B7280', '#4B5563', '#374151'];
                          borderColor = canUse ? '#A78BFA' : '#6B7280';
                          glowColor = canUse ? 'rgba(167, 139, 250, 0.4)' : 'rgba(107, 114, 128, 0.2)';
                        }
                        
                        return (
                          <TouchableOpacity
                            key={hack.id}
                            style={[
                              styles.hackButton,
                              canUse && styles.hackButtonActive,
                              { borderColor, shadowColor: borderColor }
                            ]}
                            onPress={() => runHack(hack.id)}
                            disabled={!canUse}
                            activeOpacity={0.8}
                          >
                            <LinearGradient
                              colors={gradientColors}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.hackButtonGradient}
                            >
                              <View style={styles.hackButtonHeader}>
                                <View style={styles.hackNameContainer}>
                                  <View style={[styles.hackStatusIndicator, { backgroundColor: canUse ? '#10B981' : '#6B7280' }]} />
                                  <Text style={styles.hackName}>{hack.name}</Text>
                                </View>
                              </View>
                              
                              <View style={styles.hackButtonStats}>
                                <View style={styles.hackStat}>
                                  <Zap size={14} color="#FBBF24" />
                                  <Text style={styles.hackStatText}>{hack.energyCost} Energy</Text>
                                </View>
                                <View style={styles.hackStat}>
                                  <DollarSign size={14} color="#10B981" />
                                  <Text style={styles.hackStatText}>${hack.reward.toLocaleString()}</Text>
                                </View>
                                <View style={styles.hackStat}>
                                  <Bitcoin size={14} color="#F7931A" />
                                  <Text style={styles.hackStatText}>~{estimatedBtcReward.toFixed(6)} BTC</Text>
                                </View>
                              </View>
                              
                              <View style={[styles.hackButtonRisk, { backgroundColor: riskLevel >= 0.5 ? 'rgba(239, 68, 68, 0.2)' : riskLevel >= 0.3 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(139, 92, 246, 0.2)' }]}>
                                <Shield size={12} color={riskLevel >= 0.5 ? '#EF4444' : riskLevel >= 0.3 ? '#FBBF24' : '#A78BFA'} />
                                <Text style={[styles.hackRiskText, { color: riskLevel >= 0.5 ? '#EF4444' : riskLevel >= 0.3 ? '#FBBF24' : '#A78BFA' }]}>
                                  Risk: {Math.round(actualRisk * 100)}%
                                </Text>
                              </View>
                            </LinearGradient>
                          </TouchableOpacity>
                         );
                       })}
                    </View>
                  </ScrollView>
                )}
              </View>
            </>
          )}
        </LinearGradient>
      </View>
    </ScrollView>
  ), [canUseTerminal, terminalOutput, isHacking, hacks, cryptos, energy, calculateActualRisk, runHack, createTimeout]);

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
        <Text style={styles.headerTitle}>Dark Web</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shop' && styles.activeTab]}
          onPress={() => setActiveTab('shop')}
        >
          <LinearGradient
            colors={activeTab === 'shop' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <ShoppingCart size={16} color="#FFFFFF" />
            <Text style={styles.tabText}>Shop</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'forum' && styles.activeTab]}
          onPress={() => setActiveTab('forum')}
        >
          <LinearGradient
            colors={activeTab === 'forum' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <MessageSquare size={16} color="#FFFFFF" />
            <Text style={styles.tabText}>Forum</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terminal' && styles.activeTab]}
          onPress={() => setActiveTab('terminal')}
        >
          <LinearGradient
            colors={activeTab === 'terminal' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <Terminal size={16} color="#FFFFFF" />
            <Text style={styles.tabText}>Terminal</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {activeTab === 'shop' && renderShopTab()}
      {activeTab === 'forum' && renderForumTab()}
      {activeTab === 'terminal' && renderTerminalTab()}
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
  },
  tab: {
    flex: 1,
    minHeight: 60,
    borderRadius: 10,
    overflow: 'hidden',
  },
  activeTab: {
    boxShadow: '0px 4px 8px rgba(59, 130, 246, 0.3)',
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
  balanceContainer: {
    marginBottom: 20,
  },
  balanceCard: {
    padding: 20,
    borderRadius: 16,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F7931A',
  },
  itemsContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  itemCard: {
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  itemCardGradient: {
    padding: 20,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  itemPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7931A',
  },
  itemStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  itemStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemStatText: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  requirementsContainer: {
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  requirementTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
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
  ownedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  ownedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  forumContainer: {
    paddingBottom: 40,
  },
  forumCard: {
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  forumCardGradient: {
    padding: 24,
  },
  forumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  forumTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  forumDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 16,
  },
  forumRequirements: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  forumNote: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  forumContent: {
    marginTop: 16,
  },
  forumSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  hackCourse: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  hackCourseName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  hackCourseDesc: {
    fontSize: 12,
    color: '#D1D5DB',
    marginBottom: 4,
  },
  hackCoursePrice: {
    fontSize: 12,
    color: '#F7931A',
    fontWeight: '600',
    marginBottom: 2,
  },
  hackCourseStats: {
    fontSize: 12,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  hackCourseStatsDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  hackCourseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hackCourseInfo: {
    flex: 1,
  },
  hackBuyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  hackBuyButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  hackBuyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hackOwnedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  hackOwnedText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  hackCourseReward: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  hackCourseRisk: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  terminalContainer: {
    flex: 1,
    paddingBottom: 40,
  },
  terminalCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  terminalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  terminalLocked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminalLockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  terminalLockedMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  terminalLockedMessageDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  terminalOutput: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  terminalLine: {
    fontSize: 12,
    color: '#10B981',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  hacksContainer: {
    marginTop: 20,
  },
  hacksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  hacksTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  hacksTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hacksScrollContent: {
    paddingRight: 20,
  },
  hacksList: {
    flexDirection: 'row',
    gap: 16,
  },
  hackButton: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 180,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  hackButtonActive: {
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  hackButtonGradient: {
    padding: 18,
    minWidth: 180,
  },
  hackButtonHeader: {
    marginBottom: 12,
  },
  hackNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hackStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  hackName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    letterSpacing: 0.3,
  },
  hackLockedBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hackLockedText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  hackButtonStats: {
    marginBottom: 12,
    gap: 6,
  },
  hackStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  hackStatText: {
    fontSize: 12,
    color: '#E5E7EB',
    fontWeight: '600',
  },
  hackButtonRisk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hackRiskText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noHacksContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginTop: 10,
  },
  noHacksText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  noHacksTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  noHacksSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  noHacksSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
});


