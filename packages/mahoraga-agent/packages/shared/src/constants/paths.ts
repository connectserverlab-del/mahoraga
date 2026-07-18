/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized file system paths.
 */

export const PATHS = {
  DEFAULT_EXECUTION_DIR: process.cwd(),
  MAHORAGA_DIR_NAME: '.mahoraga',
  DEV_MAHORAGA_DIR_NAME: '.mahoraga-dev',
  BROWSERCLAW_DIR_NAME: '.browserclaw',
  DEV_BROWSERCLAW_DIR_NAME: '.browserclaw-dev',
  CACHE_DIR_NAME: 'cache',
  DB_DIR_NAME: 'db',
  DB_FILE_NAME: 'mahoraga.sqlite',
  SESSIONS_DIR_NAME: 'sessions',
  TOOL_OUTPUT_DIR_NAME: 'tool-output',
  SOUL_FILE_NAME: 'SOUL.md',
  SERVER_CONFIG_FILE_NAME: 'server.json',
  SESSION_RETENTION_DAYS: 30,
} as const
