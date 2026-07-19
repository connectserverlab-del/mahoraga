/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { PATHS } from '@mahoraga/shared/constants/paths'
import {
  ensureMahoragaDir,
  getMahoragaDir,
  getCacheDir,
  getDbPath,
  getSessionsDir,
  getToolOutputDir,
  logDevelopmentMahoragaDir,
  TOOL_OUTPUT_DIR_MODE,
  writeToolOutputFile,
} from '../src/lib/mahoraga-dir'
import { logger } from '../src/lib/logger'

describe('getMahoragaDir', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalMahoragaDir = process.env.MAHORAGA_DIR

  beforeEach(() => {
    delete process.env.NODE_ENV
    delete process.env.MAHORAGA_DIR
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }

    if (originalMahoragaDir === undefined) {
      delete process.env.MAHORAGA_DIR
    } else {
      process.env.MAHORAGA_DIR = originalMahoragaDir
    }
  })

  it('uses a separate home directory in development', () => {
    process.env.NODE_ENV = 'development'

    expect(getMahoragaDir()).toBe(join(homedir(), '.mahoraga-dev'))
  })

  it('uses the standard home directory outside development', () => {
    process.env.NODE_ENV = 'test'

    expect(getMahoragaDir()).toBe(join(homedir(), PATHS.MAHORAGA_DIR_NAME))
  })

  it('logs the resolved development directory path', () => {
    process.env.NODE_ENV = 'development'
    const originalInfo = logger.info
    const info = mock(() => {})
    logger.info = info

    try {
      logDevelopmentMahoragaDir()

      expect(info).toHaveBeenCalledWith(
        `Using development Mahoraga directory: ${join(homedir(), '.mahoraga-dev')}`,
      )
    } finally {
      logger.info = originalInfo
    }
  })

  it('does not log a development directory outside development', () => {
    process.env.NODE_ENV = 'test'
    const originalInfo = logger.info
    const info = mock(() => {})
    logger.info = info

    try {
      logDevelopmentMahoragaDir()

      expect(info).not.toHaveBeenCalled()
    } finally {
      logger.info = originalInfo
    }
  })

  it('uses the development cache directory in development', () => {
    process.env.NODE_ENV = 'development'

    expect(getCacheDir()).toBe(join(homedir(), '.mahoraga-dev', 'cache'))
  })

  it('uses the Mahoraga directory for the sqlite database', () => {
    process.env.NODE_ENV = 'development'

    expect(getDbPath()).toBe(
      join(
        homedir(),
        PATHS.DEV_MAHORAGA_DIR_NAME,
        PATHS.DB_DIR_NAME,
        PATHS.DB_FILE_NAME,
      ),
    )
  })

  it('uses the standard Mahoraga directory for the sqlite database outside development', () => {
    process.env.NODE_ENV = 'test'

    expect(getDbPath()).toBe(
      join(
        homedir(),
        PATHS.MAHORAGA_DIR_NAME,
        PATHS.DB_DIR_NAME,
        PATHS.DB_FILE_NAME,
      ),
    )
  })

  it('uses the standard cache directory outside development', () => {
    process.env.NODE_ENV = 'test'

    expect(getCacheDir()).toBe(
      join(homedir(), PATHS.MAHORAGA_DIR_NAME, 'cache'),
    )
  })
  it('creates only the startup-owned directories during startup setup', async () => {
    const mahoragaDir = mkdtempSync(join(tmpdir(), 'mahoraga-dir-test-'))
    process.env.MAHORAGA_DIR = mahoragaDir

    try {
      await ensureMahoragaDir()

      expect(existsSync(getSessionsDir())).toBe(true)
      expect(existsSync(join(mahoragaDir, 'tool-output'))).toBe(true)
      expect(existsSync(join(mahoragaDir, 'cache', 'vm'))).toBe(false)
      expect(existsSync(join(mahoragaDir, 'vm'))).toBe(false)
      expect(existsSync(join(mahoragaDir, 'lazy-monitoring'))).toBe(false)
      expect(existsSync(join(mahoragaDir, 'lazy-monitoring', 'runs'))).toBe(
        false,
      )
    } finally {
      rmSync(mahoragaDir, { recursive: true, force: true })
    }
  })

  it('locks down the tool output directory permissions', async () => {
    const mahoragaDir = mkdtempSync(join(tmpdir(), 'mahoraga-dir-test-'))
    process.env.MAHORAGA_DIR = mahoragaDir

    try {
      const rawOutputDir = join(mahoragaDir, 'tool-output')
      const createdOutputDir = await getToolOutputDir()
      expect(createdOutputDir).toBe(realpathSync(rawOutputDir))
      if (process.platform !== 'win32') {
        chmodSync(rawOutputDir, 0o777)
      }

      const outputDir = await getToolOutputDir()

      expect(outputDir).toBe(realpathSync(rawOutputDir))
      if (process.platform !== 'win32') {
        expect(statSync(outputDir).mode & 0o777).toBe(TOOL_OUTPUT_DIR_MODE)
      }
    } finally {
      rmSync(mahoragaDir, { recursive: true, force: true })
    }
  })

  it('does not overwrite existing generated tool output files', async () => {
    const mahoragaDir = mkdtempSync(join(tmpdir(), 'mahoraga-dir-test-'))
    process.env.MAHORAGA_DIR = mahoragaDir

    try {
      const outputDir = await getToolOutputDir()
      const outputPath = join(outputDir, 'existing.txt')
      writeFileSync(outputPath, 'original')

      await expect(
        writeToolOutputFile(outputPath, 'replacement'),
      ).rejects.toThrow('EEXIST')
    } finally {
      rmSync(mahoragaDir, { recursive: true, force: true })
    }
  })
})
