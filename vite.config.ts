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
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Aggressive cache busting for immediate updates
        cacheId: `1584-inventory-${timestamp}`,
        mode: 'development',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: `firebase-storage-cache-${timestamp}`,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 1 // 1 hour for images
              },
              networkTimeoutSeconds: 3
            }
          },
          // Network-first for all app assets to ensure fresh content
          {
            urlPattern: /\.(?:js|css|html|ico|png|svg|woff|woff2)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: `app-assets-${timestamp}`,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 1 // 1 hour max cache
              },
              networkTimeoutSeconds: 3
            }
          }
        ]
      },
      // Enable PWA in development for consistent behavior
      devOptions: {
        enabled: true,
        type: 'module'
      }
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
    },
    // Handle service worker requests in development
    middlewareMode: false,
    fs: {
      allow: ['..']
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
