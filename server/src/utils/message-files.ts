import type { Message as PrismaMessage } from '@prisma/client'

export type MessageFile = {
  name: string
  url: string
  kind: 'image' | 'file'
}

export type ClientMessage = PrismaMessage & {
  fileList: MessageFile[]
}

const markdownImagePattern = /!\[(.*?)\]\((https?:\/\/[^\s)]+)(?:\s+"(.*?)")?\)/g
const markdownLinkPattern = /\[(.*?)\]\((https?:\/\/[^\s)]+)(?:\s+"(.*?)")?\)/g
const directUrlPattern = /https?:\/\/[^\s)]+/g
const imageExtensionPattern = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:$|[?#])/i

function getFileNameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const fileName = parsedUrl.pathname.split('/').pop() || ''
    return decodeURIComponent(fileName) || 'file'
  } catch {
    return 'file'
  }
}

function getFileKind(url: string): MessageFile['kind'] {
  return imageExtensionPattern.test(url) ? 'image' : 'file'
}

function pushUniqueFile(target: MessageFile[], file: MessageFile) {
  if (target.some((item) => item.url === file.url)) {
    return
  }

  target.push(file)
}

export function extractFileListFromContent(content: string): MessageFile[] {
  const fileList: MessageFile[] = []

  for (const match of content.matchAll(markdownImagePattern)) {
    const [, alt = '', url = ''] = match

    if (!url) {
      continue
    }

    pushUniqueFile(fileList, {
      name: alt || getFileNameFromUrl(url),
      url,
      kind: 'image'
    })
  }

  for (const match of content.matchAll(markdownLinkPattern)) {
    const [, text = '', url = ''] = match

    if (!url) {
      continue
    }

    pushUniqueFile(fileList, {
      name: text || getFileNameFromUrl(url),
      url,
      kind: getFileKind(url)
    })
  }

  for (const match of content.matchAll(directUrlPattern)) {
    const [url = ''] = match

    if (!url) {
      continue
    }

    pushUniqueFile(fileList, {
      name: getFileNameFromUrl(url),
      url,
      kind: getFileKind(url)
    })
  }

  return fileList
}

export function serializeMessageForClient(message: PrismaMessage): ClientMessage {
  return {
    ...message,
    fileList: extractFileListFromContent(message.content)
  }
}
