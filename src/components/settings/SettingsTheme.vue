<template>
  <div>
    <h3 class="settings-section-title">Theme</h3>
    <div class="theme-grid">
      <button
        v-for="theme in themes"
        :key="theme.id"
        class="theme-card"
        :class="{ active: workspace.theme === theme.id }"
        @click="workspace.setTheme(theme.id)"
      >
        <!-- Mini preview -->
        <div class="theme-preview" :style="{ background: theme.colors.bgPrimary }">
          <!-- Sidebar -->
          <div class="theme-preview-sidebar" :style="{ background: theme.colors.bgSecondary }"></div>
          <!-- Editor area -->
          <div class="theme-preview-editor">
            <div class="theme-preview-line" :style="{ background: theme.colors.fgMuted, width: '60%' }"></div>
            <div class="theme-preview-line" :style="{ background: theme.colors.accent, width: '45%' }"></div>
            <div class="theme-preview-line" :style="{ background: theme.colors.fgMuted, width: '70%' }"></div>
            <div class="theme-preview-line" :style="{ background: theme.colors.accentSecondary, width: '35%' }"></div>
            <div class="theme-preview-line" :style="{ background: theme.colors.fgMuted, width: '55%' }"></div>
          </div>
        </div>
        <!-- Label -->
        <div class="theme-label">{{ theme.label }}</div>
        <!-- Color dots -->
        <div class="theme-dots">
          <span class="theme-dot" :style="{ background: theme.colors.accent }"></span>
          <span class="theme-dot" :style="{ background: theme.colors.accentSecondary }"></span>
          <span class="theme-dot" :style="{ background: theme.colors.success }"></span>
          <span class="theme-dot" :style="{ background: theme.colors.error }"></span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useWorkspaceStore } from '../../stores/workspace'

const workspace = useWorkspaceStore()

const themes = [
  // Light themes
  {
    id: 'light',
    label: 'Light',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f6f8',
      fgMuted: '#999999',
      accent: '#5f9ea0',
      accentSecondary: '#4a7c7e',
      success: '#2e7d32',
      error: '#c62828',
    },
  },
  {
    id: 'solarized',
    label: 'Solarized Light',
    colors: {
      bgPrimary: '#fdf6e3',
      bgSecondary: '#eee8d5',
      fgMuted: '#93a1a1',
      accent: '#268bd2',
      accentSecondary: '#6c71c4',
      success: '#859900',
      error: '#dc322f',
    },
  },
  {
    id: 'one-light',
    label: 'One Light',
    colors: {
      bgPrimary: '#fafafa',
      bgSecondary: '#f0f0f1',
      fgMuted: '#a0a1a7',
      accent: '#4078f2',
      accentSecondary: '#a626a4',
      success: '#50a14f',
      error: '#e45649',
    },
  },
  {
    id: 'humane',
    label: 'Humane',
    colors: {
      bgPrimary: '#faf9f5',
      bgSecondary: '#f2f0e7',
      fgMuted: '#9a9389',
      accent: '#b5623a',
      accentSecondary: '#6b8065',
      success: '#5a7d3a',
      error: '#b84a3c',
    },
  },
  // Dark themes
  {
    id: 'default',
    label: 'Tokyo Night',
    colors: {
      bgPrimary: '#1a1b26',
      bgSecondary: '#1f2335',
      fgMuted: '#565f89',
      accent: '#7aa2f7',
      accentSecondary: '#bb9af7',
      success: '#9ece6a',
      error: '#f7768e',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#21222c',
      fgMuted: '#6272a4',
      accent: '#bd93f9',
      accentSecondary: '#ff79c6',
      success: '#50fa7b',
      error: '#ff5555',
    },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    colors: {
      bgPrimary: '#272822',
      bgSecondary: '#1e1f1c',
      fgMuted: '#75715e',
      accent: '#fd971f',
      accentSecondary: '#f92672',
      success: '#a6e22e',
      error: '#f92672',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    colors: {
      bgPrimary: '#2e3440',
      bgSecondary: '#3b4252',
      fgMuted: '#616e88',
      accent: '#88c0d0',
      accentSecondary: '#81a1c1',
      success: '#a3be8c',
      error: '#bf616a',
    },
  },
]
</script>

<style scoped>
.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.theme-card {
  background: var(--bg-primary);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
  text-align: left;
}

.theme-card:hover {
  border-color: var(--fg-muted);
}

.theme-card.active {
  border-color: var(--accent);
}

.theme-preview {
  height: 62px;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
  margin-bottom: 8px;
}

.theme-preview-sidebar {
  width: 20%;
}

.theme-preview-editor {
  flex: 1;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
}

.theme-preview-line {
  height: 3px;
  border-radius: 1px;
  opacity: 0.7;
}

.theme-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-primary);
  margin-bottom: 4px;
}

.theme-dots {
  display: flex;
  gap: 4px;
}

.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
