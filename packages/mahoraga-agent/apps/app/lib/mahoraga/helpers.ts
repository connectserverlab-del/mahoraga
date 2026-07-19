import { getMahoragaAdapter } from './adapter'
import { MAHORAGA_PREFS } from './prefs'

class McpPortError extends Error {
  constructor() {
    super('MCP server port not configured.')
    this.name = 'McpPortError'
  }
}

/**
 * Returns the local Mahoraga server base URL for chat and agent APIs.
 * Mahoraga publishes this through the unified MCP/server-port preference.
 */
export async function getAgentServerUrl(): Promise<string> {
  const port = await getMcpPort()
  return `http://127.0.0.1:${port}`
}

async function getMcpPort(): Promise<number> {
  try {
    const adapter = getMahoragaAdapter()
    const pref = await adapter.getPref(MAHORAGA_PREFS.MCP_PORT)

    if (pref?.value && typeof pref.value === 'number') {
      return pref.value
    }
  } catch {
    // Mahoraga API not available
  }

  throw new McpPortError()
}

/** Returns the MCP proxy endpoint for local server connections. */
export async function getMcpServerUrl(): Promise<string> {
  const port = await getProxyPort()
  return `http://127.0.0.1:${port}/mcp`
}

class ProxyPortError extends Error {
  constructor() {
    super('Proxy server port not configured.')
    this.name = 'ProxyPortError'
  }
}

export async function getProxyPort(): Promise<number> {
  try {
    const adapter = getMahoragaAdapter()
    const pref = await adapter.getPref(MAHORAGA_PREFS.PROXY_PORT)

    if (pref?.value && typeof pref.value === 'number') {
      return pref.value
    }
  } catch {
    // Mahoraga API not available
  }

  throw new ProxyPortError()
}

/** Returns the MCP proxy health-check endpoint. */
export async function getHealthCheckUrl(): Promise<string> {
  const port = await getProxyPort()
  return `http://127.0.0.1:${port}/system/health`
}
