<template>
  <div class="container-shell kb-wrap">
    <header class="glass-card header-card reveal">
      <h2 class="gradient-heading-sm">知识库</h2>

      <div class="filters toolbar-enhanced">
        <n-input
          v-model:value="keyword"
          class="toolbar-control"
          size="large"
          placeholder="搜索问题标题或内容"
          round
          clearable
          @keyup.enter="onSearch"
        />
        <n-select
          v-model:value="selectedCategory"
          class="toolbar-control"
          :options="categoryOptions"
          placeholder="全部分类"
          clearable
          size="large"
          filterable
          remote
          :loading="categoriesLoading"
          :on-search="onCategorySearch"
        />
        <button class="btn-glow" type="button" @click="onSearch">搜索</button>
      </div>

    </header>

    <section v-if="loading" class="glass-card state">正在加载问题...</section>
    <section v-else-if="items.length === 0" class="glass-card state">暂无匹配的问题，试试换个关键词？</section>

    <section v-else class="cards reveal">
      <QuestionCard
        v-for="q in items"
        :key="q.id"
        :title="q.title"
        size="md"
        action-text="复制答案"
        @click="goDetail(q.id)"
        @action="copyAnswer(q)"
      >
        <template #head>
          <span class="label-question">问题</span>
          <h3 class="text-title">{{ q.title }}</h3>
        </template>

        <template #meta>
          <div class="meta text-body">
            <span>{{ q.category?.name || '未分类' }}</span>
            <span>浏览 {{ q.viewCount }}</span>
            <span class="badge" :data-visibility="q.visibility">{{ visibilityLabel(q.visibility) }}</span>
          </div>
        </template>

        <template #body>
          <span class="label-answer">标准答案</span>
          <p class="text-body">{{ getSnippet(q.content) }}</p>
        </template>

        <div v-if="q.images?.length" class="image-strip" @click.stop>
          <button
            v-for="(img, idx) in q.images"
            :key="`${q.id}-${idx}`"
            type="button"
            class="thumb-btn"
            @click="openImage(q.images || [], idx)"
          >
            <img
              :src="img.imageUrl"
              alt="答案配图"
              loading="lazy"
            />
          </button>
        </div>
      </QuestionCard>
    </section>

    <footer v-if="total > pageSize" class="pager glass-card">
      <button class="btn-ghost" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }}/{{ totalPages }}页</span>
      <button class="btn-ghost" :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
    </footer>

    <div v-if="previewImageUrl" class="image-lightbox" @click="closeImagePreview">
      <button class="lightbox-close" type="button" @click.stop="closeImagePreview">✕</button>
      <button
        v-if="previewImages.length > 1"
        class="lightbox-nav prev"
        type="button"
        @click.stop="showPrevImage"
      >
        ‹
      </button>
      <img :src="previewImageUrl" alt="放大预览" class="lightbox-image" @click.stop />
      <button
        v-if="previewImages.length > 1"
        class="lightbox-nav next"
        type="button"
        @click.stop="showNextImage"
      >
        ›
      </button>
      <div v-if="previewImages.length > 1" class="lightbox-index" @click.stop>
        {{ previewIndex + 1 }} / {{ previewImages.length }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { apiClient } from '../utils/apiClient';
import { cachedRequest } from '../utils/requestCache';
import QuestionCard from '../components/QuestionCard.vue';

interface QuestionListItem {
  id: number;
  title: string;
  content: string;
  viewCount: number;
  visibility: 'PUBLIC' | 'LOGGED_IN' | 'PRIVATE';
  category?: { id: number; name: string };
  images?: { imageUrl: string }[];
}

interface Category {
  id: number;
  name: string;
}

const route = useRoute();
const router = useRouter();
const message = useMessage();

const keyword = ref<string>((route.query.q as string) || '');
const selectedCategory = ref<string>((route.query.category as string) || '');
const items = ref<QuestionListItem[]>([]);
const total = ref(0);
const page = ref(Number(route.query.page || 1) || 1);
const pageSize = 20;
const loading = ref(false);
const categories = ref<Category[]>([]);
const categoriesLoading = ref(false);
const previewImages = ref<string[]>([]);
const previewIndex = ref(0);
let debounceTimer: number | null = null;
let categorySearchTimer: number | null = null;

const categoryOptions = computed(() => [
  { label: '全部分类', value: '' },
  ...categories.value.map((c) => ({ label: c.name, value: c.name })),
]);

const totalPages = computed(() => (total.value === 0 ? 1 : Math.ceil(total.value / pageSize)));

const visibilityLabel = (v: QuestionListItem['visibility']) => {
  if (v === 'PUBLIC') return '公开';
  if (v === 'LOGGED_IN') return '登录可见';
  if (v === 'PRIVATE') return '仅管理员';
  return v;
};

const getSnippet = (content?: string) => {
  if (!content) return '暂无答案内容';
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
};

const copyAnswer = async (q: QuestionListItem) => {
  try {
    await navigator.clipboard.writeText(q.content || '');
    message.success('答案已复制，可直接粘贴使用。');
  } catch {
    message.error('复制失败，请稍后重试。');
  }
};

const previewImageUrl = computed(() => previewImages.value[previewIndex.value] || '');

const openImage = (images: { imageUrl: string }[], index: number) => {
  previewImages.value = images.map((item) => item.imageUrl);
  previewIndex.value = index;
};

const closeImagePreview = () => {
  previewImages.value = [];
  previewIndex.value = 0;
};

const showPrevImage = () => {
  if (!previewImages.value.length) return;
  previewIndex.value = (previewIndex.value - 1 + previewImages.value.length) % previewImages.value.length;
};

const showNextImage = () => {
  if (!previewImages.value.length) return;
  previewIndex.value = (previewIndex.value + 1) % previewImages.value.length;
};

const fetchCategories = async (keyword = '') => {
  categoriesLoading.value = true;
  const key = keyword.trim();
  try {
    const data = await cachedRequest<Category[]>(
      `questions:categories:q=${key}:limit=50`,
      async () => {
        const res = await apiClient.get<Category[]>('/categories', {
          params: { q: key || undefined, limit: 50 },
        });
        return res.data;
      },
      120_000,
    );

    if (key) {
      const map = new Map<string, Category>();
      for (const c of categories.value) map.set(c.name, c);
      for (const c of data) map.set(c.name, c);
      categories.value = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    } else {
      categories.value = data;
    }
  } catch {
    // ignore
  } finally {
    categoriesLoading.value = false;
  }
};

const onCategorySearch = (keyword: string) => {
  if (categorySearchTimer) window.clearTimeout(categorySearchTimer);
  categorySearchTimer = window.setTimeout(() => {
    void fetchCategories(keyword);
  }, 250);
};

const fetchQuestions = async () => {
  loading.value = true;
  const reqKey = `questions:list:q=${keyword.value || ''}:cat=${selectedCategory.value || ''}:page=${page.value}:size=${pageSize}`;
  try {
    const data = await cachedRequest<{ items?: QuestionListItem[]; total?: number }>(
      reqKey,
      async () => {
        const res = await apiClient.get('/questions', {
          params: {
            q: keyword.value || undefined,
            category: selectedCategory.value || undefined,
            page: page.value,
            pageSize,
          },
        });
        return res.data;
      },
      45_000,
    );

    items.value = (data.items ?? []).sort((a: QuestionListItem, b: QuestionListItem) => b.id - a.id);
    total.value = data.total ?? 0;
  } catch {
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const updateRoute = () => {
  router.replace({
    name: 'questions',
    query: {
      q: keyword.value || undefined,
      category: selectedCategory.value || undefined,
      page: page.value,
    },
  });
};

const onSearch = () => {
  page.value = 1;
  updateRoute();
  fetchQuestions();
};

const scheduleLiveSearch = () => {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    page.value = 1;
    updateRoute();
    fetchQuestions();
  }, 300);
};

const changePage = (newPage: number) => {
  page.value = newPage;
  updateRoute();
  fetchQuestions();
};

const goDetail = (id: number) => {
  router.push({ name: 'question-detail', params: { id } });
};

watch([keyword, selectedCategory], scheduleLiveSearch);

onMounted(() => {
  document.title = '知识库 - Apparel QA';
  fetchCategories();
  fetchQuestions();
});

onBeforeUnmount(() => {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  if (categorySearchTimer) window.clearTimeout(categorySearchTimer);
});
</script>

<style scoped>
.kb-wrap {
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
}

.header-card {
  padding: var(--sp-4);
}

.gradient-heading-sm {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.filters {
  margin-top: var(--sp-3);
  display: grid;
  gap: var(--sp-2);
  grid-template-columns: 1fr;
}

.toolbar-control {
  min-width: 0;
}

.filters :deep(.toolbar-control .n-base-selection) {
  min-height: 44px;
  height: 44px;
  border-radius: 999px;
}

.filters :deep(.toolbar-control .n-base-selection-label),
.filters :deep(.toolbar-control .n-base-selection-input) {
  min-height: 44px;
  line-height: 44px;
}

.filters :deep(.toolbar-control .n-input__input-el) {
  height: 100%;
}

.cards {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
}

.text-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.45;
}

.text-body {
  color: var(--text-secondary);
}

.label-question,
.label-answer {
  display: inline-flex;
  width: fit-content;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  border: 1px solid rgba(138, 167, 255, 0.28);
  color: #cfe3ff;
  background: rgba(79, 159, 255, 0.12);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  font-size: 0.8rem;
}

.image-strip {
  margin-top: var(--sp-2);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
  gap: 8px;
  max-width: 320px;
}

.thumb-btn {
  border: 1px solid var(--border-subtle);
  background: transparent;
  border-radius: 10px;
  padding: 0;
  height: 66px;
  overflow: hidden;
  cursor: zoom-in;
}

.thumb-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.badge {
  padding: 0.15rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  background: rgba(79, 159, 255, 0.14);
  color: #cfe3ff;
}

.badge[data-visibility='PRIVATE'] {
  background: rgba(244, 63, 94, 0.16);
  color: #fecdd3;
}

.badge[data-visibility='LOGGED_IN'] {
  background: rgba(45, 212, 191, 0.16);
  color: #99f6e4;
}

.card-button {
  transform: translate(-50%, 125%);
  width: min(180px, calc(100% - 2.2rem));
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  color: #fff;
  font-size: 0.84rem;
  font-weight: 600;
  padding: 0.5rem 0.95rem;
  position: absolute;
  left: 50%;
  bottom: 0.9rem;
  opacity: 0;
  transition: 0.3s ease-out;
}

.qa-card-uiverse:hover .card-button {
  transform: translate(-50%, 0);
  opacity: 1;
}

.state {
  padding: var(--sp-8);
  text-align: center;
  color: var(--text-secondary);
}

.pager {
  padding: var(--sp-3);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--sp-3);
  color: var(--text-secondary);
}

