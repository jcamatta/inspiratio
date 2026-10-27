/** Parses an HTTP body that may be empty or not JSON at all (proxies, HTML error pages). */
export const parseJsonBody = (text: string): unknown => {
  if (text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
