import {
  type BuildProductDescriptor,
  wasmBinaryPlugin,
} from '@mahoraga/build-server-tools'

export const SERVER_BUNDLE_ENTRYPOINT = 'apps/server/src/compiled-bootstrap.ts'

const REQUIRED_PROD_VARS = [
  'MAHORAGA_CONFIG_URL',
  'POSTHOG_API_KEY',
  'SENTRY_DSN',
]
const INLINED_ENV_VARS = [
  ...REQUIRED_PROD_VARS,
  'AGENT_RUNNER_JWT_SECRET',
  'NODE_ENV',
  'LOG_LEVEL',
] as const
const CI_INLINE_ENV_DEFAULTS = {
  MAHORAGA_CONFIG_URL: 'https://mahoraga.invalid/api/mahoraga-server/config',
  LOG_LEVEL: 'info',
  NODE_ENV: 'production',
  POSTHOG_API_KEY: 'phc_mahoraga_ci',
  SENTRY_DSN: 'https://ci@sentry.invalid/1',
}

export const mahoragaServerBuildProduct: BuildProductDescriptor = {
  label: 'Mahoraga server',
  packageDir: 'apps/server',
  entrypoint: SERVER_BUNDLE_ENTRYPOINT,
  distRoot: 'dist/prod/server',
  rawBinaryBaseName: 'mahoraga-server',
  stagedBinaryBaseName: 'mahoraga_server',
  archiveBaseName: 'mahoraga-server-resources',
  defaultManifestPath: 'scripts/build/config/server-prod-resources.json',
  env: {
    requiredInlineEnvKeys: REQUIRED_PROD_VARS,
    inlineEnvKeys: INLINED_ENV_VARS,
    ciInlineEnvDefaults: CI_INLINE_ENV_DEFAULTS,
    defaultR2UploadPrefix: 'artifacts/server',
    defaultR2DownloadPrefix: 'artifacts/vendor',
  },
  bundle: {
    external: ['node-pty'],
    plugins: [wasmBinaryPlugin()],
  },
}
