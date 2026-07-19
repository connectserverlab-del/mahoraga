import { describe, expect, test } from 'bun:test'

import { verifyNpmPublishAccess } from './npm-access'

describe('verifyNpmPublishAccess', () => {
  test('accepts an authenticated package owner', () => {
    const calls: string[][] = []
    const result = verifyNpmPublishAccess('mahoraga-cli', (args) => {
      calls.push(args)
      if (args[0] === 'whoami') {
        return 'mahoraga_eng\n'
      }
      if (args.join(' ') === 'owner ls mahoraga-cli') {
        return 'mahoraga_eng <eng@felafax.ai>\nother_owner <owner@example.com>\n'
      }
      if (
        args.join(' ') ===
        'access list collaborators mahoraga-cli mahoraga_eng --json'
      ) {
        return JSON.stringify({ mahoraga_eng: 'read-write' })
      }
      throw new Error(`unexpected npm args: ${args.join(' ')}`)
    })

    expect(result).toEqual({
      packageName: 'mahoraga-cli',
      user: 'mahoraga_eng',
      owners: ['mahoraga_eng', 'other_owner'],
      access: 'read-write',
    })
    expect(calls).toEqual([
      ['whoami'],
      ['owner', 'ls', 'mahoraga-cli'],
      [
        'access',
        'list',
        'collaborators',
        'mahoraga-cli',
        'mahoraga_eng',
        '--json',
      ],
    ])
  })

  test('rejects a token user that is not a package owner', () => {
    expect(() =>
      verifyNpmPublishAccess('mahoraga-cli', (args) => {
        if (args[0] === 'whoami') {
          return 'ci_bot\n'
        }
        if (args.join(' ') === 'owner ls mahoraga-cli') {
          return 'mahoraga_eng <eng@felafax.ai>\n'
        }
        throw new Error(`unexpected npm args: ${args.join(' ')}`)
      }),
    ).toThrow(
      'NPM_TOKEN authenticates as ci_bot, but mahoraga-cli owners are: mahoraga_eng',
    )
  })

  test('rejects an unreadable owner list', () => {
    expect(() =>
      verifyNpmPublishAccess('mahoraga-cli', (args) => {
        if (args[0] === 'whoami') {
          return 'mahoraga_eng\n'
        }
        if (args.join(' ') === 'owner ls mahoraga-cli') {
          return '\n'
        }
        throw new Error(`unexpected npm args: ${args.join(' ')}`)
      }),
    ).toThrow('No npm owners found for mahoraga-cli')
  })

  test('rejects owner tokens without read-write package access', () => {
    expect(() =>
      verifyNpmPublishAccess('mahoraga-cli', (args) => {
        if (args[0] === 'whoami') {
          return 'mahoraga_eng\n'
        }
        if (args.join(' ') === 'owner ls mahoraga-cli') {
          return 'mahoraga_eng <eng@felafax.ai>\n'
        }
        if (
          args.join(' ') ===
          'access list collaborators mahoraga-cli mahoraga_eng --json'
        ) {
          return JSON.stringify({ mahoraga_eng: 'read-only' })
        }
        throw new Error(`unexpected npm args: ${args.join(' ')}`)
      }),
    ).toThrow('does not have read-write access to mahoraga-cli')
  })
})
