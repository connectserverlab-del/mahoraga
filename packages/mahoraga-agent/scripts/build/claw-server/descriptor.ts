import type { BuildProductDescriptor } from '@mahoraga/build-server-tools'

export const CLAW_SERVER_BUNDLE_ENTRYPOINT = 'apps/claw-server/src/main.ts'

const REQUIRED_PROD_VARS = ['CLAW_POSTHOG_KEY'] as const
const INLINED_ENV_VARS = [
  ...REQUIRED_PROD_VARS,
  'CLAW_POSTHOG_HOST',
  'NODE_ENV',
] as const
const PRODUCTION_INLINE_ENV = {
  NODE_ENV: 'production',
}

export const clawServerBuildProduct: BuildProductDescriptor = {
  label: 'Mahoraga Claw server',
  packageDir: 'apps/claw-server',
  entrypoint: CLAW_SERVER_BUNDLE_ENTRYPOINT,
  distRoot: 'dist/prod/claw-server',
  rawBinaryBaseName: 'mahoraga-claw-server',
  stagedBinaryBaseName: 'mahoraga-claw-server',
  archiveBaseName: 'mahoraga-claw-server-resources',
  defaultManifestPath: 'scripts/build/config/claw-server-prod-resources.json',
  env: {
    requiredInlineEnvKeys: REQUIRED_PROD_VARS,
    inlineEnvKeys: INLINED_ENV_VARS,
    ciInlineEnvDefaults: PRODUCTION_INLINE_ENV,
    inlineEnvOverrides: PRODUCTION_INLINE_ENV,
    defaultR2UploadPrefix: 'claw-server/prod-resources',
  },
}
