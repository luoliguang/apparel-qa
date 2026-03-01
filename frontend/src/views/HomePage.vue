<template>
  <div class="container-shell home-wrap">
    <section class="glass-card hero reveal">
      <div class="hero-inner">
        <h1 class="gradient-heading">快速找到每一个服装跟单答案</h1>
        <p class="hero-desc">输入关键词，例如：缩水、克重、唛头、包装方式，实时匹配可复用标准答案。</p>

        <div class="search-wrap" :class="{ focused: showPreview }">
          <n-input
            v-model:value="keyword"
            size="large"
            round
            clearable
            placeholder="搜索常见问题，如：缩水、面料成分、包装要求..."
            @keyup.enter="onEnterSearch"
          />
          <button class="btn-glow btn-view-all" type="button" @click="goAllResults">查看全部</button>

          <div v-if="showPreview" class="preview-panel glass-card">
            <div v-if="previewLoading" class="preview-state">正在匹配答案...</div>

            <div v-else-if="previewQuestions.length" class="preview-list">
              <article
                v-for="q in previewQuestions"
                :key="q.id"
                class="preview-card"
                @click="goDetail(q.id)"
              >
                <h4>{{ q.title }}</h4>
                <p>{{ getSnippet(q.content) }}</p>
                <button class="btn-ghost" type="button" @click.stop="copyAnswer(q.content)">复制答案</button>
              </article>
              <div class="preview-footer">
                <button class="btn-ghost" type="button" @click="goAllResults">在知识库查看全部结果</button>
              </div>
            </div>

            <div v-else class="preview-state">未找到匹配结果，试试其他关键词。</div>
          </div>
        </div>
      </div>
    </section>

    <section class="glass-card reveal">
      <div class="section-head">
        <h2>常用分类</h2>
        <p>按场景快速进入你最常处理的问题。</p>
      </div>
      <div class="chips">
        <button v-for="c in quickCategories" :key="c.name" class="chip" type="button" @click="goCategory(c.name)">
          {{ c.name }}
        </button>
      </div>
    </section>

    <section ref="popularSectionRef" class="glass-card reveal">
      <div class="section-head">
        <h2>常见问题</h2>
        <p>最近常被查看的问题，会随着使用自动变化。</p>
      </div>

      <div v-if="popularLoading" class="empty-state">正在加载常见问题...</div>

      <div v-else-if="questions.length" class="card-grid">
        <QuestionCard
          v-for="q in questions"
          :key="q.id"
          :title="q.title"
          :body="getSnippet(q.content)"
          size="md"
          action-text="复制答案"
          @click="goDetail(q.id)"
          @action="copyAnswer(q.content)"
        />
      </div>

      <div v-else class="empty-state">目前还没有问题，请先在后台创建一些标准问答。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { apiClient } from '../utils/apiClient';
import { cachedRequest } from '../utils/requestCache';
import QuestionCard from '../components/QuestionCard.vue';

interface QuestionItem {
  id: number;
  title: string;
  content: string;
}

interface CategoryItem {
  id?: number;
  name: string;
}

const router = useRouter();
const message = useMessage();

const keyword = ref('');
const questions = ref<QuestionItem[]>([]);
const previewQuestions = ref<QuestionItem[]>([]);
const previewLoading = ref(false);
const popularLoading = ref(false);
const showPreview = computed(() => keyword.value.trim().length >= 2);
const popularSectionRef = ref<HTMLElement | null>(null);
let previewTimer: number | null = null;
let previewReqId = 0;
let popularObserver: IntersectionObserver | null = null;

const fallbackCategories: CategoryItem[] = [
  { name: '面料' },
  { name: '尺寸' },
  { name: '包装' },
  { name: '出货' },
];

const quickCategories = ref<CategoryItem[]>([...fallbackCategories]);

const getSnippet = (content = '') => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 86 ? `${normalized.slice(0, 86)}...` : normalized || '暂无答案内容';
};

const copyAnswer = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content || '');
    message.success('答案已复制');
  } catch {
    message.error('复制失败，请稍后重试');
  }
};

const fetchPreview = async () => {
  const q = keyword.value.trim();
  if (q.length < 2) {
    previewQuestions.value = [];
    return;
  }

  const reqId = ++previewReqId;
  previewLoading.value = true;

  try {
    const list = await cachedRequest<any[]>(
      `home:preview:q=${q}`,
      async () => {
        const res = await apiClient.get('/questions', {
          params: { q, page: 1, pageSize: 6 },
        });
        return res.data.items || [];
      },
      20_000,
    );

    if (reqId !== previewReqId) return;
    previewQuestions.value = list.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content || '',
    }));
  } catch {
    if (reqId !== previewReqId) return;
    previewQuestions.value = [];
  } finally {
    if (reqId === previewReqId) previewLoading.value = false;
  }
};

watch(keyword, () => {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(fetchPreview, 300);
});

const goAllResults = () => {
  router.push({ name: 'questions', query: { q: keyword.value || undefined } });
};

const onEnterSearch = () => {
  if (previewQuestions.value.length) {
    goDetail(previewQuestions.value[0].id);
    return;
  }
  goAllResults();
};

