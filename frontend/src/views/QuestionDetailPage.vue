<template>
  <div class="container-shell detail-wrap">
    <section v-if="loading" class="glass-card state">正在加载问题详情...</section>

    <section v-else-if="error" class="glass-card state error">{{ error }}</section>

    <section v-else-if="question" class="glass-card reveal">
      <header class="head">
        <h2 class="gradient-heading-sm">{{ question.title }}</h2>
        <div class="meta">
          <span>{{ question.category?.name || '未分类' }}</span>
          <span>浏览 {{ question.viewCount }}</span>
          <span class="badge" :data-visibility="question.visibility">{{ visibilityLabel(question.visibility) }}</span>
          <button class="btn-glow" type="button" @click="copyAnswer">复制答案</button>
        </div>
      </header>

      <article class="content">
        <p v-for="(line, idx) in contentLines" :key="idx">{{ line }}</p>
      </article>

      <section v-if="question.images?.length" class="images">
        <h3>相关图片</h3>
        <div class="grid">
          <figure v-for="img in question.images" :key="img.id" class="image">
            <img :src="img.imageUrl" alt="" />
          </figure>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMessage } from 'naive-ui';
import { apiClient } from '../utils/apiClient';

interface QuestionImage {
  id: number;
  imageUrl: string;
}

interface QuestionDetail {
  id: number;
  title: string;
  content: string;
  viewCount: number;
  visibility: 'PUBLIC' | 'LOGGED_IN' | 'PRIVATE';
  category?: { id: number; name: string };
  images?: QuestionImage[];
}

const route = useRoute();
const question = ref<QuestionDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const message = useMessage();

const contentLines = computed(() => question.value?.content?.split(/\r?\n/).filter(Boolean) ?? []);

const visibilityLabel = (v: QuestionDetail['visibility']) => {
  if (v === 'PUBLIC') return '公开';
  if (v === 'LOGGED_IN') return '登录可见';
  if (v === 'PRIVATE') return '仅管理员';
  return v;
};

const fetchDetail = async () => {
  const id = route.params.id as string;
  if (!id) return;

  loading.value = true;
  error.value = null;

  try {
    const res = await apiClient.get(`/questions/${id}`);
    question.value = res.data;
    document.title = `${question.value.title} - Apparel QA`;
  } catch (e: any) {
    if (e?.response?.status === 401) {
      error.value = '该问题仅登录用户可见，请先登录。';
    } else if (e?.response?.status === 404) {
      error.value = '问题不存在或已被删除。';
    } else {
      error.value = '加载问题详情失败，请稍后重试。';
    }
  } finally {
    loading.value = false;
  }
};

const copyAnswer = async () => {
  if (!question.value) return;
  try {
    await navigator.clipboard.writeText(question.value.content || '');
    message.success('答案已复制，可以直接发给客户。');
  } catch {
    message.error('复制失败，请稍后重试。');
  }
};

onMounted(fetchDetail);
</script>

<style scoped>
.detail-wrap {
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
  padding: var(--sp-6);
}

.state {
  text-align: center;
  color: var(--text-secondary);
}

.state.error { color: #fecaca; }

.gradient-heading-sm {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.meta {
  margin-top: var(--sp-3);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
  color: var(--text-secondary);
}

.badge {
  padding: 0.12rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  background: rgba(79, 159, 255, 0.14);
  color: #cfe3ff;
}

.badge[data-visibility='PRIVATE'] { background: rgba(244, 63, 94, 0.16); color: #fecdd3; }
.badge[data-visibility='LOGGED_IN'] { background: rgba(45, 212, 191, 0.16); color: #99f6e4; }

.btn-glow {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.45rem 0.95rem;
  color: #fff;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  transition: transform .2s ease, box-shadow .3s ease;
}
.btn-glow:hover { transform: translateY(-1px); box-shadow: var(--shadow-glow); }

.content { margin-top: var(--sp-4); color: var(--text-secondary); line-height: 1.75; }
.content p { margin: 0 0 var(--sp-2); }

.images { margin-top: var(--sp-4); }
.images h3 { margin: 0 0 var(--sp-2); color: var(--text-primary); }
.grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(140px,1fr)); gap: var(--sp-2); }
.image { margin: 0; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-subtle); }
.image img { width: 100%; display: block; object-fit: cover; }
</style>
