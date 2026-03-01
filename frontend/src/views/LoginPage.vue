<template>
  <div class="auth-page container-shell">
    <section class="glass-card auth-card reveal">
      <header class="auth-head">
        <h2 class="gradient-heading-sm">登录</h2>
        <p>使用邮箱和密码登录后即可提问，并在「我的问题」中查看进度。</p>
      </header>

      <n-form @submit.prevent="onSubmit" class="auth-form">
        <n-form-item label="邮箱">
          <n-input v-model:value="email" type="email" placeholder="you@example.com" size="large" clearable />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="password" type="password" placeholder="请输入密码" size="large" />
        </n-form-item>

        <div class="actions">
          <button class="btn-glow" :disabled="loading" type="submit">{{ loading ? '登录中...' : '登录' }}</button>
          <router-link :to="{ name: 'register', query: route.query }" class="link">还没有账号？去注册</router-link>
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </n-form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

const onSubmit = async () => {
  if (!email.value || !password.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    await auth.login(email.value, password.value);
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e: any) {
    errorMessage.value = e?.response?.data?.message || '登录失败，请检查邮箱和密码。';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  padding-top: var(--sp-8);
}

.auth-card {
  width: 100%;
  max-width: 460px;
  padding: var(--sp-6);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.auth-head h2 {
  margin: 0;
}

.auth-head p {
  margin: var(--sp-2) 0 var(--sp-4);
  color: var(--text-secondary);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.btn-glow {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.72rem 1.2rem;
  color: #fff;
  font-weight: 600;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  transition: transform 0.2s ease, box-shadow 0.3s ease;
}

.btn-glow:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.link {
  color: var(--text-secondary);
  text-decoration: underline;
}

.error {
  margin: 0;
  color: #fecaca;
}

.gradient-heading-sm {
  font-size: 1.7rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
