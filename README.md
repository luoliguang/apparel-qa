# Apparel QA 服装跟单问答网站

集中管理常见问题的图文回答，支持客户自助查看、搜索，以及在线提问与后台回复。

## 技术栈

- **前端**：Vue 3 + Vite + Vue Router + Pinia + Axios
- **后端**：Node.js + Express + TypeScript
- **数据库**：PostgreSQL（Prisma ORM）

## 环境要求

- Node.js 18+
- PostgreSQL 14+
- npm 或 pnpm

## 快速开始

### 1. 数据库

创建数据库（例如名为 `apparel_qa`），并记下连接串。

### 2. 后端

```bash
cd backend
cp .env.example .env
# 编辑 .env：填写 DATABASE_URL、JWT_SECRET、PORT
npm install
npx prisma generate
npx prisma migrate dev --name init   # 首次创建表结构
npm run dev
```

后端默认运行在 `http://localhost:4000`。

### 3. 前端

```bash
cd frontend
npm install
# 可选：新建 .env 并设置 VITE_API_BASE_URL=http://localhost:4000/api
npm run dev
```

前端默认运行在 `http://localhost:5173`，请求会发往 `http://localhost:4000/api`（可通过 `VITE_API_BASE_URL` 覆盖）。

### 4. 首次使用

- 第一个注册的用户会自动成为**管理员**。
- 管理员可访问「管理后台」：知识库管理、分类管理、客户提问管理。

## 功能概览

- **访客**：浏览、搜索公开问题。
- **登录客户**：浏览公开 + 登录可见问题；提交问题；在「我的问题」查看回复。
- **管理员**：管理知识库（增删改、可见性、分类、图片）；管理分类；回复客户提问。

## 生产构建

```bash
# 后端
cd backend && npm run build && npm start

# 前端
cd frontend && npm run build
# 将 frontend/dist 部署到静态服务器或与后端同域静态托管
```

生产环境请务必修改 `JWT_SECRET` 并正确配置 `DATABASE_URL`。
