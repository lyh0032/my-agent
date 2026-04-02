<template>
  <div class="message-list" ref="listRef">
    <div v-if="messages.length === 0" class="message-list__empty">
      <h3>开始一段新对话</h3>
      <p>输入你的问题，系统会保存会话和消息历史。</p>
    </div>
    <div v-else class="message-list__items">
      <article
        v-for="message in messages"
        :key="message.id"
        class="message-bubble"
        :class="`message-bubble--${message.role}`"
      >
        <span class="message-bubble__role">{{ roleLabelMap[message.role] }}</span>
        <p>
          {{ message.content
          }}<span v-if="showStreamingCursor(message)" class="message-bubble__cursor"></span>
        </p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import type { Message } from '../../types/chat'

const listRef = ref<HTMLDivElement>()

const props = defineProps<{
  messages: Message[]
  streaming?: boolean
}>()

defineExpose({
  scrollToBottom(isSmooth = true) {
    console.log(listRef.value)
    if (listRef.value) {
      scrollToBottom(listRef.value, isSmooth)
    }
  }
})

const roleLabelMap = {
  user: '你',
  assistant: '助手',
  system: '系统'
} as const

function showStreamingCursor(message: Message) {
  return (
    props.streaming === true &&
    message.role === 'assistant' &&
    props.messages[props.messages.length - 1]?.id === message.id
  )
}

function scrollToBottom(element: HTMLElement, isSmooth = true) {
  let target = element

  const scrollHeight = target.scrollHeight

  if ('scrollTo' in target) {
    try {
      target.scrollTo({
        top: scrollHeight,
        behavior: isSmooth ? 'smooth' : 'auto'
      })
      return // 成功执行则退出
    } catch (e) {
      console.warn('平滑滚动不支持或出错，降级为直接滚动', e)
    }
  }

  target.scrollTop = scrollHeight
}
</script>

<style scoped>
.message-list {
  height: 100%;
  overflow: auto;
  padding: 0 16px;
}

.message-list__empty {
  min-height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  color: #5f6774;
}

.message-list__items {
  display: grid;
  gap: 16px;
}

.message-bubble {
  max-width: 760px;
  padding: 16px 18px;
  border-radius: 20px;
  background: #f4f7fb;
  color: #142235;
}

.message-bubble--user {
  margin-left: auto;
  background: #123458;
  color: #fff;
}

.message-bubble--assistant {
  margin-right: auto;
}

.message-bubble--system {
  margin: 0 auto;
  background: #fff2cf;
}

.message-bubble__role {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.message-bubble p {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
}

.message-bubble__cursor {
  display: inline-block;
  width: 0.7ch;
  height: 1.1em;
  margin-left: 2px;
  transform: translateY(2px);
  background: currentColor;
  animation: blink 1s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
