import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const backendTarget = process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8081';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: backendTarget,
          ws: true,
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
