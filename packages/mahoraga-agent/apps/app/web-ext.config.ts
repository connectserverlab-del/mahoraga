import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWebExtConfig } from 'wxt'

// biome-ignore lint/style/noProcessEnv: config file needs env access
const env = process.env
const legacySharedProfiles = new Set([
  '/tmp/mahoraga-dev',
  '/private/tmp/mahoraga-dev',
])
const configDir = dirname(fileURLToPath(import.meta.url))

/** Returns a worktree-scoped Chromium profile for local Mahoraga dev runs. */
function defaultChromiumProfile(): string {
  const agentRoot = resolve(configDir, '../..')
  const worktreeRoot = resolve(agentRoot, '../..')
  const label = sanitizeProfileLabel(basename(worktreeRoot)) || 'repo'
  const key = createHash('sha256').update(agentRoot).digest('hex').slice(0, 8)
  return join(tmpdir(), `mahoraga-dev-${label}-${key}`)
}

function sanitizeProfileLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Honors explicit profiles but upgrades the old shared temp profile. */
function chromiumProfile(): string {
  const configured = env.MAHORAGA_USER_DATA_DIR?.trim()
  let profile: string
  if (configured && !legacySharedProfiles.has(resolve(configured))) {
    profile = configured
  } else {
    profile = defaultChromiumProfile()
  }
  mkdirSync(profile, { recursive: true })
  return profile
}

function mahoragaProduct(defaultProduct: 'mahoraga' | 'browserclaw') {
  const product = env.MAHORAGA_PRODUCT?.trim() || defaultProduct
  if (product !== 'mahoraga' && product !== 'browserclaw') {
    throw new Error(
      `MAHORAGA_PRODUCT must be mahoraga or browserclaw: ${product}`,
    )
  }
  return product
}

const chromiumArgs = [
  '--use-mock-keychain',
  '--show-component-extension-options',
  '--disable-mahoraga-server',
  '--disable-mahoraga-extensions',
  '--mahoraga-dock-icon=dev',
  `--mahoraga-product=${mahoragaProduct('mahoraga')}`,
]

if (env.MAHORAGA_CDP_PORT) {
  chromiumArgs.push(`--remote-debugging-port=${env.MAHORAGA_CDP_PORT}`)
}
if (env.MAHORAGA_SERVER_PORT) {
  chromiumArgs.push(`--mahoraga-mcp-port=${env.MAHORAGA_SERVER_PORT}`)
  chromiumArgs.push(`--mahoraga-server-port=${env.MAHORAGA_SERVER_PORT}`)
  // --disable-mahoraga-server means no proxy is running, so proxy port falls back to server port
  chromiumArgs.push(`--mahoraga-proxy-port=${env.MAHORAGA_SERVER_PORT}`)
}
if (env.MAHORAGA_EXTENSION_PORT) {
  chromiumArgs.push(
    `--mahoraga-extension-port=${env.MAHORAGA_EXTENSION_PORT}`,
  )
}

export default defineWebExtConfig({
  binaries: {
    chrome:
      env.MAHORAGA_BINARY ||
      '/Applications/Mahoraga.app/Contents/MacOS/Mahoraga',
  },
  chromiumArgs,
  chromiumProfile: chromiumProfile(),
  keepProfileChanges: true,
  startUrls: ['chrome://newtab'],
})
