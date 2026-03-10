# 部署说明

本文档覆盖两条部署路径：

- 当前仓库已经在使用的 `GitHub Pages + Render`
- 你自己的阿里云 Debian 服务器，前端通过 Nginx 托管，后端通过 Nginx 反向代理

当前代码库的后端核心是 `Socket.IO` 服务，不是传统 REST API。也就是说：

- 现在零代码改动即可稳定部署的实时连接路径是 `/socket.io/`
- 如果你希望所有后端入口都严格收口到 `/api/*`，当前仓库还需要补一处 `Socket.IO path` 可配置能力，本文会单独说明

## 部署架构

### 方案一：GitHub Pages + Render

- 前端：GitHub Actions 构建 `packages/client/dist`，发布到 GitHub Pages
- 后端：Render 运行 `@blitzlord/server`
- 前端构建时通过 `VITE_SERVER_URL` 指向 Render 服务地址

### 方案二：阿里云 Debian + Nginx

- 前端：Vite 构建产物由 Nginx 提供静态访问
- 后端：Node.js 进程在本机端口运行
- Nginx：同域名提供前端页面，并反向代理后端连接

## 方案一：GitHub Pages + Render

### 现有配置

仓库内已经存在以下部署配置：

- [`render.yaml`](/D:/fohen/Blitzlord/render.yaml)
- [`.github/workflows/deploy-client.yml`](/D:/fohen/Blitzlord/.github/workflows/deploy-client.yml)
- [`packages/client/vite.config.ts`](/D:/fohen/Blitzlord/packages/client/vite.config.ts)

当前约束如下：

- GitHub Pages 构建时会使用 `base: "/Blitzlord/"`
- 前端路由使用 `createHashRouter`，因此 Pages 侧不需要额外 rewrite
- Render 运行的是 `pnpm --filter @blitzlord/server start`
- 服务端允许的跨域来源由 `CORS_ORIGIN` 控制

### Render 部署步骤

1. 在 Render 新建一个 `Web Service`
2. 关联当前仓库
3. 使用仓库内的 `render.yaml`，或手动填写以下关键参数：

```text
Runtime: Node
Build Command: npm install -g pnpm && pnpm install
Start Command: pnpm --filter @blitzlord/server start
```

4. 配置环境变量：

```text
NODE_VERSION=22
CORS_ORIGIN=https://<你的 GitHub Pages 域名>
```

注意：

- 如果你使用默认 Pages 域名，`CORS_ORIGIN` 一般是 `https://<用户名>.github.io`
- Pages URL 中即使带仓库路径，CORS 也只看协议、域名和端口，不包含 `/Blitzlord/`
- Render 服务地址应填写服务根地址，例如 `https://blitzlord-server.onrender.com`，不要把 `/socket.io/` 拼进去

### GitHub Pages 部署步骤

1. 在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中添加：

```text
RENDER_SERVER_URL=https://<你的 Render 服务域名>
```

2. 在仓库 `Settings -> Pages` 中启用 GitHub Pages
3. 确认工作流 `Deploy Client to GitHub Pages` 有权限发布 Pages
4. 推送到 `main` 分支，或手动触发该工作流

工作流会自动执行：

```bash
pnpm install --frozen-lockfile
pnpm --filter @blitzlord/client build
```

构建完成后会发布 `packages/client/dist`

### 这一方案下的排查重点

- 页面资源 404：通常是 `vite.config.ts` 中的 `base` 与 Pages 实际路径不一致
- 页面能打开但连不上后端：通常是 `RENDER_SERVER_URL` 填错，或者 Render 服务尚未启动
- 浏览器报 CORS：通常是 `CORS_ORIGIN` 没有写成前端实际访问域名

## 方案二：阿里云 Debian + Nginx

下面这套流程默认你已经有：

- 一台 Debian 服务器
- 一个已解析到服务器公网 IP 的域名
- `sudo` 权限

示例中统一使用：

- 域名：`game.example.com`
- 项目目录：`/opt/blitzlord`
- 前端发布目录：`/var/www/blitzlord/client`
- 后端监听端口：`3001`

请按你的实际环境替换。

### 1. 安装基础依赖

```bash
sudo apt update
sudo apt install -y git nginx curl rsync
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@9 --activate
node -v
pnpm -v
```

如果你已经通过其他方式安装了 Node.js 22 和 pnpm，可以跳过这一步。

### 2. 拉取代码并安装依赖

```bash
sudo mkdir -p /opt/blitzlord
sudo chown $USER:$USER /opt/blitzlord
git clone <你的仓库地址> /opt/blitzlord
cd /opt/blitzlord
pnpm install --frozen-lockfile
```

### 3. 构建前端

同域名部署建议不要写死 `VITE_SERVER_URL`，让前端走同源连接：

```bash
cd /opt/blitzlord
pnpm --filter @blitzlord/client build
```

如果你希望前端明确连到某个独立后端域名，再在构建前设置：

```bash
export VITE_SERVER_URL=https://api.example.com
pnpm --filter @blitzlord/client build
```

### 4. 发布前端静态文件

