import { logger } from '@/utils/logger';

export type Language = 'English' | 'Svenska' | 'Español' | 'Français' | 'Deutsch';

export interface TranslationKeys {
  // Settings
  settings: {
    title: string;
    darkMode: string;
    darkModeDescription: string;
    soundEffects: string;
    soundEffectsDescription: string;
    hapticFeedback: string;
    hapticFeedbackDescription: string;
    notifications: string;
    notificationsDescription: string;
    autoSave: string;
    autoSaveDescription: string;
    language: string;
    languageDescription: string;
    switchSaveSlot: string;
    showTutorial: string;
    leaderboard: string;
    reportBug: string;
    restartGame: string;
    dangerZone: string;
    developerTools: string;
    close: string;
  };
  
  // Main Menu
  mainMenu: {
    continue: string;
    continueSubtitle: string;
    newGame: string;
    newGameSubtitle: string;
    saveSlots: string;
    saveSlotsSubtitle: string;
    settings: string;
    settingsSubtitle: string;
  };

  // Game UI
  game: {
    week: string;
    age: string;
    money: string;
    health: string;
    happiness: string;
    energy: string;
    fitness: string;
    reputation: string;
    gems: string;
    nextWeek: string;
    save: string;
    load: string;
    settings: string;
    scenario: string;
    sex: string;
    sexuality: string;
    relationshipStatus: string;
    job: string;
    netWorth: string;
    weeklyCashFlow: string;
    perks: string;
    noPerks: string;
    traits: string;
    weeklyModifiers: string;
  };

  // Tabs
  tabs: {
    home: string;
    work: string;
    market: string;
    computer: string;
    mobile: string;
    jail: string;
    health: string;
  };

  // Work
  work: {
    title: string;
    street: string;
    career: string;
    hobby: string;
    skills: string;
    crimeJobs: string;
    unemployed: string;
    apply: string;
    quit: string;
    work: string;
    train: string;
    enterTournament: string;
    uploadSong: string;
    uploadArtwork: string;
    playMatch: string;
    acceptContract: string;
    extendContract: string;
    cancelContract: string;
    buyUpgrade: string;
    unlockUpgrade: string;
  };

  // Market
  market: {
    title: string;
    buy: string;
    sell: string;
    price: string;
    quantity: string;
    total: string;
    confirm: string;
    cancel: string;
    insufficientFunds: string;
    insufficientQuantity: string;
    items: string;
    food: string;
    gym: string;
    weeklyBonus: string;
    restores: string;
    gymSession: string;
    currentFitness: string;
    cost: string;
    energyCost: string;
    purchaseItems: string;
    buyFood: string;
    trainGym: string;
    gymDescription: string;
    benefitsPerSession: string;
    notEnoughMoney: string;
    notEnoughEnergy: string;
    startWorkout: string;
  };

  // Computer
  computer: {
    title: string;
    terminal: string;
    onion: string;
    stocks: string;
    crypto: string;
    hack: string;
    execute: string;
    clear: string;
    help: string;
    noComputerAvailable: string;
    noComputerMessage: string;
    darkWeb: string;
    hinder: string;
    contacts: string;
    social: string;
    bank: string;
    company: string;
    education: string;
    pets: string;
    mineCrypto: string;
    realEstate: string;
    buyManageProperties: string;
    accessDeepWeb: string;
    findLoveRelationships: string;
    manageRelationships: string;
    shareLifeOnline: string;
    tradeInvest: string;
    manageFinances: string;
    buildBusiness: string;
    learnNewSkills: string;
    managePets: string;
    desktopApps: string;
    accessComputerApplications: string;
    adoptPet: string;
  };

  // Mobile
  mobile: {
    title: string;
    bank: string;
    social: string;
    dating: string;
    news: string;
    weather: string;
    transfer: string;
    deposit: string;
    withdraw: string;
    balance: string;
    noPhoneAvailable: string;
    noPhoneMessage: string;
    mobileApps: string;
    accessSmartphoneApplications: string;
    contacts: string;
    stocks: string;
    education: string;
    company: string;
    pets: string;
    findLoveRelationships: string;
    manageRelationships: string;
    shareLifeOnline: string;
    tradeInvest: string;
    manageFinances: string;
    learnNewSkills: string;
    buildBusiness: string;
    managePets: string;
  };

  // Jail
  jail: {
    title: string;
    activities: string;
    bail: string;
    timeRemaining: string;
    payBail: string;
    insufficientBail: string;
  };

  // Health
  health: {
    title: string;
    healthActivities: string;
    dietPlans: string;
    benefits: string;
    weeklyBenefits: string;
    weeklyCost: string;
    activePlan: string;
    do: string;
    active: string;
    select: string;
    investMentalPhysical: string;
    chooseAutomaticDaily: string;
    chanceToCure: string;
    curesAllHealthIssues: string;
  };

  // Common
  common: {
    yes: string;
    no: string;
    ok: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    save: string;
    load: string;
    back: string;
    next: string;
    previous: string;
    close: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    loading: string;
    retry: string;
    unknown: string;
  };

  // Tutorial
  tutorial: {
    welcome: string;
    welcomeDescription: string;
    next: string;
    skip: string;
    finish: string;
  };
}

