import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const stooqSymbols = '%5ESPX+%5EDJI+%5ENDQ+%5ESNX+%5EHSI+%5ESHC+%5ENKX'
const stooqFields = 'sd2t2ncohl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        rewrite: () => `/q/l/?s=${stooqSymbols}&f=${stooqFields}&h&e=json`,
      },
    },
  },
})
