<template>
  <n-config-provider>
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-shell">
          <header class="navbar-wrap">
            <div class="navbar container-shell glass-card">
              <RouterLink to="/" class="brand gradient-heading-sm">
                Apparel QA
              </RouterLink>

              <button
                type="button"
                class="menu-btn"
                :aria-expanded="menuOpen"
                aria-label="菜单"
                @click="menuOpen = !menuOpen"
              >
                ☰
              </button>

              <nav class="nav-panel" :class="menuOpen ? 'open' : ''">
                <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link" @click="menuOpen = false">
                  {{ item.label }}
                </RouterLink>

                <div class="divider"></div>

                <button
                  type="button"
                  class="theme-btn"
                  :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
                  @click="toggleTheme"
                >
                  <span class="theme-icon" aria-hidden="true">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
                  <span>{{ theme === 'dark' ? '浅色' : '深色' }}</span>
                </button>

                <template v-if="auth.isLoggedIn">
                  <div ref="notifWrapRef" class="notif-wrap">
                    <button
                      type="button"
                      class="notif-btn"
                      :aria-label="`通知，未读 ${unreadCount} 条`"
                      @click="toggleNotifPanel"
                    >
                    <span aria-hidden="true">🔔</span>
                    <span v-if="unreadCount > 0" class="notif-dot">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
                  </button>

                    <div v-if="showNotifPanel" class="notif-panel glass-card">
                      <div class="notif-head">
                        <strong>消息通知</strong>
                        <div class="notif-actions">
                          <button type="button" class="text-btn" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</button>
                          <button type="button" class="text-btn" :disabled="selectedNotifIds.size === 0" @click="deleteSelected">删除选中</button>
                          <button type="button" class="text-btn" :disabled="notifications.length === 0" @click="clearAllNotifications">清空</button>
                          <button type="button" class="text-btn" @click="markAllRead">全部已读</button>
                        </div>
                      </div>
                      <div v-if="notifLoading" class="notif-empty">加载中...</div>
                      <div v-else-if="notifications.length === 0" class="notif-empty">暂无通知</div>
                      <button
                        v-for="n in notifications"
                        :key="n.id"
                        type="button"
                        class="notif-item"
                        :class="{ unread: !n.isRead }"
                        @click="openNotification(n)"
                      >
                        <label class="notif-select" @click.stop>
                          <input :checked="selectedNotifIds.has(n.id)" type="checkbox" @change="toggleSelectOne(n.id)" />
                        </label>
                        <div class="notif-content">
                          <p>{{ n.title }}</p>
                          <span>{{ n.content }}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <RouterLink to="/profile" class="user-chip" @click="menuOpen = false">
                    <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" alt="头像" class="user-avatar" />
                    <span v-else class="user-avatar user-avatar-fallback">{{ userInitial }}</span>
                    <span class="user-name">{{ displayName }}</span>
                  </RouterLink>
                  <RouterLink v-if="auth.isAdmin" to="/admin/questions" class="nav-link" @click="menuOpen = false">管理后台</RouterLink>
                  <button type="button" class="btn-glow btn-logout" @click="logout">退出</button>
                </template>

                <template v-else>
                  <RouterLink to="/login" class="nav-link" @click="menuOpen = false">登录</RouterLink>
                  <RouterLink to="/register" class="btn-glow" @click="menuOpen = false">注册</RouterLink>
                </template>
              </nav>
            </div>
          </header>

          <main class="container-shell content-wrap">
            <RouterView v-slot="{ Component }">
              <component :is="Component" />
            </RouterView>
          </main>

          <nav v-if="showBottomTab" class="bottom-tab glass-card">
            <RouterLink to="/" class="tab-item">首页</RouterLink>
            <RouterLink to="/ask" class="tab-item">提问</RouterLink>
            <RouterLink to="/my-questions" class="tab-item">我的</RouterLink>
          </nav>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui';
import { useAuthStore } from './stores/auth';
import { apiClient } from './utils/apiClient';

type ThemeMode = 'dark' | 'light';
const THEME_KEY = 'apparel-theme';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const theme = ref<ThemeMode>('dark');
const unreadCount = ref(0);
const notifications = ref<Array<{ id: number; title: string; content: string; isRead: boolean; relatedType?: string; relatedId?: number }>>([]);
const selectedNotifIds = ref<Set<number>>(new Set());
const notifLoading = ref(false);
const showNotifPanel = ref(false);
let notifTimer: number | null = null;
const notifWrapRef = ref<HTMLElement | null>(null);

const allSelected = computed(() => notifications.value.length > 0 && selectedNotifIds.value.size === notifications.value.length);

const handleNotificationRefresh = () => {
  void fetchUnreadCount();
  if (showNotifPanel.value) {
    void fetchNotifications();
  }
};

