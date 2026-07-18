/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type AgentInfo,
  ForeignEntryError,
  ServerNotFoundError,
} from '@mahoraga/agent-mcp-manager'
import {
  cleanupNonCuratedLinks,
  installInto,
  listAgents,
  resetMcpManagerForTesting,
  setMcpManagerForTesting,
  uninstallFrom,
} from '../../../src/lib/mcp-manager'
import { callsOf, createStubMcpManager } from '../../_helpers/stub-mcp-manager'

let stubAgents: AgentInfo[] = []
const stubDetect = async (): Promise<AgentInfo[]> => stubAgents

function agent(
  id: AgentInfo['id'],
  displayName: string,
  installed: boolean,
): AgentInfo {
  return { id, displayName, installed, configPath: `/tmp/fake/${id}.json` }
}

async function withTempMcpEnv<T>(
  run: (paths: { claudeConfigPath: string }) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'mcp-manager-service-'))
  const previous = {
    MAHORAGA_DIR: process.env.MAHORAGA_DIR,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    HOME: process.env.HOME,
  }
  const mahoragaDir = join(root, 'mahoraga')
  const claudeConfigDir = join(root, 'claude-config')
  const homeDir = join(root, 'home')
  const claudeConfigPath = join(claudeConfigDir, '.claude.json')
  try {
    await mkdir(claudeConfigDir, { recursive: true })
    await mkdir(homeDir, { recursive: true })
    process.env.MAHORAGA_DIR = mahoragaDir
    process.env.CLAUDE_CONFIG_DIR = claudeConfigDir
    process.env.HOME = homeDir
    resetMcpManagerForTesting()
    return await run({ claudeConfigPath })
  } finally {
    resetMcpManagerForTesting()
    restoreEnv(previous)
    await rm(root, { recursive: true, force: true })
  }
}

function restoreEnv(previous: {
  MAHORAGA_DIR?: string
  CLAUDE_CONFIG_DIR?: string
  HOME?: string
}): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

beforeEach(() => {
  resetMcpManagerForTesting()
  stubAgents = []
})

afterEach(() => {
  resetMcpManagerForTesting()
})

describe('listAgents', () => {
  it('surfaces installed curated agents with their link state', async () => {
    stubAgents = [
      agent('claude-code', 'Claude Code', true),
      agent('cursor', 'Cursor', true),
    ]
    const stub = createStubMcpManager()
    stub.seedServer(
      'mahoraga',
      { transport: 'http', url: 'http://127.0.0.1:9100/mcp' },
      [{ agent: 'claude-code' }],
    )
    setMcpManagerForTesting(stub)

    const rows = await listAgents({ detect: stubDetect })
    expect(rows.find((r) => r.id === 'claude-code')).toMatchObject({
      installed: true,
      linked: true,
    })
    expect(rows.find((r) => r.id === 'cursor')).toMatchObject({
      installed: true,
      linked: false,
    })
  })

  it('omits curated agents that are neither installed nor linked', async () => {
    stubAgents = [
      agent('claude-code', 'Claude Code', true),
      agent('cursor', 'Cursor', false),
    ]
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)

    const rows = await listAgents({ detect: stubDetect })
    expect(rows.map((r) => r.id)).toEqual(['claude-code'])
  })

  it('does not surface non-curated agents even when detected on disk', async () => {
    // Gemini CLI and Claude Desktop are supported by the upstream
    // catalog but deliberately excluded from the one-click set. The
    // curated allow-list is what keeps them out of the panel.
    stubAgents = [
      agent('claude-code', 'Claude Code', true),
      agent('gemini', 'Gemini CLI', true),
      agent('claude-desktop', 'Claude Desktop', true),
    ]
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)

    const rows = await listAgents({ detect: stubDetect })
    expect(rows.map((r) => r.id)).toEqual(['claude-code'])
  })

  it('counts codex as linked when wired up under the stdio server name', async () => {
    stubAgents = [agent('codex', 'Codex', true)]
    const stub = createStubMcpManager()
    stub.seedServer(
      'mahoraga-stdio',
      { transport: 'stdio', command: 'npx', args: ['mcp-remote', 'x'] },
      [{ agent: 'codex' }],
    )
    setMcpManagerForTesting(stub)

    const rows = await listAgents({ detect: stubDetect })
    expect(rows.find((r) => r.id === 'codex')?.linked).toBe(true)
  })

  it('ignores manifest links under server names Mahoraga does not manage', async () => {
    stubAgents = [agent('claude-code', 'Claude Code', true)]
    const stub = createStubMcpManager()
    stub.seedServer(
      'some-other-server',
      { transport: 'http', url: 'http://127.0.0.1:9100/mcp' },
      [{ agent: 'claude-code' }],
    )
    setMcpManagerForTesting(stub)

    const rows = await listAgents({ detect: stubDetect })
    expect(rows.find((r) => r.id === 'claude-code')?.linked).toBe(false)
  })

  it('treats an existing link as installed even when disk detection says otherwise', async () => {
    stubAgents = [agent('claude-code', 'Claude Code', false)]
    const stub = createStubMcpManager()
    stub.seedServer(
      'mahoraga',
      { transport: 'http', url: 'http://127.0.0.1:9100/mcp' },
      [{ agent: 'claude-code' }],
    )
    setMcpManagerForTesting(stub)

    const rows = await listAgents({ detect: stubDetect })
    expect(rows.find((r) => r.id === 'claude-code')).toMatchObject({
      installed: true,
      linked: true,
    })
  })
})

