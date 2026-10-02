import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub repo name exactly
export default defineConfig({
  plugins: [react()],
  base: '/hey-mom/',
});
