const path = require("path");
const glob = require('glob');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const PurgecssPlugin = require('purgecss-webpack-plugin');

const src = 'src';
const dist = 'docs';
const indexJS = 'index.js';

module.exports = {
  mode: "development",
  entry: {
    index: `./${src}/${indexJS}`,
    sw: `./${src}/sw.js`,
  },
  output: {
    path: `${__dirname}/${dist}`,
    filename: '[name].js',
  },
  devServer: {
    host: '0.0.0.0',
    contentBase: `${__dirname}/${dist}`
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
      new CssMinimizerPlugin({
        sourceMap: true,
      })
    ],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: { loader: 'babel-loader' }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: "css-loader", options: { sourceMap: true } },
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "style.css",
    }),
    new PurgecssPlugin({
      paths: [
        ...glob.sync(`./${src}/**/*`, { nodir: true }),
        "./node_modules/quill/dist/quill.min.js"
      ],
    }),
  ]
};
