<script setup lang="ts">
import { reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  email: '',
  username: '',
  password: ''
})

async function handleSubmit() {
  await authStore.register({
    email: form.email.trim(),
    username: form.username.trim(),
    password: form.password
  })

  await router.push('/chat')
}
</script>

<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <div class="auth-card-intro">
        <span class="auth-card-eyebrow">Create Account</span>
        <h1>创建你的 My Agent 账号</h1>
        <p>注册后即可保存聊天历史和长期记忆。</p>
      </div>
      <el-form label-position="top" @submit.prevent="handleSubmit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 8 位" />
        </el-form-item>
        <el-button class="auth-card-submit" type="primary" @click="handleSubmit">注册</el-button>
      </el-form>
      <div class="auth-card-footer">
        已有账号？
        <RouterLink to="/login">返回登录</RouterLink>
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
  width: min(100%, 520px);
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