describe('installInto', () => {
  it('links the mahoraga http entry for claude-code in a single call', async () => {
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)

    const result = await installInto('claude-code', 'http://127.0.0.1:9100/mcp')
    expect(result.success).toBe(true)
    const linkCalls = callsOf(stub, 'link') as Array<{
      server: { name: string; spec: unknown }
      agent: string
    }>
    expect(linkCalls).toHaveLength(1)
    expect(linkCalls[0].server.name).toBe('mahoraga')
    expect(linkCalls[0].server.spec).toEqual({
      transport: 'http',
      url: 'http://127.0.0.1:9100/mcp',
    })
    expect(linkCalls[0].agent).toBe('claude-code')
  })

  it('writes the claude-code system-scope http type field via the catalog', async () => {
    // agent-mcp-manager 0.0.4 emits the explicit `type: "http"` tag
    // for Claude Code HTTP entries at the catalog layer, so no
    // post-write fixup is needed. This locks that behaviour in.
    await withTempMcpEnv(async ({ claudeConfigPath }) => {
      await writeFile(claudeConfigPath, '{"mcpServers":{}}\n', 'utf8')

      const result = await installInto(
        'claude-code',
        'http://127.0.0.1:9100/mcp',
      )

      expect(result.success).toBe(true)
      const config = JSON.parse(await readFile(claudeConfigPath, 'utf8'))
      expect(config.mcpServers.mahoraga).toEqual({
        url: 'http://127.0.0.1:9100/mcp',
        type: 'http',
      })
    })
  })

  it('uses an http spec under the http server name for codex', async () => {
    // Codex speaks streamable-HTTP MCP, so planFor hits the http
    // branch and no stdio bridge is needed.
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)

    const result = await installInto('codex', 'http://127.0.0.1:9100/mcp')
    expect(result.success).toBe(true)
    const linkCalls = callsOf(stub, 'link') as Array<{
      server: { name: string; spec: unknown }
      agent: string
    }>
    expect(linkCalls).toHaveLength(1)
    expect(linkCalls[0].server.name).toBe('mahoraga')
    expect(linkCalls[0].server.spec).toEqual({
      transport: 'http',
      url: 'http://127.0.0.1:9100/mcp',
    })
    expect(linkCalls[0].agent).toBe('codex')
  })

  it('uses a stdio mcp-remote spec under the stdio server name for claude-desktop', async () => {
    // Claude Desktop only accepts stdio MCP entries; the catalog flags
    // it stdio-only and planFor honours that even though it is not a
    // curated one-click surface.
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)

    const result = await installInto(
      'claude-desktop',
      'http://127.0.0.1:9100/mcp',
    )
    expect(result.success).toBe(true)
    const linkCalls = callsOf(stub, 'link') as Array<{
      server: { name: string; spec: unknown }
      agent: string
    }>
    expect(linkCalls).toHaveLength(1)
    expect(linkCalls[0].server.name).toBe('mahoraga-stdio')
    expect(linkCalls[0].server.spec).toEqual({
      transport: 'stdio',
      command: 'npx',
      args: ['mcp-remote', 'http://127.0.0.1:9100/mcp'],
    })
    expect(linkCalls[0].agent).toBe('claude-desktop')
  })

  it('sweeps the opposite server name before linking so an agent never ends up double-linked', async () => {
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)

    const result = await installInto(
      'claude-desktop',
      'http://127.0.0.1:9100/mcp',
    )
    expect(result.success).toBe(true)
    const unlinkCalls = callsOf(stub, 'unlink') as Array<{
      serverName: string
      agent: string
    }>
    expect(unlinkCalls).toHaveLength(1)
    expect(unlinkCalls[0].serverName).toBe('mahoraga')
    expect(unlinkCalls[0].agent).toBe('claude-desktop')
    const linkCalls = callsOf(stub, 'link') as Array<{
      server: { name: string }
    }>
    expect(linkCalls).toHaveLength(1)
    expect(linkCalls[0].server.name).toBe('mahoraga-stdio')
  })

  it('rejects unsupported agent ids', async () => {
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)
    await expect(
      installInto('not-a-real-agent', 'http://127.0.0.1:9100/mcp'),
    ).rejects.toMatchObject({ agent: 'not-a-real-agent' })
  })
})

