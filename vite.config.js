import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import compression from 'vite-plugin-compression';
import legacy from '@vitejs/plugin-legacy';
import { createHtmlPlugin } from 'vite-plugin-html';
import path from 'node:path';
import { existsSync, cpSync } from 'node:fs';

const repoBase = '/';

const copyStaticFoldersPlugin = () => ({
  name: 'copy-static-folders',
  closeBundle() {
    const staticFolders = ['js', 'images'];

    for (const folderName of staticFolders) {
      const sourcePath = path.resolve(folderName);
      const targetPath = path.resolve('dist', folderName);

      if (existsSync(sourcePath)) {
        cpSync(sourcePath, targetPath, { recursive: true });
      }
    }
  }
});

export default defineConfig({
  root: '.',
  base: repoBase,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        main: './index.html',
        'our-story': './our-story.html',
        'digital-solutions': './digital-solutions.html',
        'enrollment': './enrollment.html',
        'blog': './blog.html',
        'contact': './contact.html',
        'submissions': './submissions.html',
        'success': './success.html'
      },
      output: {
        manualChunks: {
          'supabase': ['@supabase/supabase-js'],
          'vendor': ['stripe']
        }
      }
    }
  },
  plugins: [
    copyStaticFoldersPlugin(),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          year: new Date().getFullYear()
        }
      }
    }),
    legacy({
      targets: ['defaults', 'not IE 11']
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz'
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br'
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Aspire Impact Network',
        short_name: 'Aspire Impact',
        description: 'Empowering People. Elevating Business. Creating Impact.',
        theme_color: '#1f5faa',
        background_color: '#081a2f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: repoBase,
        scope: repoBase,
        icons: [
          {
            src: `${repoBase}pwa-192x192.png`,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: `${repoBase}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: `${repoBase}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  css: {
    postcss: './postcss.config.js'
  }
});
