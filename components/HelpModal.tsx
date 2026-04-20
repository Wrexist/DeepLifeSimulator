import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, Mail } from 'lucide-react-native';
import { SUPPORT_EMAIL } from '@/lib/config/appConfig';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

const helpContent = [
  {
    category: 'Getting Started',
    items: [
      {
        question: 'How do I play DeepLife Simulator?',
        answer: 'DeepLife is a life simulation game where you make choices and manage your character\'s life. Start at age 18 with basic stats. Each week, you can work, invest, build relationships, and make life decisions. Tap "Next Week" to advance time. Your goal is to build wealth, achieve goals, and create a legacy. The game continues across generations through the Legacy system or resets with bonuses through Prestige.',
      },
      {
        question: 'How do I progress to the next week?',
        answer: 'Tap the green "Next Week" button on the top bar. Each week advances time by 7 days, updates your stats, processes income/expenses, triggers random events, and applies disease effects. Your character ages approximately 0.019 years per week (about 1 week of age). Energy regenerates automatically each week. All passive income, investments, and recurring costs are processed weekly.',
      },
      {
        question: 'What should I do first?',
        answer: '1. Get a street job for quick money. 2. Buy a phone to unlock mobile apps (Bank, Social Media, Dating). 3. Buy food and entertainment items to maintain health and happiness. 4. Save money for your first major purchase (computer or property). 5. Get education for better careers. 6. Start investing early - compound interest is powerful! Focus on building passive income streams.',
      },
      {
        question: 'How does the game save my progress?',
        answer: 'Your game saves automatically after each week progression and after major actions. You can also manually save from Settings. Cloud save syncs your progress across devices (iOS, Android, Web). Enable cloud save in Settings to access your game from any device. Save files are stored locally and in the cloud for backup.',
      },
    ],
  },
  {
    category: 'Core Stats Explained',
    items: [
      {
        question: 'What are all the stats and what do they do?',
        answer: 'Health (❤️): Your physical well-being. Affects lifespan, prevents diseases, and reduces negative events. Keep above 50 to avoid health issues. If health reaches 0 for 4 weeks, you die. Happiness (😊): Your mental well-being. Affects job performance, relationships, and prevents depression. Low happiness reduces career success. If happiness reaches 0 for 4 weeks, you die. Energy (⚡): Required for most actions. Regenerates 30 points weekly (more with prestige bonuses). Low energy prevents some activities. Fitness: Improves job performance, health, and unlocks some careers. Reputation: Affects career opportunities, social interactions, and political careers. Money: Your currency for purchases, investments, and expenses. Gems: Premium currency earned from achievements and purchases.',
      },
      {
        question: 'How do stats change over time?',
        answer: 'Stats naturally decay each week based on your wealth (poorer characters decay faster). Health decays ~2.4 points/week, Happiness decays ~3.2 points/week. Working a job reduces health by 2 and happiness by 3 per week. Education reduces health by 3 per week (more if multiple courses). Diseases apply negative effects weekly. Items, activities, and relationships can boost stats. Energy regenerates 30 points weekly (more with prestige bonuses). Keep stats balanced by buying items, maintaining relationships, and avoiding overwork.',
      },
      {
        question: 'What happens when stats reach 0?',
        answer: 'If Health reaches 0: You have 4 weeks to improve it or you die. A warning popup appears each week showing weeks remaining. If Happiness reaches 0: You have 4 weeks to improve it or you die. Same warning system applies. Death triggers a popup with options: Continue as a child (if you have children), Revive with gems (15,000 gems), or Start a new life. Keep both health and happiness above 20 to avoid the warning system.',
      },
      {
        question: 'How do I increase my stats?',
        answer: 'Health: Buy healthy food, visit doctor/hospital, exercise at gym, buy health items, maintain good fitness, avoid diseases. Happiness: Buy entertainment items, maintain relationships, go on dates, buy pets, purchase nice properties, achieve goals, avoid negative events. Energy: Regenerates automatically each week (30 base, more with prestige). Buy energy drinks for immediate boost. Fitness: Work out at gym, play sports hobbies, maintain active lifestyle. Reputation: Successful careers, achievements, positive social interactions, charitable actions, avoid criminal activities.',
      },
      {
        question: 'What is the stat decay system?',
        answer: 'Stats naturally decay each week to simulate aging and life challenges. Decay rate depends on wealth: Poorer characters (low net worth) decay faster (up to 2x rate). Wealthier characters decay slower (minimum 0.5x rate). Base decay: Health -2.4/week, Happiness -3.2/week. Working adds: Health -2, Happiness -3. Education adds: Health -3 per course (more if multiple). This creates a balance - you need to work and study, but must maintain your well-being. Prestige bonuses can reduce decay rates.',
      },
    ],
  },
  {
    category: 'Disease System',
    items: [
      {
        question: 'How does the disease system work?',
        answer: 'Diseases can randomly occur based on your health, fitness, age, and lifestyle. Each disease has severity (mild, serious, critical), effects on stats, and treatment requirements. Diseases apply negative stat effects each week until cured. Some diseases can be cured naturally over time, others require treatment. Critical diseases can cause death if untreated. The system tracks disease history, immunities, and complications.',
      },
      {
        question: 'How do I get diseases?',
        answer: 'Diseases occur randomly each week based on risk factors: Low health increases risk (health < 60 = 60% higher risk). Low fitness increases risk. Older age increases risk for some diseases. Previous diseases can increase risk. Some diseases grant immunity after recovery. The base chance is low (1-2% per week), but risk factors multiply it. Keep health and fitness high to reduce disease risk.',
      },
      {
        question: 'How do I cure diseases?',
        answer: 'Doctor Visit: Costs $500, 50% chance to cure each curable disease. Can cure multiple diseases in one visit. Hospital Stay: Costs $2,000, 100% chance to cure ALL curable diseases. Best for multiple diseases. Natural Recovery: Some diseases (like Common Cold) heal naturally over 2-4 weeks if you maintain good health (>70) and fitness (>50). Faster recovery with better stats. Experimental Treatment: Required for critical diseases like Cancer. Very expensive but can save your life.',
      },
      {
        question: 'What are disease severities?',
        answer: 'Mild: Small stat penalties (-2 to -5), often heal naturally, low risk. Examples: Common Cold, Minor Infection, Fatigue. Serious: Moderate stat penalties (-5 to -10), may require treatment, higher risk. Examples: Flu, Pneumonia, High Stress. Critical: Severe stat penalties (-10 to -20), can cause death if untreated, requires immediate treatment. Examples: Cancer, Heart Disease. Chronic: Manageable but not curable, permanent stat penalties. Examples: Diabetes, Chronic Pain.',
      },
      {
        question: 'What happens if I don\'t treat a disease?',
        answer: 'Diseases apply negative stat effects each week until cured. Critical diseases have a death countdown (e.g., Cancer: 20 weeks until death). If countdown reaches 0, you die. Some diseases can worsen or cause complications if untreated. Natural recovery diseases will heal eventually, but you suffer stat penalties the entire time. Always treat critical diseases immediately. For mild diseases, natural recovery may be acceptable if you have good stats.',
      },
      {
        question: 'How does disease immunity work?',
        answer: 'Some diseases grant immunity after recovery (like real vaccines). Once immune, you cannot contract that disease again. Immunity is tracked permanently in your disease history. Doctor visits and hospital stays can grant immunity for certain diseases. This makes early treatment valuable - you build immunity for future protection. Check your disease history to see immunities.',
      },
    ],
  },
  {
    category: 'Life Moments System',
    items: [
      {
        question: 'What are Life Moments?',
        answer: 'Life Moments are special decision events that appear randomly throughout your life. They present meaningful choices with immediate effects and hidden long-term consequences. Your choices in Life Moments can unlock future events, modify event probabilities, add hidden traits, and affect relationships. Life Moments create a connected story where past decisions matter.',
      },
      {
        question: 'How do Life Moments work?',
        answer: 'Life Moments appear randomly (typically 1-2 per year). Each moment presents a situation with 2-4 choices. Choices have immediate effects (stat changes, money) and hidden consequences (unlock events, modify weights, add traits). Hidden consequences activate immediately or after a delay (weeks). Your choice history affects future events - the game remembers your decisions. Some events reference past choices with "You remember..." messages.',
      },
      {
        question: 'What are hidden consequences?',
        answer: 'Hidden consequences are long-term effects of your choices that activate later. Types: Unlock Event - Makes a future event available. Lock Event - Prevents a future event from appearing. Modify Weight - Changes probability of future events. Add Trait - Gives you a hidden trait affecting gameplay. Relationship Flag - Affects specific relationships. Consequences can activate immediately or after weeks/delays. You won\'t know the full impact until later - choose wisely!',
      },
      {
        question: 'How do I know what choice to make?',
        answer: 'Read the situation carefully and consider your character\'s goals. Immediate effects are shown, but hidden consequences are not. Think about long-term implications: Will this unlock opportunities? Could this lock me out of something? Does this fit my character\'s path? There\'s no "right" answer - different choices lead to different story paths. Your choice history creates a unique narrative. Experiment and see what happens!',
      },
    ],
  },
  {
    category: 'Events System',
    items: [
      {
        question: 'How do random events work?',
        answer: 'Random events occur approximately 8-12% of weeks (about 1 in 10 weeks). Events are triggered based on your game state, stats, and risk factors. There\'s a pity system: if you go 6 weeks without an event, you\'re guaranteed one. Events can be positive (lottery win, job bonus) or negative (unexpected bill, burglary). Seasonal events occur 1-2 times per season. Economic events are rare but long-lasting (4-12 weeks).',
      },
      {
        question: 'What types of events are there?',
        answer: 'Regular Events: Random weekly events (job bonus, unexpected bill, lottery, etc.). Seasonal Events: Occur during specific seasons (spring festival, summer vacation, etc.). Economic Events: Long-lasting economic states (recession, boom, inflation). Personal Crisis Events: Triggered by low stats or specific conditions. Chained Events: Follow-up events from previous choices. Political Events: For political careers (elections, policies, scandals).',
      },
      {
        question: 'How do event choices affect the game?',
        answer: 'Event choices have immediate effects (money, stats) and can trigger chained events. Some choices unlock future events or modify event probabilities. Your choice history is tracked and can affect future events. Positive choices often lead to positive follow-ups. Negative choices can have consequences. Some events reference past choices. Think strategically about long-term implications.',
      },
      {
        question: 'Can I avoid negative events?',
        answer: 'Some events are triggered by risk factors: Low money = higher economic event risk. Low health = higher health event risk. Low relationships = higher social event risk. High wanted level = higher police event risk. Maintaining good stats and avoiding risky activities reduces negative event probability. However, some events are random and unavoidable. The pity system ensures you get events regularly, so some negative events are expected.',
      },
    ],
  },
  {
    category: 'Work & Careers',
    items: [
      {
        question: 'How do I get a job?',
        answer: 'Visit the Work tab and browse available careers. Each career shows requirements (education, fitness, age, items). Apply for careers you qualify for. Some careers unlock at certain ages (e.g., CEO at age 40+). Prestige bonuses can unlock early career access. Street jobs are available from age 18 with no requirements. Better careers require education and experience.',
      },
      {
        question: 'What are street jobs?',
        answer: 'Street jobs are quick gigs available from age 18 with no requirements. They pay immediately but have lower earnings than careers. Legal jobs: Delivery, Construction, Retail. Illegal jobs: Street Hustle, Network Testing (increase wanted level). Good for early game money before you get education. Some street jobs are underground and require special skills/items.',
      },
      {
        question: 'How do promotions work?',
        answer: 'Each week you have a chance for promotion based on: Your stats (higher = better chance), Mindset perks (career-focused perks help), Career level (higher levels = harder to promote), Random chance. Promotions increase salary significantly and unlock new career paths. Some careers have multiple levels (e.g., Junior → Senior → Lead). Higher education and fitness improve promotion chances.',
      },
      {
        question: 'What is education and how do I get it?',
        answer: 'Education unlocks better careers and increases promotion chances. Visit the Education tab (or Education app) to enroll. Education costs money and takes weeks to complete. Types: High School (basic requirement), University (unlocks professional careers), Specialized Training (unlocks expert careers). You can enroll in multiple courses simultaneously, but each adds health penalty. Prestige bonuses can unlock early education access or reduce costs.',
      },
      {
        question: 'How do I start a company?',
        answer: 'Buy a computer, then open the Company app. You need education and capital ($10,000+) to start. Companies generate passive income weekly. Hire workers to increase production. Upgrade facilities to improve efficiency. Manage your company weekly to maximize profits. Family businesses can be passed down through generations. Companies require ongoing management but provide excellent passive income.',
      },
      {
        question: 'What are Family Businesses?',
        answer: 'Family businesses are companies that can be inherited by your children when you die. They continue generating income across generations. The number of generations held increases each time they\'re passed down. Multi-generational businesses may unlock special bonuses. This creates a powerful legacy - your business empire grows across generations.',
      },
      {
        question: 'How does job performance work?',
        answer: 'Job performance affects promotion chances and bonuses. Factors: Health (higher = better), Happiness (higher = better), Fitness (higher = better), Education (relevant education helps), Reputation (high reputation helps). Low stats reduce performance and promotion chances. Some careers have specific stat requirements. Maintain good stats to maximize career success.',
      },
    ],
  },
  {
    category: 'Apps & Features',
    items: [
      {
        question: 'What mobile apps are available?',
        answer: 'Phone apps: Bank (savings, loans, credit), Social Media (posting, followers, sponsorships), Dating (swipe, dates, relationships), Contacts (manage relationships), Education (enroll in courses), Stocks (mobile trading). Buy a phone from the Shop to unlock mobile apps. Some apps require additional items or achievements.',
      },
      {
        question: 'What computer apps are available?',
        answer: 'Computer apps: Bitcoin Mining (crypto mining), Real Estate (property management), Stocks (trading), Company (business management), Onion Browser (dark web), YouVideo (gaming/streaming), Travel (trips), Political (political career). Buy a computer from the Shop to unlock desktop apps. Some apps require additional items, achievements, or specific conditions.',
      },
      {
        question: 'How does Social Media work?',
        answer: 'Post content to gain followers. More followers = more sponsorship income. Post regularly to maintain followers (they decrease if you don\'t post). Engage with trending topics for bonus followers. High follower counts unlock premium features and higher earnings. Social media provides passive income from sponsorships. It\'s a long-term investment - build your audience over time.',
      },
      {
        question: 'How does the Dating app work?',
        answer: 'Swipe left (pass) or right (like) on profiles. If both like each other, you match! Go on dates to build relationships. Dates cost money but increase relationship score. Successful relationships can lead to marriage. Maintain relationships by spending time and money on dates and gifts. Higher relationship score = better chances of marriage and relationship benefits.',
      },
      {
        question: 'What is the Bank app?',
        answer: 'The Bank app lets you: Save money with weekly interest, Take out loans for large purchases, Manage credit score, View transaction history, Track finances. Savings accounts earn interest weekly (low but safe). Loans require weekly payments with interest. Good credit = better loan terms. Use bank for emergency funds and strategic loans.',
      },
      {
        question: 'What is the Onion Browser?',
        answer: 'The Onion Browser (dark web) lets you access illegal hacks, dark web items, and underground activities. Purchase VPNs, exploits, and other tools. Running hacks can earn untraceable money but carries risk of being caught. Use protection (VPNs, exploits) to reduce risk. Illegal activities increase wanted level. High risk, high reward gameplay.',
      },
      {
        question: 'What is YouVideo?',
        answer: 'YouVideo is a gaming/streaming app where you create videos and stream content. Earn money from views, sponsorships, and subscribers. Upgrade equipment to improve video quality and earnings. Build your channel and audience over time. Provides passive income from content. Requires computer and can be a significant income source.',
      },
    ],
  },
  {
    category: 'Money & Finance',
    items: [
      {
        question: 'How do I make money?',
        answer: 'Work: Street jobs (immediate, low pay) or Careers (weekly salary, higher pay). Investments: Stocks (dividends + capital gains), Real Estate (rental income), Cryptocurrency (mining + trading), Companies (passive income). Other: Social Media sponsorships, Bank interest, Achievements, Events, Relationships, Hacks (risky, illegal). Diversify income sources for stability.',
      },
      {
        question: 'What is passive income?',
        answer: 'Passive income is money earned automatically each week without active work. Sources: Stock dividends (from dividend-paying stocks), Rental properties (weekly rent income), Company profits (from your businesses), Cryptocurrency mining (from miners), Social media sponsorships (from followers), Bank interest (from savings). Passive income is key to wealth building - it compounds over time. Focus on building multiple passive income streams.',
      },
      {
        question: 'How do I maximize passive income?',
        answer: '1. Invest in dividend stocks early and reinvest dividends. 2. Buy rental properties - they provide steady weekly income. 3. Start companies and hire workers to scale. 4. Mine cryptocurrency with good miners. 5. Grow social media following for sponsorships. 6. Save money in bank accounts for interest. 7. Use prestige bonuses to multiply passive income. 8. Reinvest all passive income to compound growth. The key is starting early and reinvesting everything.',
      },
      {
        question: 'What is net worth?',
        answer: 'Net worth = Money + Bank Savings + Stock value + Real estate value + Crypto value + Company value + Vehicle value + Collectibles - Debts (loans). Net worth determines prestige eligibility (need $100M+ for first prestige). Track your net worth on the home screen. Net worth is your total wealth, not just cash. Diversify assets to grow net worth.',
      },
      {
        question: 'How do loans work?',
        answer: 'Take loans from the Bank app for large purchases. Loans have weekly payments and interest rates. Interest rates depend on credit score (good credit = lower rates). Defaulting on loans (missing payments) damages credit and reputation. Pay off loans early to save on interest. Use loans strategically for investments that generate more income than the loan cost. Don\'t take loans you can\'t afford to repay.',
      },
      {
        question: 'What is credit score?',
        answer: 'Credit score affects loan eligibility and interest rates. Good credit (700+) = better loan terms and lower interest. Pay loans on time to improve credit. Defaulting on loans damages credit significantly. Credit score is tracked in the Bank app. Build good credit early by taking small loans and paying them on time. Good credit saves money on large purchases.',
      },
      {
        question: 'How do I save money?',
        answer: 'Save money in bank accounts to earn interest. Higher savings = more interest (but still low returns). Savings are safe but provide lower returns than investments. Use savings for emergency funds and short-term goals. For long-term wealth, invest in stocks, real estate, and businesses. Bank savings are good for liquidity but not wealth building.',
      },
      {
        question: 'What are the best investments?',
        answer: 'Stocks: Good for active trading and dividends. Buy low, sell high. Dividends provide passive income. Real Estate: Best for passive income and long-term growth. Rental properties generate weekly income. Crypto Mining: High risk/reward with potential for large returns. Requires warehouse and miners. Companies: Requires management but high potential. Hire workers and upgrade. Diversify across all for best results - don\'t put all eggs in one basket.',
      },
    ],
  },
  {
    category: 'Investments Deep Dive',
    items: [
      {
        question: 'How do stocks work?',
        answer: 'Buy stocks in the Stocks app (requires computer). Stock prices fluctuate weekly based on market conditions. Buy low, sell high to profit. You can buy by number of shares or dollar amount. Dividends provide passive income weekly. Some stocks pay dividends, others don\'t. Watch market trends and company performance. Economic events affect stock prices. Diversify across multiple stocks to reduce risk.',
      },
      {
        question: 'How do I invest in real estate?',
        answer: 'Open the Real Estate app (requires computer). Browse available properties. Properties generate weekly rent income (typically 0.5-2% of property value per week). Properties can be upgraded to increase value and rent. Some properties unlock at certain ages or require specific conditions. Real estate is a long-term investment - buy and hold for passive income. Properties appreciate in value over time.',
      },
      {
        question: 'What is cryptocurrency mining?',
        answer: 'Buy miners in the Bitcoin Mining app (requires computer and warehouse). Miners generate cryptocurrency weekly based on their power. More expensive miners earn faster but use more power. Power costs money - calculate net profit = crypto earnings - power costs. Miners degrade over time (2-5% per week) and need repair. You can trade crypto directly in the Crypto Market tab. Crypto prices fluctuate weekly.',
      },
      {
        question: 'How do I maximize crypto earnings?',
        answer: 'Buy the best miners you can afford. Upgrade your warehouse for capacity (10 + 5 per level). Use auto-repair to maintain miners (costs crypto but prevents degradation). Mine the most profitable cryptocurrency (prices change). Reinvest earnings into more miners to scale. Prestige bonuses can multiply crypto income. Balance miner costs vs. power costs vs. earnings. Start small and scale up as you earn more.',
      },
      {
        question: 'How does auto-reinvest work?',
        answer: 'Auto-reinvest automatically uses dividends/income to buy more stocks. Enable it in the Stocks app settings. Set a percentage (0-100%) of income to reinvest. Reinvested money is NOT added to your cash - it goes directly to stocks. This compounds your investments automatically. Great for passive wealth building. You can disable it anytime to receive cash instead.',
      },
    ],
  },
  {
    category: 'Underground & Crime',
    items: [
      {
        question: 'What are underground jobs?',
        answer: 'Underground jobs are illegal or risky activities that pay well but increase wanted level. Examples: Hacking, Theft, Smuggling, Network Testing. These jobs require special items (purchased with BTC) and skills. Higher risk = higher reward. Use VPNs and exploits to reduce detection chance. Illegal jobs are accessed through the Onion Browser.',
      },
      {
        question: 'What is wanted level?',
        answer: 'Wanted level increases from illegal activities (hacks, crimes, illegal street jobs). High wanted level triggers police events and can lead to jail time. Wanted level decreases over time if you avoid illegal activities (about 1 point per week). Higher wanted levels take longer to decrease. You can use certain items or services to reduce wanted level faster. Keep wanted level low to avoid police attention.',
      },
      {
        question: 'What happens if I get caught?',
        answer: 'If caught doing illegal activities, you may face: Jail time (several weeks), Fines (money), Increased wanted level, Reputation loss, Criminal record. Jail time pauses most other activities. You can perform activities in jail to reduce sentence time or gain skills. Use VPNs and exploits to reduce detection chance. Higher wanted level = higher risk of being caught.',
      },
      {
        question: 'How do I reduce hack risk?',
        answer: 'Purchase dark web items: VPNs reduce trace chance, USB exploits lower detection, Other tools improve success rates. Higher hacking skill also reduces risk. Never hack without protection - the consequences are severe. Better protection = lower risk but still risky. Consider if the reward is worth the risk.',
      },
      {
        question: 'What are talent trees?',
        answer: 'Talent trees are skill progression systems for underground activities. Three trees: Stealth, Technology, and Lockpicking. Each talent provides +5% success rate and +10% payment bonus. Unlock talents by spending talent points earned from activities. Higher skills = better jobs and higher success rates. Focus on one tree or diversify based on your playstyle.',
      },
    ],
  },
  {
    category: 'Relationships & Family',
    items: [
      {
        question: 'How do I find a partner?',
        answer: 'Use the Dating app (requires phone) to swipe on profiles. Swipe right to like, left to pass. If both like each other, you match! Go on dates to build relationships. Dates cost money but increase relationship score. Successful relationships can lead to marriage. Maintain relationships by spending time and money on dates and gifts. Higher relationship score = better chances of marriage.',
      },
      {
        question: 'How does marriage work?',
        answer: 'Propose to your partner when relationship score is high enough (typically 80+). Marriage provides happiness bonuses and unlocks children. Spouses can contribute to household income (if they have a career). Maintain the relationship to keep benefits. You can only have one spouse at a time. Divorce is possible but damages reputation and relationships.',
      },
      {
        question: 'How do I have children?',
        answer: 'Get married first, then children can be born randomly or through specific events. Children cost money to raise (weekly expenses). Educate children to improve their future careers and inheritance bonuses. Children can continue your legacy when you die. Children under 18 are automatically simulated to age 18 when you continue as them. You can have multiple children.',
      },
      {
        question: 'What happens when I die with children?',
        answer: 'You can choose to continue as one of your children, inheriting 10% of your net worth (with education/career bonuses) plus their personal savings. Children under 18 are automatically simulated to age 18. Your previous character is added to the family tree. Generation number increases. This is the Legacy system - continue your family line across generations.',
      },
      {
        question: 'How is inheritance calculated?',
        answer: 'Base inheritance = 10% of parent\'s total net worth (cash + bank + real estate + companies + stocks - debts). Bonuses: +20% for university education, +30% for specialized education, +10% for professional/entrepreneur careers. Plus the child\'s personal savings. Educated children with careers inherit significantly more. This rewards investing in your children\'s future.',
      },
      {
        question: 'How do I maintain relationships?',
        answer: 'Spend time with friends and family. Go on dates with partners. Give gifts (costs money but increases relationship). Interact positively in events. Relationships decay over time if neglected. High relationships provide happiness bonuses and unlock opportunities. Some relationships are more important than others - focus on spouse and children.',
      },
    ],
  },
  {
    category: 'Prestige System',
    items: [
      {
        question: 'What is prestige?',
        answer: 'Prestige lets you reset your character while keeping permanent bonuses. Reach $100M net worth (or higher for subsequent prestiges) to unlock prestige. You lose all progress (age, stats, money, items) but gain prestige points to buy powerful bonuses. Prestige bonuses are permanent and apply to all future characters. This creates a progression system where each "life" gets easier.',
      },
      {
        question: 'How do prestige bonuses work?',
        answer: 'Spend prestige points in the Prestige Shop to buy bonuses. Bonuses are permanent and apply to all future characters. Categories: Starting bonuses (money, stats), Multipliers (income, experience), Unlocks (early access to careers/education), QoL (quality of life improvements). Many bonuses can be bought multiple times (stackable). Focus on stackable bonuses for maximum effect.',
      },
      {
        question: 'What happens when I prestige?',
        answer: 'You reset to age 18 with starting stats, but keep: Prestige level, Prestige points, Unlocked bonuses, Family tree. Your previous character is added to the family tree. You start fresh but with permanent advantages. This is different from Legacy (continuing as a child) - prestige resets everything but keeps bonuses.',
      },
      {
        question: 'How do I earn prestige points?',
        answer: 'Earn prestige points based on your net worth when you prestige. Formula: Points = (Net Worth / 1,000,000) * 0.1. Example: $100M net worth = 10 points, $200M = 20 points, $1B = 100 points. Higher net worth = more points. Each prestige increases the required net worth threshold (Level 0 = $100M, Level 1 = $200M, etc.).',
      },
      {
        question: 'Which prestige bonuses should I buy first?',
        answer: 'Recommended order: 1. Starting money bonuses (faster early game), 2. Income multipliers (long-term growth), 3. Experience multipliers (faster progression), 4. QoL bonuses (convenience), 5. Unlock bonuses (early access). Focus on stackable bonuses you can buy multiple times. Starting money is most impactful for early game speed.',
      },
      {
        question: 'What\'s the difference between Prestige and Legacy?',
        answer: 'Prestige: Reset at $100M+ net worth, gain prestige points, keep prestige bonuses, generation stays same, lose all progress. Legacy: Continue as child when you die, inherit 10% wealth, generation increases, NO prestige points gained, keep family tree. Use prestige for bonuses and faster progression. Use legacy for family continuity and generation achievements.',
      },
    ],
  },
  {
    category: 'Vehicles & Items',
    items: [
      {
        question: 'How do vehicles work?',
        answer: 'Vehicles provide transportation bonuses (reputation, happiness, career opportunities). Buy vehicles from the Shop. Vehicles depreciate over time based on mileage and condition. Higher mileage and lower condition = lower value. You can sell vehicles for their depreciated value. Better maintenance keeps vehicles in better condition. Some vehicles are required for certain careers.',
      },
      {
        question: 'What items can I buy?',
        answer: 'Items include: Food (health), Entertainment (happiness), Energy drinks (energy), Gym access (fitness), Phones, Computers, Vehicles, Collectibles, Health items, Pet toys, and more. Items can be one-time use or provide weekly bonuses. Check item descriptions for effects. Some items unlock features (phones, computers). Collectibles can appreciate in value.',
      },
      {
        question: 'What are collectibles?',
        answer: 'Collectibles are rare items that can appreciate in value over time. They can be purchased from the Shop or found through special events. Collectibles are included in net worth calculations and can be sold for profit. Some collectibles are very rare and valuable. They\'re a long-term investment - buy and hold for appreciation.',
      },
    ],
  },
  {
    category: 'Advanced Strategies',
    items: [
      {
        question: 'What\'s the best early game strategy?',
        answer: '1. Get street job for quick money. 2. Buy phone immediately (unlocks apps). 3. Buy food/entertainment to maintain stats. 4. Save for computer ($5,000+). 5. Start investing early (stocks or real estate). 6. Get education for better careers. 7. Build passive income streams. 8. Maintain health and happiness. Focus on building wealth, not just spending. Compound interest is powerful!',
      },
      {
        question: 'How do I make money fast?',
        answer: 'Early: Street jobs and basic careers. Mid-game: Start a company, invest in stocks, buy rental properties. Late-game: Multiple income streams, crypto mining, high-level careers, prestige bonuses. Risky: Hacks (illegal, high reward but dangerous). Best strategy: Diversify across all income sources. Don\'t rely on one method. Passive income compounds over time.',
      },
      {
        question: 'How do I avoid dying early?',
        answer: 'Keep health above 50 (buy food, visit doctor, exercise). Keep happiness above 50 (buy entertainment, maintain relationships). Avoid risky illegal activities (high wanted level = police events). Get medical treatment when needed (diseases can kill). Consider Immortality prestige bonus to live past age 100. Balance risk vs. reward. Don\'t neglect your stats for money.',
      },
      {
        question: 'What should I spend gems on?',
        answer: 'Gems are premium currency. Best uses: Permanent stat boosts (long-term value), Exclusive items (unlock features), Time savers (convenience), Premium features. Save gems for high-value purchases. Some items are gem-exclusive. Don\'t waste gems on temporary boosts - focus on permanent improvements. Achievements are the main source of free gems.',
      },
      {
        question: 'How do I optimize my weekly routine?',
        answer: '1. Check and manage stats (buy items if needed). 2. Work or run company. 3. Invest excess money (stocks, real estate, crypto). 4. Maintain relationships (dates, gifts). 5. Handle events and life moments. 6. Advance week. Automate passive income sources to free up time. Balance active income (work) with passive income (investments). Don\'t micromanage - let passive income work for you.',
      },
      {
        question: 'What are the best long-term investments?',
        answer: 'Real Estate: Best passive income, steady weekly rent, property appreciation. Stocks: Good for dividends and growth, requires active management. Companies: High potential, requires management, can scale with workers. Crypto Mining: High risk/reward, requires warehouse and miners. Diversify across all for best results. Start early and reinvest everything. Compound interest is your friend.',
      },
      {
        question: 'How do I build a legacy?',
        answer: '1. Build wealth (net worth). 2. Have children and educate them. 3. Start family businesses (inheritable). 4. Achieve goals and unlock achievements. 5. Continue as child when you die (Legacy system). 6. Each generation builds on the last. 7. Higher generations can unlock special bonuses. Focus on education and careers for children - they inherit more with bonuses.',
      },
    ],
  },
  {
    category: 'Crypto Mining',
    items: [
      {
        question: 'How do I start mining crypto?',
        answer: 'Buy a computer and warehouse, then open the Bitcoin Mining app. Purchase your first miner from the Miners tab. Miners require warehouse space. Start with basic miners and upgrade as you earn more crypto. You need both a computer (to access the app) and a warehouse (to store miners). Miners generate cryptocurrency weekly based on their power rating.',
      },
      {
        question: 'Which miner is best?',
        answer: 'More expensive miners earn faster but use more power. Basic miners are good for starting. Upgrade path: Basic → Advanced → Pro → Industrial → Quantum → Mega → Giga → Tera miners. Each tier earns significantly more but costs more and uses more power. Balance earnings vs. power costs. Start with what you can afford and upgrade as you earn more crypto.',
      },
      {
        question: 'How does power consumption work?',
        answer: 'Each miner consumes power weekly. Power costs money. More powerful miners use more energy. Calculate net profit = crypto earnings - power costs. Upgrade your warehouse to hold more miners and reduce power costs. Power costs scale with the number and power of miners. Efficient warehouses can reduce power costs. Always calculate net profit, not just gross earnings.',
      },
      {
        question: 'Can I trade cryptocurrency?',
        answer: 'Yes! Use the Crypto Market tab in the mining app to buy, sell, or swap coins. Crypto prices fluctuate weekly. Popular coins include Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and others. Trade strategically to profit from price movements. You can hold multiple cryptocurrencies. Prices are affected by economic events and market conditions.',
      },
      {
        question: 'What is a warehouse?',
        answer: 'A warehouse stores your miners. Buy a warehouse to start mining. Upgrade warehouses to hold more miners (base capacity: 10 miners, +5 per upgrade level). Warehouses can have auto-repair features that maintain miners automatically for crypto payment. Higher level warehouses hold more miners and may reduce power costs. Warehouses are essential for crypto mining.',
      },
      {
        question: 'How do I maximize crypto earnings?',
        answer: 'Buy the best miners you can afford, upgrade your warehouse for capacity, use auto-repair to maintain miners, mine the most profitable cryptocurrency, and reinvest earnings into more miners. Prestige bonuses can multiply crypto income. Miners degrade over time (2-5% per week) and need repair. Start small, scale up gradually. Diversify across multiple miners for stability.',
      },
      {
        question: 'How does auto-repair work?',
        answer: 'Enable auto-repair in your warehouse settings. It automatically repairs all miners below 50% durability each week using cryptocurrency. You set which crypto to use and the weekly cost. Auto-repair keeps your mining operation running smoothly without manual maintenance. Miners degrade over time, so auto-repair is essential for long-term mining operations. The cost is worth it to maintain production.',
      },
      {
        question: 'What happens when miners degrade?',
        answer: 'Miners degrade 2-5% per week based on usage and type. Degraded miners produce less cryptocurrency. At 0% durability, miners stop working completely. Repair costs cryptocurrency. Auto-repair can maintain miners automatically. Regular maintenance is essential for consistent earnings. Higher tier miners may degrade slower but cost more to repair.',
      },
    ],
  },
  {
    category: 'Mobile Apps',
    items: [
      {
        question: 'What mobile apps are available?',
        answer: 'Phone apps include: Bank (savings, loans, credit management), Social Media (posting, followers, sponsorships), Dating (swipe, dates, relationships), Contacts (manage relationships), Education (enroll in courses), Stocks (mobile trading), and more. Buy a phone from the Shop to unlock mobile apps. Each app has specific features and requirements.',
      },
      {
        question: 'How do I unlock mobile apps?',
        answer: 'Buy a phone from the Shop to unlock mobile apps. Some apps require additional items or achievements. Check each app for specific requirements. Apps appear in the Mobile tab once unlocked. The phone is the key item - without it, you cannot access any mobile apps. Some premium apps may require additional purchases or achievements.',
      },
      {
        question: 'What is the Bank app?',
        answer: 'The Bank app lets you: save money with weekly interest, take out loans for large purchases, manage credit score, view transaction history, and track finances. Savings accounts earn interest weekly (low but safe returns). Loans require weekly payments with interest. Good credit = better loan terms. Use bank for emergency funds and strategic loans. Track all your financial transactions here.',
      },
      {
        question: 'How does Social Media work?',
        answer: 'Post content to gain followers. More followers = more sponsorship income. Post regularly to maintain followers (they decrease if you don\'t post). Engage with trending topics for bonus followers. High follower counts unlock premium features and higher earnings. Social media provides passive income from sponsorships. It\'s a long-term investment - build your audience over time. Consistency is key.',
      },
      {
        question: 'How does the Dating app work?',
        answer: 'Swipe left (pass) or right (like) on profiles. If both like each other, you match! Go on dates to build relationships. Dates cost money but increase relationship score. Successful relationships can lead to marriage. Maintain relationships by spending time and money on dates and gifts. Higher relationship score = better chances of marriage and relationship benefits. Be selective - quality over quantity.',
      },
      {
        question: 'What is the Contacts app?',
        answer: 'The Contacts app shows all your relationships: partners, spouses, children, friends, and family. View relationship scores, interact with contacts, propose marriage, break up, move in together, and manage your social network. Track relationship history and interactions. Maintain relationships to keep them strong. Relationships decay over time if neglected.',
      },
      {
        question: 'How do I use the Education app?',
        answer: 'Browse available courses and enroll. Education costs money and takes weeks to complete. Types include: High School (basic requirement), University (unlocks professional careers), Specialized Training (unlocks expert careers). Education unlocks better careers and increases promotion chances. You can enroll in multiple courses simultaneously, but each adds health penalty. Plan your education path strategically.',
      },
    ],
  },
  {
    category: 'Computer Apps',
    items: [
      {
        question: 'What computer apps are available?',
        answer: 'Computer apps include: Bitcoin Mining (crypto mining), Real Estate (property management), Stocks (trading), Company (business management), Onion Browser (dark web), YouVideo (gaming/streaming), Travel (trips), Political (political career), and more. Buy a computer from the Shop to unlock desktop apps. Each app offers unique features and income opportunities.',
      },
      {
        question: 'How do I unlock computer apps?',
        answer: 'Buy a computer from the Shop to unlock computer apps. Some apps require additional items, achievements, or specific conditions. Check each app for requirements. Apps appear in the Computer tab once unlocked. The computer is essential for advanced gameplay - many investment and business features require it. Some apps unlock at certain ages or with specific achievements.',
      },
      {
        question: 'What is the Stocks app?',
        answer: 'The Stocks app lets you buy and sell stocks. Stock prices fluctuate weekly. Buy low, sell high to profit. You can buy by number of shares or dollar amount. Dividends provide passive income. Watch market trends and company performance. Economic events affect stock prices. Diversify across multiple stocks to reduce risk. Enable auto-reinvest to compound your investments automatically.',
      },
      {
        question: 'What is the Real Estate app?',
        answer: 'The Real Estate app lets you buy, sell, and manage properties. Properties generate weekly rent income. You can upgrade properties to increase value and rent. Some properties unlock at certain ages or require specific conditions. Real estate is a long-term investment - buy and hold for passive income. Properties appreciate in value over time. Manage your portfolio for maximum returns.',
      },
      {
        question: 'What is the Company app?',
        answer: 'The Company app lets you start and manage businesses. Companies generate passive income weekly. Hire workers to increase production. Upgrade facilities to improve efficiency. Manage your company weekly to maximize profits. Family businesses can be inherited by children. Companies require capital and education to start. Scale your business for maximum income.',
      },
      {
        question: 'What is the Onion Browser?',
        answer: 'The Onion Browser (dark web) lets you access illegal hacks, dark web items, and underground activities. Purchase VPNs, exploits, and other tools. Running hacks can earn untraceable money but carries risk of being caught. Use protection to reduce risk. Illegal activities increase wanted level. High risk, high reward gameplay. Be careful - consequences are severe if caught.',
      },
      {
        question: 'What is YouVideo?',
        answer: 'YouVideo is a gaming/streaming app where you create videos and stream content. Earn money from views, sponsorships, and subscribers. Upgrade equipment to improve video quality and earnings. Build your channel and audience over time. Provides passive income from content. Requires computer and can be a significant income source. Consistency and quality content grow your audience.',
      },
      {
        question: 'What is the Travel app?',
        answer: 'The Travel app lets you book trips to different destinations. Trips cost money and take time. Some trips unlock business opportunities or special events. Travel can provide happiness bonuses and unlock new experiences. Some destinations have unique benefits or unlock special features. Travel can be a great way to boost happiness and discover new opportunities.',
      },
      {
        question: 'What is the Political app?',
        answer: 'The Political app is available if you have a political career. Run for office, create policies, participate in elections, work with lobbyists, and build your political career. Political careers require high reputation and specific qualifications. Political actions affect your reputation and can unlock special events. Build your political influence over time.',
      },
    ],
  },
  {
    category: 'Hobbies & Activities',
    items: [
      {
        question: 'What are hobbies?',
        answer: 'Hobbies are activities you can pursue for fun, skill development, and stat bonuses. Examples include: sports, gaming, reading, music, art, and more. Hobbies can increase happiness, fitness, and unlock special events. They provide a break from work and can improve your overall well-being. Different hobbies provide different benefits.',
      },
      {
        question: 'How do I start a hobby?',
        answer: 'Hobbies can be started from the Hobbies tab or through special events. Some hobbies require items or specific conditions. Once started, you can practice hobbies weekly to improve skills and gain bonuses. Check the Hobbies tab to see available hobbies and their requirements. Some hobbies unlock at certain ages or with specific achievements.',
      },
      {
        question: 'What do hobbies do?',
        answer: 'Hobbies provide: happiness bonuses, skill development, fitness improvements, social opportunities, and can unlock special events or achievements. Regular practice improves hobby skills and increases benefits. Some hobbies can even generate small amounts of income. Hobbies are a great way to maintain happiness while developing skills.',
      },
      {
        question: 'Can I have multiple hobbies?',
        answer: 'Yes! You can pursue multiple hobbies simultaneously. Each hobby is tracked separately with its own skill level. Managing multiple hobbies can provide diverse bonuses and opportunities. However, practicing hobbies takes time and energy, so balance them with other activities. Focus on hobbies that align with your goals.',
      },
      {
        question: 'How do hobbies affect my stats?',
        answer: 'Hobbies primarily boost happiness and sometimes fitness. Regular practice increases these bonuses. Some hobbies can also improve reputation or unlock career opportunities. Hobbies provide a sustainable way to maintain happiness without spending money. They\'re especially valuable when you\'re trying to balance work and life.',
      },
    ],
  },
  {
    category: 'Pets & Animals',
    items: [
      {
        question: 'How do I get a pet?',
        answer: 'Pets can be adopted from the Pets app (requires computer) or purchased from the Shop. Different pets have different costs, care requirements, and bonuses. Pets provide happiness and companionship. Some pets are more expensive but provide better bonuses. Choose pets that fit your budget and lifestyle.',
      },
      {
        question: 'How do I care for my pet?',
        answer: 'Pets require: food (costs money weekly), attention (time), and care. Neglected pets can become unhappy and provide fewer bonuses. Buy pet toys to increase pet happiness. Well-cared-for pets provide better bonuses. Regular care is essential - neglected pets may even run away. Budget for pet expenses in your weekly costs.',
      },
      {
        question: 'What bonuses do pets provide?',
        answer: 'Pets provide happiness bonuses and companionship. Happy pets provide better bonuses. Some pets have special abilities or unlock unique events. Pet toys can increase pet happiness and bonuses. The happiness bonus scales with pet happiness level. Well-cared-for pets can significantly boost your happiness stat.',
      },
      {
        question: 'Can I have multiple pets?',
        answer: 'Yes! You can own multiple pets. Each pet is tracked separately with its own happiness and care requirements. Multiple pets provide cumulative happiness bonuses but also require more care and money. Balance the number of pets with your ability to care for them. More pets = more happiness but more expenses.',
      },
      {
        question: 'What happens if I neglect my pet?',
        answer: 'Neglected pets become unhappy and provide fewer bonuses. Very unhappy pets may run away, losing the pet and any investment. Regular care is essential. Budget for pet food and toys. Well-cared-for pets are a great investment in happiness, but neglected pets are a waste of money.',
      },
    ],
  },
  {
    category: 'Advanced Systems',
    items: [
      {
        question: 'What is the R&D Lab?',
        answer: 'The R&D Lab is an advanced feature that requires a company. It lets you research new technologies, participate in competitions, and develop innovations. R&D can unlock new features, bonuses, and achievements. It\'s a late-game feature that provides additional income and reputation opportunities. Requires significant investment but offers high rewards.',
      },
      {
        question: 'How do R&D competitions work?',
        answer: 'R&D competitions let you enter research projects for prizes. Competitions have entry fees, scoring systems, AI competitors, and prize pools. Winning competitions provides money, reputation, and unlocks new opportunities. Success depends on your company\'s R&D level and investment. Competitions are competitive but offer significant rewards for winners.',
      },
      {
        question: 'What is the Statistics app?',
        answer: 'The Statistics app shows detailed analytics about your game progress: money earned, time played, achievements, relationships, investments, and more. Track your progress and see how you compare to goals. View detailed breakdowns of income sources, expenses, and stat changes. Use statistics to optimize your gameplay strategy.',
      },
      {
        question: 'What are Memories?',
        answer: 'Memories are special events and milestones recorded in your Journal. Memories can provide stat bonuses and are passed down to children when you continue your legacy. Important life events create memories automatically. Some memories provide permanent bonuses. They create a narrative of your character\'s life and can affect future events.',
      },
      {
        question: 'What is the Journal?',
        answer: 'The Journal records important events, memories, and milestones in your life. It tracks achievements, relationships, major purchases, life events, and special moments. Review your journal to see your life story unfold. Memories can provide stat bonuses and are passed to children. The Journal creates a narrative of your character\'s life across generations.',
      },
      {
        question: 'How do I view my family tree?',
        answer: 'The Family Tree can be viewed from the main menu or through special events. It shows your lineage across generations, including ancestors, descendants, relationships, achievements, and net worth. Each generation builds upon the last. Track your family\'s legacy and see how each generation contributed to your dynasty.',
      },
      {
        question: 'What are Dynasty Stats?',
        answer: 'Dynasty Stats track your family\'s legacy across generations. They include: total generations, total net worth accumulated, achievements unlocked, and heirlooms collected. Dynasty Stats can unlock special bonuses. They represent your family\'s overall success across all generations. Higher dynasty stats unlock more powerful bonuses.',
      },
      {
        question: 'What are Heirlooms?',
        answer: 'Heirlooms are special items passed down through generations. They provide permanent bonuses and increase in value over time. Heirlooms are created when you achieve certain milestones or complete special events. They\'re valuable family assets that grow more powerful with each generation. Protect and pass down heirlooms for maximum benefit.',
      },
    ],
  },
  {
    category: 'Death & Legacy',
    items: [
      {
        question: 'How do I die?',
        answer: 'You can die from: reaching age 100 (natural death), health reaching 0 for 4 weeks, or happiness reaching 0 for 4 weeks. The Immortality prestige bonus lets you live past age 100. Death triggers the death popup with options. Critical diseases can also cause death if untreated. Plan for death - it\'s inevitable without immortality.',
      },
      {
        question: 'What happens when I die?',
        answer: 'A death popup appears with options: Continue as a child (if you have children), Revive with gems (costs 15,000 gems), or Start a new life. Your previous character is added to the family tree. Generation increases if continuing as child. All your progress, wealth, and achievements are recorded. Choose wisely - each option has different benefits.',
      },
      {
        question: 'How does inheritance work?',
        answer: 'When continuing as a child, they inherit: 10% of parent\'s total net worth (cash + bank + real estate + companies + stocks - debts) with bonuses: +20% for university education, +30% for specialized education, +10% for professional/entrepreneur careers. Plus the child\'s personal savings. Educated children with careers inherit significantly more. This rewards investing in your children\'s future.',
      },
      {
        question: 'What is the difference between Prestige and Legacy?',
        answer: 'Prestige: Reset at $100M+ net worth, gain prestige points, keep prestige bonuses, generation stays same, lose all progress. Legacy: Continue as child when you die, inherit 10% wealth, generation increases, NO prestige points gained, keep family tree. Use prestige for bonuses and faster progression. Use legacy for family continuity and generation achievements.',
      },
      {
        question: 'How do I continue my family line?',
        answer: 'Have children (get married first), then when you die, choose "Continue Legacy" and select a child. The child inherits wealth and you continue playing as them. Generation number increases. Your previous character is added to the family tree. Each generation builds on the last. Focus on educating children for better inheritance bonuses.',
      },
      {
        question: 'What happens to my children when I die?',
        answer: 'If you have children, you can choose to continue as one of them. Children under 18 are automatically simulated to age 18. The selected child inherits 10% of your net worth (with bonuses) plus their savings. Other children remain in the family tree. You can only continue as one child per death. Choose the child with the best education and career for maximum inheritance.',
      },
      {
        question: 'What is Generation Number?',
        answer: 'Generation number tracks how many times you\'ve continued your family line. It increases when you continue as a child (legacy system) but NOT when you prestige. Higher generations can unlock special bonuses and achievements. Generation number is separate from prestige level. Some features and achievements require specific generation numbers.',
      },
      {
        question: 'What happens to my wealth when I die?',
        answer: 'If you continue as a child: They inherit 10% of net worth (with bonuses). If you prestige: All wealth is lost (but you gain prestige points). If you start new life: All wealth is lost. Family businesses continue generating income for children. Plan your death strategy - do you want to pass wealth to children or gain prestige points?',
      },
    ],
  },
  {
    category: 'Tips & Tricks',
    items: [
      {
        question: 'What are common mistakes to avoid?',
        answer: '1. Neglecting stats (health/happiness) - can lead to death. 2. Not investing early - missing compound interest. 3. Taking loans you can\'t afford - damages credit. 4. Ignoring diseases - critical diseases can kill. 5. Not maintaining relationships - miss opportunities. 6. Spending all money - need to invest for growth. 7. Not getting education - limits career options. 8. Overworking - damages stats. Balance is key!',
      },
      {
        question: 'How do I balance work and life?',
        answer: 'Don\'t overwork - jobs reduce health and happiness. Buy items to maintain stats. Take breaks from work to focus on relationships and hobbies. Build passive income so you don\'t need to work constantly. Education helps but also reduces health - balance it. Use prestige bonuses to reduce stat decay. Remember: Stats are more important than money - you can\'t enjoy money if you\'re dead.',
      },
      {
        question: 'What should I prioritize?',
        answer: 'Early game: Money and basic items. Mid-game: Education and investments. Late-game: Passive income and legacy building. Always: Maintain health and happiness. Never: Neglect stats for money. Focus on building multiple income streams. Education unlocks opportunities. Relationships provide happiness and opportunities. Balance everything - don\'t optimize for one thing.',
      },
      {
        question: 'How do achievements work?',
        answer: 'Achievements track your progress and accomplishments. Complete achievements to earn gems and unlock bonuses. Some achievements are progress-based (earn X money), others are milestone-based (reach age X). Check the Achievements tab to see your progress and rewards. Achievements provide gems which are valuable premium currency. Focus on achievable goals first.',
      },
      {
        question: 'What is the Journal?',
        answer: 'The Journal records important events, memories, and milestones in your life. It tracks achievements, relationships, major purchases, life events, and special moments. Review your journal to see your life story unfold. Memories can provide stat bonuses and are passed to children. The Journal creates a narrative of your character\'s life.',
      },
      {
        question: 'How do I optimize my gameplay?',
        answer: '1. Build passive income early. 2. Maintain stats above 50. 3. Invest in education for better careers. 4. Diversify income sources. 5. Plan for death (children or prestige). 6. Use prestige bonuses strategically. 7. Balance risk vs. reward. 8. Don\'t micromanage - automate what you can. Focus on long-term strategies, not short-term gains.',
      },
    ],
  },
  {
    category: 'Contact & Support',
    items: [
      {
        question: 'How do I contact support?',
        answer: 'Tap the "Contact Support" button at the bottom of the Help screen. This opens your email app with a pre-filled message including your game info (week, money, age). Describe your issue and send. We typically respond within 24-48 hours. For bugs, include steps to reproduce and any error messages. Screenshots help!',
      },
      {
        question: 'How do I report a bug?',
        answer: 'Contact support with: What you were doing, What happened vs. what should happen, Your game state (week, age, money), Any error messages, Screenshots if possible. We fix bugs regularly in updates. Check for game updates - many bugs are fixed in patches.',
      },
      {
        question: 'Can I suggest features?',
        answer: 'Yes! We love feedback. Contact support with your feature ideas. Popular suggestions often get implemented in future updates. Check update notes to see new features. We\'re always improving the game based on player feedback.',
      },
    ],
  },
];

