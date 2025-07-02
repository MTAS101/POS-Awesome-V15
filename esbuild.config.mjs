import esbuild from 'esbuild';
import vuePlugin from '@vitejs/plugin-vue';
import frappeVueStyle from './frappe-vue-style.js';

esbuild.build({
  entryPoints: ['frontend/src/posawesome.bundle.js'],
  bundle: true,
  outdir: 'posawesome/public/dist/js',
  format: 'esm',
  target: 'esnext',
  plugins: [frappeVueStyle(), vuePlugin()],
  metafile: true,
}).then(result => {
  console.log('Build outputs:', Object.keys(result.metafile.outputs));
}).catch(() => process.exit(1));
