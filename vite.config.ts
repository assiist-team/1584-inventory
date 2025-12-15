import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// Generate a timestamp for cache busting
const timestamp = Date.now()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: process.env.NODE_ENV === 'production' ? 'autoUpdate' : null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'index.html'],
      manifest: {
        name: '1584 Design Inventory & Transactions',
        short_name: '1584 Design Projects',
        description: 'Modern, mobile-first inventory management system',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        globPatterns: ['index.html', '**/*.{ico,png,svg}'], // Only cache static assets, precache shell
        // Don't cache app files in service worker - always fetch fresh versions
        cacheId: `1584-inventory-${timestamp}`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: `supabase-storage-cache-${timestamp}`,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours for images is fine
              }
            }
          },
          // DON'T cache app files (js, css, html) - always fetch fresh versions
          // This ensures immediate deployment updates are visible
        ]
      },
      // PWA enabled in both dev and prod for consistent behavior
      // Use short cache times to ensure changes are visible immediately
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    https: false, // Set to true if you want HTTPS in development
    cors: true,   // Enable CORS for development
    // Enable localStorage for auth persistence - no cache control headers that interfere
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          router: ['react-router-dom'],
          ui: ['lucide-react', 'clsx']
        },
        // Ensure proper MIME types
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
