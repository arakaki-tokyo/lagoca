var path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const PurgeCSSPlugin = require('purgecss-webpack-plugin');
const glob = require('glob');

const entryJS = 'bundle_css.js';

module.exports = {
  mode: "production",
  devServer: {
    contentBase: path.join(__dirname, "dist"),
    compress: true,
    port: 9000,
    host: "0.0.0.0",
  },
  // watch: true,
  // watchOptions: {
  //   ignored: /node_modules/,
  // },
  entry: `./src/${entryJS}`,
  output: {
    path: __dirname + "/dist",
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
    new PurgeCSSPlugin({
      paths: [
        path.join(__dirname, "dist/index.html"),
        path.join(__dirname, "dist/index.js"),
        // ...glob.sync(`${path.join(__dirname, 'src')}/**/*`,  { nodir: true }),
      ],
    }),
  ]
};
