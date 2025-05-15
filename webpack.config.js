// webpack.config.js
const webpack = require('webpack');

module.exports = {
  // ... other webpack configuration
  resolve: {
    fallback: {
      // Provide polyfills for Node.js core modules
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
      "assert": require.resolve("assert/"),
      "os": require.resolve("os-browserify/browser"),
      "zlib": require.resolve("browserify-zlib"),
      "fs": false, // Not needed in the browser
      "child_process": false, // Not needed in the browser
      "net": false, // Not needed in the browser
      "tls": false, // Not needed in the browser
    },
  },
  plugins: [
    // ... other plugins
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ],
};