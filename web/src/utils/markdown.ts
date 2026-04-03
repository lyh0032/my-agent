import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

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
