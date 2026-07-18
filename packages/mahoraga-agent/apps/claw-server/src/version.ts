import pkg from '../package.json' with { type: 'json' }

declare const __MAHORAGA_VERSION__: string

export const VERSION: string =
  typeof __MAHORAGA_VERSION__ !== 'undefined'
    ? __MAHORAGA_VERSION__
    : pkg.version
