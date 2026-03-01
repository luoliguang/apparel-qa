<template>
  <div class="container-shell admin-wrap">
    <header class="glass-card reveal">
      <h2 class="gradient-heading-sm">知识库管理</h2>

      <div class="toolbar toolbar-enhanced">
        <div class="filter-grid">
          <n-input
            v-model:value="keyword"
            class="toolbar-control"
            size="large"
            placeholder="搜索标题或内容"
            round
            clearable
            @keyup.enter="onSearch"
          />
          <n-select
            v-model:value="filterVisibility"
            class="toolbar-control"
            :options="visibilityOptions"
            placeholder="全部可见性"
            clearable
            size="large"
            @update:value="onVisibilityChange"
          />
          <button class="btn-glow" type="button" @click="onSearch">搜索</button>
        </div>

        <div class="right-actions">
          <button
            type="button"
            class="btn-danger-ghost"
            :disabled="!selectedIds.length || loading"
            @click="onBatchDelete"
          >
            批量删除（{{ selectedIds.length }}）
          </button>
          <router-link to="/admin/questions/new" class="ml-auto">
            <button class="btn-glow" type="button">新增问题</button>
          </router-link>
        </div>
      </div>
    </header>

    <transition name="fade" mode="out-in">
      <section v-if="loading" key="loading" class="glass-card state">加载中...</section>

      <section v-else-if="items.length === 0" key="empty" class="glass-card state">暂无问题</section>

      <section v-else key="table" class="glass-card table-wrap reveal">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  :checked="allCurrentPageSelected"
                  :indeterminate.prop="hasPartialSelection"
                  @change="toggleSelectAll"
                />
              </th>
              <th>ID</th>
              <th>标题</th>
              <th>分类</th>
              <th>可见性</th>
              <th>浏览</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="q in items" :key="q.id">
              <td>
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(q.id)"
                  @change="toggleOne(q.id)"
                />
              </td>
              <td>{{ q.id }}</td>
              <td class="title-cell">{{ q.title }}</td>
              <td>
                <span class="badge badge-category">{{ q.category?.name || '未分类' }}</span>
              </td>
              <td>
                <span class="badge" :class="visibilityClass(q.visibility)">{{ visibilityLabel(q.visibility) }}</span>
              </td>
              <td>{{ q.viewCount }}</td>
              <td>
                <router-link :to="{ name: 'admin-question-edit', params: { id: q.id } }" class="action-link">编辑</router-link>
                <button type="button" class="btn-danger-ghost" @click="onDelete(q.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </transition>

    <footer v-if="total > 0" class="glass-card pager">
      <div class="pager-row">
        <span>共 {{ total }} 条</span>
        <n-pagination
          :item-count="total"
          :page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          @update:page="onPageChange"
          @update:page-size="onPageSizeChange"
        />
      </div>
    </footer>

    <p class="links">
      <router-link to="/admin/categories" class="action-link">管理分类</router-link>
      <router-link to="/admin/customer-questions" class="action-link">客户提问管理</router-link>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { apiClient } from '../../utils/apiClient';

interface Item {
  id: number;
  title: string;
  viewCount: number;
  visibility: 'PUBLIC' | 'LOGGED_IN' | 'PRIVATE';
  category?: { id: number; name: string };
}

const dialog = useDialog();
const message = useMessage();

const keyword = ref('');
const filterVisibility = ref<string | null>(null);
const items = ref<Item[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const selectedIds = ref<number[]>([]);

const visibilityOptions = [
  { label: '公开', value: 'PUBLIC' },
  { label: '登录可见', value: 'LOGGED_IN' },
  { label: '仅管理员', value: 'PRIVATE' },
];

const visibilityLabel = (v: Item['visibility']) => {
  if (v === 'PUBLIC') return '公开';
  if (v === 'LOGGED_IN') return '登录可见';
  if (v === 'PRIVATE') return '仅管理员';
  return v;
};

const visibilityClass = (v: Item['visibility']) => {
  if (v === 'PRIVATE') return 'is-private';
  if (v === 'LOGGED_IN') return 'is-login';
  return 'is-public';
};

const allCurrentPageSelected = computed(
  () => items.value.length > 0 && items.value.every((item) => selectedIds.value.includes(item.id)),
);

const hasPartialSelection = computed(() => {
  if (!items.value.length) return false;
  const selectedCount = items.value.filter((item) => selectedIds.value.includes(item.id)).length;
  return selectedCount > 0 && selectedCount < items.value.length;
});

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await apiClient.get('/questions', {
      params: {
        q: keyword.value || undefined,
        visibility: filterVisibility.value || undefined,
        page: page.value,
        pageSize: pageSize.value,
      },
    });

    const serverItems = (res.data.items ?? []) as Item[];
    items.value = serverItems.sort((a: Item, b: Item) => b.id - a.id);
    total.value = res.data.total ?? serverItems.length;
    selectedIds.value = selectedIds.value.filter((id) => items.value.some((item) => item.id === id));
  } catch (e: any) {
    items.value = [];
    total.value = 0;
    message.error(e?.response?.data?.message || '加载失败');
  } finally {
    loading.value = false;
  }
};

