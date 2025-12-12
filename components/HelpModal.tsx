import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, Mail } from 'lucide-react-native';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

const helpContent = [
  {
    category: 'Gameplay Basics',
    items: [
      {
        question: 'How do I progress to the next week?',
        answer: 'Tap the green "Next Week" button on the top bar. Each week advances time by 7 days, updates your stats, processes income/expenses, and triggers random events. Your character ages and the game world progresses.',
      },
      {
        question: 'How do I earn money?',
        answer: 'There are many ways to earn money: Work jobs (street jobs or careers), start and run a company, invest in stocks and cryptocurrency, buy and rent real estate, mine cryptocurrency, complete hacks (risky), receive passive income from investments, and earn from relationships or achievements.',
      },
      {
        question: 'What are the main stats and what do they do?',
        answer: 'Health (❤️): Affects lifespan and prevents negative events. Keep it above 50 to avoid health issues. Happiness (😊): Affects job performance and relationships. Low happiness can trigger depression events. Energy (⚡): Required for most actions. Replenishes weekly but can be boosted with items. Fitness: Improves job performance and health. Reputation: Affects career opportunities and social interactions. Money: Your currency for buying items, properties, and investments.',
      },
      {
        question: 'Can I play on mobile and web?',
        answer: 'Yes! DeepLife works on iOS, Android and the web with the same save file. Your progress syncs across all platforms using cloud save. Make sure to enable cloud save in settings.',
      },
      {
        question: 'How does aging work?',
        answer: 'You start at age 18. Each week you age by approximately 0.019 years (about 1 week). At age 100, your character dies unless you have the Immortality prestige bonus. Age affects available jobs, relationships, and certain game events.',
      },
      {
        question: 'What happens when I die?',
        answer: 'When you die (age 100 or health reaches 0), you can choose to continue as a child (if you have one) or restart at age 18. If you have prestiged, you keep your prestige bonuses. Your family tree records all your characters.',
      },
    ],
  },
  {
    category: 'Work & Careers',
    items: [
      {
        question: 'How do I get a job?',
        answer: 'Visit the Work tab and browse available careers. Each career has requirements (education, fitness, items). Apply for careers you qualify for. Some careers unlock at certain ages. Prestige bonuses can unlock early career access.',
      },
      {
        question: 'What are street jobs?',
        answer: 'Street jobs are quick gigs available from age 18. They pay immediately but have lower earnings. Examples include delivery, construction, and retail. Good for early game money. Some street jobs are illegal and increase wanted level.',
      },
      {
        question: 'How do promotions work?',
        answer: 'Each week you have a chance for promotion based on: your stats (higher = better), mindset perks, career level, and random chance. Promotions increase salary and unlock new career paths. Some careers have multiple levels.',
      },
      {
        question: 'Can I switch careers?',
        answer: 'Yes! Resign from your current job in the Work tab, then apply for a new career. You lose your current position but can start fresh in a new field. Some careers require specific education or experience.',
      },
      {
        question: 'What is education and how do I get it?',
        answer: 'Education unlocks better careers and increases promotion chances. Visit the Education tab to enroll. Education costs money and takes time (weeks) to complete. Types include high school, university, and specialized training. Prestige bonuses can unlock early education access.',
      },
      {
        question: 'How do I start a company?',
        answer: 'Buy a computer, then open the Company app. You need education and capital to start. Companies generate passive income and can be upgraded with workers and improvements. Manage your company weekly to maximize profits.',
      },
    ],
  },
  {
    category: 'Stats & Health',
    items: [
      {
        question: 'Why is health important?',
        answer: 'Health affects your lifespan and prevents negative events. If health drops to 0, you die. Low health triggers medical events and reduces quality of life. Keep health above 50 by eating healthy, exercising, and avoiding risky activities.',
      },
      {
        question: 'How do I increase happiness?',
        answer: 'Buy fun items (games, entertainment), maintain relationships, go on dates, buy pets, purchase nice properties, achieve goals, and avoid negative events. Low happiness can trigger depression and reduce job performance.',
      },
      {
        question: 'How do I manage energy?',
        answer: 'Energy regenerates to 100 each week automatically. Use energy for work, hobbies, relationships, and other activities. Buy energy drinks or rest items to boost energy. Prestige bonuses can increase energy regeneration.',
      },
      {
        question: 'What affects fitness?',
        answer: 'Fitness increases from gym workouts, sports hobbies, and certain activities. Higher fitness improves job performance, health, and unlocks some careers. Fitness can decrease if you neglect exercise.',
      },
      {
        question: 'How do I improve reputation?',
        answer: 'Reputation increases from: successful careers, achievements, positive social interactions, charitable actions, and avoiding criminal activities. High reputation unlocks better opportunities and improves relationships.',
      },
      {
        question: 'What happens if my stats get too low?',
        answer: 'Low stats trigger negative events: Low health = medical issues, Low happiness = depression, Low energy = can\'t perform actions. If health reaches 0, you die. Keep all stats balanced for best gameplay.',
      },
    ],
  },
  {
    category: 'Apps & Features',
    items: [
      {
        question: 'What is the Shop?',
        answer: 'The Shop (Market tab) lets you buy items that boost stats, food for health, gym access for fitness, and other useful items. Items have one-time or weekly effects. Some items unlock new features or apps.',
      },
      {
        question: 'How do I unlock new apps?',
        answer: 'Apps unlock as you progress: Phone unlocks apps (Bank, Social Media, Dating), Computer unlocks (Stocks, Real Estate, Crypto Mining, Company), and some apps require specific items or achievements. Check each app for requirements.',
      },
      {
        question: 'What is the Bank app?',
        answer: 'The Bank app lets you: save money with interest, take out loans, manage credit, and track finances. Savings accounts earn weekly interest. Loans help with large purchases but require weekly payments.',
      },
      {
        question: 'What is Social Media?',
        answer: 'Social Media lets you post content, gain followers, and earn money from sponsorships. More followers = more income. Post regularly and engage with content to grow your audience. High follower counts unlock premium features.',
      },
      {
        question: 'How does Dating work?',
        answer: 'Use the Dating app to find partners. Swipe on profiles, go on dates, and build relationships. Successful relationships can lead to marriage and children. Maintain relationships by spending time and money on dates.',
      },
      {
        question: 'What is the Family Tree?',
        answer: 'The Family Tree shows your lineage across generations. When you die and continue as a child, or when you prestige, your previous character is added to the tree. Track your family history and achievements.',
      },
    ],
  },
  {
    category: 'Investments & Money',
    items: [
      {
        question: 'How do stocks work?',
        answer: 'Buy stocks in the Stocks app (requires computer). Stock prices fluctuate weekly. Buy low, sell high to profit. You can buy by number of shares or dollar amount. Dividends provide passive income. Watch market trends to maximize profits.',
      },
      {
        question: 'How do I invest in real estate?',
        answer: 'Open the Real Estate app (requires computer). Buy properties that generate weekly rent income. Properties can be upgraded and managed. Real estate is a long-term investment that provides passive income. Some properties unlock at certain ages.',
      },
      {
        question: 'What is cryptocurrency mining?',
        answer: 'Buy miners in the Bitcoin Mining app (requires computer and warehouse). Miners generate cryptocurrency weekly based on their power. More expensive miners earn faster. You can also trade crypto directly in the Crypto Market tab. Crypto prices fluctuate weekly.',
      },
      {
        question: 'How do I make passive income?',
        answer: 'Passive income sources: Stock dividends, rental properties, company profits, cryptocurrency mining, social media sponsorships, and bank interest. Build multiple income streams for financial security. Prestige bonuses can multiply passive income.',
      },
      {
        question: 'What is net worth?',
        answer: 'Net worth = Money + Stock value + Real estate value + Crypto value + Company value. Net worth determines prestige eligibility (need $100M+ for first prestige). Track your net worth on the home screen.',
      },
      {
        question: 'How do loans work?',
        answer: 'Take loans from the Bank app for large purchases. Loans have weekly payments and interest rates. Defaulting on loans damages credit and reputation. Pay off loans early to save on interest. Use loans strategically for investments.',
      },
    ],
  },
  {
    category: 'Onion Browser & Hacking',
    items: [
      {
        question: 'How do I access the Onion browser?',
        answer: 'Buy a computer and purchase the Onion app from the dark web section. The Onion browser lets you access illegal hacks and dark web items. Be careful - illegal activities increase wanted level.',
      },
      {
        question: 'What do hacks do?',
        answer: 'Running hacks can earn untraceable money but carries a risk of being caught. More profitable hacks have higher risk. If caught, you may face jail time, fines, or increased wanted level. Use VPNs and exploits to reduce risk.',
      },
      {
        question: 'How do I reduce hack risk?',
        answer: 'Purchase dark web items: VPNs reduce trace chance, USB exploits lower detection, and other tools improve success rates. Higher hacking skill also reduces risk. Never hack without protection - the consequences are severe.',
      },
      {
        question: 'What is wanted level?',
        answer: 'Wanted level increases from illegal activities (hacks, crimes, illegal street jobs). High wanted level triggers police events and can lead to jail time. Wanted level decreases over time if you avoid illegal activities.',
      },
      {
        question: 'What happens in jail?',
        answer: 'If caught, you may be sentenced to jail for several weeks. In jail, you can perform activities to reduce sentence time, gain skills, or earn small amounts of money. Jail time pauses most other activities.',
      },
    ],
  },
  {
    category: 'Crypto Mining',
    items: [
      {
        question: 'How do I start mining crypto?',
        answer: 'Buy a computer and warehouse, then open the Bitcoin Mining app. Purchase your first miner from the Miners tab. Miners require warehouse space. Start with basic miners and upgrade as you earn more crypto.',
      },
      {
        question: 'Which miner is best?',
        answer: 'More expensive miners earn faster but use more power. Basic miners are good for starting. Upgrade to Advanced, Pro, Industrial, Quantum, Mega, Giga, and Tera miners as your budget grows. Balance earnings vs. power costs.',
      },
      {
        question: 'How does power consumption work?',
        answer: 'Each miner consumes power weekly. Power costs money. More powerful miners use more energy. Calculate net profit = crypto earnings - power costs. Upgrade your warehouse to hold more miners and reduce power costs.',
      },
      {
        question: 'Can I trade cryptocurrency?',
        answer: 'Yes! Use the Crypto Market tab in the mining app to buy, sell, or swap coins. Crypto prices fluctuate weekly. Popular coins include Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and others. Trade strategically to profit.',
      },
      {
        question: 'What is a warehouse?',
        answer: 'A warehouse stores your miners. Buy a warehouse to start mining. Upgrade warehouses to hold more miners (10 + 5 per level). Warehouses can have auto-repair features that maintain miners automatically for crypto payment.',
      },
      {
        question: 'How do I maximize crypto earnings?',
        answer: 'Buy the best miners you can afford, upgrade your warehouse for capacity, use auto-repair to maintain miners, mine the most profitable cryptocurrency, and reinvest earnings into more miners. Prestige bonuses can multiply crypto income.',
      },
    ],
  },
  {
    category: 'Prestige System',
    items: [
      {
        question: 'What is prestige?',
        answer: 'Prestige lets you reset your character while keeping permanent bonuses. Reach $100M net worth (or higher for subsequent prestiges) to unlock prestige. You lose progress but gain prestige points to buy powerful bonuses.',
      },
      {
        question: 'How do prestige bonuses work?',
        answer: 'Spend prestige points in the Prestige Shop to buy bonuses. Bonuses are permanent and apply to all future characters. Categories include: Starting bonuses (money, stats), Multipliers (income, experience), Unlocks (early access), and QoL (quality of life).',
      },
      {
        question: 'What happens when I prestige?',
        answer: 'You reset to age 18 with starting stats, but keep: prestige level, prestige points, unlocked bonuses, and family tree. Your previous character is added to the family tree. You start fresh but with permanent advantages.',
      },
      {
        question: 'How do I earn prestige points?',
        answer: 'Earn prestige points based on your net worth when you prestige. Higher net worth = more points. Points = (Net Worth / 1,000,000) * 0.1. Each prestige increases the required net worth threshold.',
      },
      {
        question: 'Which prestige bonuses should I buy first?',
        answer: 'Recommended order: Starting money bonuses for faster early game, Income multipliers for long-term growth, Experience multipliers for faster progression, then QoL bonuses for convenience. Focus on stackable bonuses you can buy multiple times.',
      },
      {
        question: 'Can I prestige multiple times?',
        answer: 'Yes! Each prestige increases your prestige level and the required net worth threshold. Level 0 = $100M, Level 1 = $200M, Level 2 = $300M, etc. Higher levels unlock more powerful bonuses and multipliers.',
      },
    ],
  },
  {
    category: 'Relationships & Family',
    items: [
      {
        question: 'How do I find a partner?',
        answer: 'Use the Dating app (requires phone) to swipe on profiles. Go on dates to build relationships. Successful relationships can lead to marriage. Maintain relationships by spending time and money on dates and gifts.',
      },
      {
        question: 'How does marriage work?',
        answer: 'Propose to your partner when relationship is high enough. Marriage provides happiness bonuses and unlocks children. Spouses can contribute to household income. Maintain the relationship to keep benefits.',
      },
      {
        question: 'How do I have children?',
        answer: 'Get married first, then children can be born randomly or through specific events. Children cost money to raise but can continue your legacy when you die. Educate children to improve their future careers.',
      },
      {
        question: 'What happens when I die with children?',
        answer: 'You can choose to continue as one of your children, inheriting some of your wealth and starting at their age. This lets you continue your family line. Your previous character is added to the family tree.',
      },
      {
        question: 'How do I maintain relationships?',
        answer: 'Spend time with friends and family, go on dates, give gifts, and interact positively. Relationships decay over time if neglected. High relationships provide happiness bonuses and unlock opportunities.',
      },
    ],
  },
  {
    category: 'Tips & Strategies',
    items: [
      {
        question: 'What should I focus on early game?',
        answer: 'Start with street jobs for quick money, buy a phone to unlock apps, invest in health and happiness items, get education for better careers, and save money for your first major purchase (computer or property).',
      },
      {
        question: 'How do I make money fast?',
        answer: 'Early: Street jobs and basic careers. Mid-game: Start a company, invest in stocks, buy rental properties. Late-game: Multiple income streams, crypto mining, high-level careers, and prestige bonuses. Diversify for stability.',
      },
      {
        question: 'What are the best investments?',
        answer: 'Stocks: Good for active trading. Real Estate: Best for passive income. Crypto Mining: High risk/reward. Companies: Requires management but high potential. Bank Savings: Safe but low returns. Diversify across all for best results.',
      },
      {
        question: 'How do I avoid dying early?',
        answer: 'Keep health above 50, avoid risky illegal activities, maintain happiness, get medical treatment when needed, and consider the Immortality prestige bonus to live past age 100. Balance risk vs. reward.',
      },
      {
        question: 'What should I spend gems on?',
        answer: 'Gems are premium currency. Best uses: Permanent stat boosts, exclusive items, time savers, and premium features. Save gems for high-value purchases. Some items are gem-exclusive.',
      },
      {
        question: 'How do I optimize my weekly routine?',
        answer: '1. Check and manage stats, 2. Work or run company, 3. Invest excess money, 4. Maintain relationships, 5. Buy needed items, 6. Advance week. Automate passive income sources to free up time for other activities.',
      },
    ],
  },
  {
    category: 'Contact & Support',
    items: [
      {
        question: 'How do I contact support?',
        answer: 'Tap the "Contact Support" button below to send us an email. Include your game info (week, money, age) and describe your issue. We typically respond within 24-48 hours. For bugs, include steps to reproduce.',
      },
      {
        question: 'How do I report a bug?',
        answer: 'Contact support with: What you were doing, what happened vs. what should happen, your game state (week, age, money), and any error messages. Screenshots help! We fix bugs regularly in updates.',
      },
      {
        question: 'Can I suggest features?',
        answer: 'Yes! We love feedback. Contact support with your feature ideas. Popular suggestions often get implemented in future updates. Check update notes to see new features.',
      },
    ],
  },
];

