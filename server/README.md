# Server

服务端使用 Node.js + TypeScript、Express 与 Prisma，负责以下能力：

- 用户注册、登录、鉴权
- 会话与消息持久化
- 长期记忆管理
- 基于 LangChain 的阿里云 DashScope 兼容模型调用
- 本地 LangChain tools 与可选 MCP tools 的统一注册与执行
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
- `DASHSCOPE_IMAGE_API_KEY`: 可选，单独给画图工具使用的百炼 API Key；未配置时回退到 `DASHSCOPE_API_KEY`
- `DASHSCOPE_IMAGE_BASE_URL`: 千问文生图 HTTP 接口根地址，默认北京地域 `https://dashscope.aliyuncs.com`
- `DASHSCOPE_IMAGE_MODEL`: 文生图模型，默认 `qwen-image-2.0-pro`
- `DASHSCOPE_IMAGE_SIZE`: 默认图片尺寸，格式如 `1024*1024`
- `DASHSCOPE_IMAGE_PROMPT_EXTEND`: 是否启用阿里云 prompt 扩写，默认开启
- `DASHSCOPE_IMAGE_WATERMARK`: 是否给生成图添加水印，默认关闭
- `DASHSCOPE_WEBSEARCH_MCP_URL`: 阿里云 WebSearch MCP 地址，默认已内置
- `DASHSCOPE_WEBSEARCH_ENABLED`: 是否启用内置 `webSearchTool`，默认开启
- `STORAGE_ENDPOINT`: S3 协议对象存储 endpoint，例如 `https://example-s3.your-cloud.com`
- `STORAGE_BUCKET`: 上传目标 bucket
- `STORAGE_ACCESS_KEY_ID`: 对象存储 access key
- `STORAGE_SECRET_ACCESS_KEY`: 对象存储 secret key
- `STORAGE_PUBLIC_BASE_URL`: 可公开访问的文件域名前缀，例如 `https://cdn.example.com/my-bucket`
- `STORAGE_PREFIX`: 对象 key 前缀，默认 `uploads`
- `MCP_SERVERS`: 可选，MCP server 配置，支持 JSON 对象或数组

开发环境下，如果没有手动提供 `DATABASE_URL` 和 `JWT_SECRET`，服务端会回退到本地默认值；生产环境仍然要求显式配置。

如果配置了 `DASHSCOPE_API_KEY`，服务端会自动通过阿里云 MCP 接入内置 `webSearchTool`，用于联网搜索和实时信息查询，无需你再手动写入 `MCP_SERVERS`。

画图工具使用的是阿里云千问文生图同步 HTTP 接口，生成后会先拿到一个 24 小时有效的临时图片地址；当你补齐 S3 兼容存储配置后，服务端会自动把图片下载并转存到你的对象存储上，再把可预览/可下载地址返回给前端。

S3 配置示例：

```env
DASHSCOPE_IMAGE_API_KEY=sk-xxxx
DASHSCOPE_IMAGE_BASE_URL=https://dashscope.aliyuncs.com
DASHSCOPE_IMAGE_MODEL=qwen-image-2.0-pro
DASHSCOPE_IMAGE_SIZE=1024*1024

STORAGE_ENDPOINT=https://s3.example.com
STORAGE_BUCKET=my-agent-images
STORAGE_ACCESS_KEY_ID=your-access-key
STORAGE_SECRET_ACCESS_KEY=your-secret-key
STORAGE_PUBLIC_BASE_URL=https://cdn.example.com/my-agent-images
STORAGE_PREFIX=uploads
```

`MCP_SERVERS` 推荐使用对象形式，键名即 server 名称，例如：

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
    "cwd": "/Users/lvyuhao/Desktop/my-agent/server"
  }
}
```

远程 MCP 也支持 `streamable-http`，例如：

```json
{
  "remote-search": {
    "transport": "streamable-http",
    "url": "https://example.com/mcp",
    "headers": {
      "Authorization": "Bearer <token>"
    }
  }
}
```

当前服务端方案基于 LangChain 实现 tool calling，并通过官方 `@modelcontextprotocol/sdk` 把 MCP tools 适配成 LangChain tools。对于当前这种聊天 + tool 调用场景，不需要引入 LangGraph；只有在需要复杂执行图、人工审批、持久化工作流或多阶段 agent 编排时，才建议升级。

## 消息接口

- `POST /api/conversations/:conversationId/messages`: 普通同步消息接口
- `POST /api/conversations/:conversationId/messages/stream`: 基于 `text/event-stream` 的流式接口
