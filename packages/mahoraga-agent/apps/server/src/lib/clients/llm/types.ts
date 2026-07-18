/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Internal types for LLM client.
 */

import type { LLMConfig } from '@mahoraga/shared/schemas/llm'

export interface ResolvedLLMConfig extends LLMConfig {
  model: string
  upstreamProvider?: string
  mahoragaId?: string
  accountId?: string
}
