import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js"
  },
  server: {
    proxy: {
      '/v2': 'http://localhost:8082',
      '/api/rabbitmq': 'http://localhost:8082',
      '/api/bff': 'http://localhost:8084',
      '/bff': 'http://localhost:8084',
      '/api/pedidos': 'http://localhost:8082',
    }
  }
})
