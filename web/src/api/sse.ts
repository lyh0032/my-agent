export type SseEvent = {
  event: string
  data: unknown
}

function findSseBoundary(buffer: string): { index: number; length: number } | null {
  const crlfBoundaryIndex = buffer.indexOf('\r\n\r\n')

  if (crlfBoundaryIndex >= 0) {
    return {
      index: crlfBoundaryIndex,
      length: 4
    }
  }

  const lfBoundaryIndex = buffer.indexOf('\n\n')

  if (lfBoundaryIndex >= 0) {
    return {
      index: lfBoundaryIndex,
      length: 2
    }
  }

  return null
}

function parseSseEvent(chunk: string): SseEvent | null {
  const lines = chunk.split(/\r?\n/).filter(Boolean)

  if (lines.length === 0) {
    return null
  }

  const event =
    lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim() ?? 'message'
  const dataText = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  return {
    event,
    data: dataText ? JSON.parse(dataText) : null
  }
}

export async function consumeSseStream(
  response: Response,
  onEvent: (event: SseEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error('流式响应体为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const boundary = findSseBoundary(buffer)

      if (!boundary) {
        break
      }

      const rawEvent = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)

      const parsed = parseSseEvent(rawEvent)

      if (parsed) {
        onEvent(parsed)
      }
    }
  }

  const remainingEvent = parseSseEvent(buffer.trim())

  if (remainingEvent) {
    onEvent(remainingEvent)
  }
}
