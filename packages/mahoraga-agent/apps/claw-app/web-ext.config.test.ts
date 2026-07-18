import { afterEach, describe, expect, it } from 'bun:test'

const env = process.env
const originalProduct = env.MAHORAGA_PRODUCT
let importVersion = 0

afterEach(() => {
  if (originalProduct === undefined) {
    delete env.MAHORAGA_PRODUCT
  } else {
    env.MAHORAGA_PRODUCT = originalProduct
  }
})

async function loadWebExtConfig(product?: string) {
  if (product === undefined) {
    delete env.MAHORAGA_PRODUCT
  } else {
    env.MAHORAGA_PRODUCT = product
  }

  const module = await import(`./web-ext.config.ts?test=${importVersion++}`)
  return module.default as { chromiumArgs: string[] }
}

describe('web-ext Chromium product args', () => {
  it('defaults Claw launches to the BrowserClaw product', async () => {
    const config = await loadWebExtConfig()

    expect(config.chromiumArgs).toContain('--mahoraga-product=browserclaw')
  })

  it('honors an explicit Mahoraga product override', async () => {
    const config = await loadWebExtConfig('mahoraga')

    expect(config.chromiumArgs).toContain('--mahoraga-product=mahoraga')
  })

  it('rejects invalid product overrides', async () => {
    await expect(loadWebExtConfig('invalid')).rejects.toThrow(
      'MAHORAGA_PRODUCT must be mahoraga or browserclaw: invalid',
    )
  })
})
