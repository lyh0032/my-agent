import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { MessageFile } from '../types/chat'

export type MarkdownImageAsset = MessageFile & {
  alt?: string
  title?: string
}

const markdownImagePattern = /!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)/g

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
})

const defaultLinkOpenRenderer =
  markdownIt.renderer.rules.link_open ??
  ((tokens: any[], idx: number, options: any, env: any, self: any) =>
    self.renderToken(tokens, idx, options))

markdownIt.renderer.rules.link_open = (
  tokens: any[],
  idx: number,
  options: any,
  env: any,
  self: any
) => {
  const token = tokens[idx]

  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')

  return defaultLinkOpenRenderer(tokens, idx, options, env, self)
}

export function renderMarkdown(content: string) {
  const html = markdownIt.render(content ?? '')
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

function renderRawHtml(content: string) {
  return markdownIt.render(content ?? '')
}

function parseRenderedHtml(html: string) {
  const parser = new DOMParser()
  return parser.parseFromString(html, 'text/html')
}

export function extractMarkdownImages(content: string): MarkdownImageAsset[] {
  const html = renderRawHtml(content)
  const document = parseRenderedHtml(html)
  const images: MarkdownImageAsset[] = []

  for (const imageElement of document.querySelectorAll('img')) {
    const url = imageElement.getAttribute('src') || ''

    if (!url) continue

    images.push({
      kind: 'image',
      alt: imageElement.getAttribute('alt') || '',
      url,
      name: imageElement.getAttribute('alt') || imageElement.getAttribute('title') || 'image',
      title: imageElement.getAttribute('title') || undefined
    })
  }

  return images
}

export function renderMarkdownWithoutFileLinks(content: string, fileList: MessageFile[] = []) {
  const document = parseRenderedHtml(renderRawHtml(content))
  const fileUrlSet = new Set(fileList.map((file) => file.url))

  for (const imageElement of document.querySelectorAll('img')) {
    imageElement.remove()
  }

  for (const anchorElement of document.querySelectorAll('a')) {
    const href = anchorElement.getAttribute('href') || ''

    if (!fileUrlSet.has(href)) {
      continue
    }

    const parentElement = anchorElement.parentElement
    anchorElement.remove()

    if (parentElement && parentElement.tagName === 'P') {
      const text = parentElement.textContent?.replace(/[👉📥\s]+/g, '').trim() || ''

      if (!text) {
        parentElement.remove()
      }
    }
  }

  for (const paragraphElement of document.querySelectorAll('p')) {
    const text = paragraphElement.textContent?.trim() || ''
    const hasMeaningfulChildren = Array.from(paragraphElement.children).some(
      (child) => child.tagName !== 'BR'
    )

    if (!text && !hasMeaningfulChildren) {
      paragraphElement.remove()
    }
  }

  return DOMPurify.sanitize(document.body.innerHTML, { USE_PROFILES: { html: true } })
}
