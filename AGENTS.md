# AGENTS.md

## 仓库结构
- `server/` 和 `web/` 是两个独立应用；仓库根目录没有统一的 `package.json` 或 workspace runner。
- `server/` 是 Express + Prisma + SQLite，`web/` 是 Vue 3 + Vite + Pinia + Element Plus。

## 常用命令
- 依赖分别安装：先 `cd server && yarn`，再 `cd web && yarn`。
- 服务端开发/构建：`cd server && yarn dev`，`cd server && yarn build`。
- 前端开发/构建：`cd web && yarn dev`，`cd web && yarn build`。
- Prisma 只在服务端执行：`cd server && yarn prisma:generate`，再 `cd server && yarn prisma:migrate --name <name>`。

## 验证方式
- 清单里没有仓库级测试脚本，主要用各自的 `build` 作为验证步骤。
- 同时改了两个应用时，两个 `build` 都要跑。

## 服务端注意事项
- 开发环境下 `DATABASE_URL` 和 `JWT_SECRET` 有默认回退，但生产环境仍然必须显式配置。
- SQLite 数据库文件在 `server/prisma/dev.db`，Prisma schema 在 `server/prisma/schema.prisma`。
- API 挂在 `/api`，健康检查是 `/health`，服务绑定 `0.0.0.0`。
- CORS 直接写在 `server/src/app.ts`，如果前端来自新的 host/port，需要在这里加允许来源。
- 配置 `DASHSCOPE_API_KEY` 会启用内置的 web search MCP；`MCP_SERVERS` 是可选项，支持 JSON 对象或数组。

## 前端注意事项
- Vite 开发服务器端口是 `5173`。
- `/api` 和 `/health` 会代理到 `VITE_API_BASE_URL`，未设置时默认转发到 `http://localhost:5172`。

## 修改原则
- 不要手改生成产物，除非这次改动就是要调整生成结果本身。
- 尽量保持在现有的 `server/web` 边界内改动，功能通常只属于其中一个应用。
