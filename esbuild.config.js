const { resolve } = require('path');
const vueStylePlugin = require('./frappe-vue-style');

module.exports = {
  target: 'esnext',
  metafile: true,
  plugins: [vueStylePlugin()],
};
