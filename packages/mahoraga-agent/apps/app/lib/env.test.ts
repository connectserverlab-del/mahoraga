import { describe, expect, it } from 'bun:test'
import { parseMahoragaApiUrl } from './mahoraga-api-url'
import { parseAlphaFeaturesFlag } from './env'

describe('parseAlphaFeaturesFlag', () => {
  it('defaults alpha features on when unset', () => {
    expect(parseAlphaFeaturesFlag(undefined)).toBe(true)
  })

  it('keeps explicit true enabled', () => {
    expect(parseAlphaFeaturesFlag('true')).toBe(true)
  })

  it('keeps explicit false disabled', () => {
    expect(parseAlphaFeaturesFlag('false')).toBe(false)
  })
})

describe('parseMahoragaApiUrl', () => {
  it('defaults to the production Mahoraga API when unset', () => {
    expect(parseMahoragaApiUrl(undefined)).toBe('https://api.mahoraga.com')
  })

  it('preserves explicit overrides', () => {
    expect(parseMahoragaApiUrl('http://127.0.0.1:3000')).toBe(
      'http://127.0.0.1:3000',
    )
  })

  it('rejects overrides without a scheme', () => {
    expect(() => parseMahoragaApiUrl('api.mahoraga.com')).toThrow(
      'VITE_PUBLIC_MAHORAGA_API must be a valid URL including http:// or https://',
    )
  })

  it('rejects non-HTTP overrides', () => {
    expect(() =>
      parseMahoragaApiUrl('chrome-extension://extension-id'),
    ).toThrow('VITE_PUBLIC_MAHORAGA_API must use http:// or https://')
  })

  it('returns a URL that can form a valid WXT match pattern', () => {
    expect(`${parseMahoragaApiUrl(undefined)}/home`).toStartWith('https://')
  })
})
