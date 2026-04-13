<template>
  <div class="composer">
    <el-input
      v-model="content"
      type="textarea"
      resize="none"
      placeholder="输入问题，回车发送，Shift + 回车换行，聊天消息会自动保存到当前会话"
      @keydown.enter.exact.prevent="handleSubmit"
    />
    <el-button type="primary" :loading="loading" @click="handleSubmit">发送</el-button>
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

<style scoped lang="less">
.composer {
  height: 110px;
  display: flex;
  gap: 16px;

  .el-textarea {
    flex: 1;
    height: 100%;
    :deep(.el-textarea__inner) {
      height: 100%;
    }
  }

  .el-button {
    height: 100%;
  }
}
</style>
