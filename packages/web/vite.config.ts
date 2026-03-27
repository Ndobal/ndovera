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
  const manualChunks = (id: string) => {
    if (!id.includes('node_modules')) return undefined;
    if (id.includes('react-router') || id.includes('react-dom') || id.includes(`${path.sep}react${path.sep}`)) return 'vendor-react';
    if (id.includes('lucide-react') || id.includes(`${path.sep}motion${path.sep}`) || id.includes('framer-motion')) return 'vendor-ui';
    if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('yjs') || id.includes('y-websocket') || id.includes('y-protocols')) return 'vendor-editor';
    if (id.includes('mathlive') || id.includes('katex') || id.includes('remark-math') || id.includes('rehype-katex') || id.includes('react-markdown') || id.includes('unified') || id.includes('mdast') || id.includes('hast') || id.includes('vfile') || id.includes('micromark')) return 'vendor-math';
    if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('html-to-image') || id.includes('docx') || id.includes('jszip') || id.includes('file-saver') || id.includes('xml-js')) return 'vendor-export';
    if (id.includes('fabric') || id.includes('konva') || id.includes('react-konva')) return 'vendor-canvas';
    if (id.includes('html5-qrcode') || id.includes('qrcode.react')) return 'vendor-qr';
    if (id.includes('emoji-mart')) return 'vendor-emoji';
    if (id.includes('@google/genai')) return 'vendor-ai';
    return 'vendor-misc';
  };

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
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
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