.btn-glow {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.68rem 1.35rem;
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

.btn-ghost {
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  padding: 0.36rem 0.82rem;
  font-size: 0.8rem;
  transition: all 0.25s ease;
}

.btn-ghost:hover,
.btn-ghost:focus-visible {
  color: var(--text-primary);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow);
}

.toolbar-enhanced :deep(.toolbar-control .n-input-wrapper),
.toolbar-enhanced :deep(.toolbar-control .n-base-selection) {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.toolbar-enhanced :deep(.toolbar-control .n-input-wrapper:hover),
.toolbar-enhanced :deep(.toolbar-control .n-base-selection:hover) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(79, 159, 255, 0.12);
}

.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lightbox-image {
  max-width: min(92vw, 1100px);
  max-height: 86vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.lightbox-close,
.lightbox-nav {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(15, 23, 42, 0.62);
  color: #fff;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  font-size: 1.2rem;
  cursor: pointer;
}

.lightbox-close {
  top: 20px;
  right: 20px;
}

.lightbox-nav {
  top: 50%;
  transform: translateY(-50%);
}

.lightbox-nav.prev {
  left: 20px;
}

.lightbox-nav.next {
  right: 20px;
}

.lightbox-index {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  color: #e2e8f0;
  font-size: 0.86rem;
  background: rgba(15, 23, 42, 0.62);
  padding: 4px 10px;
  border-radius: 999px;
}

@media (min-width: 900px) {
  .filters {
    grid-template-columns: 1fr 240px auto;
  }
}
</style>
