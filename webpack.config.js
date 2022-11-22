const path = require('path');

module.exports = (env, argv) => {
  const { mode } = argv;
  const isProd = mode === 'production';

  const config = {
    entry: './src/main.ts',
    target: 'web',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(glsl|wgsl)$/,
          type: 'asset/source'
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
  }

  if (!isProd) {
    config.devtool = 'source-map';
  }

  return config;
};