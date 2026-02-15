import { request as undiciRequest } from 'undici'

export interface ForwardRequest {
  method: string
  url: string
  headers: Record<string, string | undefined>
  body: unknown
}

export interface ForwardResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

/**
 * Forwards a request to the target API.
 * Returns the response status, headers, and body.
 */
export async function forwardRequest(
  req: ForwardRequest,
): Promise<ForwardResponse> {
  // Strip hop-by-hop and internal headers
  const forwardHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase()
    if (
      lower === 'host' ||
      lower === 'x-agent-key' ||
      lower === 'x-target-url' ||
      lower === 'connection' ||
      lower === 'transfer-encoding' ||
      value === undefined
    ) {
      continue
    }
    forwardHeaders[key] = value
  }

  const response = await undiciRequest(req.url, {
    method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    headers: forwardHeaders,
    body: req.body ? JSON.stringify(req.body) : undefined,
  })

  let body: unknown
  const contentType = response.headers['content-type']
  if (typeof contentType === 'string' && contentType.includes('json')) {
    body = await response.body.json()
  } else {
    body = await response.body.text()
  }

  // Collect response headers as flat record
  const responseHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(response.headers)) {
    if (value !== undefined) {
      responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value
    }
  }

  return {
    status: response.statusCode,
    headers: responseHeaders,
    body,
  }
}
