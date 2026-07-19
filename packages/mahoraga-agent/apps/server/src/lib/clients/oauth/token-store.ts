/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { and, eq } from 'drizzle-orm'
import type { MahoragaDatabase } from '../../db'
import { type OAuthTokenRow, oauthTokens } from '../../db/schema'
import type {
  OAuthStatus,
  OAuthTokenStore as OAuthTokenStoreContract,
  StoredOAuthTokens,
} from './token-manager'

/** Persists OAuth tokens in the Mahoraga Drizzle database for server-managed LLM providers. */
export class OAuthTokenStore implements OAuthTokenStoreContract {
  constructor(private readonly db: MahoragaDatabase) {}

  upsertTokens(
    mahoragaId: string,
    provider: string,
    tokens: StoredOAuthTokens,
  ): void {
    const row: OAuthTokenRow = {
      mahoragaId,
      provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: tokens.email ?? null,
      accountId: tokens.accountId ?? null,
      updatedAt: Date.now(),
    }
    this.db
      .insert(oauthTokens)
      .values(row)
      .onConflictDoUpdate({
        target: [oauthTokens.mahoragaId, oauthTokens.provider],
        set: row,
      })
      .run()
  }

  getTokens(mahoragaId: string, provider: string): StoredOAuthTokens | null {
    const row = this.findRow(mahoragaId, provider)
    if (!row) return null
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
      email: row.email ?? undefined,
      accountId: row.accountId ?? undefined,
    }
  }

  deleteTokens(mahoragaId: string, provider: string): void {
    this.db.delete(oauthTokens).where(tokenKey(mahoragaId, provider)).run()
  }

  getStatus(mahoragaId: string, provider: string): OAuthStatus {
    const row = this.findRow(mahoragaId, provider)
    return {
      authenticated: row !== null,
      email: row?.email ?? undefined,
      provider,
    }
  }

  private findRow(mahoragaId: string, provider: string): OAuthTokenRow | null {
    return (
      this.db
        .select()
        .from(oauthTokens)
        .where(tokenKey(mahoragaId, provider))
        .get() ?? null
    )
  }
}

function tokenKey(mahoragaId: string, provider: string) {
  return and(
    eq(oauthTokens.mahoragaId, mahoragaId),
    eq(oauthTokens.provider, provider),
  )
}
