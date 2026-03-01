<template>
  <div class="container-shell edit-wrap">
    <header class="glass-card reveal">
      <div class="head-row">
        <h2 class="gradient-heading-sm">{{ isNew ? '新增问题' : '编辑问题' }}</h2>
        <router-link to="/admin/questions" class="text-link">← 返回列表</router-link>
      </div>
    </header>

    <section class="glass-card reveal form-surface">
      <n-form class="form-premium" label-placement="top" @submit.prevent="onSubmit">
        <n-form-item label="标题">
          <n-input v-model:value="title" placeholder="问题标题" />
        </n-form-item>

        <n-form-item label="答案正文">
          <n-input
            v-model:value="content"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 14 }"
            placeholder="答案内容（支持多行）"
          />
        </n-form-item>

        <n-form-item label="标签（可选）">
          <div class="field-stack">
            <n-select
              v-model:value="selectedTagNames"
              multiple
              filterable
              remote
              tag
              :options="tagOptions"
              :loading="tagsLoading"
              :on-search="onTagSearch"
              :on-create="handleCreateTag"
              placeholder="输入关键词搜索标签，或直接输入新标签并回车"
              @keydown.enter.stop.prevent="onTagEnter"
              @keyup.enter.stop.prevent="onTagEnter"
            />
            <p class="muted small helper-text">按需远程搜索标签，输入新标签后回车可直接创建。</p>
          </div>
        </n-form-item>

        <n-form-item label="可见性">
          <n-select v-model:value="visibility" :options="visibilityOptions" />
        </n-form-item>

        <n-form-item label="分类（可选）">
          <div class="field-stack">
            <n-select
              v-model:value="selectedCategoryName"
              filterable
              remote
              tag
              clearable
              :options="categoryNameOptions"
              :loading="categoriesLoading"
              :on-search="onCategorySearch"
              :on-create="handleCreateCategory"
              placeholder="输入关键词搜索分类，或输入新分类回车"
              @keydown.enter.stop.prevent="onCategoryEnter"
              @keyup.enter.stop.prevent="onCategoryEnter"
            />
            <p class="muted small helper-text">按需远程搜索分类，输入新分类后回车即可创建并选中。</p>
          </div>
        </n-form-item>

        <n-form-item label="图片（可选）">
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
                <input class="hidden" type="file" accept="image/*" multiple @change="onFileSelected" />
              </label>
              <span class="muted small">可直接拖拽图片到此区域上传。</span>
            </div>

            <p v-if="uploading" class="muted small">上传中...</p>

            <div v-if="imageUrls.length" class="img-grid">
              <figure v-for="(url, idx) in imageUrls" :key="`${url}-${idx}`" class="img-item">
                <img :src="url" alt="" />
                <button class="img-remove" type="button" @click="removeImage(idx)">删除</button>
              </figure>
            </div>
          </div>
        </n-form-item>

        <div class="actions">
          <button class="btn-glow" type="submit" :disabled="submitting">{{ isNew ? '创建' : '保存' }}</button>
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </n-form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiClient } from '../../utils/apiClient';

interface Category {
  id: number;
  name: string;
}

interface Tag {
  id: number;
  name: string;
}

const route = useRoute();
const router = useRouter();

const id = computed(() => route.params.id as string);
const isNew = computed(() => !id.value || id.value === 'new');

const title = ref('');
const content = ref('');
const visibility = ref<'PUBLIC' | 'LOGGED_IN' | 'PRIVATE'>('PUBLIC');
const imageUrls = ref<string[]>([]);
const categories = ref<Category[]>([]);
const tags = ref<Tag[]>([]);
const selectedTagNames = ref<string[]>([]);
const selectedCategoryName = ref<string | null>(null);
const tagSearchKeyword = ref('');
const categorySearchKeyword = ref('');
let tempOptionId = 1;
const categoriesLoading = ref(false);
const tagsLoading = ref(false);
const uploading = ref(false);
const submitting = ref(false);
const errorMessage = ref('');
const isDragging = ref(false);
let categorySearchTimer: number | null = null;
let tagSearchTimer: number | null = null;

