# AGENTS.md

## 仓库结构

- `server/` 和 `web/` 是两个独立应用，无 workspace runner
- `server/`: Express + Prisma + SQLite
- `web/`: Vue 3 + Vite + Pinia + Element Plus

## 常用命令

- 安装：`cd server && yarn`，再 `cd web && yarn`
- 开发/构建：`cd server && yarn dev/build`，`cd web && yarn dev/build`
- Prisma：`cd server && yarn prisma:generate`，`cd server && yarn prisma:migrate --name <name>`
- 验证：两端的 `build` 通过即可

## 服务端注意事项

- API 挂在 `/api`，健康检查 `/health`，服务绑定 `0.0.0.0`
- SQLite 数据库 `server/prisma/dev.db`，schema 在 `server/prisma/schema.prisma`
- CORS 配置在 `server/src/app.ts`，新 host/port 需添加
- `DASHSCOPE_API_KEY` 启用内置 web search MCP；`MCP_SERVERS` 可选

## 前端注意事项

- Vite 端口 `5173`，`/api` 和 `/health` 代理到 `VITE_API_BASE_URL`（默认 `http://localhost:5172`）

## 功能模块文件索引

### 1. 注册 / 登录
- `server/src/modules/auth/auth.routes.ts` — 路由注册
- `server/src/modules/auth/auth.controller.ts` — 请求处理
- `server/src/modules/auth/auth.service.ts` — 业务逻辑（注册、登录、查询用户）
- `server/src/lib/jwt.ts` — JWT 签发与验证
- `server/src/middlewares/auth.ts` — Bearer token 鉴权中间件
- `web/src/views/LoginView.vue` / `RegisterView.vue` — 登录/注册页面
- `web/src/stores/auth.ts` — 用户认证状态管理（含 session restore）
- `web/src/api/auth.ts` — 认证相关 API 调用
- `web/src/router/index.ts` — 路由守卫，未登录重定向
- `web/src/utils/token.ts` — token 本地持久化

### 2. 会话管理
- `server/prisma/schema.prisma` → `Conversation` 模型
- `server/src/modules/conversations/conversation.{routes,controller,service}.ts` — 会话 CRUD（列表、创建、详情、重命名、置顶、删除）
- `web/src/views/ChatView.vue` — 主页面，包含侧栏列表 + 聊天区域
- `web/src/components/chat/ConversationList.vue` — 侧栏会话列表（含三点菜单：置顶/重命名/删除）
- `web/src/stores/chat.ts` — 会话与消息状态管理
- `web/src/api/chat.ts` — 会话与消息 API

### 3. 对话管理（流式输出 / 消息编辑删除 / 语音输入 / 上下文记忆）
- `server/src/modules/messages/message.{routes,controller,service}.ts` — 消息流式生成、恢复、取消、编辑、删除、重新生成
- `server/src/utils/sse.ts` — SSE 流式传输工具
- `server/src/lib/audio.ts` — ASR 音频转写接入
- `server/src/lib/ai.ts` — LangChain 模型调用、工具绑定、消息组装
- `web/src/api/chat.ts` — SSE 流式解析、音频上传、消息 CRUD
- `web/src/stores/chat.ts` — 流状态管理、断流恢复、编辑→截断→重新生成编排
- `web/src/components/chat/MessageList.vue` — 消息气泡展示（含编辑/删除操作）
- `web/src/components/chat/MessageComposer.vue` — 输入框 + 录音按钮 + 发送/停止

### 4. 长期记忆管理（手动 + 自动提取）
- `server/prisma/schema.prisma` → `Memory` 模型（类型：`profile|preference|summary|fact`）
- `server/src/modules/memories/memory.{routes,controller,service}.ts` — 记忆手动 CRUD
- `server/src/lib/memory-graph.ts` — LangGraph 编排自动记忆提取
- `server/src/lib/ai.ts` → `generateMemoryCandidates()` — LLM 记忆候选提取
- `web/src/views/MemoryView.vue` — 记忆管理页面
- `web/src/stores/memory.ts` — 记忆状态管理
- `web/src/api/memory.ts` — 记忆 API
- `web/src/types/memory.ts` — 记忆类型定义

### 5. LLM 切换
- `server/src/lib/models.ts` — 可用模型列表定义
- `server/prisma/schema.prisma` → `User.preferredModel` 用户偏好字段
- `server/src/modules/model-preferences/model-preference.{routes,controller,service}.ts` — 模型偏好管理
- `web/src/views/ChatView.vue` — 侧栏模型选择器 UI
- `web/src/api/model-preference.ts` — 模型偏好 API
- `web/src/types/chat.ts` → `ModelInfo` 类型

### 6. MCP & Tools
- `server/src/lib/mcp.ts` — MCP 客户端封装
- `server/src/lib/tools/tools.ts` — 工具注册入口
- `server/src/lib/tools/webSearch.ts` — 联网搜索工具（DashScope MCP）
- `server/src/lib/tools/drawImage.ts` — 图片生成工具（DashScope API + 七牛存储）
- `server/src/lib/ai.ts` — 工具调用主逻辑（多轮 tool calling 循环）
- `server/src/config/env.ts` — `DASHSCOPE_API_KEY` / `MCP_SERVERS` 等环境变量

### 7. 公共基础设施
- `server/src/app.ts` — Express 应用配置（中间件、路由挂载）
- `server/src/main.ts` — 服务启动入口
- `server/src/modules/index.ts` — API 路由总入口，统一挂载 `/api`
- `server/src/lib/prisma.ts` — Prisma 客户端单例
- `server/src/config/env.ts` — 环境变量读取与校验
- `server/src/middlewares/error.ts` — 全局错误处理
- `server/src/middlewares/validate.ts` — Zod 参数校验中间件
- `server/src/utils/http.ts` — HTTP 响应封装
- `server/src/utils/app-error.ts` — 自定义错误类
- `web/src/main.ts` — 前端入口（注册 Element Plus、Pinia、Router）
- `web/src/App.vue` — 根组件
- `web/src/router/index.ts` — 路由配置
- `web/src/api/http.ts` — fetch 封装（自动注入 token、401 处理）

## 修改原则

- 不要手改生成产物，除非这次改动就是要调整生成结果本身。
- 尽量保持在现有的 `server/web` 边界内改动，功能通常只属于其中一个应用。