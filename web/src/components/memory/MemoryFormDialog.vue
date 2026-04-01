<template>
  <el-dialog :model-value="modelValue" :title="title" width="560px" @close="$emit('close')">
    <el-form label-position="top" :model="form">
      <el-form-item label="类型">
        <el-select v-model="form.type" placeholder="选择记忆类型">
          <el-option label="Profile" value="profile" />
          <el-option label="Preference" value="preference" />
          <el-option label="Summary" value="summary" />
          <el-option label="Fact" value="fact" />
        </el-select>
      </el-form-item>
      <el-form-item label="Key">
        <el-input v-model="form.key" placeholder="例如: preferred_language" />
      </el-form-item>
      <el-form-item label="内容">
        <el-input v-model="form.content" type="textarea" :rows="5" resize="none" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

import type { CreateMemoryInput, MemoryRecord } from '../../types/memory'

const props = defineProps<{
  modelValue: boolean
  initialValue?: MemoryRecord | null
  title: string
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateMemoryInput]
}>()

const form = reactive<CreateMemoryInput>({
  type: 'fact',
  key: '',
  content: ''
})

watch(
  () => props.initialValue,
  (value) => {
    form.type = value?.type ?? 'fact'
    form.key = value?.key ?? ''
    form.content = value?.content ?? ''
  },
  { immediate: true }
)

function handleSubmit() {
  emit('submit', {
    type: form.type,
    key: form.key.trim(),
    content: form.content.trim()
  })
}
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
