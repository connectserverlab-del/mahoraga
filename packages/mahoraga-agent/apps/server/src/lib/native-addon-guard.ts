const NATIVE_ADDON_DISABLED_MESSAGE =
  'Mahoraga server disables native addon loading in compiled production builds'

interface GuardedProcess extends NodeJS.Process {
  __mahoragaNativeAddonGuardInstalled?: boolean
}

/** Blocks native addons before Bun can extract bundled `.node` files. */
export function installNativeAddonGuard(): void {
  const guardedProcess = process as GuardedProcess
  if (guardedProcess.__mahoragaNativeAddonGuardInstalled) return

  const guard: NodeJS.Process['dlopen'] = () => {
    throw new Error(NATIVE_ADDON_DISABLED_MESSAGE)
  }

  process.dlopen = guard
  guardedProcess.__mahoragaNativeAddonGuardInstalled = true
}