const onSearch = () => {
  page.value = 1;
  fetchList();
};

const onVisibilityChange = () => {
  page.value = 1;
  fetchList();
};

const toggleOne = (id: number) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
    return;
  }
  selectedIds.value = [...selectedIds.value, id];
};

const toggleSelectAll = () => {
  if (allCurrentPageSelected.value) {
    const pageIds = items.value.map((item) => item.id);
    selectedIds.value = selectedIds.value.filter((id) => !pageIds.includes(id));
    return;
  }
  selectedIds.value = Array.from(new Set([...selectedIds.value, ...items.value.map((item) => item.id)]));
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

const onDelete = (id: number) => {
  dialog.warning({
    title: '确认删除',
    content: '确定删除该问题？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await apiClient.delete(`/questions/${id}`);
        selectedIds.value = selectedIds.value.filter((x) => x !== id);
        message.success('删除成功');
        fetchList();
      } catch (e: any) {
        message.error(e?.response?.data?.message || '删除失败');
      }
    },
  });
};

const onBatchDelete = () => {
  if (!selectedIds.value.length) return;
  dialog.warning({
    title: '确认批量删除',
    content: `确定删除已选中的 ${selectedIds.value.length} 个问题？该操作不可恢复。`,
    positiveText: '批量删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res = await apiClient.delete('/questions/batch', {
          data: { ids: selectedIds.value },
        });
        const count = res.data?.deletedCount ?? selectedIds.value.length;
        message.success(`已删除 ${count} 条问题`);
        selectedIds.value = [];
        fetchList();
      } catch (e: any) {
        message.error(e?.response?.data?.message || '批量删除失败');
      }
    },
  });
};

onMounted(() => {
  document.title = '知识库管理 - Apparel QA';
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

.glass-card {
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

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  color: var(--text-secondary);
}

th,
td {
  padding: 0.72rem 0.8rem;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}

th {
  color: var(--text-primary);
}

.title-cell {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  padding: 0.12rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
}

.badge.is-public { background: rgba(79, 159, 255, 0.14); color: #cfe3ff; }
.badge.is-login { background: rgba(45, 212, 191, 0.16); color: #99f6e4; }
.badge.is-private { background: rgba(244, 63, 94, 0.16); color: #fecdd3; }
.badge-category { background: rgba(148, 163, 184, 0.16); color: #dbe7ff; }

.right-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-left: auto;
}

.action-link {
  color: var(--accent-blue);
  text-decoration: none;
}

.action-link:hover {
  text-decoration: underline;
}

.btn-danger-ghost {
  margin-left: var(--sp-2);
  border: 1px solid rgba(244, 63, 94, 0.3);
  border-radius: var(--radius-md);
  background: rgba(244, 63, 94, 0.08);
  color: #fecaca;
  padding: 0.2rem 0.55rem;
  font-size: 0.76rem;
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

.state {
  text-align: center;
  color: var(--text-secondary);
}

.pager-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-2);
  color: var(--text-secondary);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
}

.toolbar-control {
  height: 44px;
}

.toolbar-enhanced :deep(.toolbar-control .n-input-wrapper),
.toolbar-enhanced :deep(.toolbar-control .n-base-selection) {
  min-height: 44px;
  height: 44px;
  border-radius: 999px;
}

.toolbar-enhanced :deep(.toolbar-control .n-base-selection-label),
.toolbar-enhanced :deep(.toolbar-control .n-base-selection-input) {
  min-height: 44px;
  line-height: 44px;
}

.toolbar-enhanced :deep(.toolbar-control .n-input__input-el) {
  height: 100%;
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
