import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api calls to the Express backend. The browser sees a single origin,
    // so the session cookie works without any CORS setup.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
