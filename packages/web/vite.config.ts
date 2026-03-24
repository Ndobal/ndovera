import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const boundPortPath = path.resolve(__dirname, '../server/BOUND_PORT.txt');
  const fallbackPort = env.NDOVERA_SERVER_PORT || '3001';

  return {
    // Plugins (single plugins array; legacy included below)
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      port: 5174,
      proxy: {
        // Proxy API calls to backend to avoid CORS in dev
        '/api': {
          target: `http://localhost:${fallbackPort}`,
          router: () => {
            if (fs.existsSync(boundPortPath)) {
              return `http://localhost:${fs.readFileSync(boundPortPath, 'utf8').trim()}`;
            }
            return `http://localhost:${fallbackPort}`;
          },
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
        },
      },
    },
    build: {
      target: 'es2015',
    },
    plugins: [
      react(),
      tailwindcss(),
      legacy({
        // Provide a legacy (nomodule) build for older browsers including IE11.
        targets: ['>0.2%', 'not dead', 'ie 11'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime', 'core-js/stable'],
      }),
    ],
  };
});
