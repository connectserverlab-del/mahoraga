/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { SignJWT } from 'jose'
import { JWT_TTL_SEC } from './constants'

export interface MintJwtOptions {
  mahoragaId: string
  secret: string
  ttlSec?: number
}

export async function mintLaptopJwt(opts: MintJwtOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const ttl = opts.ttlSec ?? JWT_TTL_SEC
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.mahoragaId)
    .setAudience('laptop')
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(new TextEncoder().encode(opts.secret))
}
