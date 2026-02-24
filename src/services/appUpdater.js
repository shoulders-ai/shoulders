import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'

let _downloadedUpdate = null

export async function getAppVersion() {
  try {
    return await getVersion()
  } catch {
    return '0.0.0'
  }
}

/**
 * Check for available updates. Returns the update object or null.
 * Never throws — errors are caught and logged.
 */
export async function checkForUpdate() {
  try {
    const update = await check()
    return update ?? null
  } catch (e) {
    console.warn('[updater] Check failed:', e)
    return null
  }
}

/**
 * Download the update. Calls onProgress(percent) during download.
 * Returns true on success, false on failure.
 */
export async function downloadUpdate(update, onProgress) {
  if (!update) return false
  try {
    let contentLength = 0
    let downloaded = 0

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0
          break
        case 'Progress':
          downloaded += event.data.chunkLength
          if (contentLength > 0 && onProgress) {
            onProgress(Math.round((downloaded / contentLength) * 100))
          }
          break
        case 'Finished':
          if (onProgress) onProgress(100)
          break
      }
    })

    _downloadedUpdate = update
    return true
  } catch (e) {
    console.error('[updater] Download failed:', e)
    return false
  }
}

/**
 * Relaunch the app to apply the downloaded update.
 */
export async function installAndRestart() {
  await relaunch()
}

/**
 * Whether auto-check is enabled (default: true).
 */
export function isAutoCheckEnabled() {
  return localStorage.getItem('autoCheckUpdates') !== 'false'
}

export function setAutoCheckEnabled(enabled) {
  localStorage.setItem('autoCheckUpdates', enabled ? 'true' : 'false')
}
