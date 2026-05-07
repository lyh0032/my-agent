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

## 业务概览
- 这是一个 AI 对话应用，你提到的核心能力大部分都已落地：注册、登录、会话管理、会话上下文记忆、会话流式输出、长期记忆管理、LLM 切换、联网查询工具。
- 需要修正的一点：代码里目前没有发现独立的“会话终端”页面/模块。现有实现更准确地说是“聊天输入区 + SSE 流式输出/恢复/停止链路”，主要在 `web/src/components/chat/MessageComposer.vue`、`web/src/api/chat.ts`、`server/src/modules/messages/message.controller.ts`、`server/src/modules/messages/message.service.ts`。
- 前端主页面是聊天页和记忆页：`web/src/views/ChatView.vue`、`web/src/views/MemoryView.vue`。
- 后端 API 总入口在 `server/src/modules/index.ts`，统一挂载到 `/api`；应用入口在 `server/src/app.ts`、`server/src/main.ts`。

## 功能定位索引

### 1. 注册 / 登录 / 会话恢复
- 后端路由：`server/src/modules/auth/auth.routes.ts`
- 后端控制器：`server/src/modules/auth/auth.controller.ts`
- 后端服务：`server/src/modules/auth/auth.service.ts`
- JWT 与鉴权中间件：`server/src/lib/jwt.ts`、`server/src/middlewares/auth.ts`
- 前端页面：`web/src/views/LoginView.vue`、`web/src/views/RegisterView.vue`
- 前端 API：`web/src/api/auth.ts`
- 前端状态管理：`web/src/stores/auth.ts`
- 路由守卫与 session restore：`web/src/router/index.ts`
- token 持久化：`web/src/utils/token.ts`

### 2. 会话管理
- 会话数据模型：`server/prisma/schema.prisma` 中的 `Conversation`
- 后端路由：`server/src/modules/conversations/conversation.routes.ts`
- 后端控制器：`server/src/modules/conversations/conversation.controller.ts`
- 后端服务：`server/src/modules/conversations/conversation.service.ts`
- 能力包括：会话列表、创建、详情、重命名、置顶、删除。
- 前端主页面：`web/src/views/ChatView.vue`
- 前端会话列表组件：`web/src/components/chat/ConversationList.vue`
- 前端聊天状态管理：`web/src/stores/chat.ts`
- 前端会话 API：`web/src/api/chat.ts`

### 3. 会话上下文记忆
- 短期上下文不是单独存表，而是从当前会话历史消息中读取。
- 关键实现：`server/src/modules/messages/message.service.ts` 中的 `loadMessageGenerationContext()`。
- 会话历史消息表：`server/prisma/schema.prisma` 中的 `Message`
- 组装模型输入：`server/src/lib/ai.ts` 中的 `buildLangChainMessages()`。
- 当前实现会把“当前会话历史 + 用户长期记忆”一起送入模型。

### 4. 会话流式输出 / 停止 / 恢复
- 后端路由：`server/src/modules/messages/message.routes.ts`
- 后端控制器：`server/src/modules/messages/message.controller.ts`
- 后端核心服务：`server/src/modules/messages/message.service.ts`
- SSE 工具：`server/src/utils/sse.ts`
- 已支持：
- `POST /conversations/:conversationId/messages/stream` 发起流式生成
- `GET /conversations/:conversationId/messages/:messageId/stream` 订阅/恢复已有流
- `POST /conversations/:conversationId/messages/:messageId/cancel` 停止生成
- 前端流式解析与 SSE 事件处理：`web/src/api/chat.ts`
- 前端流状态管理、断流恢复、停止生成：`web/src/stores/chat.ts`
- 前端展示：`web/src/components/chat/MessageList.vue`、`web/src/components/chat/MessageComposer.vue`

### 5. 长期记忆管理
- 记忆数据模型：`server/prisma/schema.prisma` 中的 `Memory`
- 后端路由：`server/src/modules/memories/memory.routes.ts`
- 后端控制器：`server/src/modules/memories/memory.controller.ts`
- 后端服务：`server/src/modules/memories/memory.service.ts`
- 记忆类型：`profile | preference | summary | fact`
- 后端已支持：记忆列表、查询过滤、创建、更新、删除。
- 前端页面：`web/src/views/MemoryView.vue`
- 前端状态管理：`web/src/stores/memory.ts`
- 前端 API：`web/src/api/memory.ts`
- 前端类型：`web/src/types/memory.ts`
- 当前前端实际已接入的是“列表/统计/删除”；`web/src/components/memory/MemoryFormDialog.vue` 已存在，但页面里暂未接入新增/编辑流程。

### 6. 自动长期记忆提取
- 触发点：`server/src/modules/messages/message.service.ts`
- 在消息完成后会异步调用 `scheduleUserMemoryExtraction()`。
- LangGraph 编排：`server/src/lib/memory-graph.ts`
- 候选记忆提取：`server/src/lib/ai.ts` 中的 `generateMemoryCandidates()`
- 最终写入数据库：`server/src/modules/memories/memory.service.ts` 中的 `applyAutoMemoryActions()`
- 当前逻辑会做：候选提取、同 key 冲突判断、create/update/skip 决策、持久化。

### 7. LLM 切换
- 模型列表定义：`server/src/lib/models.ts`
- 用户偏好字段：`server/prisma/schema.prisma` 中的 `User.preferredModel`
- 后端路由：`server/src/modules/model-preferences/model-preference.routes.ts`
- 后端控制器：`server/src/modules/model-preferences/model-preference.controller.ts`
- 后端服务：`server/src/modules/model-preferences/model-preference.service.ts`
- 模型实际使用入口：`server/src/modules/messages/message.service.ts` 里的 `getModelNameForLLM()`，以及 `server/src/lib/ai.ts` 里的 `getBaseChatModel()` / `getChatModel()`。
- 前端模型切换 UI：`web/src/views/ChatView.vue`
- 前端 API：`web/src/api/model-preference.ts`
- 前端类型：`web/src/types/chat.ts` 中的 `ModelInfo`

