/**
 * Anonymous telemetry service for Shoulders.
 * Opt-in only. Sends batched events to the Shoulders API.
 * No personal data — just usage patterns with a random device ID.
 */

import { invoke } from '@tauri-apps/api/core'

const ENDPOINT = 'https://shoulde.rs/api/v1/telemetry/events'
const FLUSH_INTERVAL = 60_000 // 1 minute
const MAX_QUEUE = 200
const STORAGE_KEY = 'shoulders_telemetry'
const DEVICE_ID_KEY = 'shoulders_device_id'

let queue = []
let flushTimer = null
let enabled = false
let deviceId = null
let appVersion = null
let platform = null

export function initTelemetry() {
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    enabled = prefs.enabled === true
    deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
  } catch { /* ignore */ }

  // Detect platform
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) platform = 'macos'
  else if (ua.includes('win')) platform = 'windows'
  else if (ua.includes('linux')) platform = 'linux'

  if (enabled) startFlushing()
}

export function setTelemetryEnabled(value) {
  enabled = value
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }))
  } catch { /* ignore */ }

  if (enabled) {
    startFlushing()
  } else {
    stopFlushing()
    queue = []
  }
}

export function isTelemetryEnabled() {
  return enabled
}

export function trackEvent(eventType, eventData = null) {
  if (!enabled) return

  queue.push({
    device_id: deviceId,
    event_type: eventType,
    event_data: eventData,
    app_version: appVersion,
    platform,
    timestamp: new Date().toISOString(),
  })

  if (queue.length >= MAX_QUEUE) flush()
}

export function setAppVersion(version) {
  appVersion = version
}

async function flush() {
  if (queue.length === 0) return

  const batch = queue.splice(0, 100)
  try {
    await invoke('proxy_api_call', {
      request: {
        url: ENDPOINT,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      },
    })
  } catch {
    // Put failed events back (but don't exceed max)
    queue.unshift(...batch.slice(0, MAX_QUEUE - queue.length))
  }
}

function startFlushing() {
  if (flushTimer) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL)
}

function stopFlushing() {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}

// Convenience event helpers
export const events = {
  appOpen: () => trackEvent('app_open'),
  fileOpen: (ext) => trackEvent('file_open', { ext }),
  chatSend: (provider) => trackEvent('chat_send', { provider }),
  ghostTrigger: () => trackEvent('ghost_trigger'),
  refImport: (method) => trackEvent('ref_import', { method }),
  themeChange: (theme) => trackEvent('theme_change', { theme }),
}
