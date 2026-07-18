/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getOAuthTokenManager,
  initializeOAuth,
  shutdownOAuth,
} from '../../../../src/lib/clients/oauth'
import { closeDb, initializeDb } from '../../../../src/lib/db'

describe('OAuth client setup', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    shutdownOAuth()
    closeDb()
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    )
    tempDirs.length = 0
  })

  it('initializes a process token manager backed by the Mahoraga database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mahoraga-oauth-index-test-'))
    tempDirs.push(dir)
    const handle = initializeDb({
      dbPath: join(dir, 'db', 'mahoraga.sqlite'),
    })

    const manager = initializeOAuth(handle.db, 'mahoraga-1')

    expect(getOAuthTokenManager()).toBe(manager)
    expect(manager.getStatus('qwen-code')).toEqual({
      authenticated: false,
      email: undefined,
      provider: 'qwen-code',
    })

    manager.storeTokens('qwen-code', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    })

    expect(manager.getStatus('qwen-code')).toEqual({
      authenticated: true,
      email: undefined,
      provider: 'qwen-code',
    })
  })

  it('stops and clears the current process token manager', () => {
    const handle = initializeTestDb()
    const firstManager = initializeOAuth(handle.db, 'mahoraga-1')
    const stopFirst = spyOn(firstManager, 'stopCallbackServer')

    const secondManager = initializeOAuth(handle.db, 'mahoraga-2')

    expect(stopFirst).toHaveBeenCalledTimes(1)
    expect(getOAuthTokenManager()).toBe(secondManager)

    const stopSecond = spyOn(secondManager, 'stopCallbackServer')

    shutdownOAuth()

    expect(stopSecond).toHaveBeenCalledTimes(1)
    expect(getOAuthTokenManager()).toBeNull()
  })

  function initializeTestDb() {
    const dir = mkdtempSync(join(tmpdir(), 'mahoraga-oauth-index-test-'))
    tempDirs.push(dir)
    return initializeDb({
      dbPath: join(dir, 'db', 'mahoraga.sqlite'),
    })
  }
})
