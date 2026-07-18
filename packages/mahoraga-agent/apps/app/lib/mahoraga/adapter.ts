// biome-ignore-all lint/suspicious/noExplicitAny: Low-level browser API adapter requires flexible types
/// <reference path="./chrome-browser-os.d.ts" />

export type PrefObject = chrome.mahoraga.PrefObject
export type ChoosePathOptions = chrome.mahoraga.ChoosePathOptions
export type SelectedPath = chrome.mahoraga.SelectedPath

export class MahoragaAdapter {
  private static instance: MahoragaAdapter | null = null

  private constructor() {}

  static getInstance(): MahoragaAdapter {
    if (!MahoragaAdapter.instance) {
      MahoragaAdapter.instance = new MahoragaAdapter()
    }
    return MahoragaAdapter.instance
  }

  async getVersion(): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      if (typeof chrome.mahoraga.getVersionNumber !== 'function') {
        resolve(null)
        return
      }

      chrome.mahoraga.getVersionNumber((version: string) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown error'))
        } else {
          resolve(version)
        }
      })
    })
  }

  async getMahoragaVersion(): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      if (typeof chrome.mahoraga.getMahoragaVersionNumber !== 'function') {
        resolve(null)
        return
      }

      chrome.mahoraga.getMahoragaVersionNumber((version: string) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown error'))
        } else {
          resolve(version)
        }
      })
    })
  }

  async logMetric(
    eventName: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    if (typeof chrome.mahoraga.logMetric !== 'function') {
      return
    }

    return new Promise<void>((resolve, reject) => {
      const callback = () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown error'))
        } else {
          resolve()
        }
      }

      if (properties) {
        chrome.mahoraga.logMetric(eventName, properties, callback)
      } else {
        chrome.mahoraga.logMetric(eventName, callback)
      }
    })
  }

  async getPref(name: string): Promise<PrefObject> {
    if (typeof chrome.mahoraga?.getPref !== 'function') {
      throw new Error('getPref API not available')
    }

    return new Promise<PrefObject>((resolve, reject) => {
      chrome.mahoraga.getPref(name, (pref: PrefObject) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown error'))
        } else {
          resolve(pref)
        }
      })
    })
  }

  async setPref(name: string, value: any, pageId?: string): Promise<boolean> {
    if (typeof chrome.mahoraga?.setPref !== 'function') {
      throw new Error('setPref API not available')
    }

    return new Promise<boolean>((resolve, reject) => {
      const callback = (success: boolean) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown error'))
        } else {
          resolve(success)
        }
      }

      if (pageId !== undefined) {
        chrome.mahoraga.setPref(name, value, pageId, callback)
      } else {
        chrome.mahoraga.setPref(name, value, callback)
      }
    })
  }

  async choosePath(options?: ChoosePathOptions): Promise<SelectedPath | null> {
    if (typeof chrome.mahoraga?.choosePath !== 'function') {
      throw new Error('choosePath API not available')
    }

    return new Promise<SelectedPath | null>((resolve, reject) => {
      const callback = (result: SelectedPath | null) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown error'))
        } else {
          resolve(result)
        }
      }

      if (options) {
        chrome.mahoraga.choosePath(options, callback)
      } else {
        chrome.mahoraga.choosePath(callback)
      }
    })
  }

  isAPIAvailable(method: string): boolean {
    return method in chrome.mahoraga
  }

  getAvailableAPIs(): string[] {
    return Object.keys(chrome.mahoraga).filter(
      (key) => typeof (chrome.mahoraga as any)[key] === 'function',
    )
  }
}

/** @public */
export const getMahoragaAdapter = () => MahoragaAdapter.getInstance()
