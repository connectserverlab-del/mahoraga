/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Replaced at build time via `define` in scripts/build/server.ts
declare const __MAHORAGA_VERSION__: string

export const VERSION: string =
  typeof __MAHORAGA_VERSION__ !== 'undefined'
    ? __MAHORAGA_VERSION__
    : '0.0.0-dev'
