import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));



export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.GREETO_API_TARGET || env.VITE_API_TARGET || 'http://localhost:3001';
  return {
  plugins: [react()],
  root: '.',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    clearMocks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@xyflow/react') || id.includes('@xyflow/system')) return 'workflow-canvas-vendor';
          if (id.includes('recharts')) return 'charts-vendor';
          if (id.includes('victory-vendor')) return 'chart-math-vendor';
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'realtime-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          if (/node_modules[\\/](@?react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/webhooks': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
};
});
