<template>
  <div class="composer">
    <el-input
      v-model="content"
      type="textarea"
      :rows="4"
      resize="none"
      placeholder="输入问题，回车发送，Shift + 回车换行"
      @keydown.enter.exact.prevent="handleSubmit"
    />
    <div class="composer__actions">
      <span class="composer__hint">聊天消息会自动保存到当前会话</span>
      <el-button type="primary" :loading="loading" @click="handleSubmit">发送</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [content: string]
}>()

const content = ref('')

function handleSubmit() {
  const value = content.value.trim()

  if (!value || props.loading) {
    return
  }

  emit('submit', value)
  content.value = ''
}
</script>

<style scoped>
.composer {
  display: grid;
  gap: 12px;
}

.composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.composer__hint {
  color: #5f6774;
  font-size: 13px;
}
</style>
