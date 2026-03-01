import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_PORT || 5173),
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'axios', 'naive-ui', '@vicons/ionicons5'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          naive: ['naive-ui', '@vicons/ionicons5'],
        },
      },
    },
  },
});
