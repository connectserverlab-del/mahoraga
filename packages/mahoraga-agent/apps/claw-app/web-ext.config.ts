import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWebExtConfig } from 'wxt'

const env = process.env
const configDir = dirname(fileURLToPath(import.meta.url))

/**
 * Returns a worktree+package-scoped Chromium profile so two dev runs
 * never share state (this extension vs the agent extension; one
 * worktree vs another with the same basename).
 *
 * Label = worktree dir basename (eg. feat-foo-bar)
 * Key   = 8-char sha256 of this package's directory
 * Result: /tmp/mahoraga-dev-<label>-<key>
 */
function defaultChromiumProfile(): string {
  const worktreeRoot = resolve(configDir, '../../../..')
  const label = sanitizeProfileLabel(basename(worktreeRoot)) || 'repo'
  const key = createHash('sha256').update(configDir).digest('hex').slice(0, 8)
  return join(tmpdir(), `mahoraga-dev-${label}-${key}`)
}

function sanitizeProfileLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Honors an explicit MAHORAGA_USER_DATA_DIR override; otherwise
 * falls back to the worktree-scoped default. Either way the dir is
 * created up-front so Chromium doesn't refuse to start.
 */
function chromiumProfile(): string {
  const configured = env.MAHORAGA_USER_DATA_DIR?.trim()
  const profile = configured || defaultChromiumProfile()
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
  // The dev Mahoraga binary ships an MCP server on port 9100; this
  // package brings its own (@mahoraga/claw-server on 9200),
  // so disable the bundled one to avoid port + behaviour drift.
  '--disable-mahoraga-server',
  '--disable-mahoraga-extensions',
  '--mahoraga-dock-icon=dev',
  `--mahoraga-product=${mahoragaProduct('browserclaw')}`,
]

if (env.MAHORAGA_CLAW_CDP_PORT) {
  chromiumArgs.push(`--remote-debugging-port=${env.MAHORAGA_CLAW_CDP_PORT}`)
}
if (env.MAHORAGA_SERVER_PORT) {
  chromiumArgs.push(`--mahoraga-mcp-port=${env.MAHORAGA_SERVER_PORT}`)
  chromiumArgs.push(`--mahoraga-server-port=${env.MAHORAGA_SERVER_PORT}`)
  // --disable-mahoraga-server means no proxy is running, so proxy
  // port falls back to server port.
  chromiumArgs.push(`--mahoraga-proxy-port=${env.MAHORAGA_SERVER_PORT}`)
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
