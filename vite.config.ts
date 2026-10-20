import {defineConfig} from 'vite';
import {resolve} from 'path';
export default defineConfig({base:'./',build:{rollupOptions:{input:{index:resolve(__dirname,'main.html'),running:resolve(__dirname,'running-src.html')}}}});
