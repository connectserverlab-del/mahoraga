/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, describe, expect, it } from 'bun:test'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildAcpxRuntimePromptPrefix,
  ensureAgentHome,
  ensureRuntimeSkills,
  materializeCodexHome,
  resolveAgentRuntimePaths,
  wrapCommandWithEnv,
} from '../../../src/lib/agents/acpx/runtime-context'
import type { AgentDefinition } from '../../../src/lib/agents/agent-types'

describe('acpx runtime context helpers', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    )
    tempDirs.length = 0
  })

  it('resolves stable agent home and shared default workspace paths', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    tempDirs.push(mahoragaDir)

    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })

    expect(paths.harnessDir).toBe(join(mahoragaDir, 'agents', 'harness'))
    expect(paths.agentHome).toBe(
      join(mahoragaDir, 'agents', 'harness', 'agent-1', 'home'),
    )
    expect(paths.defaultWorkspaceCwd).toBe(
      join(mahoragaDir, 'agents', 'harness', 'workspace'),
    )
    expect(paths.effectiveCwd).toBe(paths.defaultWorkspaceCwd)
    expect(paths.runtimeStatePath).toBe(
      join(mahoragaDir, 'agents', 'harness', 'runtime-state', 'agent-1.json'),
    )
    expect(paths.runtimeSessionStatePath).toBe(
      join(
        mahoragaDir,
        'agents',
        'harness',
        'runtime-state',
        'agent-1',
        'main.json',
      ),
    )
    expect(paths.runtimeSkillsDir).toBe(
      join(mahoragaDir, 'agents', 'harness', 'runtime-skills'),
    )
    expect(paths.runtimeRoot).toBe(
      join(mahoragaDir, 'agents', 'harness', 'agent-1', 'runtime'),
    )
    expect(paths.codexHome).toBe(
      join(
        mahoragaDir,
        'agents',
        'harness',
        'agent-1',
        'runtime',
        'codex-home',
      ),
    )
  })

  it('uses selected cwd when one is provided', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    const selected = await mkdtemp(join(tmpdir(), 'mahoraga-selected-'))
    tempDirs.push(mahoragaDir, selected)

    const paths = resolveAgentRuntimePaths({
      mahoragaDir,
      agentId: 'agent-1',
      cwd: selected,
    })

    expect(paths.effectiveCwd).toBe(selected)
  })

  it('resolves a stable runtime-state path for UUID sessions', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    tempDirs.push(mahoragaDir)

    const paths = resolveAgentRuntimePaths({
      mahoragaDir,
      agentId: 'agent-1',
      sessionId: '00000000-0000-4000-8000-000000000001',
    })

    expect(paths.runtimeStatePath).toBe(
      join(mahoragaDir, 'agents', 'harness', 'runtime-state', 'agent-1.json'),
    )
    expect(paths.runtimeSessionStatePath).toBe(
      join(
        mahoragaDir,
        'agents',
        'harness',
        'runtime-state',
        'agent-1',
        '00000000-0000-4000-8000-000000000001.json',
      ),
    )
  })

  it('seeds agent home and does not overwrite edited files', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    tempDirs.push(mahoragaDir)
    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })

    await ensureAgentHome(paths)
    const seededSoul = await readFile(join(paths.agentHome, 'SOUL.md'), 'utf8')
    const seededMemory = await readFile(
      join(paths.agentHome, 'MEMORY.md'),
      'utf8',
    )
    expect(seededSoul).toContain('# SOUL.md - Who You Are')
    expect(seededSoul).toContain('## Continuity')
    expect(seededSoul).toContain('If you change this file, tell the user')
    expect(seededMemory).toContain('# MEMORY.md - What Persists')
    expect(seededMemory).toContain('Daily notes are short-term evidence')
    expect(seededMemory).toContain('Promote only stable patterns')

    await writeFile(join(paths.agentHome, 'SOUL.md'), '# Custom soul\n')
    await ensureAgentHome(paths)

    expect(await readFile(join(paths.agentHome, 'SOUL.md'), 'utf8')).toBe(
      '# Custom soul\n',
    )
    expect(
      await readFile(join(paths.agentHome, 'MEMORY.md'), 'utf8'),
    ).toContain('# MEMORY.md')
  })

  it('writes Mahoraga runtime skill files', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    tempDirs.push(mahoragaDir)
    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })

    const skills = await ensureRuntimeSkills(paths.runtimeSkillsDir)

    expect(skills).toEqual(['app-connections', 'mahoraga', 'memory', 'soul'])
    expect(
      await readFile(
        join(paths.runtimeSkillsDir, 'mahoraga', 'SKILL.md'),
        'utf8',
      ),
    ).toContain('Mahoraga MCP')
    expect(
      await readFile(
        join(paths.runtimeSkillsDir, 'memory', 'SKILL.md'),
        'utf8',
      ),
    ).toContain('MEMORY.md')
    expect(
      await readFile(
        join(paths.runtimeSkillsDir, 'memory', 'SKILL.md'),
        'utf8',
      ),
    ).toContain('Do not promote one-off facts')
    expect(
      await readFile(join(paths.runtimeSkillsDir, 'soul', 'SKILL.md'), 'utf8'),
    ).toContain('SOUL.md')
    expect(
      await readFile(join(paths.runtimeSkillsDir, 'soul', 'SKILL.md'), 'utf8'),
    ).toContain('If you change SOUL.md, tell the user')
  })

  it('refreshes managed runtime skills even when an existing file is read-only', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    tempDirs.push(mahoragaDir)
    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })
    const skillPath = join(paths.runtimeSkillsDir, 'mahoraga', 'SKILL.md')

    await ensureRuntimeSkills(paths.runtimeSkillsDir)
    await chmod(skillPath, 0o444)

    await ensureRuntimeSkills(paths.runtimeSkillsDir)

    expect(await readFile(skillPath, 'utf8')).toContain('Mahoraga MCP')
  })

  it('materializes Codex home with auth symlink and all runtime skills', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    const sourceCodexHome = await mkdtemp(
      join(tmpdir(), 'mahoraga-codex-src-'),
    )
    tempDirs.push(mahoragaDir, sourceCodexHome)
    await writeFile(join(sourceCodexHome, 'auth.json'), '{"ok":true}\n')
    await writeFile(join(sourceCodexHome, 'config.toml'), 'model = "test"\n')
    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })
    const skills = await ensureRuntimeSkills(paths.runtimeSkillsDir)

    await materializeCodexHome({ paths, skillNames: skills, sourceCodexHome })

    const auth = await lstat(join(paths.codexHome, 'auth.json'))
    expect(auth.isSymbolicLink()).toBe(true)
    expect(await readFile(join(paths.codexHome, 'config.toml'), 'utf8')).toBe(
      'model = "test"\n',
    )
    expect(
      await readFile(
        join(paths.codexHome, 'skills', 'mahoraga', 'SKILL.md'),
        'utf8',
      ),
    ).toContain('Mahoraga MCP')
  })

  it('rejects non-file Codex auth sources instead of silently skipping auth', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    const sourceCodexHome = await mkdtemp(
      join(tmpdir(), 'mahoraga-codex-src-'),
    )
    tempDirs.push(mahoragaDir, sourceCodexHome)
    await mkdir(join(sourceCodexHome, 'auth.json'))
    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })
    const skills = await ensureRuntimeSkills(paths.runtimeSkillsDir)

    await expect(
      materializeCodexHome({ paths, skillNames: skills, sourceCodexHome }),
    ).rejects.toThrow(/auth\.json/)
  })

  it('rejects non-file Codex config sources instead of silently skipping config', async () => {
    const mahoragaDir = await mkdtemp(join(tmpdir(), 'mahoraga-context-'))
    const sourceCodexHome = await mkdtemp(
      join(tmpdir(), 'mahoraga-codex-src-'),
    )
    tempDirs.push(mahoragaDir, sourceCodexHome)
    await mkdir(join(sourceCodexHome, 'config.toml'))
    const paths = resolveAgentRuntimePaths({ mahoragaDir, agentId: 'agent-1' })
    const skills = await ensureRuntimeSkills(paths.runtimeSkillsDir)

    await expect(
      materializeCodexHome({ paths, skillNames: skills, sourceCodexHome }),
    ).rejects.toThrow(/config\.toml/)
  })

  it('wraps commands with shell-quoted env vars', () => {
    expect(
      wrapCommandWithEnv('npx @zed-industries/codex-acp', {
        AGENT_HOME: '/tmp/agent home',
        CODEX_HOME: "/tmp/codex'home",
      }),
    ).toBe(
      "env AGENT_HOME='/tmp/agent home' CODEX_HOME='/tmp/codex'\\''home' npx @zed-industries/codex-acp",
    )
  })

  it('builds the Mahoraga operating prompt prefix', () => {
    const agent: AgentDefinition = {
      id: 'agent-1',
      name: 'Researcher',
      adapter: 'claude',
      permissionMode: 'approve-all',
      sessionKey: 'agent:agent-1:main',
      createdAt: 1000,
      updatedAt: 1000,
    }
    const paths = resolveAgentRuntimePaths({
      mahoragaDir: '/tmp/mahoraga',
      agentId: agent.id,
      cwd: '/tmp/workspace',
    })

    const prompt = buildAcpxRuntimePromptPrefix({
      agent,
      paths,
      skillNames: ['app-connections', 'mahoraga', 'memory', 'soul'],
    })

    expect(prompt).toContain('You are Mahoraga')
    expect(prompt).toContain(
      'AGENT_HOME=/tmp/mahoraga/agents/harness/agent-1/home',
    )
    expect(prompt).toContain('Current workspace cwd: /tmp/workspace')
    expect(prompt).toContain(
      'Skill root: /tmp/mahoraga/agents/harness/runtime-skills',
    )
    expect(prompt).toContain(
      'Available skills: app-connections, mahoraga, memory, soul',
    )
  })

  it('routes explicit memory requests to Mahoraga AGENT_HOME files', () => {
    const agent: AgentDefinition = {
      id: 'agent-1',
      name: 'Researcher',
      adapter: 'claude',
      permissionMode: 'approve-all',
      sessionKey: 'agent:agent-1:main',
      createdAt: 1000,
      updatedAt: 1000,
    }
    const paths = resolveAgentRuntimePaths({
      mahoragaDir: '/tmp/mahoraga',
      agentId: agent.id,
      cwd: '/tmp/workspace',
    })

    const prompt = buildAcpxRuntimePromptPrefix({
      agent,
      paths,
      skillNames: ['mahoraga', 'memory', 'soul'],
    })

    expect(prompt).toContain('When the user asks you to remember')
    expect(prompt).toContain('use the Mahoraga memory skill')
    expect(prompt).toContain('AGENT_HOME/MEMORY.md')
    expect(prompt).toContain('AGENT_HOME/memory/YYYY-MM-DD.md')
    expect(prompt).toContain('Do not use native Claude project memory')
  })
})
