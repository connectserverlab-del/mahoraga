import { getMahoragaAdapter } from '@/lib/mahoraga/adapter'
import { MAHORAGA_PREFS } from '@/lib/mahoraga/prefs'

/** @public */
export interface LlmHubProvider {
  name: string
  url: string
}

export async function loadProviders(): Promise<LlmHubProvider[]> {
  try {
    const adapter = getMahoragaAdapter()
    const providersPref = await adapter.getPref(
      MAHORAGA_PREFS.THIRD_PARTY_LLM_PROVIDERS,
    )
    return (providersPref?.value as LlmHubProvider[]) || []
  } catch {
    return []
  }
}

export async function saveProviders(
  providers: LlmHubProvider[],
): Promise<boolean> {
  try {
    const adapter = getMahoragaAdapter()
    return await adapter.setPref(
      MAHORAGA_PREFS.THIRD_PARTY_LLM_PROVIDERS,
      providers,
    )
  } catch {
    return false
  }
}

export function getFaviconUrl(url: string, size = 128): string | undefined {
  try {
    const normalized = url.trim()
    if (!normalized) return undefined
    const parsed = new URL(
      normalized.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)
        ? normalized
        : `https://${normalized}`,
    )
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=${size}`
  } catch {
    return undefined
  }
}
