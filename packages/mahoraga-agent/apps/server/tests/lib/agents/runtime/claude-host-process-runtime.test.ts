/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ClaudeRuntime,
  configureClaudeRuntime,
  getAgentRuntimeRegistry,
  getClaudeRuntime,
  prepareClaudeCodeContext,
  resetAgentRuntimeRegistry,
} from '../../../../src/lib/agents/runtime'

function makeAgent(id = 'agent-1') {
  return {
    id,
    name: 'Claude bot',
    adapter: 'claude' as const,
    sessionKey: `agent:${id}:main`,
    pinned: false,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    modelId: 'claude-opus-4-5',
    reasoningEffort: 'medium',
    providerType: 'host-auth',
    providerName: null,
    baseUrl: null,
    apiKey: null,
    supportsImages: true,
  }
}

describe('ClaudeRuntime', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    )
    tempDirs.length = 0
    resetAgentRuntimeRegistry()
  })

  it('declares the canonical Claude descriptor', () => {
    const runtime = new ClaudeRuntime(
      { binaryName: 'claude' },
      { mahoragaDir: '/tmp/mahoraga' },
    )
    expect(runtime.descriptor.adapterId).toBe('claude')
    expect(runtime.descriptor.kind).toBe('host-process')
    expect(runtime.descriptor.platforms).toContain('darwin')
    expect(runtime.descriptor.platforms).toContain('linux')
  })

  it('getPerAgentHomeDir resolves the canonical agent home path', () => {
    const runtime = new ClaudeRuntime(
      { binaryName: 'claude' },
      { mahoragaDir: '/tmp/mahoraga' },
    )
    expect(runtime.getPerAgentHomeDir('agent-7')).toBe(
      '/tmp/mahoraga/agents/harness/agent-7/home',
    )
  })

  it('prepareTurnContext sets AGENT_HOME and not CODEX_HOME', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-claude-'))
    tempDirs.push(mahoragaDir)
    const prepared = await prepareClaudeCodeContext({
      mahoragaDir,
      agent: makeAgent('claude-agent'),
      sessionId: 'main',
      sessionKey: 'agent:claude-agent:main',
      cwdOverride: null,
      isSelectedCwd: false,
      message: 'hi',
    })
    expect(prepared.commandEnv).toEqual({
      AGENT_HOME: join(
        mahoragaDir,
        'agents',
        'harness',
        'claude-agent',
        'home',
      ),
    })
    expect(prepared.commandEnv).not.toHaveProperty('CODEX_HOME')
    expect(prepared.useMahoragaMcp).toBe(true)
  })

  describe('configureClaudeRuntime', () => {
    it('registers a runtime in the registry', () => {
      const mahoragaDir = '/tmp/mahoraga'
      const runtime = configureClaudeRuntime({ mahoragaDir })
      expect(runtime).toBeInstanceOf(ClaudeRuntime)
      expect(getClaudeRuntime()).toBe(runtime)
      expect(getAgentRuntimeRegistry().get('claude')).toBe(runtime)
    })

    it('throws on duplicate registration', () => {
      configureClaudeRuntime({ mahoragaDir: '/tmp/mahoraga' })
      expect(() =>
        configureClaudeRuntime({ mahoragaDir: '/tmp/mahoraga' }),
      ).toThrow(/already registered/)
    })
  })
})
