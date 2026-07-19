import { getMahoragaAdapter } from '@/lib/mahoraga/adapter'

const versions = {
  extension: null as string | null,
  chromium: null as string | null,
  mahoraga: null as string | null,
}

const adapter = getMahoragaAdapter()
adapter
  .getVersion()
  .then((v) => {
    versions.chromium = v
  })
  .catch(() => {})
adapter
  .getMahoragaVersion()
  .then((v) => {
    versions.mahoraga = v
  })
  .catch(() => {})

/** @public */
export function track(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!versions.extension) {
    versions.extension = chrome.runtime.getManifest().version
  }

  adapter
    .logMetric(eventName, {
      extension_version: versions.extension,
      ...(versions.chromium && { chromium_version: versions.chromium }),
      ...(versions.mahoraga && { mahoraga_version: versions.mahoraga }),
      ...properties,
    })
    .catch(() => {})
}
