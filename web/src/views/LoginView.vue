<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <div class="auth-card__intro">
        <span class="auth-card__eyebrow">AI Chat Workspace</span>
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
        <el-button class="auth-card__submit" type="primary" @click="handleSubmit">登录</el-button>
      </el-form>
      <div class="auth-card__footer">
        还没有账号？
        <RouterLink to="/register">立即注册</RouterLink>
      </div>
    </el-card>
  </div>
</template>

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

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.auth-card {
  width: min(100%, 480px);
  border-radius: 28px;
}

.auth-card__intro {
  margin-bottom: 20px;
}

.auth-card__eyebrow {
  display: inline-block;
  margin-bottom: 12px;
  color: #8c5c2a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.auth-card__intro h1 {
  margin: 0 0 8px;
}

.auth-card__intro p {
  margin: 0;
  color: #5f6774;
}

.auth-card__submit {
  width: 100%;
}

.auth-card__footer {
  margin-top: 20px;
  color: #5f6774;
}
</style>
