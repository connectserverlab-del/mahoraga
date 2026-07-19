/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface IdentityConfig {
  installId?: string
  statePath?: string
}

interface IdentityStateFile {
  mahoragaId: string
}

export class IdentityService {
  private mahoragaId: string | null = null

  /** Chooses the stable Mahoraga id without coupling it to the product SQLite schema. */
  initialize(config: IdentityConfig): void {
    this.mahoragaId =
      normalizeInstallId(config.installId) ??
      this.loadFromState(config.statePath) ??
      this.generateAndSave(config.statePath)
  }

  getMahoragaId(): string {
    if (!this.mahoragaId) {
      throw new Error(
        'IdentityService not initialized. Call initialize() first.',
      )
    }
    return this.mahoragaId
  }

  isInitialized(): boolean {
    return this.mahoragaId !== null
  }

  private loadFromState(statePath: string | undefined): string | null {
    if (!statePath) return null
    try {
      const parsed = JSON.parse(
        readFileSync(statePath, 'utf8'),
      ) as Partial<IdentityStateFile>
      return typeof parsed.mahoragaId === 'string' &&
        parsed.mahoragaId.length > 0
        ? parsed.mahoragaId
        : null
    } catch (err) {
      if (isNotFoundError(err)) return null
      throw err
    }
  }

  private generateAndSave(statePath: string | undefined): string {
    const mahoragaId = crypto.randomUUID()
    if (statePath) {
      mkdirSync(dirname(statePath), { recursive: true })
      writeFileSync(statePath, `${JSON.stringify({ mahoragaId })}\n`, 'utf8')
    }
    return mahoragaId
  }
}

function normalizeInstallId(installId: string | undefined): string | null {
  return installId && installId.length > 0 ? installId : null
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'ENOENT'
  )
}

export const identity = new IdentityService()
