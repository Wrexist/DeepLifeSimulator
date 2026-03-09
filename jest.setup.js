/* eslint-env jest */
// Jest setup file for global test configuration

global.__DEV__ = false;
process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = process.env.EXPO_PUBLIC_SAVE_HMAC_KEY || 'test-save-hmac-key-0123456789abcdef';
process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES = process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES || 'true';

// Mock performance API for performance tests
global.performance = {
  now: () => Date.now(),
  mark: jest.fn(),
  measure: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  getEntries: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Startup globals expected by startup safety tests.
if (!Array.isArray(global.__errorQueue)) {
  global.__errorQueue = [];
}

const pushStartupError = (error, isFatal, type = 'globalError') => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  if (!Array.isArray(global.__errorQueue)) {
    global.__errorQueue = [];
  }
  global.__errorQueue.push({
    message: normalizedError.message || String(error),
    stack: normalizedError.stack,
    isFatal: !!isFatal,
    time: Date.now(),
    type,
  });
  if (global.__errorQueue.length > 50) {
    global.__errorQueue.shift();
  }
};

if (!(global.ErrorUtils && typeof global.ErrorUtils.getGlobalHandler === 'function')) {
  let activeHandler = (error, isFatal) => {
    pushStartupError(error, isFatal, 'globalError');
    return undefined;
  };
  global.ErrorUtils = {
    getGlobalHandler: jest.fn(() => activeHandler),
    setGlobalHandler: jest.fn((nextHandler) => {
      if (typeof nextHandler === 'function') {
        activeHandler = nextHandler;
      }
    }),
    reportFatalError: jest.fn((error) => activeHandler(error, true)),
  };
}
if (typeof global.RCTFatal !== 'function') {
  global.RCTFatal = jest.fn((error) => {
    pushStartupError(error || new Error('RCTFatal called'), true, 'rctFatal');
  });
}
if (typeof global.__EARLY_INIT_ERROR__ !== 'function') {
  global.__EARLY_INIT_ERROR__ = jest.fn(() => null);
}
if (typeof global.__STARTUP_HEALTH_CHECK__ !== 'function') {
  global.__STARTUP_HEALTH_CHECK__ = jest.fn(() => ({
    criticalModules: ['expo-splash-screen'],
    availableModules: ['expo-splash-screen'],
    failedModules: [],
    ready: true,
  }));
}
if (!global.__MODULE_AUDIT_REPORT__) {
  global.__MODULE_AUDIT_REPORT__ = {
    iosVersion: '17.0',
    isIOS26Beta: false,
    modules: [],
    summary: { incompatible: [] },
  };
}

if (typeof global.onunhandledrejection !== 'function') {
  global.onunhandledrejection = jest.fn((event) => {
    const reason =
      event && typeof event === 'object' && 'reason' in event
        ? event.reason
        : event;
    pushStartupError(reason, false, 'unhandledRejection');
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    return true;
  });
}

if (!process.__DL_UNHANDLED_REJECTION_BRIDGE_INSTALLED__) {
  process.on('unhandledRejection', (reason) => {
    if (typeof global.onunhandledrejection === 'function') {
      global.onunhandledrejection({
        reason,
        preventDefault: () => {},
      });
      return;
    }
    pushStartupError(reason, false, 'unhandledRejection');
  });
  process.__DL_UNHANDLED_REJECTION_BRIDGE_INSTALLED__ = true;
}

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const asyncStorageMock = {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  };
  return {
    __esModule: true,
    default: asyncStorageMock,
    ...asyncStorageMock,
  };
});

// Mock Expo modules
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-linear-gradient', () => 'LinearGradient');

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}), { virtual: true });

jest.mock('@/services/RemoteLoggingService', () => ({
  remoteLogger: {
    log: jest.fn(),
    configure: jest.fn(),
    getLogs: jest.fn(() => []),
    clearLogs: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    cleanup: jest.fn(),
  },
}));

// Mock React Native components without requiring the real package (ESM parse issues in Jest).
jest.mock('react-native', () => {
  const componentNames = [
    'View',
    'Text',
    'Image',
    'ScrollView',
    'FlatList',
    'SectionList',
    'TextInput',
    'TouchableOpacity',
    'TouchableHighlight',
    'TouchableWithoutFeedback',
    'Pressable',
    'Modal',
    'Switch',
    'SafeAreaView',
    'KeyboardAvoidingView',
    'StatusBar',
  ];

  const mockExports = {
    Platform: {
      OS: 'ios',
      Version: 17,
      select: (config) => {
        if (config && typeof config === 'object') {
          return config.ios ?? config.default ?? config.android;
        }
        return undefined;
      },
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => style,
      compose: (a, b) => ({ ...a, ...b }),
      hairlineWidth: 1,
    },
    Alert: {
      alert: jest.fn(),
    },
    Keyboard: {
      dismiss: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeAllListeners: jest.fn(),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },
    NativeModules: {},
    PixelRatio: {
      get: jest.fn(() => 3),
      roundToNearestPixel: jest.fn((v) => v),
    },
    InteractionManager: {
      runAfterInteractions: jest.fn((cb) => {
        if (typeof cb === 'function') cb();
        return { cancel: jest.fn() };
      }),
    },
    LayoutAnimation: {
      configureNext: jest.fn(),
      create: jest.fn(),
      Types: {},
      Properties: {},
    },
  };

  const AnimatedValue = jest.fn(() => ({
    setValue: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    stopAnimation: jest.fn(),
    interpolate: jest.fn(() => 0),
  }));

  mockExports.Animated = {
    Value: AnimatedValue,
    ValueXY: jest.fn(() => ({
      x: AnimatedValue(),
      y: AnimatedValue(),
      setValue: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      getLayout: jest.fn(() => ({})),
      getTranslateTransform: jest.fn(() => []),
    })),
    timing: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    spring: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    decay: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    sequence: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    })),
    event: jest.fn(),
    createAnimatedComponent: jest.fn((component) => component),
  };

  for (const name of componentNames) {
    mockExports[name] = name;
  }

  return mockExports;
});

// Mock Moti
jest.mock('moti', () => ({
  View: 'View',
  Text: 'Text',
  AnimatePresence: ({ children }) => children,
}), { virtual: true });

// Mock Lucide React Native
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
  HelpCircle: 'HelpCircle',
  Play: 'Play',
  XCircle: 'XCircle',
  User: 'User',
  Users: 'Users',
  Dice1: 'Dice1',
  // Add other icons as needed
}));

// Global test utilities
// NOTE: Use the proper createTestGameState from __tests__/helpers/createTestGameState.ts instead
// This global is kept for backward compatibility but should be migrated
// Import: import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
const { createTestGameState: createTestGameStateHelper } = require('./__tests__/helpers/createTestGameState');
global.createTestGameState = (overrides = {}) => {
  return createTestGameStateHelper(overrides);
};

// Test timeout
jest.setTimeout(10000);
