module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin powers react-native-reanimated v4's worklets
    // (gesture callbacks, useAnimatedStyle). It must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
