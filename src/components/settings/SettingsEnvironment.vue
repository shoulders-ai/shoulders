<template>
  <div>
    <h3 class="settings-section-title">System</h3>
    <p class="settings-hint">System tools and compilers detected on your machine.</p>

    <div class="env-languages">
      <div v-for="lang in envLanguages" :key="lang.key" class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="envLangDotClass(lang)"></span>
          <span class="env-lang-name">{{ lang.label }}</span>
          <span v-if="lang.info.found" class="env-lang-version">{{ lang.info.version || '' }}</span>
          <span v-else class="env-lang-missing">Not found</span>
        </div>

        <div v-if="lang.info.found" class="env-lang-details">
          <div class="env-lang-path">{{ lang.info.path }}</div>
          <div class="env-lang-kernel-row">
            <span>Jupyter kernel</span>
            <span v-if="lang.info.hasKernel" class="env-kernel-badge env-kernel-yes">Installed</span>
            <template v-else>
              <span class="env-kernel-badge env-kernel-no">Not installed</span>
              <button
                class="env-install-btn"
                :disabled="envStore.installing === lang.key"
                @click="envStore.installKernel(lang.key)"
              >
                {{ envStore.installing === lang.key ? 'Installing...' : 'Install' }}
              </button>
            </template>
          </div>
        </div>

        <div v-else class="env-lang-hint">{{ envStore.installHint(lang.key) }}</div>

        <div v-if="envStore.installing === lang.key && envStore.installError" class="env-install-error">
          {{ envStore.installError }}
        </div>
      </div>
    </div>

    <div class="env-actions">
      <button class="env-redetect-btn" :disabled="envStore.detecting" @click="envStore.detect()">
        {{ envStore.detecting ? 'Detecting...' : 'Re-detect' }}
      </button>
      <span v-if="!envStore.detected" class="env-hint-text">Not yet detected</span>
      <span v-else class="env-hint-text">Last detected this session</span>
    </div>

    <!-- LaTeX Compiler -->
    <h3 class="settings-section-title" style="margin-top: 24px;">LaTeX Compiler</h3>
    <p class="settings-hint">Tectonic compiles .tex files to PDF. A one-time download is required.</p>

    <div class="env-lang-card">
      <!-- Installed state -->
      <template v-if="latexStore.tectonicInstalled">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="latexStore.tectonicEnabled ? 'good' : 'none'"></span>
          <span class="env-lang-name">Tectonic</span>
          <span v-if="latexStore.tectonicEnabled" class="env-lang-version">Installed</span>
          <span v-else class="env-lang-missing">Disabled</span>
          <div style="flex: 1;"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: latexStore.tectonicEnabled }"
            @click="latexStore.setTectonicEnabled(!latexStore.tectonicEnabled)"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
        <div class="env-lang-details">
          <div class="env-lang-path">{{ latexStore.tectonicPath }}</div>
        </div>
      </template>

      <!-- Downloading state -->
      <template v-else-if="latexStore.downloading">
        <div class="env-lang-header">
          <span class="env-lang-dot warn"></span>
          <span class="env-lang-name">Tectonic</span>
          <span class="env-lang-version">Downloading... {{ latexStore.downloadProgress }}%</span>
        </div>
        <div class="tectonic-progress" style="margin: 8px 16px 4px;">
          <div class="tectonic-progress-bar">
            <div class="tectonic-progress-fill" :style="{ width: latexStore.downloadProgress + '%' }"></div>
          </div>
        </div>
      </template>

      <!-- Not installed state -->
      <template v-else>
        <div class="env-lang-header">
          <span class="env-lang-dot none"></span>
          <span class="env-lang-name">Tectonic</span>
          <span class="env-lang-missing">Not installed</span>
        </div>
        <div class="env-lang-hint" style="margin-top: 4px; padding-left: 16px;">
          PDF compilation for LaTeX requires Tectonic, a modern TeX engine. One-time ~15MB download.
        </div>
        <div style="padding-left: 16px; margin-top: 8px;">
          <button class="env-install-btn" @click="latexStore.downloadTectonic()">
            Download Tectonic
          </button>
        </div>
      </template>

      <!-- Error state -->
      <div v-if="latexStore.downloadError" class="env-install-error" style="margin: 6px 16px;">
        {{ latexStore.downloadError }}
        <button class="env-install-btn" style="margin-left: 8px;" @click="latexStore.downloadTectonic()">
          Retry
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useEnvironmentStore } from '../../stores/environment'
import { useLatexStore } from '../../stores/latex'

const envStore = useEnvironmentStore()
const latexStore = useLatexStore()

const envLanguages = computed(() => [
  { key: 'python', label: 'Python', info: envStore.languages.python },
  { key: 'r', label: 'R', info: envStore.languages.r },
  { key: 'julia', label: 'Julia', info: envStore.languages.julia },
])

function envLangDotClass(lang) {
  if (lang.info.hasKernel) return 'good'
  if (lang.info.found) return 'warn'
  return 'none'
}

onMounted(() => {
  if (!envStore.detected) envStore.detect()
  latexStore.checkTectonic()
})
</script>

<style scoped>
.env-languages {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.env-lang-details {
  margin-top: 6px;
  padding-left: 16px;
}

.env-lang-path {
  font-size: 10px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  margin-bottom: 6px;
}

.env-lang-kernel-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--fg-secondary);
}

.env-kernel-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
}

.env-kernel-yes {
  background: rgba(80, 250, 123, 0.1);
  color: var(--success, #50fa7b);
}

.env-kernel-no {
  background: rgba(226, 185, 61, 0.1);
  color: var(--warning, #e2b93d);
}

.env-install-btn {
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.env-install-btn:hover {
  background: rgba(122, 162, 247, 0.2);
}

.env-install-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.env-install-error {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(247, 118, 142, 0.1);
  color: var(--error);
  font-size: 10px;
}

.env-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.env-redetect-btn {
  padding: 5px 14px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.env-redetect-btn:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}

.env-redetect-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.env-hint-text {
  font-size: 10px;
  color: var(--fg-muted);
}

.tectonic-progress-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-primary);
  overflow: hidden;
}

.tectonic-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}
</style>