const translations: Record<Language, TranslationKeys> = {
  English: {
    settings: {
      title: 'Settings',
      darkMode: 'Dark Mode',
      darkModeDescription: 'Switch between light and dark themes',
      soundEffects: 'Sound Effects',
      soundEffectsDescription: 'Enable or disable game sounds',
      hapticFeedback: 'Vibration Feedback',
      hapticFeedbackDescription: 'Enable or disable vibration feedback for interactions',
      notifications: 'Notifications',
      notificationsDescription: 'Receive game notifications',
      autoSave: 'Auto Save',
      autoSaveDescription: 'Automatically save game progress',
      language: 'Language',
      languageDescription: 'Choose your preferred language',
      switchSaveSlot: 'Switch Save Slot',
      showTutorial: 'Show Tutorial',
      leaderboard: 'Leaderboard',
      reportBug: 'Report Bug',
      restartGame: 'Restart Game',
      dangerZone: 'Danger Zone',
      developerTools: 'Developer Tools',
      close: 'Close',
    },
    mainMenu: {
      continue: 'Continue',
      continueSubtitle: 'Resume your journey',
      newGame: 'New Game',
      newGameSubtitle: 'Start a new life',
      saveSlots: 'Save Slots',
      saveSlotsSubtitle: 'Manage your saves',
      settings: 'Settings',
      settingsSubtitle: 'Configure your experience',
    },
    game: {
      week: 'Week',
      age: 'Age',
      money: 'Money',
      health: 'Health',
      happiness: 'Happiness',
      energy: 'Energy',
      fitness: 'Fitness',
      reputation: 'Reputation',
      gems: 'Gems',
      nextWeek: 'Next Week',
      save: 'Save',
      load: 'Load',
      settings: 'Settings',
      scenario: 'Life Scenario',
      sex: 'Sex',
      sexuality: 'Sexuality',
      relationshipStatus: 'Relationship Status',
      job: 'Job',
      netWorth: 'Net Worth',
      weeklyCashFlow: 'Cash Flow',
      perks: 'Perks',
      noPerks: 'No perks',
      traits: 'Traits',
      weeklyModifiers: 'Weekly Modifiers',
    },
    tabs: {
      home: 'Home',
      work: 'Work',
      market: 'Market',
      computer: 'Computer',
      mobile: 'Mobile',
      jail: 'Jail',
      health: 'Health',
    },
    work: {
      title: 'Work',
      street: 'Street',
      career: 'Career',
      hobby: 'Hobby',
      skills: 'Skills',
      crimeJobs: 'Crime Jobs',
      unemployed: 'Unemployed',
      apply: 'Apply',
      quit: 'Quit',
      work: 'Work',
      train: 'Train',
      enterTournament: 'Enter Tournament',
      uploadSong: 'Upload Song',
      uploadArtwork: 'Upload Artwork',
      playMatch: 'Play Match',
      acceptContract: 'Accept Contract',
      extendContract: 'Extend Contract',
      cancelContract: 'Cancel Contract',
      buyUpgrade: 'Buy Upgrade',
      unlockUpgrade: 'Unlock Upgrade',
    },
    market: {
      title: 'Market',
      buy: 'Buy',
      sell: 'Sell',
      price: 'Price',
      quantity: 'Quantity',
      total: 'Total',
      confirm: 'Confirm',
      cancel: 'Cancel',
      insufficientFunds: 'Insufficient funds',
      insufficientQuantity: 'Insufficient quantity',
      items: 'Items',
      food: 'Food',
      gym: 'Gym',
      weeklyBonus: 'Weekly Bonus:',
      restores: 'Restores:',
      gymSession: 'Gym Session',
      currentFitness: 'Current Fitness:',
      cost: 'Cost:',
      energyCost: 'Energy Cost:',
      purchaseItems: 'Purchase items to unlock new opportunities and weekly bonuses!',
      buyFood: 'Buy food to restore your health and energy instantly!',
      trainGym: 'Train at the gym to improve your fitness, health, and happiness!',
      gymDescription: 'A good workout session will boost your stats and make you feel great!',
      benefitsPerSession: 'Benefits per session:',
      notEnoughMoney: 'Not enough money',
      notEnoughEnergy: 'Not enough energy',
      startWorkout: 'Start Workout',
    },
    computer: {
      title: 'Computer',
      terminal: 'Terminal',
      onion: 'Onion',
      stocks: 'Stocks',
      crypto: 'Crypto',
      hack: 'Hack',
      execute: 'Execute',
      clear: 'Clear',
      help: 'Help',
      noComputerAvailable: 'No Computer Available',
      noComputerMessage: 'You need to buy a computer to access desktop applications. Visit the Market tab to purchase one!',
      darkWeb: 'Dark Web',
      hinder: 'Dating',
      contacts: 'Contacts',
      social: 'Social',
      bank: 'Bank',
      company: 'Company',
      education: 'Education',
      pets: 'Pets',

      mineCrypto: 'Mine crypto',
      realEstate: 'Real Estate',
      buyManageProperties: 'Buy and manage properties',
      accessDeepWeb: 'Access the deep web',
      findLoveRelationships: 'Find love and relationships',
      manageRelationships: 'Manage your relationships',
      shareLifeOnline: 'Share your life online',
      tradeInvest: 'Trade and invest',
      manageFinances: 'Manage your finances',
      buildBusiness: 'Build your business',
      learnNewSkills: 'Learn new skills',
      managePets: 'Manage your pets',
      desktopApps: 'Desktop Apps',
      accessComputerApplications: 'Access your computer applications',
      adoptPet: 'Adopt a pet',
    },
    mobile: {
      title: 'Mobile',
      bank: 'Bank',
      social: 'Social',
      dating: 'Dating',
      news: 'News',
      weather: 'Weather',
      transfer: 'Transfer',
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      balance: 'Balance',
      noPhoneAvailable: 'No Phone Available',
      noPhoneMessage: 'You need to buy a smartphone to access mobile apps. Visit the Market tab to purchase one!',
      mobileApps: 'Mobile Apps',
      accessSmartphoneApplications: 'Access your smartphone applications',
      contacts: 'Contacts',
      stocks: 'Stocks',
      education: 'Education',
      company: 'Company',
      pets: 'Pets',
      findLoveRelationships: 'Find love and relationships',
      manageRelationships: 'Manage your relationships',
      shareLifeOnline: 'Share your life online',
      tradeInvest: 'Trade and invest',
      manageFinances: 'Manage your finances',
      learnNewSkills: 'Learn new skills',
      buildBusiness: 'Build your business',
      managePets: 'Manage your pets',
    },
    jail: {
      title: 'Jail',
      activities: 'Activities',
      bail: 'Bail',
      timeRemaining: 'Time Remaining',
      payBail: 'Pay Bail',
      insufficientBail: 'Insufficient bail money',
    },
    health: {
      title: 'Health',
      healthActivities: 'Health Activities',
      dietPlans: 'Diet Plans',
      benefits: 'Benefits:',
      weeklyBenefits: 'Weekly Benefits:',
      weeklyCost: 'Weekly Cost:',
      activePlan: 'Active Plan:',
      do: 'Do',
      active: 'Active',
      select: 'Select',
      investMentalPhysical: 'Invest in your mental and physical wellbeing with various activities!',
      chooseAutomaticDaily: 'Choose an automatic daily diet plan for passive health benefits!',
      chanceToCure: '50% chance to cure all health issues',
      curesAllHealthIssues: 'Cures all health issues except cancer',
    },
    common: {
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      save: 'Save',
      load: 'Load',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      close: 'Close',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
      loading: 'Loading...',
      retry: 'Retry',
      unknown: 'Unknown',
    },
    tutorial: {
      welcome: 'Welcome',
      welcomeDescription: 'Welcome to DeepLife Simulator',
      next: 'Next',
      skip: 'Skip',
      finish: 'Finish',
    },
  },
  Svenska: {
    settings: {
      title: 'Inställningar',
      darkMode: 'Mörkt läge',
      darkModeDescription: 'Växla mellan ljust och mörkt tema',
      soundEffects: 'Ljudeffekter',
      soundEffectsDescription: 'Aktivera eller inaktivera spellyd',
      hapticFeedback: 'Vibrationsfeedback',
      hapticFeedbackDescription: 'Aktivera eller inaktivera vibrationsfeedback för interaktioner',
      notifications: 'Aviseringar',
      notificationsDescription: 'Ta emot spelaviseringar',
      autoSave: 'Auto-spara',
      autoSaveDescription: 'Spara spel framsteg automatiskt',
      language: 'Språk',
      languageDescription: 'Välj ditt föredragna språk',
      switchSaveSlot: 'Byt sparslot',
      showTutorial: 'Visa handledning',
      leaderboard: 'Topplista',
      reportBug: 'Rapportera bugg',
      restartGame: 'Starta om spelet',
      dangerZone: 'Farlig zon',
      developerTools: 'Utvecklarverktyg',
      close: 'Stäng',
    },
    mainMenu: {
      continue: 'Fortsätt',
      continueSubtitle: 'Återuppta din resa',
      newGame: 'Nytt spel',
      newGameSubtitle: 'Starta ett nytt liv',
      saveSlots: 'Sparplatser',
      saveSlotsSubtitle: 'Hantera dina sparfiler',
      settings: 'Inställningar',
      settingsSubtitle: 'Konfigurera din upplevelse',
    },
    game: {
      week: 'Vecka',
      age: 'Ålder',
      money: 'Pengar',
      health: 'Hälsa',
      happiness: 'Lycka',
      energy: 'Energi',
      fitness: 'Kondition',
      reputation: 'Rykte',
      gems: 'Ädelstenar',
      nextWeek: 'Nästa vecka',
      save: 'Spara',
      load: 'Ladda',
      settings: 'Inställningar',
      scenario: 'Livsscenario',
      sex: 'Kön',
      sexuality: 'Sexualitet',
      relationshipStatus: 'Relationsstatus',
      job: 'Jobb',
      netWorth: 'Nettoförmögenhet',
      weeklyCashFlow: 'Kassaflöde',
      perks: 'Fördelar',
      noPerks: 'Inga fördelar',
      traits: 'Egenskaper',
      weeklyModifiers: 'Veckans modifierare',
    },
    tabs: {
      home: 'Hem',
      work: 'Arbete',
      market: 'Marknad',
      computer: 'Dator',
      mobile: 'Mobil',
      jail: 'Fängelse',
      health: 'Hälsa',
    },
    work: {
      title: 'Arbete',
      street: 'Gata',
      career: 'Karriär',
      hobby: 'Hobby',
      skills: 'Färdigheter',
      crimeJobs: 'Brottsjobb',
      unemployed: 'Arbetslös',
      apply: 'Ansök',
      quit: 'Säg upp',
      work: 'Arbeta',
      train: 'Träna',
      enterTournament: 'Gå med i turnering',
      uploadSong: 'Ladda upp låt',
      uploadArtwork: 'Ladda upp konstverk',
      playMatch: 'Spela match',
      acceptContract: 'Acceptera kontrakt',
      extendContract: 'Förläng kontrakt',
      cancelContract: 'Avbryt kontrakt',
      buyUpgrade: 'Köp uppgradering',
      unlockUpgrade: 'Lås upp uppgradering',
    },
    market: {
      title: 'Marknad',
      buy: 'Köp',
      sell: 'Sälj',
      price: 'Pris',
      quantity: 'Kvantitet',
      total: 'Totalt',
      confirm: 'Bekräfta',
      cancel: 'Avbryt',
      insufficientFunds: 'Otillräckliga medel',
      insufficientQuantity: 'Otillräcklig kvantitet',
      items: 'Föremål',
      food: 'Mat',
      gym: 'Gym',
      weeklyBonus: 'Ukentlig bonus:',
      restores: 'Återställer:',
      gymSession: 'Gympass',
      currentFitness: 'Nuvarande kondition:',
      cost: 'Kostnad:',
      energyCost: 'Energikostnad:',
      purchaseItems: 'Köp föremål för att låsa upp nya möjligheter och dagliga bonusar!',
      buyFood: 'Köp mat för att återställa din hälsa och energi omedelbart!',
      trainGym: 'Träna på gymmet för att förbättra din kondition, hälsa och lycka!',
      gymDescription: 'Ett bra träningspass kommer att förbättra dina stats och få dig att må bra!',
      benefitsPerSession: 'Fördelar per pass:',
      notEnoughMoney: 'Inte tillräckligt med pengar',
      notEnoughEnergy: 'Inte tillräckligt med energi',
      startWorkout: 'Starta träning',
    },
    computer: {
      title: 'Dator',
      terminal: 'Terminal',
      onion: 'Onion',
      stocks: 'Aktier',
      crypto: 'Krypto',
      hack: 'Hacka',
      execute: 'Kör',
      clear: 'Rensa',
      help: 'Hjälp',
      noComputerAvailable: 'Ingen dator tillgänglig',
      noComputerMessage: 'Du behöver köpa en dator för att komma åt skrivbordsapplikationer. Besök Marknad-fliken för att köpa en!',
      darkWeb: 'Dark Web',
      hinder: 'Dating',
      contacts: 'Kontakter',
      social: 'Social',
      bank: 'Bank',
      company: 'Företag',
      education: 'Utbildning',
      pets: 'Husdjur',

      mineCrypto: 'Bryt kryptovaluta',
      realEstate: 'Fastigheter',
      buyManageProperties: 'Köp och hantera fastigheter',
      accessDeepWeb: 'Kom åt deep web',
      findLoveRelationships: 'Hitta kärlek och relationer',
      manageRelationships: 'Hantera dina relationer',
      shareLifeOnline: 'Dela ditt liv online',
      tradeInvest: 'Handla och investera',
      manageFinances: 'Hantera dina finanser',
      buildBusiness: 'Bygg ditt företag',
      learnNewSkills: 'Lär dig nya färdigheter',
      managePets: 'Hantera dina husdjur',
      desktopApps: 'Skrivbordsappar',
      accessComputerApplications: 'Kom åt dina datorapplikationer',
      adoptPet: 'Adoptera ett husdjur',
    },
    mobile: {
      title: 'Mobil',
      bank: 'Bank',
      social: 'Social',
      dating: 'Dejting',
      news: 'Nyheter',
      weather: 'Väder',
      transfer: 'Överför',
      deposit: 'Insättning',
      withdraw: 'Uttag',
      balance: 'Saldo',
      noPhoneAvailable: 'Ingen telefon tillgänglig',
      noPhoneMessage: 'Du behöver köpa en smartphone för att komma åt mobilappar. Besök Marknad-fliken för att köpa en!',
      mobileApps: 'Mobilappar',
      accessSmartphoneApplications: 'Kom åt dina smartphone-applikationer',
      contacts: 'Kontakter',
      stocks: 'Aktier',
      education: 'Utbildning',
      company: 'Företag',
      pets: 'Husdjur',
      findLoveRelationships: 'Hitta kärlek och relationer',
      manageRelationships: 'Hantera dina relationer',
      shareLifeOnline: 'Dela ditt liv online',
      tradeInvest: 'Handla och investera',
      manageFinances: 'Hantera dina finanser',
      learnNewSkills: 'Lär dig nya färdigheter',
      buildBusiness: 'Bygg ditt företag',
      managePets: 'Hantera dina husdjur',
    },
    jail: {
      title: 'Fängelse',
      activities: 'Aktiviteter',
      bail: 'Borgen',
      timeRemaining: 'Återstående tid',
      payBail: 'Betala borgensumma',
      insufficientBail: 'Otillräcklig borgensumma',
    },
    health: {
      title: 'Hälsa',
      healthActivities: 'Hälsaaktiviteter',
      dietPlans: 'Kostplaner',
      benefits: 'Fördelar:',
      weeklyBenefits: 'Veckans fördelar:',
      weeklyCost: 'Veckans kostnad:',
      activePlan: 'Aktiv plan:',
      do: 'Gör',
      active: 'Aktiv',
      select: 'Välj',
      investMentalPhysical: 'Investera i din mentala och fysiska välbefinnande med olika aktiviteter!',
      chooseAutomaticDaily: 'Välj en automatisk daglig kostplan för passiva hälsofördelar!',
      chanceToCure: '50% chans att bota alla hälsoproblem',
      curesAllHealthIssues: 'Botar alla hälsoproblem utom cancer',
    },
    common: {
      yes: 'Ja',
      no: 'Nej',
      ok: 'OK',
      cancel: 'Avbryt',
      confirm: 'Bekräfta',
      delete: 'Radera',
      edit: 'Redigera',
      save: 'Spara',
      load: 'Ladda',
      back: 'Tillbaka',
      next: 'Nästa',
      previous: 'Föregående',
      close: 'Stäng',
      error: 'Fel',
      success: 'Framgång',
      warning: 'Varning',
      info: 'Info',
      loading: 'Laddar...',
      retry: 'Försök igen',
      unknown: 'Okänd',
    },
    tutorial: {
      welcome: 'Välkommen',
      welcomeDescription: 'Välkommen till DeepLife Simulator',
      next: 'Nästa',
      skip: 'Hoppa över',
      finish: 'Slutför',
    },
  },
  Español: {
    settings: {
      title: 'Configuración',
      darkMode: 'Modo oscuro',
      darkModeDescription: 'Cambiar entre temas claro y oscuro',
      soundEffects: 'Efectos de sonido',
      soundEffectsDescription: 'Activar o desactivar sonidos del juego',
      hapticFeedback: 'Retroalimentación Háptica',
      hapticFeedbackDescription: 'Activar o desactivar retroalimentación háptica para interacciones',
      notifications: 'Notificaciones',
      notificationsDescription: 'Recibir notificaciones del juego',
      autoSave: 'Auto-guardado',
      autoSaveDescription: 'Guardar progreso automáticamente',
      language: 'Idioma',
      languageDescription: 'Elegir idioma preferido',
      switchSaveSlot: 'Cambiar ranura de guardado',
      showTutorial: 'Mostrar tutorial',
      leaderboard: 'Tabla de clasificación',
      reportBug: 'Reportar error',
      restartGame: 'Reiniciar juego',
      dangerZone: 'Zona de peligro',
      developerTools: 'Herramientas de desarrollador',
      close: 'Cerrar',
    },
    mainMenu: {
      continue: 'Continuar',
      continueSubtitle: 'Reanudar tu viaje',
      newGame: 'Nuevo juego',
      newGameSubtitle: 'Comenzar una nueva vida',
      saveSlots: 'Ranuras de Guardado',
      saveSlotsSubtitle: 'Gestionar tus guardados',
      settings: 'Configuración',
      settingsSubtitle: 'Configurar tu experiencia',
    },
    game: {
      week: 'Semana',
      age: 'Edad',
      money: 'Dinero',
      health: 'Salud',
      happiness: 'Felicidad',
      energy: 'Energía',
      fitness: 'Condición física',
      reputation: 'Reputación',
      gems: 'Gemas',
      nextWeek: 'Próxima semana',
      save: 'Guardar',
      load: 'Cargar',
      settings: 'Configuración',
      scenario: 'Escenario de vida',
      sex: 'Sexo',
      sexuality: 'Sexualidad',
      relationshipStatus: 'Estado civil',
      job: 'Trabajo',
      netWorth: 'Patrimonio neto',
      weeklyCashFlow: 'Flujo de caja',
      perks: 'Ventajas',
      noPerks: 'Sin ventajas',
      traits: 'Rasgos',
      weeklyModifiers: 'Modificadores semanales',
    },
    tabs: {
      home: 'Inicio',
      work: 'Trabajo',
      market: 'Mercado',
      computer: 'Computadora',
      mobile: 'Móvil',
      jail: 'Cárcel',
      health: 'Salud',
    },
    work: {
      title: 'Trabajo',
      street: 'Calle',
      career: 'Carrera',
      hobby: 'Pasatiempo',
      skills: 'Habilidades',
      crimeJobs: 'Trabajos criminales',
      unemployed: 'Desempleado',
      apply: 'Solicitar',
      quit: 'Renunciar',
      work: 'Trabajar',
      train: 'Entrenar',
      enterTournament: 'Entrar al torneo',
      uploadSong: 'Subir canción',
      uploadArtwork: 'Subir obra de arte',
      playMatch: 'Jugar partida',
      acceptContract: 'Aceptar contrato',
      extendContract: 'Extender contrato',
      cancelContract: 'Cancelar contrato',
      buyUpgrade: 'Comprar mejora',
      unlockUpgrade: 'Desbloquear mejora',
    },
    market: {
      title: 'Mercado',
      buy: 'Comprar',
      sell: 'Vender',
      price: 'Precio',
      quantity: 'Cantidad',
      total: 'Total',
      confirm: 'Confirmar',
      cancel: 'Cancelar',
      insufficientFunds: 'Fondos insuficientes',
      insufficientQuantity: 'Cantidad insuficiente',
      items: 'Artículos',
      food: 'Comida',
      gym: 'Gimnasio',
      weeklyBonus: 'Bono semanal:',
      restores: 'Restaura:',
      gymSession: 'Sesión de gimnasio',
      currentFitness: 'Condición física actual:',
      cost: 'Costo:',
      energyCost: 'Costo de energía:',
      purchaseItems: '¡Compra artículos para desbloquear nuevas oportunidades y bonos diarios!',
      buyFood: '¡Compra comida para restaurar tu salud y energía al instante!',
      trainGym: '¡Entrena en el gimnasio para mejorar tu condición física, salud y felicidad!',
      gymDescription: '¡Una buena sesión de entrenamiento mejorará tus estadísticas y te hará sentir genial!',
      benefitsPerSession: 'Beneficios por sesión:',
      notEnoughMoney: 'No hay suficiente dinero',
      notEnoughEnergy: 'No hay suficiente energía',
      startWorkout: 'Comenzar entrenamiento',
    },
    computer: {
      title: 'Computadora',
      terminal: 'Terminal',
      onion: 'Onion',
      stocks: 'Acciones',
      crypto: 'Cripto',
      hack: 'Hackear',
      execute: 'Ejecutar',
      clear: 'Limpiar',
      help: 'Ayuda',
      noComputerAvailable: 'No hay computadora disponible',
      noComputerMessage: '¡Necesitas comprar una computadora para acceder a aplicaciones de escritorio. ¡Visita la pestaña Mercado para comprar una!',
      darkWeb: 'Dark Web',
      hinder: 'Dating',
      contacts: 'Contactos',
      social: 'Social',
      bank: 'Banco',
      company: 'Empresa',
      education: 'Educación',
      pets: 'Mascotas',

      mineCrypto: 'Minar criptomonedas',
      realEstate: 'Bienes Raíces',
      buyManageProperties: 'Comprar y gestionar propiedades',
      accessDeepWeb: 'Acceder a la deep web',
      findLoveRelationships: 'Encontrar amor y relaciones',
      manageRelationships: 'Gestionar tus relaciones',
      shareLifeOnline: 'Compartir tu vida en línea',
      tradeInvest: 'Comerciar e invertir',
      manageFinances: 'Gestionar tus finanzas',
      buildBusiness: 'Construir tu negocio',
      learnNewSkills: 'Aprender nuevas habilidades',
      managePets: 'Gestionar tus mascotas',
      desktopApps: 'Aplicaciones de escritorio',
      accessComputerApplications: 'Accede a tus aplicaciones de computadora',
      adoptPet: 'Adoptar una mascota',
    },
    mobile: {
      title: 'Móvil',
      bank: 'Banco',
      social: 'Social',
      dating: 'Citas',
      news: 'Noticias',
      weather: 'Clima',
      transfer: 'Transferir',
      deposit: 'Depositar',
      withdraw: 'Retirar',
      balance: 'Saldo',
      noPhoneAvailable: 'No hay teléfono disponible',
      noPhoneMessage: '¡Necesitas comprar un smartphone para acceder a aplicaciones móviles. ¡Visita la pestaña Mercado para comprar uno!',
      mobileApps: 'Aplicaciones móviles',
      accessSmartphoneApplications: 'Accede a tus aplicaciones de smartphone',
      contacts: 'Contactos',
      stocks: 'Acciones',
      education: 'Educación',
      company: 'Empresa',
      pets: 'Mascotas',
      findLoveRelationships: 'Encontrar amor y relaciones',
      manageRelationships: 'Gestionar tus relaciones',
      shareLifeOnline: 'Compartir tu vida en línea',
      tradeInvest: 'Comerciar e invertir',
      manageFinances: 'Gestionar tus finanzas',
      learnNewSkills: 'Aprender nuevas habilidades',
      buildBusiness: 'Construir tu negocio',
      managePets: 'Gestionar tus mascotas',
    },
    jail: {
      title: 'Cárcel',
      activities: 'Actividades',
      bail: 'Fianza',
      timeRemaining: 'Tiempo restante',
      payBail: 'Pagar fianza',
      insufficientBail: 'Fianza insuficiente',
    },
    health: {
      title: 'Salud',
      healthActivities: 'Actividades de salud',
      dietPlans: 'Planes de dieta',
      benefits: 'Beneficios:',
      weeklyBenefits: 'Beneficios semanales:',
      weeklyCost: 'Costo semanal:',
      activePlan: 'Plan activo:',
      do: 'Hacer',
      active: 'Activo',
      select: 'Seleccionar',
      investMentalPhysical: '¡Invierte en tu bienestar mental y físico con varias actividades!',
      chooseAutomaticDaily: '¡Elige un plan de dieta diario automático para beneficios de salud pasivos!',
      chanceToCure: '50% de probabilidad de curar todos los problemas de salud',
      curesAllHealthIssues: 'Cura todos los problemas de salud excepto el cáncer',
    },
    common: {
      yes: 'Sí',
      no: 'No',
      ok: 'OK',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      delete: 'Eliminar',
      edit: 'Editar',
      save: 'Guardar',
      load: 'Cargar',
      back: 'Atrás',
      next: 'Siguiente',
      previous: 'Anterior',
      close: 'Cerrar',
      error: 'Error',
      success: 'Éxito',
      warning: 'Advertencia',
      info: 'Info',
      loading: 'Cargando...',
      retry: 'Reintentar',
      unknown: 'Desconocido',
    },
    tutorial: {
      welcome: 'Bienvenido',
      welcomeDescription: 'Bienvenido a DeepLife Simulator',
      next: 'Siguiente',
      skip: 'Omitir',
      finish: 'Finalizar',
    },
  },
  Français: {
    settings: {
      title: 'Paramètres',
      darkMode: 'Mode sombre',
      darkModeDescription: 'Basculer entre les thèmes clair et sombre',
      soundEffects: 'Effets sonores',
      soundEffectsDescription: 'Activer ou désactiver les sons du jeu',
      hapticFeedback: 'Retour Haptique',
      hapticFeedbackDescription: 'Activer ou désactiver le retour haptique pour les interactions',
      notifications: 'Notifications',
      notificationsDescription: 'Recevoir les notifications du jeu',
      autoSave: 'Sauvegarde automatique',
      autoSaveDescription: 'Sauvegarder automatiquement la progression',
      language: 'Langue',
      languageDescription: 'Choisir votre langue préférée',
      switchSaveSlot: 'Changer d\'emplacement de sauvegarde',
      showTutorial: 'Afficher le tutoriel',
      leaderboard: 'Classement',
      reportBug: 'Signaler un bug',
      restartGame: 'Redémarrer le jeu',
      dangerZone: 'Zone de danger',
      developerTools: 'Outils de développement',
      close: 'Fermer',
    },
    mainMenu: {
      continue: 'Continuer',
      continueSubtitle: 'Reprendre votre voyage',
      newGame: 'Nouvelle partie',
      newGameSubtitle: 'Commencer une nouvelle vie',
      saveSlots: 'Emplacements de Sauvegarde',
      saveSlotsSubtitle: 'Gérer vos sauvegardes',
      settings: 'Paramètres',
      settingsSubtitle: 'Configurer votre expérience',
    },
    game: {
      week: 'Semaine',
      age: 'Âge',
      money: 'Argent',
      health: 'Santé',
      happiness: 'Bonheur',
      energy: 'Énergie',
      fitness: 'Forme physique',
      reputation: 'Réputation',
      gems: 'Gemmes',
      nextWeek: 'Semaine suivante',
      save: 'Sauvegarder',
      load: 'Charger',
      settings: 'Paramètres',
      scenario: 'Scénario de vie',
      sex: 'Sexe',
      sexuality: 'Sexualité',
      relationshipStatus: 'Statut relationnel',
      job: 'Emploi',
      netWorth: 'Valeur nette',
      weeklyCashFlow: 'Flux de trésorerie',
      perks: 'Avantages',
      noPerks: 'Aucun avantage',
      traits: 'Traits',
      weeklyModifiers: 'Modificateurs hebdomadaires',
    },
    tabs: {
      home: 'Accueil',
      work: 'Travail',
      market: 'Marché',
      computer: 'Ordinateur',
      mobile: 'Mobile',
      jail: 'Prison',
      health: 'Santé',
    },
    work: {
      title: 'Travail',
      street: 'Rue',
      career: 'Carrière',
      hobby: 'Passe-temps',
      skills: 'Compétences',
      crimeJobs: 'Jobs criminels',
      unemployed: 'Chômeur',
      apply: 'Postuler',
      quit: 'Démissionner',
      work: 'Travailler',
      train: 'S\'entraîner',
      enterTournament: 'Entrer dans le tournoi',
      uploadSong: 'Télécharger une chanson',
      uploadArtwork: 'Télécharger une œuvre d\'art',
      playMatch: 'Jouer un match',
      acceptContract: 'Accepter le contrat',
      extendContract: 'Prolonger le contrat',
      cancelContract: 'Annuler le contrat',
      buyUpgrade: 'Acheter une amélioration',
      unlockUpgrade: 'Débloquer une amélioration',
    },
    market: {
      title: 'Marché',
      buy: 'Acheter',
      sell: 'Vendre',
      price: 'Prix',
      quantity: 'Quantité',
      total: 'Total',
      confirm: 'Confirmer',
      cancel: 'Annuler',
      insufficientFunds: 'Fonds insuffisants',
      insufficientQuantity: 'Quantité insuffisante',
      items: 'Objets',
      food: 'Nourriture',
      gym: 'Salle de sport',
      weeklyBonus: 'Bonus hebdomadaire :',
      restores: 'Restaure :',
      gymSession: 'Séance de sport',
      currentFitness: 'Forme physique actuelle :',
      cost: 'Coût :',
      energyCost: 'Coût énergétique :',
      purchaseItems: 'Achetez des objets pour débloquer de nouvelles opportunités et des bonus quotidiens !',
      buyFood: 'Achetez de la nourriture pour restaurer votre santé et votre énergie instantanément !',
      trainGym: 'Entraînez-vous à la salle de sport pour améliorer votre forme physique, votre santé et votre bonheur !',
      gymDescription: 'Une bonne séance d\'entraînement améliorera vos statistiques et vous fera vous sentir bien !',
      benefitsPerSession: 'Avantages par séance :',
      notEnoughMoney: 'Pas assez d\'argent',
      notEnoughEnergy: 'Pas assez d\'énergie',
      startWorkout: 'Commencer l\'entraînement',
    },
    computer: {
      title: 'Ordinateur',
      terminal: 'Terminal',
      onion: 'Onion',
      stocks: 'Actions',
      crypto: 'Krypto',
      hack: 'Pirater',
      execute: 'Exécuter',
      clear: 'Effacer',
      help: 'Aide',
      noComputerAvailable: 'Aucun ordinateur disponible',
      noComputerMessage: 'Vous devez acheter un ordinateur pour accéder aux applications de bureau. Visitez l\'onglet Marché pour en acheter un !',
      darkWeb: 'Dark Web',
      hinder: 'Dating',
      contacts: 'Contacts',
      social: 'Social',
      bank: 'Banque',
      company: 'Entreprise',
      education: 'Éducation',
      pets: 'Animaux',

      mineCrypto: 'Miner des cryptomonnaies',
      realEstate: 'Immobilier',
      buyManageProperties: 'Acheter et gérer des propriétés',
      accessDeepWeb: 'Accéder au deep web',
      findLoveRelationships: 'Trouver l\'amour et des relations',
      manageRelationships: 'Gérer vos relations',
      shareLifeOnline: 'Partager votre vie en ligne',
      tradeInvest: 'Trader et investir',
      manageFinances: 'Gérer vos finances',
      buildBusiness: 'Construire votre entreprise',
      learnNewSkills: 'Apprendre de nouvelles compétences',
      managePets: 'Gérer vos animaux',
      desktopApps: 'Applications de bureau',
      accessComputerApplications: 'Accédez à vos applications informatiques',
      adoptPet: 'Adopter un animal',
    },
    mobile: {
      title: 'Mobile',
      bank: 'Banque',
      social: 'Social',
      dating: 'Rencontres',
      news: 'Actualités',
      weather: 'Météo',
      transfer: 'Transférer',
      deposit: 'Déposer',
      withdraw: 'Retirer',
      balance: 'Solde',
      noPhoneAvailable: 'Aucun téléphone disponible',
      noPhoneMessage: 'Vous devez acheter un smartphone pour accéder aux applications mobiles. Visitez l\'onglet Marché pour en acheter un !',
      mobileApps: 'Applications mobiles',
      accessSmartphoneApplications: 'Accédez à vos applications smartphone',
      contacts: 'Contacts',
      stocks: 'Actions',
      education: 'Éducation',
      company: 'Entreprise',
      pets: 'Animaux',
      findLoveRelationships: 'Trouver l\'amour et des relations',
      manageRelationships: 'Gérer vos relations',
      shareLifeOnline: 'Partager votre vie en ligne',
      tradeInvest: 'Trader et investir',
      manageFinances: 'Gérer vos finances',
      learnNewSkills: 'Apprendre de nouvelles compétences',
      buildBusiness: 'Construire votre entreprise',
      managePets: 'Gérer vos animaux',
    },
    jail: {
      title: 'Prison',
      activities: 'Activités',
      bail: 'Caution',
      timeRemaining: 'Temps restant',
      payBail: 'Payer la caution',
      insufficientBail: 'Caution insuffisante',
    },
    health: {
      title: 'Santé',
      healthActivities: 'Activités de santé',
      dietPlans: 'Plans de régime',
      benefits: 'Avantages :',
      weeklyBenefits: 'Avantages hebdomadaires :',
      weeklyCost: 'Coût hebdomadaire :',
      activePlan: 'Plan actif :',
      do: 'Faire',
      active: 'Actif',
      select: 'Sélectionner',
      investMentalPhysical: 'Investissez dans votre bien-être mental et physique avec diverses activités !',
      chooseAutomaticDaily: 'Choisissez un plan de régime quotidien automatique pour des avantages de santé passifs !',
      chanceToCure: '50% de chance de guérir tous les problèmes de santé',
      curesAllHealthIssues: 'Guérit tous les problèmes de santé sauf le cancer',
    },
    common: {
      yes: 'Oui',
      no: 'Non',
      ok: 'OK',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      delete: 'Supprimer',
      edit: 'Modifier',
      save: 'Sauvegarder',
      load: 'Charger',
      back: 'Retour',
      next: 'Suivant',
      previous: 'Précédent',
      close: 'Fermer',
      error: 'Erreur',
      success: 'Succès',
      warning: 'Avertissement',
      info: 'Info',
      loading: 'Chargement...',
      retry: 'Réessayer',
      unknown: 'Inconnu',
    },
    tutorial: {
      welcome: 'Bienvenue',
      welcomeDescription: 'Bienvenue dans DeepLife Simulator',
      next: 'Suivant',
      skip: 'Passer',
      finish: 'Terminer',
    },
  },
  Deutsch: {
    settings: {
      title: 'Einstellungen',
      darkMode: 'Dunkler Modus',
      darkModeDescription: 'Zwischen hellem und dunklem Thema wechseln',
      soundEffects: 'Soundeffekte',
      soundEffectsDescription: 'Spielsounds aktivieren oder deaktivieren',
      hapticFeedback: 'Haptisches Feedback',
      hapticFeedbackDescription: 'Haptisches Feedback für Interaktionen aktivieren oder deaktivieren',
      notifications: 'Benachrichtigungen',
      notificationsDescription: 'Spielbenachrichtigungen erhalten',
      autoSave: 'Auto-Speichern',
      autoSaveDescription: 'Spielstand automatisch speichern',
      language: 'Sprache',
      languageDescription: 'Bevorzugte Sprache wählen',
      switchSaveSlot: 'Speicherplatz wechseln',
      showTutorial: 'Tutorial anzeigen',
      leaderboard: 'Bestenliste',
      reportBug: 'Fehler melden',
      restartGame: 'Spiel neu starten',
      dangerZone: 'Gefahrenzone',
      developerTools: 'Entwicklerwerkzeuge',
      close: 'Schließen',
    },
    mainMenu: {
      continue: 'Weiter',
      continueSubtitle: 'Deine Reise fortsetzen',
      newGame: 'Neues Spiel',
      newGameSubtitle: 'Ein neues Leben beginnen',
      saveSlots: 'Speicherplätze',
      saveSlotsSubtitle: 'Deine Speicherstände verwalten',
      settings: 'Einstellungen',
      settingsSubtitle: 'Deine Erfahrung konfigurieren',
    },
    game: {
      week: 'Woche',
      age: 'Alter',
      money: 'Geld',
      health: 'Gesundheit',
      happiness: 'Glück',
      energy: 'Energie',
      fitness: 'Fitness',
      reputation: 'Ruf',
      gems: 'Edelsteine',
      nextWeek: 'Nächste Woche',
      save: 'Speichern',
      load: 'Laden',
      settings: 'Einstellungen',
      scenario: 'Lebensszenario',
      sex: 'Geschlecht',
      sexuality: 'Sexualität',
      relationshipStatus: 'Beziehungsstatus',
      job: 'Beruf',
      netWorth: 'Nettovermögen',
      weeklyCashFlow: 'Cashflow',
      perks: 'Vorteile',
      noPerks: 'Keine Vorteile',
      traits: 'Eigenschaften',
      weeklyModifiers: 'Wöchentliche Modifikatoren',
    },
    tabs: {
      home: 'Start',
      work: 'Arbeit',
      market: 'Markt',
      computer: 'Computer',
      mobile: 'Mobil',
      jail: 'Gefängnis',
      health: 'Gesundheit',
    },
    work: {
      title: 'Arbeit',
      street: 'Straße',
      career: 'Karriere',
      hobby: 'Hobby',
      skills: 'Fähigkeiten',
      crimeJobs: 'Verbrechensjobs',
      unemployed: 'Arbeitslos',
      apply: 'Bewerben',
      quit: 'Kündigen',
      work: 'Arbeiten',
      train: 'Trainieren',
      enterTournament: 'Turnier betreten',
      uploadSong: 'Lied hochladen',
      uploadArtwork: 'Kunstwerk hochladen',
      playMatch: 'Spiel spielen',
      acceptContract: 'Vertrag annehmen',
      extendContract: 'Vertrag verlängern',
      cancelContract: 'Vertrag kündigen',
      buyUpgrade: 'Upgrade kaufen',
      unlockUpgrade: 'Upgrade freischalten',
    },
    market: {
      title: 'Markt',
      buy: 'Kaufen',
      sell: 'Verkaufen',
      price: 'Preis',
      quantity: 'Menge',
      total: 'Gesamt',
      confirm: 'Bestätigen',
      cancel: 'Abbrechen',
      insufficientFunds: 'Unzureichende Mittel',
      insufficientQuantity: 'Unzureichende Menge',
      items: 'Gegenstände',
      food: 'Nahrung',
      gym: 'Fitnessstudio',
      weeklyBonus: 'Wöchentlicher Bonus:',
      restores: 'Stellt wieder her:',
      gymSession: 'Fitnesssession',
      currentFitness: 'Aktuelle Fitness:',
      cost: 'Kosten:',
      energyCost: 'Energiekosten:',
      purchaseItems: 'Kaufe Gegenstände, um neue Möglichkeiten und tägliche Boni freizuschalten!',
      buyFood: 'Kaufe Nahrung, um deine Gesundheit und Energie sofort wiederherzustellen!',
      trainGym: 'Trainiere im Fitnessstudio, um deine Fitness, Gesundheit und Glück zu verbessern!',
      gymDescription: 'Ein gutes Training wird deine Statistiken verbessern und dich großartig fühlen lassen!',
      benefitsPerSession: 'Vorteile pro Session:',
      notEnoughMoney: 'Nicht genug Geld',
      notEnoughEnergy: 'Nicht genug Energie',
      startWorkout: 'Training starten',
    },
    computer: {
      title: 'Computer',
      terminal: 'Terminal',
      onion: 'Onion',
      stocks: 'Aktien',
      crypto: 'Krypto',
      hack: 'Hacken',
      execute: 'Ausführen',
      clear: 'Löschen',
      help: 'Hilfe',
      noComputerAvailable: 'Kein Computer verfügbar',
      noComputerMessage: 'Sie müssen einen Computer kaufen, um auf Desktop-Anwendungen zuzugreifen. Besuchen Sie die Markt-Registerkarte, um einen zu kaufen!',
      darkWeb: 'Dark Web',
      hinder: 'Dating',
      contacts: 'Kontakte',
      social: 'Social',
      bank: 'Bank',
      company: 'Unternehmen',
      education: 'Bildung',
      pets: 'Haustiere',
      mineCrypto: 'Kryptowährung minen',
      realEstate: 'Immobilien',
      buyManageProperties: 'Immobilien kaufen und verwalten',
      accessDeepWeb: 'Auf das Deep Web zugreifen',
      findLoveRelationships: 'Liebe und Beziehungen finden',
      manageRelationships: 'Ihre Beziehungen verwalten',
      shareLifeOnline: 'Ihr Leben online teilen',
      tradeInvest: 'Handeln und investieren',
      manageFinances: 'Ihre Finanzen verwalten',
      buildBusiness: 'Ihr Unternehmen aufbauen',
      learnNewSkills: 'Neue Fähigkeiten erlernen',
      managePets: 'Ihre Haustiere verwalten',
      desktopApps: 'Desktop-Anwendungen',
      accessComputerApplications: 'Greifen Sie auf Ihre Computeranwendungen zu',
      adoptPet: 'Ein Haustier adoptieren',
    },
    mobile: {
      title: 'Mobil',
      bank: 'Bank',
      social: 'Social',
      dating: 'Dating',
      news: 'Nachrichten',
      weather: 'Wetter',
      transfer: 'Überweisen',
      deposit: 'Einzahlen',
      withdraw: 'Abheben',
      balance: 'Kontostand',
      noPhoneAvailable: 'Kein Telefon verfügbar',
      noPhoneMessage: 'Sie müssen ein Smartphone kaufen, um auf mobile Apps zuzugreifen. Besuchen Sie die Markt-Registerkarte, um eines zu kaufen!',
      mobileApps: 'Mobile Apps',
      accessSmartphoneApplications: 'Greifen Sie auf Ihre Smartphone-Anwendungen zu',
      contacts: 'Kontakte',
      stocks: 'Aktien',
      education: 'Bildung',
      company: 'Unternehmen',
      pets: 'Haustiere',
      findLoveRelationships: 'Liebe und Beziehungen finden',
      manageRelationships: 'Ihre Beziehungen verwalten',
      shareLifeOnline: 'Ihr Leben online teilen',
      tradeInvest: 'Handeln und investieren',
      manageFinances: 'Ihre Finanzen verwalten',
      learnNewSkills: 'Neue Fähigkeiten erlernen',
      buildBusiness: 'Ihr Unternehmen aufbauen',
      managePets: 'Ihre Haustiere verwalten',
    },
    jail: {
      title: 'Gefängnis',
      activities: 'Aktivitäten',
      bail: 'Kaution',
      timeRemaining: 'Verbleibende Zeit',
      payBail: 'Kaution zahlen',
      insufficientBail: 'Unzureichende Kaution',
    },
    health: {
      title: 'Gesundheit',
      healthActivities: 'Gesundheitsaktivitäten',
      dietPlans: 'Ernährungspläne',
      benefits: 'Vorteile:',
      weeklyBenefits: 'Wöchentliche Vorteile:',
      weeklyCost: 'Wöchentliche Kosten:',
      activePlan: 'Aktiver Plan:',
      do: 'Machen',
      active: 'Aktiv',
      select: 'Auswählen',
      investMentalPhysical: 'Investieren Sie in Ihr geistiges und körperliches Wohlbefinden mit verschiedenen Aktivitäten!',
      chooseAutomaticDaily: 'Wählen Sie einen automatischen täglichen Ernährungsplan für passive Gesundheitsvorteile!',
      chanceToCure: '50% Chance, alle Gesundheitsprobleme zu heilen',
      curesAllHealthIssues: 'Heilt alle Gesundheitsprobleme außer Krebs',
    },
    common: {
      yes: 'Ja',
      no: 'Nein',
      ok: 'OK',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      save: 'Speichern',
      load: 'Laden',
      back: 'Zurück',
      next: 'Weiter',
      previous: 'Zurück',
      close: 'Schließen',
      error: 'Fehler',
      success: 'Erfolg',
      warning: 'Warnung',
      info: 'Info',
      loading: 'Lädt...',
      retry: 'Wiederholen',
      unknown: 'Unbekannt',
    },
    tutorial: {
      welcome: 'Willkommen',
      welcomeDescription: 'Willkommen bei DeepLife Simulator',
      next: 'Weiter',
      skip: 'Überspringen',
      finish: 'Beenden',
    },
  },
};

export function getTranslation(language: Language): TranslationKeys {
  return translations[language] || translations.English;
}

export function t(language: Language, key: string): string {
  const translation = getTranslation(language);
  const keys = key.split('.');
  let value: any = translation;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Debug logging for missing translations
      if (__DEV__) {
        logger.warn('Translation not found:', { language, key, missingKey: k, availableKeys: value ? Object.keys(value) : 'undefined' });
      }
      return key; // Return key if translation not found
    }
  }
  
  const result = typeof value === 'string' ? value : key;
  
  // Debug logging to catch any potential prefix issues
  if (__DEV__ && typeof result === 'string' && (result.includes('computer.') || result.includes('mobile.') || result.includes('work.') || result.includes('market.') || result.includes('health.'))) {
    logger.warn('Translation result contains potential prefix issue:', { language, key, result });
  }
  
  return result;
}
