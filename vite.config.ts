import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000, // Or whichever port you want
    proxy: {
      '/api': 'http://localhost:3001', // Ensure this points to your Express server
    },
  },
});
