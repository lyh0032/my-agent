<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, RouterLink } from 'vue-router'

import AnimatedBackground from '../components/AnimatedBackground.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  emailOrUsername: '',
  password: ''
})

async function handleSubmit() {
  await authStore.login({
    emailOrUsername: form.emailOrUsername.trim(),
    password: form.password
  })

  await router.push('/chat')
}
</script>

<template>
  <AnimatedBackground />
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <div class="auth-card-intro">
        <span class="auth-card-eyebrow">AI Chat Workspace</span>
        <h1>登录到 My Agent</h1>
        <p>继续查看历史会话、个性记忆和聊天记录。</p>
      </div>
      <el-form label-position="top" @submit.prevent="handleSubmit">
        <el-form-item label="邮箱或用户名">
          <el-input v-model="form.emailOrUsername" placeholder="请输入邮箱或用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
          />
        </el-form-item>
        <el-button class="auth-card-submit" type="primary" @click="handleSubmit">登录</el-button>
      </el-form>
      <div class="auth-card-footer">
        还没有账号？
        <RouterLink to="/register">立即注册</RouterLink>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="less">
.auth-page {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.auth-card {
  width: min(100%, 480px);
  border-radius: 28px;
  background: rgba(18, 20, 38, 0.65) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #e0e4f0;

  :deep(.el-form-item__label) {
    color: #b0b8d0 !important;
  }

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: none;
  }

  :deep(.el-input__inner) {
    color: #e0e4f0;
  }

  &-intro {
    margin-bottom: 20px;

    h1 {
      margin: 0 0 8px;
      color: #e8ecf8;
    }

    p {
      margin: 0;
      color: #8a94b0;
    }
  }

  &-eyebrow {
    display: inline-block;
    margin-bottom: 12px;
    color: #8c9eff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &-submit {
    width: 100%;
  }

  &-footer {
    margin-top: 20px;
    color: #8a94b0;

    a {
      color: #7a9eff;
      font-weight: 600;

      &:hover {
        color: #9ab4ff;
      }
    }
  }
}

@media (max-width: 640px) {
  .auth-page {
    padding: 16px;
  }

  .auth-card {
    border-radius: 22px;
  }
}
</style>
