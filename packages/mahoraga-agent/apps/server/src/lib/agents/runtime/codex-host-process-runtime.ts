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
import {
  materializeCodexHome,
  resolveAgentRuntimePaths,
} from '../acpx/runtime-context'
import { HostProcessAgentRuntime } from './host-process-agent-runtime'
import { getAgentRuntimeRegistry } from './registry'
import type { RuntimeDescriptor } from './types'

const CODEX_BINARY = 'codex'

export interface CodexRuntimeConfig {
  mahoragaDir: string
}

export class CodexRuntime extends HostProcessAgentRuntime {
  readonly descriptor: RuntimeDescriptor & { kind: 'host-process' } = {
    adapterId: 'codex',
    displayName: 'Codex',
    kind: 'host-process',
    platforms: ['darwin', 'linux'],
  }

  private readonly codexConfig: CodexRuntimeConfig

  constructor(
    deps: ConstructorParameters<typeof HostProcessAgentRuntime>[0],
    config: CodexRuntimeConfig,
  ) {
    super(deps)
    this.codexConfig = config
  }

  getPerAgentHomeDir(agentId: string): string {
    return resolveAgentRuntimePaths({
      mahoragaDir: this.codexConfig.mahoragaDir,
      agentId,
    }).agentHome
  }

  prepareTurnContext(
    input: PrepareAcpxAgentContextInput,
  ): Promise<PreparedAcpxAgentContext> {
    return prepareCodexContext(input)
  }
}

/** Prepares Codex with a contained CODEX_HOME and Mahoraga agent home. */
export async function prepareCodexContext(
  input: PrepareAcpxAgentContextInput,
): Promise<PreparedAcpxAgentContext> {
  const common = await prepareMahoragaManagedContext(input)
  await materializeCodexHome({
    paths: common.paths,
    skillNames: common.skillNames,
  })
  return finishMahoragaManagedContext({
    ...common,
    commandEnv: {
      AGENT_HOME: common.paths.agentHome,
      CODEX_HOME: common.paths.codexHome,
    },
  })
}

export interface ConfigureCodexRuntimeOptions {
  mahoragaDir?: string
}

export function configureCodexRuntime(
  options: ConfigureCodexRuntimeOptions = {},
): CodexRuntime {
  const mahoragaDir = options.mahoragaDir ?? getMahoragaDir()
  const runtime = new CodexRuntime(
    { binaryName: CODEX_BINARY },
    { mahoragaDir },
  )
  getAgentRuntimeRegistry().register(runtime)
  logger.debug('CodexRuntime registered', { binary: CODEX_BINARY })
  return runtime
}

export function getCodexRuntime(): CodexRuntime | null {
  const r = getAgentRuntimeRegistry().get('codex')
  return r instanceof CodexRuntime ? r : null
}
