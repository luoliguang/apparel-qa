<template>
  <div class="container-shell cat-wrap">
    <header class="glass-card reveal">
      <div class="head-row">
        <h2 class="gradient-heading-sm">分类管理</h2>
        <router-link to="/admin/questions" class="text-link">← 返回知识库</router-link>
      </div>
    </header>

    <section class="glass-card reveal">
      <h3>新增分类</h3>
      <form class="inline-form" @submit.prevent="onCreate">
        <input v-model="newName" type="text" placeholder="分类名称" required />
        <input v-model="newDesc" type="text" placeholder="描述（可选）" />
        <button class="btn-glow" type="submit" :disabled="creating">{{ creating ? '创建中...' : '添加' }}</button>
      </form>
      <p v-if="createError" class="error">{{ createError }}</p>
    </section>

    <section v-if="loading" class="glass-card state">加载中...</section>
    <section v-else-if="items.length === 0" class="glass-card state">暂无分类，请先添加。</section>

    <section v-else class="list reveal">
      <article v-for="c in items" :key="c.id" class="item glass-card">
        <div v-if="editingId !== c.id" class="row">
          <div class="info">
            <strong>{{ c.name }}</strong>
            <span v-if="c.description" class="desc">{{ c.description }}</span>
          </div>
          <div class="actions">
            <button class="btn-ghost" type="button" @click="startEdit(c)">编辑</button>
            <button class="btn-danger-ghost" type="button" @click="onDelete(c.id)">删除</button>
          </div>
        </div>

        <form v-else class="edit-row" @submit.prevent="onSaveEdit">
          <input v-model="editName" type="text" required />
          <input v-model="editDesc" type="text" placeholder="描述" />
          <button class="btn-glow" type="submit" :disabled="saving">保存</button>
          <button class="btn-ghost" type="button" @click="editingId = null">取消</button>
        </form>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { apiClient } from '../../utils/apiClient';

interface Category {
  id: number;
  name: string;
  description: string | null;
}

const dialog = useDialog();
const message = useMessage();

const items = ref<Category[]>([]);
const loading = ref(false);
const newName = ref('');
const newDesc = ref('');
const creating = ref(false);
const createError = ref('');

const editingId = ref<number | null>(null);
const editName = ref('');
const editDesc = ref('');
const saving = ref(false);

const fetchList = async () => {
  loading.value = true;
  try {
    const res = await apiClient.get<Category[]>('/categories');
    items.value = res.data;
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
};

const onCreate = async () => {
  if (!newName.value.trim()) return;
  creating.value = true;
  createError.value = '';
  try {
    await apiClient.post('/categories', {
      name: newName.value.trim(),
      description: newDesc.value.trim() || null,
    });
    newName.value = '';
    newDesc.value = '';
    message.success('添加成功');
    fetchList();
  } catch (e: any) {
    createError.value = e?.response?.data?.message || '添加失败';
  } finally {
    creating.value = false;
  }
};

const startEdit = (c: Category) => {
  editingId.value = c.id;
  editName.value = c.name;
  editDesc.value = c.description ?? '';
};

const onSaveEdit = async () => {
  if (editingId.value == null || !editName.value.trim()) return;
  saving.value = true;
  try {
    await apiClient.put(`/categories/${editingId.value}`, {
      name: editName.value.trim(),
      description: editDesc.value.trim() || null,
    });
    editingId.value = null;
    message.success('保存成功');
    fetchList();
  } catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

const onDelete = (id: number) => {
  dialog.warning({
    title: '确认删除',
    content: '确定删除该分类？若有关联问题将无法删除。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await apiClient.delete(`/categories/${id}`);
        message.success('删除成功');
        fetchList();
      } catch (e: any) {
        message.error(e?.response?.data?.message || '删除失败');
      }
    },
  });
};

onMounted(() => {
  document.title = '分类管理 - Apparel QA';
  fetchList();
});
</script>

<style scoped>
.cat-wrap { display: flex; flex-direction: column; gap: var(--sp-4); padding-top: var(--sp-2); padding-bottom: var(--sp-8); }
.glass-card { background: rgba(255,255,255,.04); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--sp-4); }
.gradient-heading-sm { margin: 0; font-size: 1.6rem; font-weight: 700; background: linear-gradient(135deg,#f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%); -webkit-background-clip:text; background-clip: text; -webkit-text-fill-color: transparent; }
.head-row { display:flex; justify-content: space-between; align-items:center; gap: var(--sp-3); }
.text-link { color: var(--accent-blue); text-decoration: none; }
.text-link:hover { text-decoration: underline; }
h3 { margin: 0 0 var(--sp-3); color: var(--text-primary); }
.inline-form, .edit-row { display:flex; flex-wrap: wrap; gap: var(--sp-2); align-items:center; }
input { border: 1px solid var(--border-subtle); border-radius: var(--radius-full); background: rgba(255,255,255,.03); color: var(--text-primary); padding: .42rem .75rem; outline: none; }
input:focus { border-color: var(--border-accent); box-shadow: var(--shadow-glow); }
.state { text-align:center; color: var(--text-secondary); }
.list { display:flex; flex-direction: column; gap: var(--sp-2); }
.item { padding: var(--sp-3) var(--sp-4); }
.row { display:flex; justify-content: space-between; align-items:center; gap: var(--sp-3); }
.info { display:flex; flex-direction: column; gap: .2rem; }
.info strong { color: var(--text-primary); }
.desc { color: var(--text-secondary); font-size: .82rem; }
.actions { display:flex; gap: var(--sp-2); }
.btn-glow { border:none; border-radius: var(--radius-full); padding: .62rem 1.2rem; color: #fff; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); transition: transform .2s ease, box-shadow .3s ease; }
.btn-glow:hover { transform: translateY(-1px); box-shadow: var(--shadow-glow); }
.btn-ghost { border: 1px solid var(--border-bright); border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); padding: .35rem .7rem; }
.btn-danger-ghost { border: 1px solid rgba(244,63,94,.28); border-radius: var(--radius-md); background: rgba(244,63,94,.08); color: #fecaca; padding: .35rem .7rem; }
.error { margin-top: var(--sp-2); color: #fecaca; }
</style>
