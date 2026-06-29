const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports and add 'browser' condition to correctly resolve WebCrypto/browser versions of packages (like jose)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  'react-native',
  'browser',
  'require',
  'import',
];

module.exports = config;
