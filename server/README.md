# Server

服务端使用 Node.js + TypeScript、Express 与 Prisma，负责以下能力：

- 用户注册、登录、鉴权
- 会话与消息持久化
- 长期记忆管理
- 基于 LangChain 的阿里云 DashScope 兼容模型调用
- 普通消息接口和流式消息接口

## 当前目录

- [src/config](src/config): 环境变量与运行配置
- [src/lib](src/lib): Prisma、JWT、AI 调用封装
- [src/middlewares](src/middlewares): 认证、校验、错误处理
- [src/modules](src/modules): auth、conversations、messages、memories 模块
- [src/utils](src/utils): 错误类、异步包装、响应封装

## 环境变量

- `PORT`: 服务端端口
- `DATABASE_URL`: Prisma SQLite 连接串，默认可以直接把数据库文件放在项目里的 `server/prisma/dev.db`
- `JWT_SECRET`: JWT 签名密钥
- `DASHSCOPE_API_KEY`: 阿里云百炼 API Key
- `DASHSCOPE_BASE_URL`: DashScope OpenAI 兼容接口地址
- `DASHSCOPE_MODEL`: 默认模型名，例如 `qwen-plus`

开发环境下，如果没有手动提供 `DATABASE_URL` 和 `JWT_SECRET`，服务端会回退到本地默认值；生产环境仍然要求显式配置。

## 消息接口

- `POST /api/conversations/:conversationId/messages`: 普通同步消息接口
- `POST /api/conversations/:conversationId/messages/stream`: 基于 `text/event-stream` 的流式接口
