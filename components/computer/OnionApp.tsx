import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Lock, ShoppingCart, MessageSquare, Terminal, Bitcoin, Shield, Zap, DollarSign } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

interface OnionAppProps {
  onBack: () => void;
}

export default function OnionApp({ onBack }: OnionAppProps) {
  const { gameState, setGameState, buyDarkWebItem, buyHack, performHack } = useGame();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'shop' | 'forum' | 'terminal'>('shop');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isHacking, setIsHacking] = useState(false);

  const canUseTerminal =
    gameState.darkWebItems.find(i => i.id === 'usb')?.owned &&
    gameState.darkWebItems.find(i => i.id === 'vpn')?.owned;

  const canUseForum =
    gameState.darkWebItems.find(i => i.id === 'vpn')?.owned &&
    gameState.darkWebItems.find(i => i.id === 'usb')?.owned;

  const btcBalance = gameState.cryptos.find(c => c.id === 'btc')?.owned || 0;
  const isDarkMode = gameState.settings.darkMode;

  // Helper function to calculate actual hack risk with item buffs
  const calculateActualRisk = (hack: any) => {
    const ownedItems = gameState.darkWebItems.filter(i => i.owned);
    const totalRiskReduction = ownedItems.reduce(
      (sum, i) => sum + (i.riskReduction || 0),
      0
    );
    return Math.max(0, hack.risk - totalRiskReduction);
  };

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

  const runHack = (hackId: string) => {
    const hack = gameState.hacks.find(h => h.id === hackId);
    if (!hack) return;
    const steps = hackSteps[hackId] || ['Initializing attack'];
    if (gameState.stats.energy < hack.energyCost) {
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
      setTimeout(() => {
        const percent = Math.round(((idx + 1) / steps.length) * 100);
        const barLength = 20;
        const filled = Math.round((percent / 100) * barLength);
        const bar = `[${'#'.repeat(filled)}${'-'.repeat(barLength - filled)}] ${percent}%`;
        setTerminalOutput(prev => [...prev, `${step} ${bar}`]);
        if (idx === steps.length - 1) {
          try {
            const result = performHack(hackId);
            setTimeout(() => {
              let finalLine = '';
              if (result && result.caught) {
                if (result.jailed) {
                  finalLine = `ARRESTED! Jailed for 4 weeks! Wanted level increased!`;
                  // Navigate to work tab to show prison screen
                  setTimeout(() => {
                    if (navigation && typeof navigation.navigate === 'function') {
                      navigation.navigate('work');
                    } else {
                      console.warn('Navigation not available - user is now in jail');
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
            console.error('Hack error:', error);
            setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`]);
            setIsHacking(false);
          }
        }
      }, (idx + 1) * 400);
    });
  };

  const renderShopTab = () => (
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
        {gameState.darkWebItems.map(item => {
          const requiredBy = gameState.streetJobs
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
                      <Text key={job} style={styles.requirementText}>• {job}</Text>
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
  );

  const renderForumTab = () => (
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
                  <Text style={styles.requirementText}>• VPN Connection (0.007 BTC)</Text>
                  <Text style={styles.requirementText}>• USB Drive (0.012 BTC)</Text>
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
                  {gameState.hacks.map(hack => {
                    const btc = gameState.cryptos.find(c => c.id === 'btc');
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
  );

  const renderTerminalTab = () => (
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
              <Lock size={48} color="#6B7280" />
              <Text style={styles.terminalLockedTitle}>Terminal Locked</Text>
              <Text style={styles.terminalLockedMessage}>
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
                      setTimeout(() => {
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
                <Text style={styles.hacksTitle}>Available Hacks</Text>
                {gameState.hacks.filter(hack => hack.purchased).length === 0 ? (
                  <View style={styles.noHacksContainer}>
                    <Text style={styles.noHacksText}>No hacks purchased yet.</Text>
                    <Text style={styles.noHacksSubtext}>Visit the Forum tab to buy hacking courses.</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.hacksList}>
                      {gameState.hacks
                        .filter(hack => hack.purchased) // Only show purchased hacks
                        .map(hack => {
                        const canUse = !isHacking && gameState.stats.energy >= hack.energyCost;
                        const btc = gameState.cryptos.find(c => c.id === 'btc');
                        const estimatedBtcReward = btc ? hack.reward / btc.price : 0;
                        const actualRisk = calculateActualRisk(hack);
                        
                        return (
                          <TouchableOpacity
                            key={hack.id}
                            style={styles.hackButton}
                            onPress={() => runHack(hack.id)}
                            disabled={!canUse}
                          >
                                                      <LinearGradient
                            colors={
                              !canUse ? ['#F59E0B', '#D97706'] :
                              ['#10B981', '#059669']
                            }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.hackButtonGradient}
                            >
                              <View style={styles.hackButtonHeader}>
                                <Text style={styles.hackName}>{hack.name}</Text>
                              </View>
                              
                              <View style={styles.hackButtonStats}>
                                <View style={styles.hackStat}>
                                  <Zap size={12} color="#FBBF24" />
                                  <Text style={styles.hackStatText}>{hack.energyCost} Energy</Text>
                                </View>
                                <View style={styles.hackStat}>
                                  <DollarSign size={12} color="#10B981" />
                                  <Text style={styles.hackStatText}>${hack.reward}</Text>
                                </View>
                                <View style={styles.hackStat}>
                                  <Bitcoin size={12} color="#F7931A" />
                                  <Text style={styles.hackStatText}>~{estimatedBtcReward.toFixed(6)} BTC</Text>
                                </View>
                              </View>
                              
                              <View style={styles.hackButtonRisk}>
                                <Text style={styles.hackRiskText}>Risk: {Math.round(actualRisk * 100)}%</Text>
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
  );

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
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
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
  balanceContainer: {
    marginBottom: 20,
  },
  balanceCard: {
    padding: 20,
    borderRadius: 16,
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
    marginTop: 16,
  },
  hacksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  hacksList: {
    flexDirection: 'row',
    gap: 12,
  },
  hackButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 120,
  },
  hackButtonGradient: {
    padding: 16,
    minWidth: 160,
  },
  hackButtonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hackName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
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
    marginBottom: 8,
  },
  hackStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  hackStatText: {
    fontSize: 11,
    color: '#D1D5DB',
    marginLeft: 4,
  },
  hackButtonRisk: {
    alignItems: 'center',
  },
  hackRiskText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
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
  },
  noHacksSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});

