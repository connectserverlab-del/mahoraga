export const DEFAULT_MAHORAGA_API_URL = 'https://api.mahoraga.com'

/** Resolves and validates the Mahoraga API base URL for runtime and build config. */
export function parseMahoragaApiUrl(value: string | undefined): string {
  const rawUrl = value?.trim() || DEFAULT_MAHORAGA_API_URL
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(
      'VITE_PUBLIC_MAHORAGA_API must be a valid URL including http:// or https://',
    )
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_PUBLIC_MAHORAGA_API must use http:// or https://')
  }

  return url.toString().replace(/\/$/, '')
}
