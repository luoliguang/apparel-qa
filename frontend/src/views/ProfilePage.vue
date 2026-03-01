<template>
  <div class="container-shell profile-wrap">
    <section class="glass-card reveal">
      <h2 class="gradient-heading-sm">个人资料</h2>
      <p class="muted">可修改昵称和头像。昵称规则：2-20位，仅支持中文、英文、数字、下划线。</p>
    </section>

    <section class="glass-card reveal profile-card">
      <div class="avatar-block">
        <img v-if="previewAvatar" :src="previewAvatar" alt="头像" class="avatar" />
        <div v-else class="avatar avatar-fallback">{{ avatarFallback }}</div>

        <div class="avatar-actions">
          <label class="btn-ghost upload-btn">
            上传头像
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="onChooseAvatar" />
          </label>
          <button type="button" class="btn-ghost" @click="useDefaultAvatar">使用默认头像</button>
        </div>
        <span class="hint">支持 jpg/png/webp，最大 2MB</span>
      </div>

      <form class="form" @submit.prevent="onSubmit">
        <label class="field">
          <span>邮箱（只读）</span>
          <input type="text" :value="auth.user?.email || ''" disabled />
        </label>

        <label class="field">
          <span>昵称</span>
          <input v-model.trim="nickname" type="text" maxlength="20" placeholder="请输入昵称" />
        </label>

        <p class="error" v-if="errorMsg">{{ errorMsg }}</p>

        <button class="btn-glow" type="submit" :disabled="saving">
          {{ saving ? '保存中...' : '保存资料' }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '../stores/auth';
import { apiClient } from '../utils/apiClient';

const NICKNAME_REGEX = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/;

const auth = useAuthStore();
const message = useMessage();

const nickname = ref('');
const previewAvatar = ref('');
const saving = ref(false);
const errorMsg = ref('');

const avatarFallback = computed(() => {
  const source = auth.user?.nickname || auth.user?.email || 'U';
  return source.trim().slice(0, 1).toUpperCase();
});

const syncFromUser = () => {
  nickname.value = auth.user?.nickname || '';
  previewAvatar.value = auth.user?.avatarUrl || '';
};

const validateNickname = (value: string) => {
  if (!NICKNAME_REGEX.test(value)) {
    return '昵称格式不合法：2-20位，仅支持中文、英文、数字、下划线';
  }
  return '';
};

const onChooseAvatar = async (evt: Event) => {
  const input = evt.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    message.error('图片不能超过 2MB');
    input.value = '';
    return;
  }

  try {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post('/upload/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    previewAvatar.value = res.data.url;
    message.success('头像上传成功');
  } catch (e: any) {
    message.error(e?.response?.data?.message || '头像上传失败');
  } finally {
    input.value = '';
  }
};

const useDefaultAvatar = () => {
  previewAvatar.value = '';
};

const onSubmit = async () => {
  const err = validateNickname(nickname.value);
  if (err) {
    errorMsg.value = err;
    return;
  }

  errorMsg.value = '';
  saving.value = true;

  try {
    await auth.updateProfile({
      nickname: nickname.value,
      avatarUrl: previewAvatar.value || '',
    });
    message.success('个人资料已更新');
  } catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败，请稍后重试');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  document.title = '个人资料 - Apparel QA';
  if (!auth.user) {
    await auth.fetchMe();
  }
  syncFromUser();
});
</script>

<style scoped>
.profile-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-8);
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--sp-4);
}

.gradient-heading-sm {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.muted {
  margin-top: var(--sp-2);
  color: var(--text-secondary);
}

.profile-card {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: var(--sp-6);
}

.avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid var(--border-bright);
  background: var(--bg-elevated);
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  font-size: 2rem;
  font-weight: 700;
}

.upload-btn input {
  display: none;
}

.hint {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field span {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.field input {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  padding: 0.62rem 0.78rem;
  outline: none;
}

.field input:focus {
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow);
}

.error {
  margin: 0;
  color: #f87171;
  font-size: 0.82rem;
}

.btn-glow {
  width: fit-content;
  border: none;
  border-radius: var(--radius-full);
  padding: 0.62rem 1.2rem;
  color: #fff;
  font-weight: 600;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
}

.btn-glow:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-ghost {
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  padding: 0.36rem 0.8rem;
  font-size: 0.78rem;
  cursor: pointer;
}

@media (max-width: 768px) {
  .profile-card {
    grid-template-columns: 1fr;
  }
}
</style>
