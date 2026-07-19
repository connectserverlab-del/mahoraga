/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getMahoragaDir } from '../../mahoraga-dir'
import { logger } from '../../logger'
import type {
  PrepareAcpxAgentContextInput,
  PreparedAcpxAgentContext,
} from '../acpx/agent-adapter'
import {
  finishMahoragaManagedContext,
  prepareMahoragaManagedContext,
} from '../acpx/agent-common'
import { resolveAgentRuntimePaths } from '../acpx/runtime-context'
import { HostProcessAgentRuntime } from './host-process-agent-runtime'
import { getAgentRuntimeRegistry } from './registry'
import type { RuntimeDescriptor } from './types'

const CLAUDE_BINARY = 'claude'

export interface ClaudeRuntimeConfig {
  mahoragaDir: string
}

export class ClaudeRuntime extends HostProcessAgentRuntime {
  readonly descriptor: RuntimeDescriptor & { kind: 'host-process' } = {
    adapterId: 'claude',
    displayName: 'Claude Code',
    kind: 'host-process',
    platforms: ['darwin', 'linux'],
  }

  private readonly claudeConfig: ClaudeRuntimeConfig

  constructor(
    deps: ConstructorParameters<typeof HostProcessAgentRuntime>[0],
    config: ClaudeRuntimeConfig,
  ) {
    super(deps)
    this.claudeConfig = config
  }

  getPerAgentHomeDir(agentId: string): string {
    return resolveAgentRuntimePaths({
      mahoragaDir: this.claudeConfig.mahoragaDir,
      agentId,
    }).agentHome
  }

  prepareTurnContext(
    input: PrepareAcpxAgentContextInput,
  ): Promise<PreparedAcpxAgentContext> {
    return prepareClaudeCodeContext(input)
  }
}

/** Prepares Claude Code with Mahoraga agent home while preserving host Claude auth. */
export async function prepareClaudeCodeContext(
  input: PrepareAcpxAgentContextInput,
): Promise<PreparedAcpxAgentContext> {
  const common = await prepareMahoragaManagedContext(input)
  return finishMahoragaManagedContext({
    ...common,
    commandEnv: {
      AGENT_HOME: common.paths.agentHome,
    },
  })
}

export interface ConfigureClaudeRuntimeOptions {
  mahoragaDir?: string
}

export function configureClaudeRuntime(
  options: ConfigureClaudeRuntimeOptions = {},
): ClaudeRuntime {
  const mahoragaDir = options.mahoragaDir ?? getMahoragaDir()
  const runtime = new ClaudeRuntime(
    { binaryName: CLAUDE_BINARY },
    { mahoragaDir },
  )
  getAgentRuntimeRegistry().register(runtime)
  logger.debug('ClaudeRuntime registered', { binary: CLAUDE_BINARY })
  return runtime
}

export function getClaudeRuntime(): ClaudeRuntime | null {
  const r = getAgentRuntimeRegistry().get('claude')
  return r instanceof ClaudeRuntime ? r : null
}
