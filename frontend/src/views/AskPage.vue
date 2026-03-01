<template>
  <div class="container-shell ask-wrap">
    <header class="glass-card reveal">
      <h2 class="gradient-heading-sm">提交新问题</h2>
    </header>

    <section v-if="!isLoggedIn" class="glass-card state">请先登录后再提交问题。</section>

    <section v-else class="glass-card reveal">
      <n-form label-placement="top" @submit.prevent="onSubmit">
        <n-form-item label="问题标题">
          <n-input v-model:value="title" placeholder="例如：某款棉氨面料缩水率测试方法？" />
        </n-form-item>

        <n-form-item label="问题描述">
          <n-input
            v-model:value="description"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="请补充款号、面料成分、克重、问题现象、买家要求等信息。"
          />
        </n-form-item>

        <n-form-item label="参考图片（可选）">
          <div class="uploader-wrap">
            <div
              class="drop-zone"
              :class="isDragging ? 'dragging' : ''"
              @dragover.prevent="onDragOver"
              @dragleave.prevent="onDragLeave"
              @drop.prevent="onDrop"
            >
              <label class="btn-glow">
                选择图片
                <input class="hidden" type="file" multiple accept="image/*" @change="onFilesSelected" />
              </label>
              <span class="muted small">可直接拖拽图片到此区域上传（支持多图）。</span>
            </div>

            <div v-if="uploadingItems.length" class="progress-box">
              <p class="small">上传进度</p>
              <div v-for="item in uploadingItems" :key="item.id" class="progress-row">
                <div class="progress-head">
                  <span>{{ item.name }}</span>
                  <span>{{ item.progress }}%</span>
                </div>
                <div class="bar-bg"><div class="bar" :style="{ width: `${item.progress}%` }"></div></div>
              </div>
            </div>

            <p v-if="uploading" class="small muted">正在上传图片，请稍候...</p>

            <div v-if="imageUrls.length" class="img-grid">
              <figure v-for="(url, idx) in imageUrls" :key="url" class="img-item">
                <img :src="url" alt="" />
                <button type="button" class="img-remove" @click="removeImage(idx)">删除</button>
              </figure>
            </div>
          </div>
        </n-form-item>

        <div class="actions">
          <button class="btn-glow" type="submit" :disabled="submitting">{{ submitting ? '提交中...' : '提交问题' }}</button>
        </div>

        <p v-if="successMessage" class="success">{{ successMessage }}</p>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </n-form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiClient } from '../utils/apiClient';
import { useAuthStore } from '../stores/auth';

interface UploadingItem {
  id: string;
  name: string;
  progress: number;
}

const auth = useAuthStore();
const router = useRouter();

const isLoggedIn = computed(() => auth.isLoggedIn);

const title = ref('');
const description = ref('');
const imageUrls = ref<string[]>([]);
const uploading = ref(false);
const isDragging = ref(false);
const uploadingItems = ref<UploadingItem[]>([]);
const submitting = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const removeImage = (idx: number) => {
  imageUrls.value.splice(idx, 1);
};

const uploadFiles = async (files: FileList | File[]) => {
  if (!files || !files.length) return;

  uploading.value = true;
  errorMessage.value = '';

  try {
    const uploads: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;

      const itemId = `${file.name}-${Date.now()}-${i}`;
      uploadingItems.value.push({ id: itemId, name: file.name, progress: 0 });

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
          const target = uploadingItems.value.find((x) => x.id === itemId);
          if (target) target.progress = progress;
        },
      });

      uploads.push(res.data.url);

      const done = uploadingItems.value.find((x) => x.id === itemId);
      if (done) done.progress = 100;
    }

    imageUrls.value.push(...uploads);

    setTimeout(() => {
      uploadingItems.value = [];
    }, 500);
  } catch {
    errorMessage.value = '图片上传失败，请稍后重试。';
    uploadingItems.value = [];
  } finally {
    uploading.value = false;
  }
};

const onFilesSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  await uploadFiles(files || []);
  target.value = '';
};

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = async (e: DragEvent) => {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  await uploadFiles(files || []);
};

const onSubmit = async () => {
  if (!title.value || !description.value) return;

  submitting.value = true;
  successMessage.value = '';
  errorMessage.value = '';

  try {
    await apiClient.post('/customer-questions', {
      title: title.value,
      description: description.value,
      imageUrls: imageUrls.value,
    });
    window.dispatchEvent(new CustomEvent('customer-question-submitted'));
    successMessage.value = '提交成功，我们会尽快回复。可在“我的问题”中查看进度。';
    title.value = '';
    description.value = '';
    imageUrls.value = [];
    setTimeout(() => {
      router.push({ name: 'my-questions' });
    }, 800);
  } catch {
    errorMessage.value = '提交失败，请检查网络后重试。';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.ask-wrap {
  --ask-input-text: #1f2f52;
  --ask-input-placeholder: #7b8aa8;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-8);
}

:deep(.n-form-item-label__text) {
  color: var(--text-secondary);
}

:deep(.n-input) {
  --n-color: rgba(255, 255, 255, 0.05);
  --n-color-focus: rgba(255, 255, 255, 0.05);
  --n-color-disabled: rgba(255, 255, 255, 0.03);
  --n-border: 1px solid rgba(255, 255, 255, 0.12);
  --n-border-hover: 1px solid rgba(255, 255, 255, 0.22);
  --n-border-focus: 1px solid rgba(79, 159, 255, 0.6);
  --n-box-shadow-focus: 0 0 0 3px rgba(79, 159, 255, 0.15);
  --n-text-color: var(--ask-input-text);
  --n-placeholder-color: var(--ask-input-placeholder);
  --n-caret-color: var(--ask-input-text);
}

:deep(.n-input .n-input__input-el),
:deep(.n-input .n-input__textarea-el) {
  color: var(--ask-input-text) !important;
  caret-color: var(--ask-input-text);
}

:deep(.n-input .n-input__input-el::placeholder),
:deep(.n-input .n-input__textarea-el::placeholder) {
  color: var(--ask-input-placeholder) !important;
  opacity: 0.95;
}

:deep(.n-input.n-input--focus) {
  box-shadow: 0 0 0 3px rgba(79, 159, 255, 0.15);
}

.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--sp-6);
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

.small {
  font-size: 0.8rem;
}

.state {
  text-align: center;
}

.drop-zone {
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.03);
  padding: var(--sp-4);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-3);
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease;
}

.drop-zone.dragging,
.drop-zone:hover {
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}

.progress-box {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3);
}

.progress-row {
  margin-top: var(--sp-2);
}

.progress-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.bar-bg {
  margin-top: 0.25rem;
  height: 7px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-teal));
  transition: width 0.25s ease;
}

.img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: var(--sp-2);
}

.img-item {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.img-item img {
  width: 100%;
  height: 92px;
  object-fit: cover;
  display: block;
}

.img-remove {
  position: absolute;
  right: 6px;
  top: 6px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  background: rgba(6, 7, 13, 0.8);
  color: var(--text-primary);
}

.actions {
  margin-top: var(--sp-4);
}

.btn-glow {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.72rem 1.4rem;
  color: #fff;
  font-weight: 600;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  transition: transform 0.2s ease, box-shadow 0.3s ease;
}

.btn-glow:hover,
.btn-glow:focus-visible {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.success {
  color: #99f6e4;
  margin-top: var(--sp-3);
}

.error {
  color: #fecaca;
  margin-top: var(--sp-3);
}
</style>
