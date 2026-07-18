/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
  MAHORAGA_ONBOARDING_API_VERSION,
  type MahoragaImportProgress,
  type MahoragaImportSource,
  type MahoragaImportSourceResult,
  type MahoragaOnboardingChrome,
  MahoragaOnboardingMessage,
  type MahoragaOnboardingState,
  type MahoragaStartImportRequest,
} from './mahoraga-onboarding-api'
import { MOCK_MAHORAGA_IMPORT_SOURCES } from './onboarding-v2.helpers'

export interface MahoragaOnboardingBridge {
  isMock: boolean
  complete(): void
  pageReady(): void
  refreshSources(): void
  registerReceiver(
    receiveState: (state: MahoragaOnboardingState) => void,
  ): () => void
  startImport(request: MahoragaStartImportRequest): void
}

interface MahoragaOnboardingBridgeOptions {
  chrome?: MahoragaOnboardingChrome | null
  mockTiming?: 'delayed' | 'sync'
}

const MOCK_READY_DELAY_MS = 250
const MOCK_PROGRESS_DELAY_MS = 650
const MOCK_SUCCESS_DELAY_MS = 1300

function getHostWindow(): Window | undefined {
  if (typeof window === 'undefined') return undefined
  return window
}

function getChromeBridge(
  chromeOverride: MahoragaOnboardingChrome | null | undefined,
): MahoragaOnboardingChrome | null {
  if (chromeOverride !== undefined) return chromeOverride
  const candidate = (
    globalThis as typeof globalThis & {
      chrome?: MahoragaOnboardingChrome
    }
  ).chrome
  return typeof candidate?.send === 'function' ? candidate : null
}

function createState(
  status: MahoragaOnboardingState['status'],
  progress?: MahoragaImportProgress,
  results?: MahoragaImportSourceResult[],
): MahoragaOnboardingState {
  return {
    apiVersion: MAHORAGA_ONBOARDING_API_VERSION,
    status,
    sources: [...MOCK_MAHORAGA_IMPORT_SOURCES],
    ...(progress ? { progress } : {}),
    ...(results ? { results } : {}),
  }
}

function emitMockState(state: MahoragaOnboardingState) {
  getHostWindow()?.mahoragaOnboarding?.receiveState(state)
}

function scheduleMockState(state: MahoragaOnboardingState, delayMs: number) {
  const hostWindow = getHostWindow()
  const schedule = hostWindow?.setTimeout ?? globalThis.setTimeout
  schedule(() => emitMockState(state), delayMs)
}

function recommendedItemsFor(request: MahoragaStartImportRequest) {
  if (request.items?.length) return request.items
  return (
    MOCK_MAHORAGA_IMPORT_SOURCES.find(
      (source) => source.id === request.sourceId,
    )?.recommendedItems ?? []
  )
}

function mockSourceFor(request: MahoragaStartImportRequest) {
  return MOCK_MAHORAGA_IMPORT_SOURCES.find(
    (source) => source.id === request.sourceId,
  )
}

function sourceDisplayNameFor(
  request: MahoragaStartImportRequest,
  source: MahoragaImportSource | undefined,
) {
  return source?.displayName ?? request.sourceId
}

function emitMockImport(request: MahoragaStartImportRequest, sync: boolean) {
  const items = recommendedItemsFor(request)
  const source = mockSourceFor(request)
  const sourceName = sourceDisplayNameFor(request, source)
  const started = createState(
    'importing',
    {
      currentItem: items[0],
      currentSourceId: request.sourceId,
      currentSourceName: sourceName,
      completedItems: [],
      totalItems: items.length,
      completedSources: 0,
      totalSources: 1,
    },
    [
      {
        sourceId: request.sourceId,
        displayName: sourceName,
        status: 'importing',
      },
    ],
  )
  const halfway = createState(
    'importing',
    {
      currentItem: items[1],
      currentSourceId: request.sourceId,
      currentSourceName: sourceName,
      completedItems: items.slice(0, 1),
      totalItems: items.length,
      completedSources: 0,
      totalSources: 1,
    },
    [
      {
        sourceId: request.sourceId,
        displayName: sourceName,
        status: 'importing',
      },
    ],
  )
  const succeeded = createState(
    'succeeded',
    {
      completedItems: items,
      totalItems: items.length,
      completedSources: 1,
      totalSources: 1,
    },
    [
      {
        sourceId: request.sourceId,
        displayName: sourceName,
        status: 'succeeded',
      },
    ],
  )

  emitMockState(started)
  if (sync) {
    emitMockState(halfway)
    emitMockState(succeeded)
    return
  }
  scheduleMockState(halfway, MOCK_PROGRESS_DELAY_MS)
  scheduleMockState(succeeded, MOCK_SUCCESS_DELAY_MS)
}

/** Creates the Chromium WebUI bridge, falling back to mock state in Vite. */
export function createMahoragaOnboardingBridge(
  options: MahoragaOnboardingBridgeOptions = {},
): MahoragaOnboardingBridge {
  const chromeBridge = getChromeBridge(options.chrome)
  const isMock = !chromeBridge
  const mockIsSync = options.mockTiming === 'sync'

  return {
    isMock,
    complete() {
      if (!isMock) {
        chromeBridge.send(MahoragaOnboardingMessage.COMPLETE)
        return
      }
      emitMockState(createState('completed'))
    },
    pageReady() {
      if (!isMock) {
        chromeBridge.send(MahoragaOnboardingMessage.PAGE_READY)
        return
      }
      emitMockState(createState('detecting'))
      if (mockIsSync) {
        emitMockState(createState('ready'))
        return
      }
      scheduleMockState(createState('ready'), MOCK_READY_DELAY_MS)
    },
    refreshSources() {
      if (!isMock) {
        chromeBridge.send(MahoragaOnboardingMessage.REFRESH_SOURCES)
        return
      }
      emitMockState(createState('detecting'))
      if (mockIsSync) {
        emitMockState(createState('ready'))
        return
      }
      scheduleMockState(createState('ready'), MOCK_READY_DELAY_MS)
    },
    registerReceiver(receiveState) {
      const hostWindow = getHostWindow()
      if (!hostWindow) return () => undefined
      const previousClient = hostWindow.mahoragaOnboarding
      const client = { receiveState }
      hostWindow.mahoragaOnboarding = client
      return () => {
        if (hostWindow.mahoragaOnboarding !== client) return
        if (previousClient) {
          hostWindow.mahoragaOnboarding = previousClient
          return
        }
        delete hostWindow.mahoragaOnboarding
      }
    },
    startImport(request) {
      if (request.items && request.items.length === 0) return
      if (!isMock) {
        chromeBridge.send(MahoragaOnboardingMessage.START_IMPORT, [request])
        return
      }
      emitMockImport(request, mockIsSync)
    },
  }
}
