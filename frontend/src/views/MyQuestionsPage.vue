<template>
  <div class="container-shell myq-wrap">
    <header class="glass-card reveal">
      <h2 class="gradient-heading-sm">我的问题</h2>
      <p class="muted">查看你提交的问题及跟进状态。</p>
    </header>

    <section v-if="!isLoggedIn" class="glass-card state">请先登录后查看你提交的问题。</section>
    <section v-else-if="loading" class="glass-card state">正在加载...</section>
    <section v-else-if="items.length === 0" class="glass-card state">你还没有提交过问题，可以先去 <router-link to="/ask" class="text-link">提问</router-link>。</section>

    <section v-else class="list reveal">
      <article v-for="q in items" :id="`my-question-${q.id}`" :key="q.id" class="q-card" :class="{ 'is-focused': focusedQuestionId === q.id }">
        <div class="q-head">
          <button type="button" class="question-toggle-glass" @click="toggle(q.id)">
            <h3>{{ q.title }}</h3>
            <p>点击展开/收起</p>
          </button>

          <div class="right-tools">
            <span class="badge" :class="statusClass(q.status)">{{ statusLabel(q.status) }}</span>
            <n-button type="error" tertiary size="small" @click="removeMyQuestion(q.id)">删除</n-button>
          </div>
        </div>

        <div v-if="expandedMap[q.id]" class="q-body">
          <p class="desc">{{ q.description }}</p>

          <div v-if="q.images?.length" class="thumbs">
            <figure v-for="img in q.images" :key="img.id" class="thumb">
              <img :src="img.imageUrl" alt="" />
            </figure>
          </div>

          <div v-if="q.answers?.length" class="answers">
            <h4>回复</h4>
            <div v-for="a in q.answers" :key="a.id" class="answer-item">
              <p>{{ a.answerContent }}</p>
              <div class="meta">
                <span>回复人：{{ a.answeredBy?.email || '系统' }}</span>
                <span v-if="a.linkedQuestion">
                  关联知识库：
                  <a href="#" class="text-link" @click.prevent="goLinkedQuestion(a.linkedQuestion.id)">{{ a.linkedQuestion.title }}</a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDialog, useMessage } from 'naive-ui';
import { apiClient } from '../utils/apiClient';
import { useAuthStore } from '../stores/auth';

interface CustomerQuestionImage {
  id: number;
  imageUrl: string;
}

interface LinkedQuestion {
  id: number;
  title: string;
}

interface Answer {
  id: number;
  answerContent: string;
  answeredBy?: { id: number; email: string } | null;
  linkedQuestion?: LinkedQuestion | null;
}

interface CustomerQuestion {
  id: number;
  title: string;
  description: string;
  status: 'PENDING' | 'ANSWERED' | 'CLOSED';
  images?: CustomerQuestionImage[];
  answers?: Answer[];
}

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const dialog = useDialog();
const message = useMessage();

const isLoggedIn = computed(() => auth.isLoggedIn);
const loading = ref(false);
const items = ref<CustomerQuestion[]>([]);
const expandedMap = ref<Record<number, boolean>>({});
const focusedQuestionId = ref<number | null>(null);

const statusLabel = (s: CustomerQuestion['status']) => {
  if (s === 'PENDING') return '待回复';
  if (s === 'ANSWERED') return '已回复';
  if (s === 'CLOSED') return '已关闭';
  return s;
};

const statusClass = (s: CustomerQuestion['status']) => {
  if (s === 'PENDING') return 'is-pending';
  if (s === 'CLOSED') return 'is-closed';
  return 'is-answered';
};

const toggle = (id: number) => {
  expandedMap.value[id] = !expandedMap.value[id];
};

const focusByRouteQuery = async () => {
  const rawId = route.query.focusQuestionId;
  const id = Number.parseInt(String(rawId || ''), 10);
  if (!id || Number.isNaN(id)) {
    focusedQuestionId.value = null;
    return;
  }

  const existed = items.value.find((q) => q.id === id);
  if (!existed) {
    focusedQuestionId.value = null;
    return;
  }

  expandedMap.value[id] = true;
  focusedQuestionId.value = id;

  await nextTick();
  const el = document.getElementById(`my-question-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  window.setTimeout(() => {
    if (focusedQuestionId.value === id) {
      focusedQuestionId.value = null;
    }
  }, 2800);
};

const fetchMyQuestions = async () => {
  if (!isLoggedIn.value) return;
  loading.value = true;
  try {
    const res = await apiClient.get<CustomerQuestion[]>('/customer-questions/my');
    items.value = res.data;
    const next: Record<number, boolean> = {};
    items.value.forEach((q) => {
      next[q.id] = expandedMap.value[q.id] ?? false;
    });
    expandedMap.value = next;
    await focusByRouteQuery();
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
};

const removeMyQuestion = (id: number) => {
  dialog.warning({
    title: '确认删除',
    content: '删除后不可恢复，确定继续吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await apiClient.delete(`/customer-questions/${id}`);
        items.value = items.value.filter((x) => x.id !== id);
        delete expandedMap.value[id];
        message.success('删除成功');
      } catch (e: any) {
        message.error(e?.response?.data?.message || '删除失败');
      }
    },
  });
};

const goLinkedQuestion = (id: number) => {
  router.push({ name: 'question-detail', params: { id } });
};

watch(
  () => route.query.focusQuestionId,
  () => {
    void focusByRouteQuery();
  },
);

onMounted(() => {
  document.title = '我的问题 - Apparel QA';
  void fetchMyQuestions();
});
</script>

<style scoped>
.myq-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-8);
}

.glass-card,
.q-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--sp-4);
}

.q-card {
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.q-card.is-focused {
  border-color: rgba(79, 159, 255, 0.7);
  box-shadow: 0 0 0 3px rgba(79, 159, 255, 0.16), var(--shadow-card);
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

.muted,
.state {
  color: var(--text-secondary);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.q-head {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
}

.question-toggle-glass {
  flex: 1;
  text-align: left;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  padding: 10px 14px;
  color: var(--text-primary);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.question-toggle-glass:hover {
  border-color: var(--border-accent);
  transform: translateY(-1px);
}

.question-toggle-glass h3 {
  margin: 0;
}

.question-toggle-glass p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.right-tools {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.badge {
  padding: 0.12rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.74rem;
}

.badge.is-pending {
  background: rgba(245, 158, 11, 0.2);
  color: #fde68a;
}

.badge.is-answered {
  background: rgba(45, 212, 191, 0.2);
  color: #99f6e4;
}

.badge.is-closed {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.q-body {
  margin-top: var(--sp-3);
}

.desc {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.thumbs {
  margin-top: var(--sp-3);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.thumb {
  margin: 0;
  width: 72px;
  height: 72px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.answers {
  margin-top: var(--sp-3);
  border-top: 1px dashed var(--border-subtle);
  padding-top: var(--sp-3);
}

.answers h4 {
  margin: 0;
  color: var(--text-primary);
}

.answer-item {
  margin-top: var(--sp-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3);
  background: rgba(255, 255, 255, 0.02);
}

.answer-item p {
  margin: 0;
  color: var(--text-secondary);
}

.meta {
  margin-top: var(--sp-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  font-size: 0.78rem;
  color: var(--text-muted);
}

.text-link {
  color: var(--accent-blue);
  text-decoration: underline;
}
</style>
