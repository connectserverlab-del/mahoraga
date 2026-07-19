/**
 * @license
 * Copyright 2025 Mahoraga
 */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'

if (!process.env.MAHORAGA_DIR) {
  process.env.MAHORAGA_DIR = mkdtempSync(
    join(tmpdir(), 'mahoraga-server-test-home-'),
  )
}

const portBase = 36000 + (process.pid % 1000) * 20

if (!process.env.MAHORAGA_TEST_CDP_PORT) {
  process.env.MAHORAGA_TEST_CDP_PORT = String(portBase)
}
if (!process.env.MAHORAGA_TEST_SERVER_PORT) {
  process.env.MAHORAGA_TEST_SERVER_PORT = String(portBase + 1)
}
if (!process.env.MAHORAGA_TEST_EXTENSION_PORT) {
  process.env.MAHORAGA_TEST_EXTENSION_PORT = String(portBase + 2)
}
