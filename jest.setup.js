jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Minimal Reanimated mock. The package's own mock re-imports the real module
// (which boots the native worklets runtime and crashes under Jest), so we stub
// just the surface Card.tsx uses. `interpolate` resolves to 0 so animated
// styles render at their resting values (e.g. a fully-transparent edge-tint),
// and shared values / animation helpers are plain synchronous passthroughs.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component) => Component,
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    interpolate: () => 0,
    runOnJS: (fn) => fn,
    useSharedValue: (init) => ({ value: init }),
    useAnimatedStyle: (factory) => factory(),
    withSpring: (toValue) => toValue,
    withTiming: (toValue) => toValue,
  };
});

// Gesture Handler's real GestureDetector pulls in the full Reanimated runtime.
// The design tests only inspect Card's rendered children, not gesture behavior,
// so render children straight through and make Gesture.* a chainable no-op.
jest.mock('react-native-gesture-handler', () => {
  const makeChain = () => new Proxy({}, { get: () => () => makeChain() });
  return {
    __esModule: true,
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: ({ children }) => children,
    Gesture: new Proxy({}, { get: () => () => makeChain() }),
  };
});
