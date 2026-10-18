import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 26847, host: '127.0.0.1', strictPort: true },
  preview: { port: 26847, host: '127.0.0.1', strictPort: true, allowedHosts: ['.trycloudflare.com', '.agentai.my.id'] }
});
