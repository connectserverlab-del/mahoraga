#!/usr/bin/env bun

import { runProdResourceBuild } from '@mahoraga/build-server-tools'

import { mahoragaServerBuildProduct } from './server/descriptor'

runProdResourceBuild(mahoragaServerBuildProduct, process.argv.slice(2)).catch(
  (error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n✗ ${message}\n`)
    process.exit(1)
  },
)
