module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // Reanimated's worklet transform must be last.
      'react-native-worklets/plugin',
    ],
  };
};
