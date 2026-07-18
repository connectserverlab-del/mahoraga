/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CustomMcpServer } from '@mahoraga/shared/schemas/browser-context'
import type { McpServerSpec } from './buildAcpxProvider'
import {
  type BuildMahoragaSelfMcpOptions,
  buildMahoragaSelfMcpEntry,
} from './buildMahoragaSelfMcp'

export interface BuildAcpMcpServersOptions
  extends BuildMahoragaSelfMcpOptions {
  /**
   * User-configured external MCP servers from `browserContext.customMcpServers`.
   * Each entry becomes its own `http` entry in the returned array. Names are
   * preserved as the user typed them; Mahoraga's own entry is prepended so
   * it wins on duplicate names (matches agent-company's precedence rule).
   */
  customMcpServers?: ReadonlyArray<CustomMcpServer>
}

/**
 * Assemble the full `mcpServers` array passed to `buildAcpxProvider` for
 * ACP-backed providers. Mahoraga's own MCP route is always first; user-
 * configured entries follow.
 */
export function buildAcpMcpServers(
  opts: BuildAcpMcpServersOptions,
): McpServerSpec[] {
  const out: McpServerSpec[] = [buildMahoragaSelfMcpEntry(opts)]
  for (const server of opts.customMcpServers ?? []) {
    out.push({
      type: 'http',
      name: server.name,
      url: server.url,
      headers: [],
    })
  }
  return out
}
