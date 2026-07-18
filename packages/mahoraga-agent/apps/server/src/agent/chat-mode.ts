/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { BROWSER_TOOLS } from '@mahoraga/browser-mcp/registry'

export const CHAT_MODE_ALLOWED_TOOLS = new Set([
  ...BROWSER_TOOLS.filter((tool) => tool.annotations?.readOnlyHint).map(
    (tool) => tool.name,
  ),
  'tabs',
])
