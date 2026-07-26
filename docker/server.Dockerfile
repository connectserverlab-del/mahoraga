# Mahoraga agent server image.
# Build from the repository root:
#   docker build -f docker/server.Dockerfile -t mahoraga-server .
FROM oven/bun:1-slim

WORKDIR /app

# Workspace manifests first for layer caching
COPY packages/mahoraga-agent/package.json packages/mahoraga-agent/bun.lock packages/mahoraga-agent/bunfig.toml ./
COPY packages/mahoraga-agent/apps ./apps
COPY packages/mahoraga-agent/packages ./packages
COPY packages/mahoraga-agent/scripts ./scripts
COPY packages/mahoraga-agent/third_party ./third_party
COPY packages/mahoraga-agent/tsconfig.json ./

RUN bun install --frozen-lockfile

# Server env: start from the checked-in example; override via compose `environment:`
COPY packages/mahoraga-agent/.env.development.example ./.env.development
COPY docker/config.docker.json ./config.docker.json

ENV NODE_ENV=development \
    LOG_LEVEL=info

EXPOSE 9100

WORKDIR /app/apps/server
CMD ["bun", "--env-file=../../.env.development", "src/index.ts", "--config", "../../config.docker.json"]
