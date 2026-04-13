<template>
  <div class="message-list" ref="listRef">
    <div v-if="messages.length === 0" class="message-list__empty">
      <h3>开始一段新对话</h3>
      <p>输入你的问题，系统会保存会话和消息历史。</p>
    </div>
    <template v-else>
      <article
        v-for="message in messages"
        :key="message.id"
        class="message-bubble"
        :class="`message-bubble--${message.role}`"
      >
        <span class="message-bubble__role">
          {{ roleLabelMap[message.role] }}
          <span class="message-bubble__time">{{
            dayjs(message.createdAt).format('YYYY-MM-DD HH:mm:ss')
          }}</span>
        </span>
        <div
          class="message-bubble__content"
          v-html="
            message.role !== 'user'
              ? renderedContent(message)
              : `<div style='white-space: pre-wrap;'>${message.content}</div>`
          "
        ></div>
        <span v-if="showStreamingCursor(message)" class="message-bubble__cursor"></span>
      </article>
      <article
        v-if="showThinkingBubble"
        class="message-bubble message-bubble--assistant message-bubble--thinking"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="message-bubble__role">
          {{ roleLabelMap.assistant }}
          <span class="message-bubble__time">思考中...</span>
        </span>
        <div class="message-bubble__thinking">
          <span class="message-bubble__thinking-text">正在整理回答</span>
          <span class="message-bubble__thinking-dots" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '../../types/chat'
import { renderMarkdown } from '../../utils/markdown'
import { dayjs } from 'element-plus'

const listRef = ref<HTMLDivElement>()

const props = defineProps<{
  messages: Message[]
  streaming?: boolean
}>()

defineExpose({
  scrollToBottom(isSmooth = true) {
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

const showThinkingBubble = computed(() => {
  if (props.streaming !== true || props.messages.length === 0) {
    return false
  }

  return props.messages[props.messages.length - 1]?.role !== 'assistant'
})

function renderedContent(message: Message) {
  return renderMarkdown(message.content)
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

<style scoped lang="less">
.message-list {
  flex: 1;
  width: 0;
  height: 100%;
  overflow: auto;
  padding: 16px;
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  &::-webkit-scrollbar {
    display: none;
    width: 0;
  }
}

.message-list__empty {
  display: grid;
  padding-top: 200px;
  place-items: center;
  text-align: center;
  color: #5f6774;
}

.message-bubble {
  max-width: 760px;
  max-width: 100%;
  padding: 16px 18px;
  border-radius: 20px;
  background: #d3e5ff;
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

.message-bubble--thinking {
  min-width: 220px;
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
  user-select: none;
}

.message-bubble__time {
  color: #888888;
  font-size: 10px;
}

.message-bubble__content {
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.message-bubble__content :deep(:first-child) {
  margin-top: 0;
}

.message-bubble__content :deep(:last-child) {
  margin-bottom: 0;
}

.message-bubble__content :deep(p) {
  margin: 0 0 0.85em;
}

.message-bubble__content :deep(ul),
.message-bubble__content :deep(ol) {
  margin: 0 0 0.85em;
  padding-left: 1.5em;
}

.message-bubble__content :deep(li + li) {
  margin-top: 0.35em;
}

.message-bubble__content :deep(blockquote) {
  margin: 0 0 0.85em;
  padding: 0.75em 1em;
  border-left: 4px solid rgba(18, 52, 88, 0.18);
  background: rgba(18, 52, 88, 0.05);
  border-radius: 0 12px 12px 0;
}

.message-bubble__content :deep(pre) {
  margin: 0 0 0.85em;
  padding: 14px 16px;
  overflow-x: auto;
  border-radius: 14px;
  background: rgba(12, 23, 40, 0.92);
  color: #f5f7fa;
}

.message-bubble__content :deep(code) {
  padding: 0.15em 0.35em;
  border-radius: 6px;
  background: rgba(18, 52, 88, 0.08);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.95em;
}

.message-bubble__content :deep(pre code) {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font-size: 0.92em;
}

.message-bubble__content :deep(table) {
  display: block;
  width: 100%;
  margin: 0 0 0.85em;
  overflow-x: auto;
  border-collapse: collapse;
}

.message-bubble__content :deep(th),
.message-bubble__content :deep(td) {
  padding: 10px 12px;
  border: 1px solid rgba(18, 52, 88, 0.14);
  text-align: left;
  vertical-align: top;
}

.message-bubble__content :deep(th) {
  background: rgba(18, 52, 88, 0.06);
  font-weight: 700;
}

.message-bubble__content :deep(hr) {
  margin: 1em 0;
  border: 0;
  border-top: 1px solid rgba(18, 52, 88, 0.16);
}

.message-bubble__content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
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

.message-bubble__thinking {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.message-bubble__thinking-text {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.message-bubble__thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.message-bubble__thinking-dots i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
  animation: pulse 1.2s ease-in-out infinite;
}

.message-bubble__thinking-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.message-bubble__thinking-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@keyframes pulse {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}
</style>
