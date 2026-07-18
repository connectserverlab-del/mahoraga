/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareAcpxAgentContext } from '../../../src/lib/agents/acpx/agent-adapter'
import { resolveAgentRuntimePaths } from '../../../src/lib/agents/acpx/runtime-context'
import { loadLatestRuntimeState } from '../../../src/lib/agents/acpx/runtime-state'
import type { AgentDefinition } from '../../../src/lib/agents/agent-types'

describe('prepareAcpxAgentContext', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    )
    tempDirs.length = 0
  })

  function makeAgent(adapter: AgentDefinition['adapter']): AgentDefinition {
    return {
      id: `${adapter}-agent`,
      name: `${adapter} agent`,
      adapter,
      permissionMode: 'approve-all',
      sessionKey: `agent:${adapter}-agent:main`,
      createdAt: 1000,
      updatedAt: 1000,
    }
  }

  it('prepares Claude with Mahoraga memory, host auth, Mahoraga MCP, and fingerprinted session', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-adapters-'))
    tempDirs.push(mahoragaDir)
    const prepared = await prepareAcpxAgentContext({
      mahoragaDir,
      agent: makeAgent('claude'),
      sessionId: 'main',
      sessionKey: 'agent:claude-agent:main',
      cwdOverride: null,
      isSelectedCwd: false,
      message: 'remember this',
    })

    expect(prepared.commandEnv.AGENT_HOME).toContain('/claude-agent/home')
    expect(prepared.commandEnv).not.toHaveProperty('CLAUDE_CONFIG_DIR')
    expect(prepared.commandEnv).not.toHaveProperty('CODEX_HOME')
    expect(prepared.useMahoragaMcp).toBe(true)
    expect(prepared.runtimeSessionKey).toMatch(
      /^agent:claude-agent:main:[a-f0-9]{16}$/,
    )
    expect(prepared.runPrompt).toContain(
      'Available skills: app-connections, mahoraga, memory, soul',
    )
    expect(
      await readFile(`${prepared.commandEnv.AGENT_HOME}/MEMORY.md`, 'utf8'),
    ).toContain('# MEMORY.md')
  })

  it('prepares Codex with CODEX_HOME and Mahoraga MCP', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-adapters-'))
    tempDirs.push(mahoragaDir)
    const prepared = await prepareAcpxAgentContext({
      mahoragaDir,
      agent: makeAgent('codex'),
      sessionId: 'main',
      sessionKey: 'agent:codex-agent:main',
      cwdOverride: null,
      isSelectedCwd: false,
      message: 'hi',
    })

    expect(prepared.commandEnv.AGENT_HOME).toContain('/codex-agent/home')
    expect(prepared.commandEnv.CODEX_HOME).toContain(
      '/codex-agent/runtime/codex-home',
    )
    expect(prepared.commandEnv).not.toHaveProperty('CLAUDE_CONFIG_DIR')
    expect(prepared.useMahoragaMcp).toBe(true)
    expect(prepared.runPrompt).toContain('AGENT_HOME=')
  })

  it('prepares a UUID session with separate runtime-state files', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-adapters-'))
    tempDirs.push(mahoragaDir)
    const sessionId = '00000000-0000-4000-8000-000000000001'

    const prepared = await prepareAcpxAgentContext({
      mahoragaDir,
      agent: makeAgent('claude'),
      sessionId,
      sessionKey: 'agent:claude-agent:main',
      cwdOverride: null,
      isSelectedCwd: false,
      message: 'hi',
    })
    const paths = resolveAgentRuntimePaths({
      mahoragaDir,
      agentId: 'claude-agent',
      sessionId,
    })

    expect(prepared.runtimeSessionKey).toMatch(
      /^agent:claude-agent:00000000-0000-4000-8000-000000000001:[a-f0-9]{16}$/,
    )
    expect(await loadLatestRuntimeState(paths.runtimeSessionStatePath)).toEqual(
      expect.objectContaining({
        sessionId,
        runtimeSessionKey: prepared.runtimeSessionKey,
      }),
    )
    expect(await loadLatestRuntimeState(paths.runtimeStatePath)).toEqual(
      expect.objectContaining({
        sessionId,
        runtimeSessionKey: prepared.runtimeSessionKey,
      }),
    )
  })
})
