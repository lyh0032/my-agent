<template>
  <div class="memory-page">
    <header class="memory-page__header">
      <div>
        <span class="memory-page__eyebrow">Long-term Context</span>
        <h1>记忆管理</h1>
      </div>
      <div class="memory-page__actions">
        <el-button plain @click="router.push('/chat')">返回聊天</el-button>
        <el-button type="primary" @click="openCreateDialog">新增记忆</el-button>
      </div>
    </header>

    <section class="memory-page__toolbar">
      <el-select v-model="filters.type" clearable placeholder="按类型筛选" @change="reload">
        <el-option label="Profile" value="profile" />
        <el-option label="Preference" value="preference" />
        <el-option label="Summary" value="summary" />
        <el-option label="Fact" value="fact" />
      </el-select>
      <el-input v-model="filters.search" placeholder="搜索 key 或内容" @change="reload" />
    </section>

    <section class="memory-page__content">
      <el-table :data="memoryStore.memories" stripe>
        <el-table-column prop="type" label="类型" width="140" />
        <el-table-column prop="key" label="Key" width="220" />
        <el-table-column prop="content" label="内容" min-width="360" show-overflow-tooltip />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <MemoryFormDialog
      :model-value="dialogVisible"
      :initial-value="editingMemory"
      :title="editingMemory ? '编辑记忆' : '新增记忆'"
      @close="closeDialog"
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import MemoryFormDialog from '../components/memory/MemoryFormDialog.vue'
import { useMemoryStore } from '../stores/memory'
import type { CreateMemoryInput, MemoryRecord, MemoryType } from '../types/memory'

const router = useRouter()
const memoryStore = useMemoryStore()

const filters = reactive<{ type?: MemoryType; search?: string }>({})
const dialogVisible = ref(false)
const editingMemory = ref<MemoryRecord | null>(null)

onMounted(async () => {
  await memoryStore.loadMemories({})
})

async function reload() {
  await memoryStore.loadMemories({
    type: filters.type,
    search: filters.search?.trim() || undefined
  })
}

function openCreateDialog() {
  editingMemory.value = null
  dialogVisible.value = true
}

function openEditDialog(memory: MemoryRecord) {
  editingMemory.value = memory
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}

async function handleSubmit(payload: CreateMemoryInput) {
  if (editingMemory.value) {
    await memoryStore.updateMemory(editingMemory.value.id, payload)
  } else {
    await memoryStore.createMemory(payload)
  }

  closeDialog()
}

async function handleDelete(memoryId: string) {
  await memoryStore.deleteMemory(memoryId)
}
</script>

<style scoped>
.memory-page {
  min-height: 100vh;
  padding: 32px;
  display: grid;
  gap: 20px;
}

.memory-page__header,
.memory-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.memory-page__actions {
  display: flex;
  gap: 12px;
}

.memory-page__eyebrow {
  display: inline-block;
  margin-bottom: 8px;
  color: #8c5c2a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.memory-page h1 {
  margin: 0;
}

.memory-page__content {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(18, 52, 88, 0.08);
  border-radius: 24px;
  padding: 16px;
}
</style>