const goCategory = (key: string) => {
  router.push({ name: 'questions', query: { category: key } });
};

const goDetail = (id: number) => {
  router.push({ name: 'question-detail', params: { id } });
};

const loadQuickCategories = async () => {
  try {
    const list = await cachedRequest<CategoryItem[]>(
      'home:quick:categories:v1',
      async () => {
        const res = await apiClient.get<CategoryItem[]>('/categories', {
          params: { limit: 8 },
        });
        return Array.isArray(res.data) ? res.data : [];
      },
      180_000,
    );

    const normalized = list
      .map((item) => ({ name: String(item?.name || '').trim() }))
      .filter((item) => item.name.length > 0)
      .slice(0, 8);

    quickCategories.value = normalized.length ? normalized : [...fallbackCategories];
  } catch {
    quickCategories.value = [...fallbackCategories];
  }
};

const loadPopularQuestions = async () => {
  if (questions.value.length || popularLoading.value) return;
  popularLoading.value = true;
  try {
    const items = await cachedRequest<any[]>(
      'home:popular:questions:v1',
      async () => {
        const res = await apiClient.get('/questions', {
          params: { page: 1, pageSize: 8, orderBy: 'views' },
        });
        return res.data.items || [];
      },
      60_000,
    );

    questions.value = items.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content || '',
    }));
  } catch {
    questions.value = [];
  } finally {
    popularLoading.value = false;
  }
};

onMounted(() => {
  void loadQuickCategories();

  const target = popularSectionRef.value;
  if (!target || typeof IntersectionObserver === 'undefined') {
    void loadPopularQuestions();
    return;
  }

  popularObserver = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (!visible) return;
    void loadPopularQuestions();
    popularObserver?.disconnect();
    popularObserver = null;
  }, { rootMargin: '120px 0px' });

  popularObserver.observe(target);
});

onBeforeUnmount(() => {
  if (previewTimer) window.clearTimeout(previewTimer);
  if (popularObserver) {
    popularObserver.disconnect();
    popularObserver = null;
  }
});
</script>

<style scoped>
.home-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-8);
}

.glass-card {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  box-shadow: var(--shadow-card);
}

.hero {
  z-index: 30;
}

.hero-inner {
  position: relative;
  z-index: 2;
  max-width: 860px;
  margin: 0 auto;
  text-align: center;
  overflow: visible;
}

.gradient-heading {
  margin: 0;
  font-weight: 700;
  font-size: clamp(2rem, 5vw, 3.6rem);
  letter-spacing: -0.03em;
  line-height: 1.1;
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-desc {
  margin: var(--sp-4) 0 var(--sp-6);
  color: var(--text-secondary);
  font-size: 0.98rem;
}

.search-wrap {
  position: relative;
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  overflow: visible;
  z-index: 60;
}

.search-wrap.focused::after {
  content: '';
  position: absolute;
  top: calc(100% + var(--sp-1));
  left: -8px;
  right: -8px;
  height: 360px;
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(7, 12, 28, 0.35) 0%, rgba(7, 12, 28, 0.12) 100%);
  pointer-events: none;
  z-index: 998;
}

.preview-panel {
  position: absolute;
  top: calc(100% + var(--sp-2));
  left: 0;
  right: 0;
  z-index: 999;
  max-height: 320px;
  overflow-y: auto;
  padding: var(--sp-3);
  background: var(--preview-panel-bg);
  border: 1px solid rgba(138, 167, 255, 0.24);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.preview-card {
  position: relative;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(138, 167, 255, 0.24);
  padding: var(--sp-4);
  transition: border-color 0.28s ease, transform 0.28s ease, box-shadow 0.28s ease;
  cursor: pointer;
}

.preview-card:hover {
  border-color: var(--border-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.preview-card h4 {
  margin: 0;
  color: var(--text-primary);
}

.preview-card p {
  margin: var(--sp-2) 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 0.85rem;
}

.card-grid {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr));
}


.preview-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--sp-2);
}

.btn-glow {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.72rem 1.45rem;
  color: #fff;
  font-weight: 600;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  transition: transform 0.2s ease, box-shadow 0.3s ease;
}

.btn-glow:hover,
.btn-glow:focus-visible {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.btn-ghost {
  margin-top: var(--sp-3);
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  padding: 0.36rem 0.8rem;
  font-size: 0.78rem;
  transition: all 0.25s ease;
}

.btn-ghost:hover,
.btn-ghost:focus-visible {
  color: var(--text-primary);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow);
}

.section-head h2 {
  margin: 0;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.section-head p {
  margin: var(--sp-2) 0 0;
  color: var(--text-secondary);
}

.chips {
  margin-top: var(--sp-4);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.chip {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  padding: 0.5rem 1rem;
  transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.chip:hover,
.chip:focus-visible {
  transform: translateY(-1px);
  border-color: var(--border-accent);
  color: var(--text-primary);
}

.empty-state,
.preview-state {
  color: var(--text-secondary);
  padding: var(--sp-4);
}

@media (max-width: 768px) {
  .search-wrap {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-glow {
    width: 100%;
  }
}

.btn-view-all {
  min-width: 110px;
  white-space: nowrap;
  text-align: center;
}
</style>