export default function HelpModal({ visible, onClose }: HelpModalProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = helpContent
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  const toggleItem = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const overlayStyle = [styles.overlay, settings.darkMode && styles.overlayDark];
  const modalStyle = [styles.modal, settings.darkMode && styles.modalDark];
  const itemTextStyle = [styles.itemText, settings.darkMode && styles.itemTextDark];
  const answerStyle = [styles.answer, settings.darkMode && styles.answerDark];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={overlayStyle}>
        <View style={modalStyle}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Help</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.searchInput, settings.darkMode && styles.searchInputDark]}
            placeholder="Search..."
            placeholderTextColor={settings.darkMode ? '#9CA3AF' : '#6B7280'}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {filtered.map((section) => (
              <View key={section.category} style={styles.section}>
                <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
                  {section.category}
                </Text>
                {section.items.map((item) => {
                  const key = section.category + item.question;
                  return (
                    <View key={key} style={styles.item}>
                      <TouchableOpacity onPress={() => toggleItem(key)}>
                        <Text style={itemTextStyle}>{item.question}</Text>
                      </TouchableOpacity>
                      {expanded[key] && <Text style={answerStyle}>{item.answer}</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.contactButton, settings.darkMode && styles.contactButtonDark]}
            onPress={() => {
              const subject = 'DeepLife Simulator - Support Request';
              const body = `Hello,\n\nI need help with DeepLife Simulator.\n\nGame Info:\nWeek: ${gameState.week}\nMoney: $${Math.floor(gameState.stats.money)}\nAge: ${Math.floor(gameState.date.age)}\n\nPlease describe your issue here:`;
              const emailUrl = `mailto:deeplifesimulator@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              
              Linking.openURL(emailUrl).then(() => {
                Alert.alert('Email Prepared', 'Your email app will open with a pre-filled message. Please send the email to contact our support team.');
              }).catch(() => {
                Alert.alert('Error', 'Could not open email app. Please email deeplifesimulator@gmail.com directly.');
              });
            }}
          >
            <Mail size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayDark: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 16,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    color: '#111827',
  },
  searchInputDark: {
    borderColor: '#374151',
    color: '#F9FAFB',
  },
  content: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  item: {
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#1F2937',
  },
  itemTextDark: {
    color: '#F9FAFB',
  },
  answer: {
    marginTop: 4,
    fontSize: 13,
    color: '#4B5563',
  },
  answerDark: {
    color: '#D1D5DB',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  contactButtonDark: {
    backgroundColor: '#1D4ED8',
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
