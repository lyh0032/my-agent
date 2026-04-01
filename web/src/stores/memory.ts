import { ref } from 'vue'
import { defineStore } from 'pinia'

import { createMemory, deleteMemory, fetchMemories, updateMemory } from '../api/memory'
import type {
  CreateMemoryInput,
  MemoryFilters,
  MemoryRecord,
  UpdateMemoryInput
} from '../types/memory'

export const useMemoryStore = defineStore('memory', () => {
  const memories = ref<MemoryRecord[]>([])
  const filters = ref<MemoryFilters>({})
  const isLoading = ref(false)

  async function loadMemories(nextFilters: MemoryFilters = filters.value) {
    isLoading.value = true
    filters.value = nextFilters

    try {
      memories.value = await fetchMemories(nextFilters)
    } finally {
      isLoading.value = false
    }
  }

  async function createMemoryAction(input: CreateMemoryInput) {
    const memory = await createMemory(input)
    memories.value = [memory, ...memories.value]
    return memory
  }

  async function updateMemoryAction(memoryId: string, input: UpdateMemoryInput) {
    const updatedMemory = await updateMemory(memoryId, input)
    memories.value = memories.value.map((memory) =>
      memory.id === memoryId ? updatedMemory : memory
    )
    return updatedMemory
  }

  async function deleteMemoryAction(memoryId: string) {
    await deleteMemory(memoryId)
    memories.value = memories.value.filter((memory) => memory.id !== memoryId)
  }

  return {
    memories,
    filters,
    isLoading,
    loadMemories,
    createMemory: createMemoryAction,
    updateMemory: updateMemoryAction,
    deleteMemory: deleteMemoryAction
  }
})
