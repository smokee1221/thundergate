/**
 * Proxy API base URL. The dashboard calls the proxy service for queue/audit data.
 */
const PROXY_URL = process.env.TG_PROXY_URL ?? 'http://localhost:3001'

export async function fetchFromProxy<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${PROXY_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Proxy API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}
