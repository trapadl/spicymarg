// config-overrides.js
const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "util": require.resolve("util/"),
    "path": require.resolve("path-browserify"),
    "assert": require.resolve("assert/"),
    "os": require.resolve("os-browserify/browser"),
    "zlib": require.resolve("browserify-zlib"),
    "url": require.resolve("url/"),
    "vm": require.resolve("vm-browserify"), // Add this line
    "fs": false,
    "child_process": false,
    "net": false,
    "tls": false,
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ];

  return config;
};