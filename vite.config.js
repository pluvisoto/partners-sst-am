import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/@supabase/supabase-js/')) return 'supabase-vendor'
          return undefined
        }
      }
    }
  },
  server: {
    proxy: {
      '/api/receitaws': {
        target: 'https://www.receitaws.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/receitaws/, '/v1/cnpj'),
        headers: { 'Accept': 'application/json' }
      },
      '/api/brasilapi': {
        target: 'https://brasilapi.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/brasilapi/, '/api/cnpj/v1'),
        headers: { 'Accept': 'application/json' }
      }
    }
  }
})
