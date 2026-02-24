import { useDb } from '../../../db/index.js'
import { telemetryEvents } from '../../../db/schema.js'
import { generateId } from '../../../utils/id.js'

const ALLOWED_EVENT_TYPES = new Set([
  'app_open', 'app_close', 'file_open', 'file_save',
  'chat_message', 'chat_tool_use', 'ghost_accept', 'ghost_reject',
  'export_pdf', 'export_docx', 'export_typst',
  'theme_change', 'workspace_open', 'error',
])

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const events = body.events

  if (!Array.isArray(events) || events.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'events array is required' }
  }

  if (events.length > 100) {
    setResponseStatus(event, 400)
    return { error: 'Maximum 100 events per batch' }
  }

  const db = useDb()
  const now = new Date().toISOString()

  let inserted = 0
  for (const evt of events) {
    if (!evt.event_type || !ALLOWED_EVENT_TYPES.has(evt.event_type)) continue

    db.insert(telemetryEvents).values({
      id: generateId(),
      deviceId: evt.device_id || null,
      eventType: evt.event_type,
      eventData: evt.event_data ? JSON.stringify(evt.event_data) : null,
      appVersion: evt.app_version || null,
      platform: evt.platform || null,
      createdAt: evt.timestamp || now,
    }).run()

    inserted++
  }

  return { inserted }
})
