/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { McpServerSpec } from './buildAcpxProvider'

const MAHORAGA_SELF_MCP_NAME = 'mahoraga'
const MANAGED_MCP_SERVERS_HEADER = 'X-Mahoraga-Managed-Mcp-Servers'

export interface BuildMahoragaSelfMcpOptions {
  /** Port the Mahoraga HTTP server is bound to. */
  serverPort: number
  /**
   * Per-conversation isolation token forwarded as `X-Mahoraga-Scope-Id`
   * so concurrent conversations never see each other's tool state.
   */
  conversationId: string
  /** Provider id forwarded as `X-Mahoraga-Agent-Id` for audit logs. */
  providerId: string
  /**
   * Active window the agent should default to when a tool that takes a
   * `windowId` is called without one. Sourced from the request's
   * `browserContext.windowId`.
   */
  defaultWindowId?: number
  /**
   * Same idea for tab groups. Not used in v1 (Mahoraga doesn't allocate
   * per-conversation tab groups today), but threaded through so a later
   * commit can populate it without changing this signature.
   */
  defaultTabGroupId?: string
  /** Managed Klavis connector names selected for this chat/session. */
  enabledMcpServers?: readonly string[]
}

/**
 * Build the MCP server entry that points the spawned ACP agent at
 * Mahoraga's own `/mcp` route. Mirrors `buildMahoragaMcpServers` in
 * mahoraga-ai/agent-company so the two projects stay in sync on the
 * header contract.
 */
export function buildMahoragaSelfMcpEntry(
  opts: BuildMahoragaSelfMcpOptions,
): McpServerSpec {
  const headers: Array<{ name: string; value: string }> = [
    { name: 'X-Mahoraga-Scope-Id', value: opts.conversationId },
    { name: 'X-Mahoraga-Agent-Id', value: opts.providerId },
  ]
  if (typeof opts.defaultWindowId === 'number') {
    headers.push({
      name: 'X-Mahoraga-Default-Window-Id',
      value: String(opts.defaultWindowId),
    })
  }
  if (opts.defaultTabGroupId) {
    headers.push({
      name: 'X-Mahoraga-Default-Tab-Group-Id',
      value: opts.defaultTabGroupId,
    })
  }
  if (opts.enabledMcpServers?.length) {
    headers.push({
      name: MANAGED_MCP_SERVERS_HEADER,
      value: opts.enabledMcpServers.map(encodeURIComponent).join(','),
    })
  }
  return {
    type: 'http',
    name: MAHORAGA_SELF_MCP_NAME,
    url: `http://127.0.0.1:${opts.serverPort}/mcp`,
    headers,
  }
}
