/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

const config = {
  cdpPort: 9222,
  serverPort: 9100,
  agentPort: 9100,
  extensionPort: null,
  resourcesDir: '/tmp/mahoraga-resources',
  executionDir: '/tmp/mahoraga-execution',
  mcpAllowRemote: false,
  aiSdkDevtoolsEnabled: false,
  instanceClientId: 'client-test',
}

describe('Application.start', () => {
  afterEach(() => {
    mock.restore()
    mock.clearAllMocks()
  })

  it('starts with the CDP backend only', async () => {
    const {
      Application,
      browserModule,
      cdpConnect,
      createHttpServer,
      loggerError,
      loggerInfo,
      loggerWarn,
    } = await setupApplicationTest()
    const app = new Application(config)

    await app.start()

    expect(cdpConnect).toHaveBeenCalledTimes(1)
    expect(createHttpServer).toHaveBeenCalledTimes(1)
    expect(createHttpServer.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        browser: expect.any(browserModule.Browser),
      }),
    )
    expect(createHttpServer.mock.calls[0]?.[0]).not.toHaveProperty('controller')
    expect(loggerInfo).toHaveBeenCalled()
    expect(loggerWarn).not.toHaveBeenCalled()
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('stores the database below the Mahoraga directory instead of the execution directory', async () => {
    const originalMahoragaDir = process.env.MAHORAGA_DIR
    process.env.MAHORAGA_DIR = '/tmp/mahoraga-dogfood'

    try {
      const { Application, initializeDb } = await setupApplicationTest()
      const app = new Application(config)

      await app.start()

      expect(initializeDb).toHaveBeenCalledWith({
        dbPath: '/tmp/mahoraga-dogfood/db/mahoraga.sqlite',
        resourcesDir: config.resourcesDir,
      })
    } finally {
      if (originalMahoragaDir === undefined) {
        delete process.env.MAHORAGA_DIR
      } else {
        process.env.MAHORAGA_DIR = originalMahoragaDir
      }
    }
  })

  it('warns at boot when metrics is enabled but no instance identity is configured', async () => {
    const { Application, loggerWarn } = await setupApplicationTest()
    const { instanceClientId: _unused, ...configWithoutIdentity } = config
    const app = new Application(configWithoutIdentity)

    await app.start()

    const warnedAboutIdentity = loggerWarn.mock.calls.some(
      (args) =>
        typeof args[0] === 'string' && args[0].includes('no instance identity'),
    )
    expect(warnedAboutIdentity).toBe(true)
  })
})

async function setupApplicationTest() {
  const apiServer = await import('../src/api/server')
  const browserModule = await import('@mahoraga/browser-core/browser')
  const cdpModule = await import('@mahoraga/browser-core/backends/cdp')
  const runtimeModule = await import('../src/lib/agents/runtime')
  const mahoragaDir = await import('../src/lib/mahoraga-dir')
  const dbModule = await import('../src/lib/db')
  const identityModule = await import('../src/lib/identity')
  const loggerModule = await import('../src/lib/logger')
  const metricsModule = await import('../src/lib/metrics')
  const sentryModule = await import('../src/lib/sentry')

  const createHttpServer = spyOn(apiServer, 'createHttpServer')
  createHttpServer.mockImplementation(async () => ({}) as never)

  const cdpConnect = mock(async () => {})
  spyOn(cdpModule.CdpBackend.prototype, 'connect').mockImplementation(
    cdpConnect,
  )

  spyOn(mahoragaDir, 'cleanOldSessions').mockImplementation(async () => {})
  spyOn(mahoragaDir, 'ensureMahoragaDir').mockImplementation(async () => {})
  spyOn(mahoragaDir, 'writeServerConfig').mockImplementation(async () => {})
  spyOn(mahoragaDir, 'removeServerConfigSync').mockImplementation(() => {})

  const initializeDb = spyOn(dbModule, 'initializeDb').mockImplementation(
    () =>
      ({
        path: '/tmp/mahoraga-state/db/mahoraga.sqlite',
        migrationsDir: '/tmp/mahoraga-resources/db/migrations',
        sqlite: { close: () => {} },
        db: {},
      }) as never,
  )
  spyOn(identityModule.identity, 'initialize').mockImplementation(() => {})
  spyOn(identityModule.identity, 'getMahoragaId').mockImplementation(
    () => 'mahoraga-id',
  )

  const loggerInfo = spyOn(loggerModule.logger, 'info').mockImplementation(
    () => {},
  )
  const loggerWarn = spyOn(loggerModule.logger, 'warn').mockImplementation(
    () => {},
  )
  spyOn(loggerModule.logger, 'debug').mockImplementation(() => {})
  const loggerError = spyOn(loggerModule.logger, 'error').mockImplementation(
    () => {},
  )
  spyOn(loggerModule.logger, 'setLogFile').mockImplementation(() => {})

  spyOn(metricsModule.metrics, 'initialize').mockImplementation(() => {})
  spyOn(metricsModule.metrics, 'isEnabled').mockImplementation(() => true)
  spyOn(metricsModule.metrics, 'log').mockImplementation(() => {})

  spyOn(sentryModule.Sentry, 'setContext').mockImplementation(() => {})
  spyOn(sentryModule.Sentry, 'setUser').mockImplementation(() => {})
  spyOn(sentryModule.Sentry, 'captureException').mockImplementation(() => {})

  spyOn(runtimeModule, 'configureClaudeRuntime').mockImplementation(
    () => ({}) as never,
  )
  spyOn(runtimeModule, 'configureCodexRuntime').mockImplementation(
    () => ({}) as never,
  )

  const { Application } = await import('../src/main')
  return {
    Application,
    browserModule,
    cdpConnect,
    createHttpServer,
    loggerError,
    loggerInfo,
    loggerWarn,
    initializeDb,
  }
}
