# my-agent

一个基于 Node.js + TypeScript + Vue 3 的 AI 对话项目骨架，目标是快速落地注册、登录、会话存储、消息存储、长期记忆管理和流式聊天输出。

## 项目结构

- [server](server): Express + Prisma + SQLite 的服务端
- [web](web): Vue 3 + Vite + Pinia + Element Plus 的前端

## 一期范围

- 用户注册、登录、当前用户信息
- 会话创建、列表、详情、删除
- 消息发送、消息持久化、模型回复
- 用户记忆的创建、更新、删除、筛选
- 前端流式打印输出与后端流式接口

## 技术栈

- 服务端: Node.js, TypeScript, Express, Prisma, SQLite, JWT, Zod, LangChain, DashScope OpenAI-compatible API
- 前端: Vue 3, TypeScript, Vite, Vue Router, Pinia, Axios, Element Plus

## 快速开始

1. 安装依赖

```bash
cd server && yarn
cd ../web && yarn
```

2. 配置环境变量

- 复制 [server/.env.example](server/.env.example) 为 `server/.env`
- 复制 [web/.env.example](web/.env.example) 为 `web/.env`

3. 初始化数据库

```bash
cd server
yarn prisma:generate
yarn prisma:migrate --name init
```

默认情况下，SQLite 数据库文件会直接创建在项目中的 `server/prisma/dev.db`。

4. 配置阿里云百炼模型

- 在 `server/.env` 中设置 `DASHSCOPE_API_KEY`
- 如无特殊需求，保留默认 `DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- 模型名可先使用 `qwen-plus`

5. 启动开发环境

```bash
cd server && yarn dev
cd web && yarn dev
```
