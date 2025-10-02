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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '1584 Design Inventory & Transactions',
        short_name: '1584 Design',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Use shorter cache times for app files to ensure updates
        cacheId: `1584-inventory-${timestamp}`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: `firebase-storage-cache-${timestamp}`,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes for images - reasonable compromise
              }
            }
          },
          // Cache app shell files with shorter expiration
          {
            urlPattern: /\.(?:js|css|html)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: `app-shell-${timestamp}`,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 // 1 minute for app files - see changes immediately
              }
            }
          }
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
    // Disable ALL browser caching in development
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
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
