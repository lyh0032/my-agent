<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, RouterLink } from 'vue-router'

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
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.auth-card {
  width: min(100%, 480px);
  border-radius: 28px;

  &-intro {
    margin-bottom: 20px;

    h1 {
      margin: 0 0 8px;
    }

    p {
      margin: 0;
      color: #5f6774;
    }
  }

  &-eyebrow {
    display: inline-block;
    margin-bottom: 12px;
    color: #8c5c2a;
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
    color: #5f6774;
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
