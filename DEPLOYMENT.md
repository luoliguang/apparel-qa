# Apparel QA 宝塔面板部署文档（已按你的环境填写）

- 域名：`apparel.fangdutex.cn`
- 后端端口：`4000`
- 项目路径：`/www/wwwroot/apparel-qa`

项目结构：
- `frontend/`：Vue3 + Vite 前端
- `backend/`：Node.js + Express + TypeScript + Prisma
- 数据库：PostgreSQL

---

## 1. 宝塔部署架构

- 宝塔 Nginx 站点（80/443）
  - 托管前端静态文件：`/www/wwwroot/apparel-qa/frontend/dist`
  - 反向代理 `/api`、`/uploads` 到 `127.0.0.1:4000`
- 宝塔 Node 项目管理器（或 PM2）运行后端
- PostgreSQL（本机或云数据库）

---

## 2. 后端部署

```bash
cd /www/wwwroot/apparel-qa/backend
npm install
cp .env.example .env
```

编辑 `backend/.env`（重点）：

```env
DATABASE_URL="postgresql://apparel_user:StrongPassword@127.0.0.1:5432/apparel_qa"
JWT_SECRET="请替换为至少32位随机字符串"
PORT=4000
```

执行迁移与构建：

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
```

### 在宝塔 Node 项目中启动

- 项目目录：`/www/wwwroot/apparel-qa/backend`
- 启动命令：`node dist/index.js`
- 端口：`4000`

或用 PM2：

```bash
pm2 start dist/index.js --name apparel-qa-backend
pm2 save
pm2 startup
```

---

## 3. 前端部署

```bash
cd /www/wwwroot/apparel-qa/frontend
npm install
```

创建 `frontend/.env.production`：

```env
VITE_API_BASE_URL=https://apparel.fangdutex.cn/api
```

构建：

```bash
npm run build
```

前端目录：`/www/wwwroot/apparel-qa/frontend/dist`

---

## 4. 宝塔站点配置（可直接粘贴）

在宝塔网站 `apparel.fangdutex.cn` 的 Nginx 配置中使用：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name apparel.fangdutex.cn;

    root /www/wwwroot/apparel-qa/frontend/dist;
    index index.html;

    # SSL 证书（由宝塔申请后自动填充路径）
    ssl_certificate     /www/server/panel/vhost/cert/apparel.fangdutex.cn/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/apparel.fangdutex.cn/privkey.pem;

    # 前端 history 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件代理
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 如果你在宝塔中启用了“强制 HTTPS”，可保留宝塔自动生成的 80→443 跳转段；不要重复写冲突规则。

---

## 5. 上线后检查

后端健康检查：

```bash
curl http://127.0.0.1:4000/api/health
```

应返回：

```json
{"status":"ok"}
```

线上检查：
- 打开 `https://apparel.fangdutex.cn`
- 测试登录/提问/后台回复
- 测试图片上传与访问

---

## 6. 更新发布流程

```bash
cd /www/wwwroot/apparel-qa
git pull

cd backend
npm install
npx prisma migrate deploy
npm run build
pm2 restart apparel-qa-backend

cd ../frontend
npm install
npm run build
```

如果你是宝塔 Node 项目管理器启动后端，则在面板点“重启项目”。

---

## 7. 常见问题

1. 前端刷新 404：确认有 `try_files $uri $uri/ /index.html;`
2. `/api` 502：确认后端已启动在 `4000`
3. 图片打不开：确认 `/uploads/` 代理存在
4. 数据库报错：检查 `DATABASE_URL` 与权限

---

> 备注：本文档已按当前生产参数示例填写（`apparel.fangdutex.cn`、`4000`、`/www/wwwroot/apparel-qa`）。如后续迁移服务器或域名，请同步修改对应配置。