import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

const MCP_PORT_PREF = 'mahoraga.server.mcp_port'
const PROXY_PORT_PREF = 'mahoraga.server.proxy_port'
let originalChrome: typeof globalThis.chrome | undefined

function readPref(name: string): { value: unknown } {
  if (name === MCP_PORT_PREF) return { value: 9105 }
  if (name === PROXY_PORT_PREF) return { value: 9106 }
  return { value: null }
}

mock.module('./prefs', () => ({
  MAHORAGA_PREFS: {
    MCP_PORT: MCP_PORT_PREF,
    PROVIDERS: 'mahoraga.providers',
    THIRD_PARTY_LLM_PROVIDERS: 'mahoraga.third_party_llm.providers',
    PROXY_PORT: PROXY_PORT_PREF,
    SERVER_PORT: 'mahoraga.server.server_port',
    ALLOW_REMOTE_MCP: 'mahoraga.server.allow_remote_in_mcp',
    RESTART_SERVER: 'mahoraga.server.restart_requested',
    SHOW_LLM_CHAT: 'mahoraga.show_llm_chat',
    SHOW_TOOLBAR_LABELS: 'mahoraga.show_toolbar_labels',
    VERTICAL_TABS_ENABLED: 'mahoraga.vertical_tabs_enabled',
    INSTALL_ID: 'mahoraga.metrics_install_id',
  },
}))

mock.module('./adapter', () => ({
  MahoragaAdapter: {
    getInstance: () => ({
      getPref: async (name: string) => readPref(name),
      getMahoragaVersion: async () => null,
    }),
  },
  getMahoragaAdapter: () => ({
    getPref: async (name: string) => readPref(name),
  }),
}))

describe('Mahoraga helper URLs', () => {
  beforeEach(() => {
    originalChrome = globalThis.chrome
    Object.assign(globalThis, {
      chrome: {
        ...originalChrome,
        mahoraga: {
          ...originalChrome?.mahoraga,
          getPref: (
            name: string,
            resolve: (result: { value: unknown }) => void,
          ) => {
            resolve(readPref(name))
          },
        },
      },
    })
  })

  afterEach(() => {
    if (originalChrome) {
      Object.assign(globalThis, { chrome: originalChrome })
      return
    }
    Reflect.deleteProperty(globalThis, 'chrome')
  })

  it('uses the Mahoraga MCP port as the server URL', async () => {
    const { getAgentServerUrl } = await import('./helpers')

    await expect(getAgentServerUrl()).resolves.toBe('http://127.0.0.1:9105')
  })

  it('uses the Mahoraga proxy port for MCP requests', async () => {
    const { getMcpServerUrl } = await import('./helpers')

    await expect(getMcpServerUrl()).resolves.toBe('http://127.0.0.1:9106/mcp')
  })

  it('uses the Mahoraga proxy port for health checks', async () => {
    const { getHealthCheckUrl } = await import('./helpers')

    await expect(getHealthCheckUrl()).resolves.toBe(
      'http://127.0.0.1:9106/system/health',
    )
  })
})