export default function HelpModal({ visible, onClose }: HelpModalProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Smart search with relevance ranking
  const filtered = useMemo(() => {
    if (!search.trim()) {
      return helpContent;
    }

    const searchLower = search.toLowerCase();
    const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);

    // Score each item based on relevance
    const scoredItems = helpContent.flatMap((section) =>
      section.items.map((item) => {
        const questionLower = item.question.toLowerCase();
        const answerLower = item.answer.toLowerCase();
        let score = 0;

        // Exact question match (highest priority)
        if (questionLower === searchLower) {
          score += 1000;
        }
        // Question starts with search
        else if (questionLower.startsWith(searchLower)) {
          score += 500;
        }
        // All search words in question
        else if (searchWords.every(word => questionLower.includes(word))) {
          score += 300;
        }
        // Question contains search
        else if (questionLower.includes(searchLower)) {
          score += 200;
        }
        // Individual words in question
        else {
          searchWords.forEach(word => {
            if (questionLower.includes(word)) {
              score += 50;
            }
          });
        }

        // Answer contains search (lower priority)
        if (answerLower.includes(searchLower)) {
          score += 10;
        }
        // Individual words in answer
        searchWords.forEach(word => {
          if (answerLower.includes(word)) {
            score += 1;
          }
        });

        return { section, item, score };
      })
    );

    // Sort by score (highest first) and group by section
    scoredItems.sort((a, b) => b.score - a.score);

    // Group back into sections
    const sectionMap = new Map<string, typeof helpContent[0]>();
    scoredItems.forEach(({ section, item, score }) => {
      if (score > 0) {
        if (!sectionMap.has(section.category)) {
          sectionMap.set(section.category, { ...section, items: [] });
        }
        sectionMap.get(section.category)!.items.push(item);
      }
    });

    return Array.from(sectionMap.values());
  }, [search]);

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
              const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              
              Linking.openURL(emailUrl).then(() => {
                Alert.alert('Email Prepared', 'Your email app will open with a pre-filled message. Please send the email to contact our support team.');
              }).catch(() => {
                Alert.alert('Error', `Could not open email app. Please email ${SUPPORT_EMAIL} directly.`);
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