describe('uninstallFrom', () => {
  it('disconnects both server names on uninstall and returns success', async () => {
    const stub = createStubMcpManager()
    setMcpManagerForTesting(stub)
    const out = await uninstallFrom('claude-code')
    expect(out.success).toBe(true)
    const disconnectCalls = callsOf(stub, 'disconnect') as Array<{
      serverName: string
      agent: string
    }>
    expect(disconnectCalls).toHaveLength(2)
    expect(disconnectCalls.map((c) => c.serverName).sort()).toEqual([
      'mahoraga',
      'mahoraga-stdio',
    ])
    for (const call of disconnectCalls) expect(call.agent).toBe('claude-code')
  })

  it('tolerates a missing manifest entry (ServerNotFoundError) while sweeping', async () => {
    const stub = createStubMcpManager({
      removeThrowsByServer: new Map([
        ['mahoraga-stdio', new ServerNotFoundError('mahoraga-stdio')],
      ]),
    })
    setMcpManagerForTesting(stub)
    const out = await uninstallFrom('codex')
    expect(out.success).toBe(true)
    expect(callsOf(stub, 'disconnect')).toHaveLength(2)
  })

  it('returns a human message on ForeignEntryError instead of throwing', async () => {
    const stub = createStubMcpManager({
      removeThrowsByServer: new Map([
        [
          'mahoraga',
          new ForeignEntryError(
            'mahoraga',
            'claude-code',
            '/tmp/fake/claude-code.json',
          ),
        ],
      ]),
    })
    setMcpManagerForTesting(stub)
    const out = await uninstallFrom('claude-code')
    expect(out.success).toBe(false)
    expect(out.message).toContain('user-edited')
  })
})

describe('cleanupNonCuratedLinks', () => {
  it('disconnects agents no longer in the curated surface and leaves curated ones', async () => {
    const stub = createStubMcpManager()
    stub.seedServer(
      'mahoraga',
      { transport: 'http', url: 'http://127.0.0.1:9100/mcp' },
      [{ agent: 'claude-code' }, { agent: 'gemini' }],
    )
    stub.seedServer(
      'mahoraga-stdio',
      { transport: 'stdio', command: 'npx', args: ['mcp-remote', 'x'] },
      [{ agent: 'claude-desktop' }],
    )
    setMcpManagerForTesting(stub)

    const removed = await cleanupNonCuratedLinks()
    expect(removed.sort()).toEqual(['claude-desktop', 'gemini'])

    const disconnects = callsOf(stub, 'disconnect') as Array<{ agent: string }>
    expect(disconnects.some((d) => d.agent === 'claude-code')).toBe(false)
    // Curated agent survives; the stale ones are gone from the manifest.
    const links = await stub.listLinks()
    expect((links as Array<{ agent: string }>).map((l) => l.agent)).toEqual([
      'claude-code',
    ])
  })

  it('is a no-op when only curated agents are linked', async () => {
    const stub = createStubMcpManager()
    stub.seedServer(
      'mahoraga',
      { transport: 'http', url: 'http://127.0.0.1:9100/mcp' },
      [{ agent: 'claude-code' }, { agent: 'cursor' }],
    )
    setMcpManagerForTesting(stub)

    const removed = await cleanupNonCuratedLinks()
    expect(removed).toEqual([])
    expect(callsOf(stub, 'disconnect')).toHaveLength(0)
  })
})
