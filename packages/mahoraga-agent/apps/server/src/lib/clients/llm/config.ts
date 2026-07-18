/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * LLM config resolution - handles MAHORAGA provider lookup.
 */

import { LLM_PROVIDERS, type LLMConfig } from '@mahoraga/shared/schemas/llm'
import { INLINED_ENV } from '../../../env'
import { logger } from '../../logger'
import { fetchMahoragaConfig, getLLMConfigFromProvider } from '../gateway'
import { getOAuthTokenManager } from '../oauth'
import {
  resolveMockMahoragaConfig,
  shouldUseMockMahoragaLLM,
} from './mock-language-model'
import type { ResolvedLLMConfig } from './types'

const CHATGPT_PROVIDER_DISPLAY_NAME = 'ChatGPT'

export async function resolveLLMConfig(
  config: LLMConfig,
  mahoragaId?: string,
): Promise<ResolvedLLMConfig> {
  // OAuth providers: resolve token from server-side storage
  if (config.provider === LLM_PROVIDERS.CHATGPT_PRO) {
    return resolveOAuthConfig(config, mahoragaId, {
      providerId: 'chatgpt-pro',
      displayName: CHATGPT_PROVIDER_DISPLAY_NAME,
      defaultModel: 'gpt-5.5',
      useRefresh: true,
      extraFields: (tokens) => ({
        upstreamProvider: 'openai',
        accountId: tokens.accountId,
      }),
    })
  }
  if (config.provider === LLM_PROVIDERS.GITHUB_COPILOT) {
    return resolveOAuthConfig(config, mahoragaId, {
      providerId: 'github-copilot',
      displayName: 'GitHub Copilot',
      defaultModel: 'gpt-5-mini',
      useRefresh: false,
    })
  }
  if (config.provider === LLM_PROVIDERS.QWEN_CODE) {
    return resolveOAuthConfig(config, mahoragaId, {
      providerId: 'qwen-code',
      displayName: 'Qwen Code',
      defaultModel: 'coder-model',
      useRefresh: true,
    })
  }

  // Mahoraga gateway: fetch config from remote service
  if (config.provider === LLM_PROVIDERS.MAHORAGA) {
    if (shouldUseMockMahoragaLLM(config)) {
      return resolveMockMahoragaConfig(config, mahoragaId)
    }
    return resolveMahoragaConfig(config, mahoragaId)
  }

  // All other providers: passthrough with model validation
  if (!config.model) {
    throw new Error(`model is required for ${config.provider} provider`)
  }
  return config as ResolvedLLMConfig
}

interface OAuthResolveOptions {
  providerId: string
  displayName: string
  defaultModel: string
  useRefresh: boolean
  extraFields?: (tokens: { accountId?: string }) => Record<string, unknown>
}

async function resolveOAuthConfig(
  config: LLMConfig,
  mahoragaId: string | undefined,
  opts: OAuthResolveOptions,
): Promise<ResolvedLLMConfig> {
  const tokenManager = getOAuthTokenManager()
  if (!tokenManager || !mahoragaId) {
    throw new Error(
      `Not authenticated with ${opts.displayName}. Please login first.`,
    )
  }

  const tokens = opts.useRefresh
    ? await tokenManager.refreshIfExpired(opts.providerId)
    : tokenManager.getTokens(opts.providerId)

  if (!tokens) {
    throw new Error(
      `Not authenticated with ${opts.displayName}. Please login first.`,
    )
  }

  return {
    ...config,
    model: config.model || opts.defaultModel,
    apiKey: tokens.accessToken,
    ...opts.extraFields?.(tokens),
  }
}

async function resolveMahoragaConfig(
  config: LLMConfig,
  mahoragaId?: string,
): Promise<ResolvedLLMConfig> {
  const configUrl = INLINED_ENV.MAHORAGA_CONFIG_URL
  if (!configUrl) {
    throw new Error(
      'MAHORAGA_CONFIG_URL environment variable is required for Mahoraga provider',
    )
  }

  logger.debug('Resolving MAHORAGA config', { configUrl, mahoragaId })

  const mahoragaConfig = await fetchMahoragaConfig(configUrl, mahoragaId)
  const llmConfig = getLLMConfigFromProvider(mahoragaConfig, 'default')

  return {
    ...config,
    model: llmConfig.modelName,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    upstreamProvider: llmConfig.providerType,
    mahoragaId,
  }
}