const visibilityOptions = [
  { label: '公开', value: 'PUBLIC' },
  { label: '登录可见', value: 'LOGGED_IN' },
  { label: '仅管理员', value: 'PRIVATE' },
] as const;

const categoryNameOptions = computed(() => categories.value.map((c) => ({ label: c.name, value: c.name })));
const tagOptions = computed(() => tags.value.map((t) => ({ label: t.name, value: t.name })));

const nextTempId = () => {
  tempOptionId += 1;
  return -tempOptionId;
};

const handleCreateTag = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return '';

  if (!selectedTagNames.value.includes(normalized)) {
    selectedTagNames.value = [...selectedTagNames.value, normalized];
  }

  if (!tags.value.some((t) => t.name === normalized)) {
    tags.value = [{ id: nextTempId(), name: normalized }, ...tags.value];
  }

  tagSearchKeyword.value = '';
  return normalized;
};

const handleCreateCategory = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return '';

  selectedCategoryName.value = normalized;
  if (!categories.value.some((c) => c.name === normalized)) {
    categories.value = [{ id: nextTempId(), name: normalized }, ...categories.value];
  }

  categorySearchKeyword.value = '';
  return normalized;
};

const mergeCategories = (list: Category[]) => {
  const map = new Map<number, Category>();
  for (const c of categories.value) map.set(c.id, c);
  for (const c of list) map.set(c.id, c);
  categories.value = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
};

const mergeTags = (list: Tag[]) => {
  const map = new Map<number, Tag>();
  for (const t of tags.value) map.set(t.id, t);
  for (const t of list) map.set(t.id, t);
  tags.value = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
};

const fetchCategories = async (keyword = '') => {
  categoriesLoading.value = true;
  try {
    const res = await apiClient.get<Category[]>('/categories', {
      params: {
        q: keyword || undefined,
        limit: 30,
      },
    });
    if (keyword) {
      mergeCategories(res.data);
    } else {
      categories.value = res.data;
    }
  } catch {
    // ignore
  } finally {
    categoriesLoading.value = false;
  }
};

const fetchTags = async (keyword = '') => {
  tagsLoading.value = true;
  try {
    const res = await apiClient.get<Tag[]>('/tags', {
      params: {
        q: keyword || undefined,
        limit: 40,
      },
    });
    if (keyword) {
      mergeTags(res.data);
    } else {
      tags.value = res.data;
    }
  } catch {
    // ignore
  } finally {
    tagsLoading.value = false;
  }
};

const onCategorySearch = (keyword: string) => {
  categorySearchKeyword.value = keyword;
  if (categorySearchTimer) window.clearTimeout(categorySearchTimer);
  categorySearchTimer = window.setTimeout(() => {
    void fetchCategories(keyword.trim());
  }, 250);
};

const onTagSearch = (keyword: string) => {
  tagSearchKeyword.value = keyword;
  if (tagSearchTimer) window.clearTimeout(tagSearchTimer);
  tagSearchTimer = window.setTimeout(() => {
    void fetchTags(keyword.trim());
  }, 250);
};

const onTagEnter = () => {
  const text = tagSearchKeyword.value.trim();
  if (!text) return;
  handleCreateTag(text);
};

const onCategoryEnter = () => {
  const text = categorySearchKeyword.value.trim();
  if (!text) return;
  handleCreateCategory(text);
};

const fetchQuestion = async () => {
  if (isNew.value) return;
  try {
    const res = await apiClient.get(`/questions/${id.value}`);
    const q = res.data;
    title.value = q.title;
    content.value = q.content;
    visibility.value = q.visibility;
    imageUrls.value = (q.images ?? []).map((img: { imageUrl: string }) => img.imageUrl);
    selectedTagNames.value = (q.tags ?? []).map((t: { name: string }) => t.name);
    selectedCategoryName.value = q.category?.name ?? null;
  } catch {
    errorMessage.value = '加载问题失败';
  }
};

const removeImage = (idx: number) => {
  imageUrls.value.splice(idx, 1);
};

const uploadFiles = async (files: FileList | File[]) => {
  if (!files || !files.length) return;
  uploading.value = true;
  errorMessage.value = '';
  try {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      imageUrls.value.push(res.data.url);
    }
  } catch {
    errorMessage.value = '图片上传失败';
  } finally {
    uploading.value = false;
  }
};

const onFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  await uploadFiles(files || []);
  input.value = '';
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

const resolveCategoryId = async () => {
  const name = selectedCategoryName.value?.trim();
  if (!name) return undefined;

  const existing = categories.value.find((c) => c.name === name);
  if (existing && existing.id > 0) return existing.id;

  const created = await apiClient.post('/categories', { name, description: null });
  const createdCategory = created.data as Category;

  categories.value = [
    ...categories.value.filter((c) => c.name !== name || c.id > 0),
    createdCategory,
  ];

  return createdCategory.id;
};

const onSubmit = async () => {
  if (!title.value || !content.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    const categoryId = await resolveCategoryId();

    const payload = {
      title: title.value,
      content: content.value,
      visibility: visibility.value,
      categoryId,
      imageUrls: imageUrls.value,
      tagNames: selectedTagNames.value.map((x) => x.trim()).filter(Boolean),
      tagIds: [],
    };

    if (isNew.value) {
      await apiClient.post('/questions', payload);
    } else {
      await apiClient.put(`/questions/${id.value}`, payload);
    }
    router.push({ name: 'admin-questions' });
  } catch (e: any) {
    errorMessage.value = e?.response?.data?.message || '保存失败';
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  document.title = isNew.value ? '新增问题 - Apparel QA' : '编辑问题 - Apparel QA';
  await Promise.all([fetchCategories(), fetchTags()]);
  await fetchQuestion();

  if (selectedCategoryName.value && !categories.value.some((c) => c.name === selectedCategoryName.value)) {
    await fetchCategories(selectedCategoryName.value);
  }

  const missingTagNames = selectedTagNames.value.filter((name) => !tags.value.some((t) => t.name === name));
  if (missingTagNames.length) {
    await Promise.all(missingTagNames.slice(0, 5).map((name) => fetchTags(name)));
  }
});

onBeforeUnmount(() => {
  if (categorySearchTimer) window.clearTimeout(categorySearchTimer);
  if (tagSearchTimer) window.clearTimeout(tagSearchTimer);
});
</script>

<style scoped>
.edit-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-8);
}

.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--sp-4);
}

.form-surface {
  position: relative;
  overflow: hidden;
}

.form-surface::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(79, 159, 255, 0.12), rgba(167, 139, 250, 0.1), rgba(45, 212, 191, 0.08));
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  padding: 1px;
}

.form-premium :deep(.n-form-item-label__text) {
  color: var(--text-secondary);
  font-weight: 600;
}

.form-premium :deep(.n-input-wrapper),
.form-premium :deep(.n-base-selection) {
  min-height: 44px;
  border-radius: 14px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.form-premium :deep(.n-input__input-el) {
  height: 100%;
}

.field-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.helper-text {
  margin: 0;
  line-height: 1.4;
  padding-left: 2px;
}

.form-premium :deep(.n-input-wrapper:hover),
.form-premium :deep(.n-base-selection:hover) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(79, 159, 255, 0.12);
}

.form-premium :deep(.n-input__input-el),
.form-premium :deep(.n-input__textarea-el) {
  color: #1f2f52;
}

.form-premium :deep(.n-input__input-el::placeholder),
.form-premium :deep(.n-input__textarea-el::placeholder) {
  color: #8ea0bf;
}

.form-premium :deep(.n-base-selection-label) {
  min-height: 44px;
  line-height: 44px;
}

.form-premium :deep(.n-base-selection-tags) {
  min-height: 44px;
  padding-block: 4px;
}

.form-premium :deep(.n-base-selection-input) {
  min-height: 32px;
  line-height: 32px;
}

.form-premium :deep(.n-base-selection .n-tag) {
  border-radius: 999px;
}

.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
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

.text-link {
  color: var(--accent-blue);
  text-decoration: underline;
}

.muted { color: var(--text-secondary); }
.small { font-size: 0.8rem; }

.drop-zone {
  border: 2px dashed var(--border-bright);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.02);
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

.img-grid {
  margin-top: var(--sp-3);
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
  display: flex;
  justify-content: flex-end;
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

.error {
  margin-top: var(--sp-3);
  color: #fecaca;
}
</style>