const handleClickOutsideNotif = (event: MouseEvent) => {
  if (!showNotifPanel.value) {
    return;
  }

  const target = event.target as Node | null;
  if (!target) {
    return;
  }

  if (notifWrapRef.value?.contains(target)) {
    return;
  }

  showNotifPanel.value = false;
};

const navItems = [
  { to: '/', label: '首页' },
  { to: '/questions', label: '知识库' },
  { to: '/ask', label: '提问' },
  { to: '/my-questions', label: '我的问题' },
  { to: '/profile', label: '个人资料' },
];

const showBottomTab = computed(() => {
  const path = route.path;
  return path === '/' || path === '/ask' || path === '/my-questions' || path.startsWith('/questions');
});

const displayName = computed(() => auth.user?.nickname || auth.user?.email || '用户');
const userInitial = computed(() => displayName.value.trim().slice(0, 1).toUpperCase() || 'U');

const applyTheme = (mode: ThemeMode) => {
  theme.value = mode;
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem(THEME_KEY, mode);
};

const toggleTheme = () => {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
};

const fetchUnreadCount = async () => {
  if (!auth.isLoggedIn) {
    unreadCount.value = 0;
    return;
  }
  try {
    const res = await apiClient.get('/notifications/unread-count');
    unreadCount.value = res.data.count ?? 0;
  } catch {
    unreadCount.value = 0;
  }
};

const fetchNotifications = async () => {
  if (!auth.isLoggedIn) {
    notifications.value = [];
    selectedNotifIds.value = new Set();
    return;
  }
  notifLoading.value = true;
  try {
    const res = await apiClient.get('/notifications', {
      params: { page: 1, pageSize: 10 },
    });
    notifications.value = res.data.items ?? [];
    const allowedIds = new Set(notifications.value.map((n) => n.id));
    selectedNotifIds.value = new Set([...selectedNotifIds.value].filter((id) => allowedIds.has(id)));
  } catch {
    notifications.value = [];
    selectedNotifIds.value = new Set();
  } finally {
    notifLoading.value = false;
  }
};

const toggleNotifPanel = async () => {
  showNotifPanel.value = !showNotifPanel.value;
  if (showNotifPanel.value) {
    await fetchNotifications();
    await fetchUnreadCount();
  }
};

const markOneRead = async (id: number) => {
  try {
    await apiClient.patch(`/notifications/${id}/read`);
    notifications.value = notifications.value.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch {
    // ignore
  }
};

const openNotification = async (notification: {
  id: number;
  isRead: boolean;
  relatedType?: string;
  relatedId?: number;
}) => {
  if (!notification.isRead) {
    await markOneRead(notification.id);
  }

  showNotifPanel.value = false;

  if (notification.relatedType === 'CUSTOMER_QUESTION' && notification.relatedId) {
    void router.push({
      name: 'my-questions',
      query: {
        focusQuestionId: String(notification.relatedId),
      },
    });
  }
};

const toggleSelectOne = (id: number) => {
  const next = new Set(selectedNotifIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedNotifIds.value = next;
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedNotifIds.value = new Set();
    return;
  }
  selectedNotifIds.value = new Set(notifications.value.map((n) => n.id));
};

const deleteSelected = async () => {
  if (selectedNotifIds.value.size === 0) {
    return;
  }

  const ids = [...selectedNotifIds.value];
  try {
    await apiClient.delete('/notifications/batch', { data: { ids } });
    notifications.value = notifications.value.filter((n) => !selectedNotifIds.value.has(n.id));
    selectedNotifIds.value = new Set();
    await fetchUnreadCount();
  } catch {
    // ignore
  }
};

const clearAllNotifications = async () => {
  try {
    await apiClient.delete('/notifications/clear');
    notifications.value = [];
    selectedNotifIds.value = new Set();
    unreadCount.value = 0;
  } catch {
    // ignore
  }
};

const markAllRead = async () => {
  try {
    await apiClient.patch('/notifications/read-all');
    notifications.value = notifications.value.map((n) => ({ ...n, isRead: true }));
    unreadCount.value = 0;
  } catch {
    // ignore
  }
};

onMounted(() => {
  const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
  } else {
    applyTheme('dark');
  }

  handleNotificationRefresh();
  window.addEventListener('focus', handleNotificationRefresh);
  window.addEventListener('customer-question-submitted', handleNotificationRefresh as EventListener);
  document.addEventListener('click', handleClickOutsideNotif);
  notifTimer = window.setInterval(() => {
    handleNotificationRefresh();
  }, 30000);
});

watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn) {
      unreadCount.value = 0;
      notifications.value = [];
      selectedNotifIds.value = new Set();
      showNotifPanel.value = false;
      return;
    }
    void fetchUnreadCount();
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleNotificationRefresh);
  window.removeEventListener('customer-question-submitted', handleNotificationRefresh as EventListener);
  document.removeEventListener('click', handleClickOutsideNotif);

  if (notifTimer) {
    window.clearInterval(notifTimer);
    notifTimer = null;
  }
});