### 8. MCP & Tools
- MCP 客户端封装：`server/src/lib/mcp.ts`
- 工具定义入口：`server/src/lib/tools/tools.ts`
- 工具-联网查询：`server/src/lib/tools/webSearch.ts`
- 工具-画图：`server/src/lib/tools/drawImage.ts`
- AI 工具调用主逻辑：`server/src/lib/ai.ts`
- 环境变量说明：`server/src/config/env.ts`，以及本文件前面的 `DASHSCOPE_API_KEY` / `MCP_SERVERS` 说明。

### 9. 前端页面与主入口
- 前端入口：`web/src/main.ts`
- 根组件：`web/src/App.vue`
- 路由：`web/src/router/index.ts`
- 聊天页：`web/src/views/ChatView.vue`
- 记忆页：`web/src/views/MemoryView.vue`
- 登录页：`web/src/views/LoginView.vue`
- 注册页：`web/src/views/RegisterView.vue`

### 10. 后端主入口与基础设施
- 服务启动入口：`server/src/main.ts`
- Express app：`server/src/app.ts`
- Prisma 客户端：`server/src/lib/prisma.ts`
- 环境变量：`server/src/config/env.ts`
- 错误处理中间件：`server/src/middlewares/error.ts`
- 参数校验中间件：`server/src/middlewares/validate.ts`
- HTTP 返回封装：`server/src/utils/http.ts`

### 11. 语音转文字（语音输入）
- 流程：前端录制音频 → `POST /audio/transcribe` → 后端转写 → 文字回显到输入框，用户确认后手动发送（不自动提交）。
- ASR 模型：`qwen3-asr-flash`，通过 DashScope OpenAI 兼容接口调用。
- 后端核心：`server/src/lib/audio.ts` 中的 `transcribeAudio()`。
- 三层无效语音过滤：
  - **尺寸过滤**：音频 < 2KB 直接拒绝（`AUDIO_TOO_SHORT`）
  - **VAD 检测**：请求中带 `enable_voice_detection: true`，依赖模型内置语音活动检测
  - **文本校验**：`isValidSpeech()` 过滤空结果、单字语气词（啊/呃/嗯/咳等）、重复无意义音节
- 后端路由：`server/src/modules/messages/message.routes.ts` → `POST /conversations/:conversationId/messages/audio/transcribe`
- 后端控制器：`server/src/modules/messages/message.controller.ts` → `transcribeAudioController()`
- 前端 API：`web/src/api/chat.ts` → `transcribeAudio()`
- 前端录音组件：`web/src/components/chat/MessageComposer.vue` → `submitRecording()` 调用转写 API，结果填入 `content`
- 前端录音 UI 在 `MessageComposer.vue`，使用 `MediaRecorder` + `getUserMedia`。
- 注意：旧的流式语音上传（`POST /audio`）和 `sendAudioMessageAction` 已移除，不再使用。

### 12. 消息编辑/删除
- 编辑流程：前端限制仅最后一条用户消息可编辑 → `PATCH /conversations/:conversationId/messages/:messageId` → 后端原子性更新内容 + 删除该消息之后的全部消息 → 前端自动截断本地列表并调用 `regenerate` 重新生成 AI 回复。
- 删除：任何非生成中的消息均可删除，确认弹窗后调用 `DELETE /conversations/:conversationId/messages/:messageId`，仅删除单条。
- **编辑权限（前端）**：`web/src/components/chat/MessageList.vue` 中的 `canEdit()`，只有 `messages` 数组中最后一条 `role === 'user'` 的消息才显示编辑按钮。
- 后端核心服务：`server/src/modules/messages/message.service.ts` → `updateMessage()`（编辑+删后续）、`regenerateMessage()`（基于已编辑消息新建 assistant 并流式输出）。
- 后端新增路由：
  - `PATCH /:messageId` — 编辑消息（限 user 角色、completed 状态）
  - `DELETE /:messageId` — 删除单条消息
  - `POST /:messageId/regenerate` — SSE 流式重新生成（用于编辑后自动调用）
- 前端 API：`web/src/api/chat.ts` → `updateMessage()`、`deleteMessage()`、`regenerateMessage()`（SSE）。
- 前端状态管理：`web/src/stores/chat.ts` → `chatStore.updateMessage()` 编排编辑→截断→重新生成的完整流程。
- 前端消息列表：`web/src/components/chat/MessageList.vue` → 编辑（内联 textarea + 保存/取消）、删除（hover 图标按钮；触摸设备常驻）。

### 13. 会话重命名
- 侧边栏会话列表原本并排放置"置顶"和"删除"两个按钮，现改为单个「更多」按钮（`MoreFilled` 图标），点击展开浮层菜单：`置顶/取消置顶`、`重命名`、`删除`。
- 点击"重命名" → 自动聚焦 + 全选当前标题 → 内联输入框，回车或失焦提交，Esc 取消。
- 后端 API 无新增（沿用已有的 `PATCH /api/conversations/:conversationId`）。
- 前端组件：`web/src/components/chat/ConversationList.vue` → `startRename()` + `submitRename()`，`nextTick` 中 auto-focus。
- 前端事件链路：`ConversationList @rename` → `ChatView handleRenameConversation` → `chatStore.renameConversation()`。

## 修改原则
- 不要手改生成产物，除非这次改动就是要调整生成结果本身。
- 尽量保持在现有的 `server/web` 边界内改动，功能通常只属于其中一个应用。
