<template>
  <div class="container-shell admin-wrap">
    <header class="glass-card reveal">
      <h2 class="gradient-heading-sm">客户提问管理</h2>

      <div class="toolbar toolbar-enhanced">
        <div class="filter-grid">
          <n-input v-model:value="keyword" placeholder="搜索标题或描述" round clearable @keyup.enter="onSearch" />
          <n-select v-model:value="filterStatus" :options="statusOptions" placeholder="全部状态" clearable />
          <button class="btn-glow" type="button" @click="onSearch">搜索</button>
        </div>

        <router-link to="/admin/questions" class="ml-auto">
          <button class="btn-ghost" type="button">返回知识库管理</button>
        </router-link>
      </div>
    </header>

    <transition name="fade" mode="out-in">
      <section v-if="loading" key="loading" class="glass-card state">加载中...</section>
      <section v-else-if="items.length === 0" key="empty" class="glass-card state">暂无客户提问</section>

      <section v-else key="list" class="list reveal">
        <article v-for="q in items" :key="q.id" class="q-card">
          <div class="q-head">
            <button type="button" class="question-toggle-glass" @click="toggle(q.id)">
              <h3>{{ q.title }}</h3>
              <p>点击展开/收起</p>
            </button>

            <div class="right-tools">
              <span class="badge" :class="statusClass(q.status)">{{ statusLabel(q.status) }}</span>
              <button class="btn-danger-ghost" type="button" @click="removeQuestion(q.id)">删除</button>
            </div>
          </div>

          <div v-if="expandedMap[q.id]" class="q-body">
            <p class="desc">{{ q.description }}</p>

            <div class="meta">
              <span>客户：{{ q.customer?.email }}</span>
              <span>提交时间：{{ formatDate(q.createdAt) }}</span>
            </div>

            <div v-if="q.images?.length" class="thumbs">
              <img v-for="img in q.images" :key="img.id" :src="img.imageUrl" alt="" class="thumb" />
            </div>

            <div v-if="q.answers?.length" class="answers">
              <h4>已回复</h4>
              <div v-for="a in q.answers" :key="a.id" class="answer-item">
                <p>{{ a.answerContent }}</p>
                <span>{{ a.answeredBy?.email }} · {{ formatDate(a.createdAt) }}</span>
              </div>
            </div>

            <div class="reply-box">
              <h4>回复客户</h4>
              <textarea v-model="replyTexts[q.id]" rows="3" placeholder="输入回复内容..." />
              <div class="reply-actions">
                <button class="btn-glow" type="button" :disabled="savingId === q.id" @click="submitReply(q.id)">
                  {{ savingId === q.id ? '提交中...' : '提交回复' }}
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </transition>

    <footer v-if="total > 0" class="glass-card pager">
      <div class="pager-row">
        <span>共 {{ total }} 条</span>
        <n-pagination
          :item-count="total"
          :page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          show-size-picker
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { apiClient } from '../../utils/apiClient';

interface CustomerQuestionImage {
  id: number;
  imageUrl: string;
}

interface Answer {
  id: number;
  answerContent: string;
  createdAt: string;
  answeredBy?: { id: number; email: string } | null;
}

interface CustomerQuestion {
  id: number;
  title: string;
  description: string;
  status: 'PENDING' | 'ANSWERED' | 'CLOSED';
  createdAt: string;
  customer?: { id: number; email: string };
  images?: CustomerQuestionImage[];
  answers?: Answer[];
}

const dialog = useDialog();
const message = useMessage();

