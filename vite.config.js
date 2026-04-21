import base44 from '@base44/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import viteImagemin from 'vite-plugin-imagemin';

export default defineConfig(({ mode }) => ({
  logLevel: 'error',
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    viteImagemin({
      mozjpeg: { quality: 75 },
      pngquant: { quality: [0.65, 0.8], speed: 4 },
      webp: { quality: 75 }
    }),
    ...(mode === 'analyze' ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })] : [])
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    css: true
  }
}));
