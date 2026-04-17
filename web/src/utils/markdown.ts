import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

export type MarkdownImageAsset = {
  alt: string
  url: string
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

export function extractMarkdownImages(content: string): MarkdownImageAsset[] {
  const images: MarkdownImageAsset[] = []

  for (const match of content.matchAll(markdownImagePattern)) {
    const [, alt = '', url = '', title] = match

    if (!url) {
      continue
    }

    images.push({
      alt,
      url,
      title
    })
  }

  return images
}

export function stripMarkdownImages(content: string) {
  return content
    .replace(markdownImagePattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