const logout = () => {
  auth.logout();
  menuOpen.value = false;
  showNotifPanel.value = false;
};
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  color: var(--text-primary);
  background-color: var(--bg-base);
  background-image:
    radial-gradient(ellipse at 15% 40%, var(--bg-grad-1) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 10%, var(--bg-grad-2) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, var(--bg-grad-3) 0%, transparent 55%);
  padding-bottom: 56px;
  overflow-x: hidden;
  overflow-y: scroll;
  scrollbar-width: none;
}

.app-shell::-webkit-scrollbar {
  width: 0;
  height: 0;
}

:global(html),
:global(body) {
  scrollbar-gutter: stable;
  scrollbar-width: none;
}

:global(html::-webkit-scrollbar),
:global(body::-webkit-scrollbar) {
  width: 0;
  height: 0;
}

.container-shell {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 var(--sp-4);
}

.navbar-wrap {
  position: sticky;
  top: 0;
  z-index: 100;
  padding-top: var(--sp-3);
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.navbar {
  height: 64px;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding-inline: var(--sp-4);
}

.brand {
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  text-decoration: none;
}

.gradient-heading-sm {
  background: linear-gradient(135deg, #f0f4ff 0%, var(--accent-blue) 50%, var(--accent-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.menu-btn {
  margin-left: auto;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-panel {
  display: none;
  position: fixed;
  inset-inline: var(--sp-4);
  top: 76px;
  padding: var(--sp-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--nav-panel-bg);
  backdrop-filter: blur(24px);
}

.nav-panel.open {
  display: block;
}

.nav-link {
  display: block;
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: background-color 0.25s ease, color 0.25s ease, transform 0.2s ease;
}

.nav-link:hover,
.nav-link:focus-visible {
  background: var(--nav-link-hover-bg);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.nav-link.router-link-active {
  background: var(--nav-link-active-bg);
  color: var(--nav-link-active-color);
}

.divider {
  height: 1px;
  margin: var(--sp-2) 0;
  background: var(--border-subtle);
}

.theme-btn {
  width: 100%;
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  padding: 0.5rem 0.75rem;
  text-align: center;
  font-size: 0.82rem;
  transition: color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.theme-btn:hover,
.theme-btn:focus-visible {
  color: var(--text-primary);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow);
}

.notif-wrap {
  position: relative;
  display: inline-flex;
}

.notif-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.notif-dot {
  position: absolute;
  right: -4px;
  top: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #ef4444, #f97316);
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.notif-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: min(420px, calc(100vw - 2rem));
  max-height: 460px;
  overflow: auto;
  padding: 10px;
  display: grid;
  gap: 8px;
  z-index: 120;
  background: #111827;
  border: 1px solid #2c3a53;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.notif-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 6px;
}

.notif-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.text-btn {
  border: 1px solid #334155;
  background: #1e293b;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
}

.text-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.notif-empty {
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 4px;
}

.notif-item {
  border: 1px solid #334155;
  background: #0f172a;
  border-radius: var(--radius-md);
  width: 100%;
  text-align: left;
  padding: 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.notif-item.unread {
  border-color: #3b82f6;
  background: #0b1730;
}

.notif-select {
  margin-top: 2px;
  display: inline-flex;
  align-items: center;
}

.notif-content {
  min-width: 0;
  display: grid;
  gap: 4px;
  flex: 1;
}

.notif-item p {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.notif-item span {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
  white-space: normal;
  word-break: break-word;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.32rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.02);
  transition: border-color 0.2s ease, transform 0.2s ease, color 0.2s ease;
}

.user-chip:hover,
.user-chip:focus-visible {
  border-color: var(--border-accent);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid var(--border-bright);
}

.user-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
}

.user-name {
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.84rem;
}

.btn-glow {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  color: white;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: box-shadow 0.3s ease, transform 0.2s ease;
}

.btn-glow:hover,
.btn-glow:focus-visible {
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}

.btn-logout {
  background: linear-gradient(135deg, #334155, #1f2937);
}

.content-wrap {
  padding-top: var(--sp-4);
  padding-bottom: var(--sp-4);
}

.bottom-tab {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  height: 56px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-radius: 0;
  border-inline: none;
  border-bottom: none;
}

.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.tab-item.router-link-active {
  color: var(--text-primary);
}

@media (min-width: 768px) {
  .app-shell {
    padding-bottom: 0;
  }

  .menu-btn {
    display: none;
  }

  .nav-panel {
    display: flex;
    position: static;
    margin-left: auto;
    inset: auto;
    padding: 0;
    border: none;
    background: transparent;
    backdrop-filter: none;
    align-items: center;
    gap: 0.25rem;
  }

  .theme-btn {
    width: auto;
    margin-right: 0.25rem;
    padding: 0.44rem 0.86rem;
  }

  .divider {
    width: 1px;
    height: 20px;
    margin: 0 0.5rem;
  }

  .bottom-tab {
    display: none;
  }
}
</style>
