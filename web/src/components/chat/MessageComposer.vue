<template>
  <div class="composer">
    <el-input
      v-model="content"
      class="composer__input"
      type="textarea"
      resize="none"
      placeholder="输入问题，回车发送，Shift + 回车换行，聊天消息会自动保存到当前会话"
      :autosize="{ minRows: 2, maxRows: 5 }"
      @keydown.enter.exact.prevent="handleSubmit"
    />

    <div class="composer__actions">
      <span class="composer__hint">Shift + Enter 换行</span>
      <el-button
        class="composer__send"
        type="primary"
        circle
        :icon="Promotion"
        :loading="loading"
        :disabled="!canSubmit"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Promotion } from '@element-plus/icons-vue'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [content: string]
}>()

const content = ref('')

const canSubmit = computed(() => content.value.trim().length > 0 && props.loading !== true)

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
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 120px;
  overflow: hidden;
  padding: 16px;
  border: 1px solid rgba(18, 52, 88, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(18, 52, 88, 0.08), 0 6px 14px rgba(18, 52, 88, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

  &:focus-within {
    border-color: rgba(18, 52, 88, 0.22);
    box-shadow: 0 22px 48px rgba(18, 52, 88, 0.12), 0 0 0 4px rgba(18, 52, 88, 0.06);
    transform: translateY(-1px);
  }
}

.composer__input {
  display: block;
  flex: 1;
  width: 100%;

  :deep(.el-textarea) {
    display: block;
  }

  :deep(.el-textarea__inner) {
    min-height: 0 !important;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    border: none !important;
    color: #142235;
    line-height: 1.7;
    font-size: 15px;

    &::placeholder {
      color: #8f99a8;
    }
  }
}

.composer__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.composer__hint {
  color: #7c8798;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.composer__send {
  border: 0;
  box-shadow: 0 10px 20px rgba(18, 52, 88, 0.2);

  &:not(.is-disabled) {
    background: linear-gradient(135deg, #123458 0%, #275d90 100%);
  }

  &.is-disabled {
    box-shadow: none;
    background: #d7dce4;
  }

  :deep(.el-icon) {
    font-size: 16px;
  }
}

@media (max-width: 640px) {
  .composer {
    min-height: 120px;
    padding: 16px;
    border-radius: 24px;
  }

  .composer__actions {
    right: 14px;
    bottom: 12px;
  }

  .composer__hint {
    display: none;
  }
}
</style>
