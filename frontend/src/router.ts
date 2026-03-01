import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from './stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('./views/HomePage.vue') },
  { path: '/questions', name: 'questions', component: () => import('./views/QuestionsPage.vue') },
  { path: '/questions/:id', name: 'question-detail', component: () => import('./views/QuestionDetailPage.vue') },
  { path: '/ask', name: 'ask', component: () => import('./views/AskPage.vue'), meta: { requiresAuth: true } },
  { path: '/my-questions', name: 'my-questions', component: () => import('./views/MyQuestionsPage.vue'), meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: () => import('./views/LoginPage.vue') },
  { path: '/register', name: 'register', component: () => import('./views/RegisterPage.vue') },
  { path: '/profile', name: 'profile', component: () => import('./views/ProfilePage.vue'), meta: { requiresAuth: true } },
  {
    path: '/admin/questions',
    name: 'admin-questions',
    component: () => import('./views/admin/AdminQuestionsPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/admin/questions/new',
    name: 'admin-question-new',
    component: () => import('./views/admin/AdminQuestionEditPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/admin/questions/edit/:id',
    name: 'admin-question-edit',
    component: () => import('./views/admin/AdminQuestionEditPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/admin/categories',
    name: 'admin-categories',
    component: () => import('./views/admin/AdminCategoriesPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/admin/customer-questions',
    name: 'admin-customer-questions',
    component: () => import('./views/admin/AdminCustomerQuestionsPage.vue'),
    meta: { requiresAdmin: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();

  if (to.meta.requiresAdmin) {
    if (!auth.isLoggedIn) {
      return next({ name: 'login', query: { redirect: to.fullPath } });
    }
    if (!auth.isAdmin) {
      return next({ name: 'home' });
    }
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return next({ name: 'login', query: { redirect: to.fullPath } });
  }

  return next();
});

export default router;

