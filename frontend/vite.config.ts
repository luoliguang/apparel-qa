import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
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
