var path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const dist = 'docs';
const entryJS = 'bundle_css.js';

module.exports = {
  mode: "production",
  entry: `./${dist}/${entryJS}`,
  output: {
    path: `${__dirname}/${dist}`,
    filename: entryJS,
  },
  optimization: {
    minimizer: [
      `...`,
      new CssMinimizerPlugin({
        sourceMap: true,
      })
    ],
  },
  module: {
    rules: [
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
  ]
};