```bash
sudo mkdir -p /var/www/blitzlord/client
sudo rsync -av --delete /opt/blitzlord/packages/client/dist/ /var/www/blitzlord/client/
```

### 5. 启动后端服务

当前服务端脚本是直接通过 `tsx` 运行源码：

```bash
cd /opt/blitzlord
pnpm --filter @blitzlord/server start
```

为了让服务常驻，建议使用 `systemd`。

新建 `/etc/systemd/system/blitzlord.service`：

```ini
[Unit]
Description=Blitzlord Socket.IO Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/blitzlord
Environment=PORT=3001
Environment=CORS_ORIGIN=https://game.example.com
ExecStart=/usr/bin/env bash -lc 'pnpm --filter @blitzlord/server start'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

说明：

- `User=deploy` 只是示例，请替换成你的实际部署用户
- `CORS_ORIGIN` 应写成前端真实访问地址
- 如果你使用 `http` 而不是 `https`，这里也要同步改成 `http://...`

然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable blitzlord
sudo systemctl start blitzlord
sudo systemctl status blitzlord
```

查看日志：

```bash
sudo journalctl -u blitzlord -f
```

### 6. 配置 Nginx

把下面配置保存到 `/etc/nginx/sites-available/blitzlord`：

```nginx
server {
    listen 80;
    server_name game.example.com;

    root /var/www/blitzlord/client;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/blitzlord /etc/nginx/sites-enabled/blitzlord
sudo nginx -t
sudo systemctl reload nginx
```

说明：

- 当前仓库还没有独立 REST API 路由，因此 `/api/` 这一段主要是给你未来扩展 HTTP 接口时预留统一前缀
- 如果你未来后端内部也直接以 `/api/...` 挂载 HTTP 路由，需要同步调整 `proxy_pass`，避免前缀被重复拼接
- 现在真正必须可用的是 `/socket.io/` 这段 WebSocket 反向代理
- 前端使用的是 `HashRouter`，因此即使刷新到 `#/room/xxx` 这类地址，Nginx 仍只需要正常返回 `index.html`

### 7. 配置 HTTPS

如果你已经有证书，可以直接把 Nginx 改成 `listen 443 ssl;`。

如果还没有证书，可以使用 `certbot`：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d game.example.com
```

完成后记得同步检查：

- `CORS_ORIGIN` 是否改成 `https://game.example.com`
- 前端是否仍使用同源连接

## `/api` 前缀说明

### 当前代码库的现状

当前项目的服务端入口是 `Socket.IO`：

- 服务端没有显式配置自定义 `path`
- 客户端也没有传入自定义 `path`
- 因此当前实时连接默认路径是 `/socket.io/`

也就是说，下面这套组合是当前零代码改动即可部署成功的方式：

- 前端页面：`/`
- 实时连接：`/socket.io/`
- 未来 HTTP API：`/api/`

### 如果你要严格统一成 `/api/*`

如果你的目标是把实时连接也统一成：

```text
/api/socket.io/
```

那么仅靠 Nginx 改写还不够，当前仓库还需要补一处代码层配置：

- 服务端：`new Server(..., { path: "/api/socket.io" })`
- 客户端：`io(url, { path: "/api/socket.io" })`

在这项改造完成之前，不建议把外部实时连接入口强行切到 `/api/socket.io/`，否则很容易出现握手 404、轮询失败或 WebSocket 升级失败。

## 发布检查清单

发布前建议按下面顺序检查：

1. `pnpm install --frozen-lockfile` 成功
2. `pnpm --filter @blitzlord/client build` 成功
3. 后端服务已启动，并监听 `3001`
4. Nginx 配置通过 `nginx -t`
5. 域名已正确解析到服务器
6. `CORS_ORIGIN` 与前端实际访问域名完全一致
7. 浏览器开发者工具里 `socket.io` 请求状态正常

## 常见问题

### 1. 页面打开正常，但一直连不上房间

优先检查：

- `VITE_SERVER_URL` 是否填成了错误地址
- Nginx 是否漏了 `/socket.io/` 反代
- Nginx 是否漏了 `Upgrade` / `Connection` 头
- 后端服务是否真的在 `3001` 端口监听

### 2. 浏览器报 CORS 错误

通常是 `CORS_ORIGIN` 不匹配：

- `https://game.example.com` 和 `http://game.example.com` 不是同一个 origin
- 带不带端口也不是同一个 origin

### 3. GitHub Pages 页面能打开，但资源路径不对

优先检查：

- 仓库名是否仍是 `Blitzlord`
- GitHub Pages 是否确实发布在 `/Blitzlord/`
- `vite.config.ts` 中的 `base` 是否需要同步调整

### 4. Nginx 反代后 WebSocket 握手失败

优先检查：

- `location /socket.io/` 与 `proxy_pass` 末尾斜杠是否匹配
- 是否设置了 `proxy_http_version 1.1`
- 是否设置了 `Upgrade` 和 `Connection "upgrade"`

### 5. 自托管同域名部署后仍然跨域

如果你是：

- 前端 `https://game.example.com`
- 后端也通过同域名 Nginx 反代

那么前端构建时通常不需要显式设置 `VITE_SERVER_URL`。保持为空值更稳，客户端会优先走同源连接。
