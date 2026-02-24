<template>
  <div class="flex flex-col h-full">
    <!-- Terminal container -->
    <div ref="terminalContainer" class="flex-1 overflow-hidden"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useWorkspaceStore } from '../../stores/workspace'
import { terminalThemes } from '../../themes/terminal'
import { defaultShell } from '../../platform'

const props = defineProps({
  termId: { type: Number, default: 1 },
  spawnCmd: { type: String, default: null },
  spawnArgs: { type: Array, default: () => [] },
  language: { type: String, default: null },
})

const workspace = useWorkspaceStore()
const terminalContainer = ref(null)

let terminal = null
let fitAddon = null
let ptyId = null
let unlistenOutput = null
let unlistenExit = null
let resizeObserver = null

async function initXterm() {
  const { Terminal } = await import('@xterm/xterm')
  const { FitAddon } = await import('@xterm/addon-fit')
  const { WebLinksAddon } = await import('@xterm/addon-web-links')
  await import('@xterm/xterm/css/xterm.css')

  terminal = new Terminal({
    theme: terminalThemes[workspace.theme] || terminalThemes.default,
    fontFamily: "'JetBrains Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
    fontSize: 13,
    lineHeight: 1.4,
    cursorBlink: true,
    scrollback: 10000,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  terminal.open(terminalContainer.value)

  await nextTick()
  fitAddon.fit()

  resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      fitAddon.fit()
      if (ptyId !== null && terminal) {
        invoke('pty_resize', {
          id: ptyId,
          cols: terminal.cols,
          rows: terminal.rows,
        }).catch(() => {})
      }
    }
  })
  resizeObserver.observe(terminalContainer.value)

  terminal.onData((data) => {
    if (ptyId !== null) {
      invoke('pty_write', { id: ptyId, data }).catch(console.error)
    }
  })

  terminal.onResize(({ cols, rows }) => {
    if (ptyId !== null) {
      invoke('pty_resize', { id: ptyId, cols, rows }).catch(() => {})
    }
  })
}

async function spawnTerminal() {
  if (!workspace.path || !terminal) return

  try {
    const cmd = props.spawnCmd || defaultShell().cmd
    const args = props.spawnCmd ? props.spawnArgs : defaultShell().args
    ptyId = await invoke('pty_spawn', {
      cmd,
      args,
      cwd: workspace.path,
      cols: terminal.cols,
      rows: terminal.rows,
    })

    unlistenOutput = await listen(`pty-output-${ptyId}`, (event) => {
      if (terminal && event.payload?.data) {
        terminal.write(event.payload.data)
      }
    })

    unlistenExit = await listen(`pty-exit-${ptyId}`, () => {
      ptyId = null
      if (terminal) {
        terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
      }
    })
  } catch (e) {
    console.error('Failed to spawn terminal:', e)
    if (terminal) terminal.write(`\r\nError: ${e}\r\n`)
  }
}

async function killTerminal() {
  if (ptyId !== null) {
    try {
      await invoke('pty_kill', { id: ptyId })
    } catch (e) {
      console.error('Failed to kill PTY:', e)
    }
    ptyId = null
  }
}

onMounted(async () => {
  await nextTick()
  if (terminalContainer.value) {
    await initXterm()
    if (workspace.path) {
      await spawnTerminal()
    }
  }
})

// Update terminal theme when app theme changes
watch(() => workspace.theme, (theme) => {
  if (terminal) {
    terminal.options.theme = terminalThemes[theme] || terminalThemes.default
  }
})

defineExpose({
  focus() {
    if (terminal) terminal.focus()
  },
  refitTerminal() {
    if (fitAddon) fitAddon.fit()
  },
  async writeToPty(data) {
    if (ptyId === null) return

    // Small payloads (< 2KB): send directly (well under 4KB PTY buffer)
    if (data.length < 2048) {
      await invoke('pty_write', { id: ptyId, data }).catch(console.error)
      return
    }

    // Large payloads: send in ~2KB chunks with brief pauses to avoid PTY buffer overflow
    const CHUNK_SIZE = 2048
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      let end = Math.min(offset + CHUNK_SIZE, data.length)
      // Try to break at a newline boundary to avoid splitting mid-line
      if (end < data.length) {
        const nl = data.lastIndexOf('\n', end)
        if (nl > offset) end = nl + 1
      }
      await invoke('pty_write', { id: ptyId, data: data.slice(offset, end) }).catch(console.error)
      if (end < data.length) {
        await new Promise(r => setTimeout(r, 10))
      }
    }
  },
})

onUnmounted(() => {
  if (unlistenOutput) unlistenOutput()
  if (unlistenExit) unlistenExit()
  if (resizeObserver) resizeObserver.disconnect()
  if (terminal) terminal.dispose()
  killTerminal()
})
</script>