const items = ref<CustomerQuestion[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const keyword = ref('');
const filterStatus = ref<string | null>(null);
const replyTexts = ref<Record<number, string>>({});
const savingId = ref<number | null>(null);
const expandedMap = ref<Record<number, boolean>>({});

const statusOptions = [
  { label: '待回复', value: 'PENDING' },
  { label: '已回复', value: 'ANSWERED' },
  { label: '已关闭', value: 'CLOSED' },
];

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

const formatDate = (s: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('zh-CN');
};

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await apiClient.get('/customer-questions', {
      params: {
        q: keyword.value || undefined,
        status: filterStatus.value || undefined,
        page: page.value,
        pageSize: pageSize.value,
      },
    });

    const list = (res.data.items ?? res.data ?? []) as CustomerQuestion[];
    items.value = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    total.value = res.data.total ?? items.value.length;

    const next: Record<number, boolean> = {};
    items.value.forEach((q) => {
      next[q.id] = false;
    });
    expandedMap.value = next;
  } catch {
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const onSearch = () => {
  page.value = 1;
  fetchList();
};

const onPageChange = (p: number) => {
  page.value = p;
  fetchList();
};

const onPageSizeChange = (size: number) => {
  pageSize.value = size;
  page.value = 1;
  fetchList();
};

const removeQuestion = (id: number) => {
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
        total.value = Math.max(0, total.value - 1);
        message.success('删除成功');
      } catch (e: any) {
        message.error(e?.response?.data?.message || '删除失败');
      }
    },
  });
};

const submitReply = async (id: number) => {
  const content = replyTexts.value[id]?.trim();
  if (!content) {
    message.warning('请输入回复内容');
    return;
  }
  savingId.value = id;
  try {
    await apiClient.put(`/customer-questions/${id}/answer`, {
      answerContent: content,
      status: 'ANSWERED',
    });
    replyTexts.value[id] = '';
    message.success('提交成功');
    fetchList();
  } catch (e: any) {
    message.error(e?.response?.data?.message || '提交失败');
  } finally {
    savingId.value = null;
  }
};

onMounted(() => {
  document.title = '客户提问管理 - Apparel QA';
  fetchList();
});
</script>

<style scoped>
.admin-wrap {
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

.gradient-heading-sm {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.toolbar {
  margin-top: var(--sp-3);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}

.filter-grid {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: var(--sp-2);
  grid-template-columns: 1fr;
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

.question-toggle-glass h3 { margin: 0; }
.question-toggle-glass p { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }

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

.badge.is-pending { background: rgba(245, 158, 11, 0.2); color: #fde68a; }
.badge.is-answered { background: rgba(45, 212, 191, 0.2); color: #99f6e4; }
.badge.is-closed { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }

.q-body { margin-top: var(--sp-3); }
.desc { margin: 0; color: var(--text-secondary); line-height: 1.7; }

.meta {
  margin-top: var(--sp-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  color: var(--text-muted);
  font-size: 0.78rem;
}

.thumbs {
  margin-top: var(--sp-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.thumb {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.answers {
  margin-top: var(--sp-3);
  border-top: 1px dashed var(--border-subtle);
  padding-top: var(--sp-3);
}

.answers h4,
.reply-box h4 {
  margin: 0;
  color: var(--text-primary);
}

.answer-item {
  margin-top: var(--sp-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  padding: var(--sp-3);
}

.answer-item p { margin: 0; color: var(--text-secondary); }
.answer-item span { display: block; margin-top: 6px; color: var(--text-muted); font-size: 0.78rem; }

.reply-box {
  margin-top: var(--sp-3);
  border-top: 1px dashed var(--border-subtle);
  padding-top: var(--sp-3);
}

.reply-box textarea {
  margin-top: var(--sp-2);
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  padding: 0.6rem 0.75rem;
  outline: none;
}

.reply-box textarea:focus {
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow);
}

.reply-actions {
  margin-top: var(--sp-2);
}

.btn-glow {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.68rem 1.3rem;
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
  padding: 0.5rem 1rem;
}

.btn-danger-ghost {
  border: 1px solid rgba(244, 63, 94, 0.28);
  border-radius: var(--radius-md);
  background: rgba(244, 63, 94, 0.08);
  color: #fecaca;
  padding: 0.22rem 0.62rem;
  font-size: 0.78rem;
}

.state {
  text-align: center;
  color: var(--text-secondary);
}

.pager-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  color: var(--text-secondary);
}

.toolbar-enhanced :deep(.n-base-selection),
.toolbar-enhanced :deep(.n-input) {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.toolbar-enhanced :deep(.n-base-selection:hover),
.toolbar-enhanced :deep(.n-input:hover) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(79, 159, 255, 0.12);
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

@media (min-width: 900px) {
  .filter-grid {
    grid-template-columns: 1fr 220px auto;
  }
}
</style>
