/* eslint-env jest */
// Jest setup file for global test configuration

global.__DEV__ = false;
process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = process.env.EXPO_PUBLIC_SAVE_HMAC_KEY || 'test-save-hmac-key-0123456789abcdef';
process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES = process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES || 'true';

// `testEnvironment: 'node'` has no rAF, and React Native's Animated calls it on
// the first frame of any animation. Without these a component that animates on
// mount (TopStatsBar) threw "requestAnimationFrame is not defined" — caught by
// the nearest ProviderBoundary, so its render smoke test still went green.
if (typeof global.requestAnimationFrame !== 'function') {
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

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
  // Screens that register a tabPress/focus listener (the onboarding Perks
  // screen, the mobile/computer launchers) call this on mount.
  useNavigation: jest.fn(() => ({
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    isFocused: jest.fn(() => true),
  })),
  useFocusEffect: jest.fn(),
  usePathname: jest.fn(() => '/'),
}));

jest.mock('expo-linear-gradient', () => 'LinearGradient');

// Mock react-native-svg as host-component string tags. The real package calls
// `react-native`'s native `processColor` at import time, which the RN mock doesn't
// provide; render tests only need the SVG elements to mount as inert host nodes.
jest.mock('react-native-svg', () => {
  const tags = [
    'Svg', 'Path', 'Defs', 'LinearGradient', 'RadialGradient', 'Stop', 'Circle',
    'Rect', 'G', 'Line', 'Polygon', 'Polyline', 'Ellipse', 'Text', 'TSpan',
    'TextPath', 'ClipPath', 'Mask', 'Use', 'Symbol', 'Pattern', 'Image', 'ForeignObject',
    // SvgXml renders a parsed SVG STRING, which is how the avatar art reaches
    // the tree. Leaving it out made every screen carrying an avatar crash with
    // "Element type is invalid" — undefined is not a component.
    'SvgXml', 'SvgCss', 'SvgFromXml',
  ];
  const mock = { __esModule: true, default: 'Svg' };
  for (const t of tags) mock[t] = t;
  return mock;
});

// Expo native `.js` modules ship ESM that ts-jest (which only transforms ts/tsx)
// can't parse. Mock the ones the screen graph pulls in — we don't test their
// behavior, only that screens mount around them.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0', name: 'DeepLife', slug: 'deeplife', extra: {}, ios: {}, android: {} },
    manifest: {},
    manifest2: {},
    nativeAppVersion: '1.0.0',
    nativeBuildVersion: '1',
    executionEnvironment: 'standalone',
    appOwnership: null,
    deviceName: 'test-device',
    platform: { ios: { buildNumber: '1' } },
    sessionId: 'test-session',
  },
  executionEnvironment: 'standalone',
  AppOwnership: { Standalone: 'standalone', Expo: 'expo', Guest: 'guest' },
}));

// Mock react-native-safe-area-context (used by every screen via useSafeAreaInsets).
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: 'SafeAreaView',
  SafeAreaInsetsContext: {
    Consumer: ({ children }) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
}));

// Mock @react-navigation/native (screens use useNavigation/useFocusEffect/etc.).
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
    setOptions: jest.fn(),
    dispatch: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: jest.fn(() => true),
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}), { virtual: true });

// expo-store-review is a native module with no JS fallback, so it can never run
// under Jest. Defaults say "the sheet is available and shows" — tests that care
// about the unavailable paths override these per-test.
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  hasAction: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
  storeUrl: jest.fn(() => null),
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
    'ImageBackground',
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
    'ActivityIndicator',
    'RefreshControl',
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
    // The hook form of the same thing. Its absence took down every component
    // that used it (TopStatsBar) — silently, because the ProviderBoundary
    // caught the throw and the smoke test only checked that SOMETHING rendered.
    useWindowDimensions: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
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
    BackHandler: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
      exitApp: jest.fn(),
    },
    NativeModules: {},
    // Legacy `Touchable.Mixin` is destructured at module scope by some touchable/gesture
    // wrappers; the real RN package exports it, so provide an empty Mixin for the mock.
    Touchable: { Mixin: {} },
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
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    stagger: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    delay: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    event: jest.fn(),
    createAnimatedComponent: jest.fn((component) => component),
    // Animated.* host components (string tags) so wrappers like
    // usePressableScale's <Animated.View> render under react-test-renderer.
    View: 'Animated.View',
    Text: 'Animated.Text',
    Image: 'Animated.Image',
    ScrollView: 'Animated.ScrollView',
    FlatList: 'Animated.FlatList',
    loop: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
  };

  // Easing — the RN mock above omitted it, so any component that calls
  // Easing.inOut(Easing.quad) (e.g. the DeepLife+ crown pulse) crashed. Provide
  // non-throwing stubs; the Animated mock no-ops, so the value is never invoked.
  const easingStub = () => easingStub;
  mockExports.Easing = new Proxy({}, { get: () => easingStub });

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
//
// A hand-maintained allowlist here is worse than no mock at all: an icon that
// is not listed resolves to `undefined`, React throws "Element type is
// invalid", and the ProviderBoundary catches it and renders its crash screen.
// Every render smoke test asserts `json.length > 0` — which the crash screen
// satisfies — so the suite goes GREEN on a component that did not render. That
// is exactly what happened to FamilyTab's first render test (Lock/Search/Smile
// were unlisted). The Proxy answers for every icon lucide exports, so the mock
// can never be the reason a component fails to mount.
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        // Never answer `then` with a truthy value: a module object with a
        // `then` is treated as a thenable by dynamic import / await.
        if (prop === 'then' || typeof prop !== 'string') return undefined;
        // String tags render as host components under react-test-renderer.
        return prop;
      },
      has: () => true,
    }
  )
);

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
