<template>
  <div class="docx-toolbar-wrap" v-if="editor">
    <div class="dtb-row" ref="toolbarRow">
      <!-- Group 0: History + Zoom (always visible — never overflows) -->
      <div class="dtb-mgroup" ref="mg0">
        <div class="dtb-group">
          <button class="dtb-btn" title="Undo" @click="cmd('undo')" :disabled="!canUndo">
            <IconArrowBackUp :size="16" />
          </button>
          <button class="dtb-btn" title="Redo" @click="cmd('redo')" :disabled="!canRedo">
            <IconArrowForwardUp :size="16" />
          </button>
        </div>
        <div class="dtb-sep"></div>
        <div class="dtb-group dtb-zoom-group">
          <button class="dtb-btn dtb-zoom-btn" title="Zoom Out" @click="workspace.docxZoomOut()" :disabled="workspace.docxZoomPercent <= 50">
            <IconMinus :size="14" />
          </button>
          <button class="dtb-btn dtb-zoom-pct" title="Zoom" @click.stop="toggleDropdown('zoom', $event)" ref="zoomBtn">
            <span class="dtb-label">{{ workspace.docxZoomPercent }}%</span>
          </button>
          <button class="dtb-btn dtb-zoom-btn" title="Zoom In" @click="workspace.docxZoomIn()" :disabled="workspace.docxZoomPercent >= 200">
            <IconPlus :size="14" />
          </button>
        </div>
      </div>

      <!-- Group 1: Styles -->
      <div class="dtb-mgroup" ref="mg1">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn dtb-dropdown-trigger" title="Paragraph Style" @click.stop="toggleDropdown('styles', $event)" ref="stylesBtn" style="width:100px">
            <span class="dtb-label">{{ currentStyle || 'Styles' }}</span>
            <IconChevronDown :size="12" />
          </button>
        </div>
      </div>

      <!-- Group 2: Font -->
      <div class="dtb-mgroup" ref="mg2">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn dtb-dropdown-trigger" title="Font" @click.stop="toggleDropdown('font', $event)" ref="fontBtn" style="width:110px">
            <span class="dtb-label">{{ currentFont || 'Font' }}</span>
            <IconChevronDown :size="12" />
          </button>
          <button class="dtb-btn dtb-dropdown-trigger" title="Font Size" @click.stop="toggleDropdown('size', $event)" ref="sizeBtn">
            <span class="dtb-label">{{ currentSize || '12' }}</span>
            <IconChevronDown :size="12" />
          </button>
        </div>
      </div>

      <!-- Group 3: Text Formatting -->
      <div class="dtb-mgroup" ref="mg3">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn" :class="{ active: isBold }" title="Bold (Cmd+B)" @click="cmd('toggleBold')">
            <IconBold :size="16" />
          </button>
          <button class="dtb-btn" :class="{ active: isItalic }" title="Italic (Cmd+I)" @click="cmd('toggleItalic')">
            <IconItalic :size="16" />
          </button>
          <button class="dtb-btn" :class="{ active: isUnderline }" title="Underline (Cmd+U)" @click="cmd('toggleUnderline')">
            <IconUnderline :size="16" />
          </button>
          <button class="dtb-btn" :class="{ active: isStrike }" title="Strikethrough" @click="cmd('toggleStrike')">
            <IconStrikethrough :size="16" />
          </button>
          <button class="dtb-btn dtb-color-btn" title="Text Color" @click.stop="toggleDropdown('color', $event)" ref="colorBtn">
            <IconLetterA :size="16" />
            <span class="dtb-color-bar" :style="{ background: currentColor || 'var(--fg-primary)' }"></span>
          </button>
          <button class="dtb-btn dtb-color-btn" title="Highlight Color" @click.stop="toggleDropdown('highlight', $event)" ref="highlightBtn">
            <IconHighlight :size="16" />
            <span class="dtb-color-bar" :style="{ background: currentHighlight || '#ffd43b' }"></span>
          </button>
          <button class="dtb-btn" title="Clear Formatting" @click="clearFormat">
            <IconClearFormatting :size="16" />
          </button>
        </div>
      </div>

      <!-- Group 4: Mode Toggle (higher priority than Paragraph/Insert/TC) -->
      <div class="dtb-mgroup" ref="mg4">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn dtb-dropdown-trigger" :class="{ active: documentMode === 'suggesting' }" title="Document Mode" @click.stop="toggleDropdown('mode', $event)" ref="modeBtn">
            <IconPencil :size="16" />
            <span class="dtb-label">{{ documentMode === 'suggesting' ? 'Suggesting' : 'Editing' }}</span>
            <IconChevronDown :size="12" />
          </button>
        </div>
      </div>

      <!-- Group 5: Paragraph -->
      <div class="dtb-mgroup" ref="mg5">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn dtb-dropdown-trigger" title="Alignment" @click.stop="toggleDropdown('align', $event)" ref="alignBtn">
            <component :is="alignIcon" :size="16" />
            <IconChevronDown :size="12" />
          </button>
          <button class="dtb-btn" :class="{ active: isBullet }" title="Bullet List" @click="cmd('toggleBulletList')">
            <IconList :size="16" />
          </button>
          <button class="dtb-btn" :class="{ active: isOrdered }" title="Numbered List" @click="cmd('toggleOrderedList')">
            <IconListNumbers :size="16" />
          </button>
          <button class="dtb-btn" title="Decrease Indent" @click="cmd('decreaseTextIndent')">
            <IconIndentDecrease :size="16" />
          </button>
          <button class="dtb-btn" title="Increase Indent" @click="cmd('increaseTextIndent')">
            <IconIndentIncrease :size="16" />
          </button>
          <button class="dtb-btn dtb-dropdown-trigger" title="Line Height" @click.stop="toggleDropdown('lineHeight', $event)" ref="lineHeightBtn">
            <IconLineHeight :size="16" />
            <IconChevronDown :size="12" />
          </button>
        </div>
      </div>

      <!-- Group 6: Insert -->
      <div class="dtb-mgroup" ref="mg6">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn" title="Insert Link" @click.stop="toggleDropdown('link', $event)" ref="linkBtn">
            <IconLink :size="16" />
          </button>
          <button class="dtb-btn" title="Insert Image" @click="insertImage">
            <IconPhoto :size="16" />
          </button>
          <button class="dtb-btn" title="Insert Table" @click.stop="toggleDropdown('table', $event)" ref="tableBtn">
            <IconTable :size="16" />
          </button>
          <button class="dtb-btn" :title="hasBib ? 'Refresh Bibliography' : 'Insert Bibliography'" @click="insertOrRefreshBibliography">
            <component :is="hasBib ? IconRefresh : IconBlockquote" :size="16" />
          </button>
        </div>
      </div>

      <!-- Group 7: Track Changes (conditional) -->
      <div class="dtb-mgroup" ref="mg7" v-if="showTrackChanges">
        <div class="dtb-sep"></div>
        <div class="dtb-group">
          <button class="dtb-btn" :class="{ active: isTrackChangesActive }" title="Toggle Track Changes" @click="toggleTrackChanges">
            <IconGitMerge :size="16" />
          </button>
          <span v-if="trackedChangeCount > 0" class="dtb-badge">{{ trackedChangeCount }}</span>
          <button class="dtb-btn" title="Previous Change" @click="goToPrevChange" :disabled="!hasAnyTrackedChanges">
            <IconArrowLeft :size="14" />
          </button>
          <button class="dtb-btn" title="Next Change" @click="goToNextChange" :disabled="!hasAnyTrackedChanges">
            <IconArrowRight :size="14" />
          </button>
          <div class="dtb-sep" style="height:16px; margin:0 3px;"></div>
          <button class="dtb-btn dtb-accept" title="Accept Change" @click="acceptChange" :disabled="!hasTrackedChange">
            <IconCheck :size="16" />
          </button>
          <button class="dtb-btn dtb-reject" title="Reject Change" @click="rejectChange" :disabled="!hasTrackedChange">
            <IconX :size="16" />
          </button>
          <div class="dtb-sep" style="height:16px; margin:0 3px;"></div>
          <button class="dtb-btn dtb-accept" title="Accept All Changes" @click="acceptAllChanges" :disabled="!hasAnyTrackedChanges">
            <IconChecks :size="16" />
          </button>
          <button class="dtb-btn dtb-reject" title="Reject All Changes" @click="rejectAllChanges" :disabled="!hasAnyTrackedChanges">
            <IconSquareX :size="16" />
          </button>
        </div>
      </div>

      <!-- Overflow button (before spacer so it sits next to last visible group) -->
      <button v-show="overflowGroups.length > 0" class="dtb-btn dtb-overflow-btn" ref="overflowBtn"
        @click.stop="toggleOverflow($event)" title="More tools">
        <IconDots :size="16" />
      </button>

      <div class="dtb-spacer"></div>
    </div>

    <!-- Dropdowns (Teleported) -->
    <Teleport to="body">
      <!-- Font Family Dropdown (alphabetical, availability-filtered, each in own typeface) -->
      <div v-if="openDropdown === 'font'" class="dtb-popover dtb-font-popover" :style="dropdownPos" @mousedown.prevent>
        <div
          v-for="f in availableFonts" :key="f.name"
          class="dtb-popover-item"
          :class="{ active: currentFont === f.name }"
          :style="{ fontFamily: f.fallback }"
          @click="setFont(f.name)"
        >{{ f.name }}</div>
        <div v-if="!availableFonts.length" class="dtb-popover-item" style="opacity:0.5; cursor:default;">No fonts available</div>
      </div>

      <!-- Zoom Preset Dropdown -->
      <div v-if="openDropdown === 'zoom'" class="dtb-popover dtb-popover-narrow" :style="dropdownPos" @mousedown.prevent>
        <div
          v-for="z in zoomPresets" :key="z"
          class="dtb-popover-item"
          :class="{ active: workspace.docxZoomPercent === z }"
          @click="setZoomPreset(z)"
        >{{ z }}%</div>
      </div>

      <!-- Styles Dropdown -->
      <div v-if="openDropdown === 'styles'" class="dtb-popover dtb-styles-popover" :style="dropdownPos" @mousedown.prevent>
        <div
          v-for="s in documentStyles" :key="s.id"
          class="dtb-popover-item dtb-style-item"
          :class="{ active: currentStyle === (s.definition?.attrs?.name || s.id) }"
          :style="getStylePreview(s)"
          @click="setStyle(s.id)"
        >{{ s.definition?.attrs?.name || s.id }}</div>
        <div v-if="!documentStyles.length" class="dtb-popover-item" style="opacity:0.5; cursor:default;">No styles in document</div>
      </div>

      <!-- Font Size Dropdown -->
      <div v-if="openDropdown === 'size'" class="dtb-popover dtb-popover-narrow" :style="dropdownPos" @mousedown.prevent>
        <div
          v-for="s in fontSizes" :key="s"
          class="dtb-popover-item"
          :class="{ active: currentSize == s }"
          @click="setSize(s)"
        >{{ s }}</div>
      </div>

      <!-- Text Color Picker -->
      <div v-if="openDropdown === 'color'" class="dtb-popover dtb-color-popover" :style="dropdownPos" @mousedown.prevent>
        <div class="dtb-color-grid">
          <button
            v-for="c in textColors" :key="c"
            class="dtb-color-swatch"
            :class="{ active: currentColor === c }"
            :style="{ background: c }"
            :title="c"
            @click="setColor(c)"
          ></button>
        </div>
        <button class="dtb-popover-item" style="margin-top:4px" @click="clearColor">Clear Color</button>
      </div>

      <!-- Highlight Color Picker -->
      <div v-if="openDropdown === 'highlight'" class="dtb-popover dtb-color-popover" :style="dropdownPos" @mousedown.prevent>
        <div class="dtb-color-grid">
          <button
            v-for="c in highlightColors" :key="c"
            class="dtb-color-swatch"
            :class="{ active: currentHighlight === c }"
            :style="{ background: c }"
            :title="c"
            @click="setHighlight(c)"
          ></button>
        </div>
        <button class="dtb-popover-item" style="margin-top:4px" @click="clearHighlight">No Highlight</button>
      </div>

      <!-- Alignment Dropdown -->
      <div v-if="openDropdown === 'align'" class="dtb-popover dtb-popover-narrow" :style="dropdownPos" @mousedown.prevent>
        <div class="dtb-popover-item" :class="{ active: currentAlign === 'left' }" @click="setAlign('left')">
          <IconAlignLeft :size="16" /> Left
        </div>
        <div class="dtb-popover-item" :class="{ active: currentAlign === 'center' }" @click="setAlign('center')">
          <IconAlignCenter :size="16" /> Center
        </div>
        <div class="dtb-popover-item" :class="{ active: currentAlign === 'right' }" @click="setAlign('right')">
          <IconAlignRight :size="16" /> Right
        </div>
        <div class="dtb-popover-item" :class="{ active: currentAlign === 'justify' }" @click="setAlign('justify')">
          <IconAlignJustified :size="16" /> Justify
        </div>
      </div>

      <!-- Line Height Dropdown -->
      <div v-if="openDropdown === 'lineHeight'" class="dtb-popover dtb-popover-narrow" :style="dropdownPos" @mousedown.prevent>
        <div
          v-for="lh in lineHeights" :key="lh.value"
          class="dtb-popover-item"
          :class="{ active: currentLineHeight == lh.value }"
          @click="setLineHeight(lh.value)"
        >{{ lh.label }}</div>
      </div>

      <!-- Link Input -->
      <div v-if="openDropdown === 'link'" class="dtb-popover dtb-link-popover" :style="dropdownPos" @mousedown.prevent>
        <input
          ref="linkInput"
          v-model="linkUrl"
          class="dtb-input"
          placeholder="https://..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          @keydown.enter="applyLink"
          @keydown.escape="closeDropdown"
        />
        <div class="dtb-link-actions">
          <button class="dtb-link-btn" @click="applyLink" :disabled="!linkUrl.trim()">Apply</button>
          <button class="dtb-link-btn" @click="closeDropdown">Cancel</button>
        </div>
      </div>

      <!-- Table Grid Selector -->
      <div v-if="openDropdown === 'table'" class="dtb-popover dtb-table-popover" :style="dropdownPos" @mousedown.prevent>
        <div class="dtb-table-label">{{ tableHover.r ? `${tableHover.r} × ${tableHover.c}` : 'Insert Table' }}</div>
        <div class="dtb-table-grid">
          <div
            v-for="r in 6" :key="r"
            class="dtb-table-row"
          >
            <div
              v-for="c in 6" :key="c"
              class="dtb-table-cell"
              :class="{ active: r <= tableHover.r && c <= tableHover.c }"
              @mouseenter="tableHover = { r, c }"
              @click="insertTable(r, c)"
            ></div>
          </div>
        </div>
      </div>

      <!-- Mode Dropdown -->
      <div v-if="openDropdown === 'mode'" class="dtb-popover dtb-popover-narrow" :style="dropdownPos" @mousedown.prevent>
        <div class="dtb-popover-item" :class="{ active: documentMode === 'editing' }" @click="setMode('editing')">
          <IconPencil :size="16" /> Editing
        </div>
        <div class="dtb-popover-item" :class="{ active: documentMode === 'suggesting' }" @click="setMode('suggesting')">
          <IconPencilCheck :size="16" /> Suggesting
        </div>
      </div>

      <!-- Overflow popover (independent from openDropdown so sub-menus don't close it) -->
      <div v-if="showOverflowPopover" class="dtb-popover dtb-overflow-popover" :style="overflowPopoverPos" @mousedown.prevent>
        <!-- Mode (group 4) -->
        <div v-if="overflowGroups.includes(4)" class="dtb-overflow-section">
          <div class="dtb-overflow-label">Mode</div>
          <div class="dtb-group">
            <button class="dtb-btn dtb-dropdown-trigger" :class="{ active: documentMode === 'suggesting' }" @click.stop="toggleDropdown('mode', $event, true)">
              <IconPencil :size="16" />
              <span class="dtb-label">{{ documentMode === 'suggesting' ? 'Suggesting' : 'Editing' }}</span>
              <IconChevronDown :size="12" />
            </button>
          </div>
        </div>
        <!-- Paragraph (group 5) -->
        <div v-if="overflowGroups.includes(5)" class="dtb-overflow-section">
          <div class="dtb-overflow-label">Paragraph</div>
          <div class="dtb-group">
            <button class="dtb-btn dtb-dropdown-trigger" title="Alignment" @click.stop="toggleDropdown('align', $event, true)">
              <component :is="alignIcon" :size="16" />
              <IconChevronDown :size="12" />
            </button>
            <button class="dtb-btn" :class="{ active: isBullet }" title="Bullet List" @click="cmd('toggleBulletList')">
              <IconList :size="16" />
            </button>
            <button class="dtb-btn" :class="{ active: isOrdered }" title="Numbered List" @click="cmd('toggleOrderedList')">
              <IconListNumbers :size="16" />
            </button>
            <button class="dtb-btn" title="Decrease Indent" @click="cmd('decreaseTextIndent')">
              <IconIndentDecrease :size="16" />
            </button>
            <button class="dtb-btn" title="Increase Indent" @click="cmd('increaseTextIndent')">
              <IconIndentIncrease :size="16" />
            </button>
            <button class="dtb-btn dtb-dropdown-trigger" title="Line Height" @click.stop="toggleDropdown('lineHeight', $event, true)">
              <IconLineHeight :size="16" />
              <IconChevronDown :size="12" />
            </button>
          </div>
        </div>
        <!-- Insert (group 6) -->
        <div v-if="overflowGroups.includes(6)" class="dtb-overflow-section">
          <div class="dtb-overflow-label">Insert</div>
          <div class="dtb-group">
            <button class="dtb-btn" title="Insert Link" @click.stop="toggleDropdown('link', $event, true)">
              <IconLink :size="16" />
            </button>
            <button class="dtb-btn" title="Insert Image" @click="insertImage">
              <IconPhoto :size="16" />
            </button>
            <button class="dtb-btn" title="Insert Table" @click.stop="toggleDropdown('table', $event, true)">
              <IconTable :size="16" />
            </button>
            <button class="dtb-btn" :title="hasBib ? 'Refresh Bibliography' : 'Insert Bibliography'" @click="insertOrRefreshBibliography">
              <component :is="hasBib ? IconRefresh : IconBlockquote" :size="16" />
            </button>
          </div>
        </div>
        <!-- Track Changes (group 7) -->
        <div v-if="showTrackChanges && overflowGroups.includes(7)" class="dtb-overflow-section">
          <div class="dtb-overflow-label">Track Changes</div>
          <div class="dtb-group">
            <button class="dtb-btn" :class="{ active: isTrackChangesActive }" title="Toggle Track Changes" @click="toggleTrackChanges">
              <IconGitMerge :size="16" />
            </button>
            <span v-if="trackedChangeCount > 0" class="dtb-badge">{{ trackedChangeCount }}</span>
            <button class="dtb-btn" title="Previous Change" @click="goToPrevChange" :disabled="!hasAnyTrackedChanges">
              <IconArrowLeft :size="14" />
            </button>
            <button class="dtb-btn" title="Next Change" @click="goToNextChange" :disabled="!hasAnyTrackedChanges">
              <IconArrowRight :size="14" />
            </button>
            <div class="dtb-sep" style="height:16px; margin:0 3px;"></div>
            <button class="dtb-btn dtb-accept" title="Accept Change" @click="acceptChange" :disabled="!hasTrackedChange">
              <IconCheck :size="16" />
            </button>
            <button class="dtb-btn dtb-reject" title="Reject Change" @click="rejectChange" :disabled="!hasTrackedChange">
              <IconX :size="16" />
            </button>
            <div class="dtb-sep" style="height:16px; margin:0 3px;"></div>
            <button class="dtb-btn dtb-accept" title="Accept All Changes" @click="acceptAllChanges" :disabled="!hasAnyTrackedChanges">
              <IconChecks :size="16" />
            </button>
            <button class="dtb-btn dtb-reject" title="Reject All Changes" @click="rejectAllChanges" :disabled="!hasAnyTrackedChanges">
              <IconSquareX :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Backdrop to catch outside clicks -->
      <div v-if="openDropdown || showOverflowPopover" class="dtb-backdrop" @click="closeDropdown" @contextmenu.prevent="closeDropdown"></div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  IconArrowBackUp, IconArrowForwardUp,
  IconBold, IconItalic, IconUnderline, IconStrikethrough,
  IconLetterA, IconHighlight,
  IconAlignLeft, IconAlignCenter, IconAlignRight, IconAlignJustified,
  IconList, IconListNumbers, IconIndentDecrease, IconIndentIncrease, IconLineHeight,
  IconLink, IconPhoto, IconTable, IconBlockquote,
  IconCheck, IconChecks, IconX, IconSquareX, IconChevronDown,
  IconPencil, IconPencilCheck,
  IconArrowLeft, IconArrowRight, IconGitMerge, IconRefresh,
  IconClearFormatting,
  IconDots,
  IconMinus, IconPlus,
} from '@tabler/icons-vue'
import { invoke } from '@tauri-apps/api/core'
import { trackChangesHelpers } from 'superdoc'
import { hasBibliography, insertBibliography, refreshBibliography } from '../../services/docxCitationImporter'
import { useReferencesStore } from '../../stores/references'
import { useWorkspaceStore } from '../../stores/workspace'

const props = defineProps({
  superdoc: { type: Object, default: null },
  documentMode: { type: String, default: 'editing' },
})

const emit = defineEmits(['mode-change'])
const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()

// --- Raw editor access (no Vue Proxy — SuperDoc uses #private fields) ---
// Parent guarantees activeEditor exists by the time this component mounts.
function getEditor() {
  return props.superdoc?.activeEditor || null
}
// For template v-if, track readiness via a simple ref toggled in onMounted
const editor = ref(null)

// --- Formatting state ---
const isBold = ref(false)
const isItalic = ref(false)
const isUnderline = ref(false)
const isStrike = ref(false)
const isBullet = ref(false)
const isOrdered = ref(false)
const currentFont = ref('')
const currentSize = ref('')
const currentColor = ref('')
const currentHighlight = ref('')
const currentAlign = ref('left')
const currentLineHeight = ref('')
const hasTrackedChange = ref(false)
const hasAnyTrackedChanges = ref(false)
const trackedChangeCount = ref(0)
const isTrackChangesActive = ref(false)
const hasBib = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const currentStyle = ref('')
const documentStyles = ref([])

// --- Dropdown state ---
const openDropdown = ref(null)
const dropdownPos = ref({})
const linkUrl = ref('')
const tableHover = ref({ r: 0, c: 0 })

// Refs for button positions
const stylesBtn = ref(null)
const fontBtn = ref(null)
const sizeBtn = ref(null)
const colorBtn = ref(null)
const highlightBtn = ref(null)
const alignBtn = ref(null)
const lineHeightBtn = ref(null)
const linkBtn = ref(null)
const tableBtn = ref(null)
const modeBtn = ref(null)
const linkInput = ref(null)
const zoomBtn = ref(null)

// --- Overflow state ---
const overflowGroups = ref([])
const showOverflowPopover = ref(false)
const overflowPopoverPos = ref({})
const toolbarRow = ref(null)
const overflowBtn = ref(null)
const mg0 = ref(null)
const mg1 = ref(null)
const mg2 = ref(null)
const mg3 = ref(null)
const mg4 = ref(null)
const mg5 = ref(null)
const mg6 = ref(null)
const mg7 = ref(null)

const showTrackChanges = computed(() =>
  props.documentMode === 'suggesting' || hasAnyTrackedChanges.value || isTrackChangesActive.value
)

// --- Static data ---

// Font catalog — alphabetical. Shipped fonts (we bundle @font-face) are always available.
// System fonts are checked at runtime via document.fonts.check().
const FONT_CATALOG = [
  { name: 'Arial', fallback: 'Arial, Helvetica, sans-serif', shipped: false },
  { name: 'Calibri', fallback: 'Calibri, sans-serif', shipped: false },
  { name: 'Cambria', fallback: 'Cambria, Georgia, serif', shipped: false },
  { name: 'Courier New', fallback: '"Courier New", Courier, monospace', shipped: false },
  { name: 'Geist', fallback: 'Geist, sans-serif', shipped: true },
  { name: 'Georgia', fallback: 'Georgia, serif', shipped: false },
  { name: 'Helvetica', fallback: 'Helvetica, Arial, sans-serif', shipped: false },
  { name: 'Inter', fallback: 'Inter, sans-serif', shipped: true },
  { name: 'JetBrains Mono', fallback: '"JetBrains Mono", monospace', shipped: true },
  { name: 'Lora', fallback: 'Lora, serif', shipped: true },
  { name: 'Palatino', fallback: '"Palatino Linotype", Palatino, serif', shipped: false },
  { name: 'STIX Two Text', fallback: '"STIX Two Text", serif', shipped: true },
  { name: 'Times New Roman', fallback: '"Times New Roman", Times, serif', shipped: false },
  { name: 'Verdana', fallback: 'Verdana, Geneva, sans-serif', shipped: false },
]

// Availability detection — only show fonts that actually render
const availableFonts = ref(FONT_CATALOG) // default to all; filtered in onMounted

const zoomPresets = [50, 75, 100, 125, 150, 200]

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

const textColors = [
  '#1a1a1a', '#434343', '#666666', '#999999', '#cccccc',
  '#f7768e', '#ff9e64', '#e0af68', '#9ece6a', '#73daca',
  '#7dcfff', '#7aa2f7', '#bb9af7', '#c0caf5', '#a9b1d6',
  '#db4b4b', '#ff7a2e', '#d4a037', '#5fba7d', '#449dab',
  '#2e7de9', '#5a4fcf', '#9854c2', '#8b5cf6', '#6366f1',
]

const highlightColors = [
  '#ffd43b', '#a3e635', '#67e8f9', '#818cf8', '#f472b6',
  '#fbbf24', '#4ade80', '#22d3ee', '#a78bfa', '#fb923c',
  '#fef08a', '#bbf7d0', '#bae6fd', '#c4b5fd', '#fecdd3',
]

const lineHeights = [
  { label: 'Single', value: 1 },
  { label: '1.15', value: 1.15 },
  { label: '1.5', value: 1.5 },
  { label: 'Double', value: 2 },
  { label: '2.5', value: 2.5 },
  { label: '3', value: 3 },
]

const alignIcon = computed(() => {
  const map = { left: IconAlignLeft, center: IconAlignCenter, right: IconAlignRight, justify: IconAlignJustified }
  return map[currentAlign.value] || IconAlignLeft
})

function getStylePreview(style) {
  const css = {}
  const defs = style?.definition?.styles || {}
  // Font size from style definition, with fallbacks by ID
  if (defs['font-size']) {
    css.fontSize = defs['font-size']
  } else {
    const id = (style?.id || '').toLowerCase()
    if (id === 'heading1') css.fontSize = '20px'
    else if (id === 'heading2') css.fontSize = '17px'
    else if (id === 'heading3') css.fontSize = '15px'
    else if (id.startsWith('heading')) css.fontSize = '13px'
    else if (id === 'title') css.fontSize = '22px'
    else if (id === 'subtitle') css.fontSize = '15px'
    else css.fontSize = '13px'
  }
  if (defs.bold && defs.bold !== '0' && defs.bold !== false) css.fontWeight = 'bold'
  else if (/heading/i.test(style?.id)) css.fontWeight = 'bold'
  if (defs.italic && defs.italic !== '0' && defs.italic !== false) css.fontStyle = 'italic'
  if (defs.color) css.color = defs.color
  else if (/subtitle/i.test(style?.id)) css.color = 'var(--fg-muted)'
  if (defs['font-family']) css.fontFamily = defs['font-family']
  if (/title/i.test(style?.id) && !/subtitle/i.test(style?.id) && !css.fontWeight) css.fontWeight = '300'
  return css
}

// Sort styles: headings by level, then common styles, then alphabetical
const STYLE_ORDER = ['Normal', 'Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5', 'Heading6', 'Quote', 'IntenseQuote', 'Caption', 'ListParagraph']
function styleSort(a, b) {
  const ai = STYLE_ORDER.indexOf(a.id)
  const bi = STYLE_ORDER.indexOf(b.id)
  if (ai !== -1 && bi !== -1) return ai - bi
  if (ai !== -1) return -1
  if (bi !== -1) return 1
  const nameA = a.definition?.attrs?.name || a.id
  const nameB = b.definition?.attrs?.name || b.id
  return nameA.localeCompare(nameB)
}

// --- State sync ---
function syncState() {
  const ed = getEditor()
  if (!ed) return

  isBold.value = ed.isActive('bold')
  isItalic.value = ed.isActive('italic')
  isUnderline.value = ed.isActive('underline')
  isStrike.value = ed.isActive('strike')
  isBullet.value = ed.isActive('bulletList')
  isOrdered.value = ed.isActive('orderedList')

  const attrs = ed.getAttributes('textStyle')
  const rawFont = attrs?.fontFamily?.replace(/['"]/g, '') || ''
  currentFont.value = rawFont.split(',')[0].trim()
  // Parse font size — could be '12pt', '16px', or just a number
  const rawSize = attrs?.fontSize
  if (rawSize) {
    const num = parseFloat(rawSize)
    currentSize.value = isNaN(num) ? '' : String(Math.round(num))
  } else {
    currentSize.value = ''
  }
  currentColor.value = attrs?.color || ''
  currentHighlight.value = ed.getAttributes('highlight')?.color || ''

  // Alignment
  const pAttrs = ed.getAttributes('paragraph')
  currentAlign.value = pAttrs?.textAlign || 'left'

  // Line height
  currentLineHeight.value = pAttrs?.lineHeight || ''

  // Current style detection — SuperDoc uses paragraph nodes with paragraphProperties.styleId
  const { $from } = ed.state.selection
  let curStyleId = ''
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === 'paragraph') {
      curStyleId = $from.node(d).attrs?.paragraphProperties?.styleId || ''
      break
    }
  }
  if (curStyleId) {
    const match = documentStyles.value.find(s => s.id === curStyleId)
    currentStyle.value = match?.definition?.attrs?.name || curStyleId
  } else {
    currentStyle.value = 'Normal'
  }

  // Track changes — at cursor
  hasTrackedChange.value = ed.isActive('trackInsert') || ed.isActive('trackDelete') || ed.isActive('trackFormat')

  // Track changes — document-wide (for Accept All / Reject All visibility)
  try {
    const changes = trackChangesHelpers.getTrackChanges(ed.state)
    const count = Array.isArray(changes) ? changes.length : 0
    trackedChangeCount.value = count
    hasAnyTrackedChanges.value = count > 0
  } catch {
    hasAnyTrackedChanges.value = hasTrackedChange.value
    trackedChangeCount.value = 0
  }

  // Track changes toggle state — read from the TrackChangesBase plugin state
  try {
    const plugins = ed.view?.state?.plugins || []
    const tcPlugin = plugins.find(p => p.spec?.key?.key === 'TrackChangesBase$')
    const tcState = tcPlugin?.getState?.(ed.state)
    isTrackChangesActive.value = tcState?.isTrackChangesActive ?? (props.documentMode === 'suggesting')
  } catch {
    isTrackChangesActive.value = props.documentMode === 'suggesting'
  }

  // Bibliography presence
  try {
    hasBib.value = hasBibliography(ed.view.state.doc)
  } catch {
    hasBib.value = false
  }

  // Undo/redo
  canUndo.value = ed.can().undo()
  canRedo.value = ed.can().redo()
}

function refreshStyles() {
  const ed = getEditor()
  if (!ed?.helpers?.linkedStyles?.getStyles) return
  try {
    const all = ed.helpers.linkedStyles.getStyles()
    documentStyles.value = (Array.isArray(all) ? all : []).filter(s => s.type === 'paragraph').sort(styleSort)
  } catch {
    // styles not available yet
  }
}

// --- Overflow measurement ---
function measureOverflow() {
  if (!toolbarRow.value) return

  const refs = [mg0, mg1, mg2, mg3, mg4, mg5, mg6, mg7]
  const els = []
  for (let i = 0; i < refs.length; i++) {
    if (refs[i].value) els.push({ idx: i, el: refs[i].value })
  }
  if (!els.length) return

  // Show all for measurement
  els.forEach(({ el }) => { el.style.display = '' })
  void toolbarRow.value.offsetWidth

  const containerWidth = toolbarRow.value.clientWidth
  let totalWidth = 0
  const widths = []
  for (const { el } of els) {
    const w = el.offsetWidth
    widths.push(w)
    totalWidth += w
  }

  const hidden = []
  if (totalWidth > containerWidth) {
    const available = containerWidth - 40 // reserve for overflow button
    let used = 0
    let overflowing = false
    for (let i = 0; i < els.length; i++) {
      if (overflowing) {
        hidden.push(els[i].idx)
        continue
      }
      used += widths[i]
      if (used > available && els[i].idx > 0) {
        overflowing = true
        hidden.push(els[i].idx)
      }
    }
  }

  for (const { idx, el } of els) {
    el.style.display = hidden.includes(idx) ? 'none' : ''
  }
  overflowGroups.value = hidden
}

let resizeObserver = null
let rafId = null

watch(showTrackChanges, () => { nextTick(measureOverflow) })

// --- Wire editor events on mount (parent guarantees activeEditor exists) ---
let boundSync = null

onMounted(async () => {
  const ed = getEditor()
  if (!ed) return
  editor.value = true // flip template guard
  boundSync = syncState
  ed.on('selectionUpdate', boundSync)
  ed.on('update', boundSync)
  ed.on('update', refreshStyles)
  refreshStyles()
  syncState()

  // Font availability detection — shipped fonts always available, system fonts checked at runtime
  try {
    await document.fonts.ready
    availableFonts.value = FONT_CATALOG.filter(f =>
      f.shipped || document.fonts.check(`16px "${f.name}"`)
    )
  } catch {
    // Fallback: show all fonts
    availableFonts.value = FONT_CATALOG
  }

  // Overflow measurement — must be in nextTick because editor.value=true
  // triggers a re-render; toolbarRow ref isn't available until DOM updates.
  resizeObserver = new ResizeObserver(() => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(measureOverflow)
  })
  nextTick(() => {
    measureOverflow()
    if (toolbarRow.value) {
      resizeObserver.observe(toolbarRow.value)
    }
  })
})

onUnmounted(() => {
  const ed = getEditor()
  if (ed && boundSync) {
    ed.off('selectionUpdate', boundSync)
    ed.off('update', boundSync)
    ed.off('update', refreshStyles)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})

// --- Commands ---
function cmd(name, ...args) {
  const ed = getEditor()
  if (!ed?.commands?.[name]) return
  ed.commands[name](...args)
  ed.view?.focus()
}

// --- Overflow popover (independent from dropdown state) ---
function toggleOverflow(event) {
  if (showOverflowPopover.value) {
    showOverflowPopover.value = false
    return
  }
  openDropdown.value = null
  showOverflowPopover.value = true
  const btn = overflowBtn.value || event?.currentTarget
  if (btn) {
    const rect = btn.getBoundingClientRect()
    // Clamp left so popover stays within viewport (estimate ~300px wide)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 308))
    overflowPopoverPos.value = {
      position: 'fixed',
      left: left + 'px',
      top: (rect.bottom + 4) + 'px',
      zIndex: 10000,
    }
  }
}

// --- Dropdown management ---
// keepOverflow=true when triggered from inside the overflow popover
function toggleDropdown(name, event, keepOverflow = false) {
  if (!keepOverflow) showOverflowPopover.value = false
  if (openDropdown.value === name) {
    openDropdown.value = null
    return
  }
  openDropdown.value = name
  // Position relative to trigger button
  const refMap = {
    styles: stylesBtn, font: fontBtn, size: sizeBtn, color: colorBtn, highlight: highlightBtn,
    align: alignBtn, lineHeight: lineHeightBtn, link: linkBtn, table: tableBtn, mode: modeBtn,
    zoom: zoomBtn,
  }
  let btn = refMap[name]?.value
  // If the ref'd button is hidden (overflowed), use the event target
  if (btn && btn.offsetParent === null && event) {
    btn = event.currentTarget
  }
  if (!btn && event) {
    btn = event.currentTarget
  }
  if (btn) {
    const rect = btn.getBoundingClientRect()
    dropdownPos.value = {
      position: 'fixed',
      left: rect.left + 'px',
      top: (rect.bottom + 4) + 'px',
      zIndex: 10001,
    }
  }
  // Focus link input after mount
  if (name === 'link') {
    nextTick(() => linkInput.value?.focus())
  }
  if (name === 'table') {
    tableHover.value = { r: 0, c: 0 }
  }
}

function closeDropdown() {
  openDropdown.value = null
  showOverflowPopover.value = false
  linkUrl.value = ''
}

// --- Font ---
function setFont(family) {
  cmd('setFontFamily', family)
  closeDropdown()
}

function setSize(size) {
  cmd('setFontSize', size + 'pt')
  closeDropdown()
}

// --- Styles ---
function setStyle(styleId) {
  const ed = getEditor()
  if (!ed) return
  ed.commands.setStyleById?.(styleId)
  closeDropdown()
  ed.view?.focus()
}

// --- Clear formatting ---
function clearFormat() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.clearFormat?.()
  ed.view?.focus()
}

// --- Colors ---
function setColor(c) {
  cmd('setColor', c)
  closeDropdown()
}
function clearColor() {
  cmd('unsetColor')
  closeDropdown()
}
function setHighlight(c) {
  cmd('setHighlight', c)
  closeDropdown()
}
function clearHighlight() {
  cmd('unsetHighlight')
  closeDropdown()
}

// --- Alignment ---
function setAlign(a) {
  cmd('setTextAlign', a)
  closeDropdown()
}

// --- Line Height ---
function setLineHeight(v) {
  cmd('setLineHeight', v)
  closeDropdown()
}

// --- Link ---
function applyLink() {
  const url = linkUrl.value.trim()
  if (!url) return
  const ed = getEditor()
  if (!ed) return
  if (ed.commands.setLink) {
    ed.commands.setLink({ href: url })
  }
  closeDropdown()
  ed.view?.focus()
}

// --- Image ---
async function insertImage() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    })
    if (!path) return
    const base64 = await invoke('read_file_base64', { path })
    const ext = path.split('.').pop().toLowerCase()
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'image/png'
    const src = `data:${mime};base64,${base64}`
    const ed = getEditor()
    if (ed?.commands?.setImage) {
      ed.commands.setImage({ src })
    }
    ed?.view?.focus()
  } catch (e) {
    console.warn('Image insert failed:', e)
  }
}

// --- Bibliography ---
function insertOrRefreshBibliography() {
  const ed = getEditor()
  if (!ed) return
  const style = referencesStore.citationStyle || 'apa'
  if (hasBib.value) {
    refreshBibliography(ed, style, referencesStore)
  } else {
    insertBibliography(ed, style, referencesStore)
  }
  syncState()
  ed.view?.focus()
}

// --- Table ---
function insertTable(rows, cols) {
  const ed = getEditor()
  if (!ed) return
  if (ed.commands.insertTable) {
    ed.commands.insertTable({ rows, cols, withHeaderRow: false })
  }
  closeDropdown()
  ed.view?.focus()
}

// --- Track changes ---
function acceptChange() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.acceptTrackedChangeBySelection?.()
  ed.view?.focus()
}

function rejectChange() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.rejectTrackedChangeOnSelection?.()
  ed.view?.focus()
}

function acceptAllChanges() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.acceptAllTrackedChanges?.()
  ed.view?.focus()
}

function rejectAllChanges() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.rejectAllTrackedChanges?.()
  ed.view?.focus()
}

function toggleTrackChanges() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.toggleTrackChanges?.()
  syncState()
  ed.view?.focus()
}

function goToNextChange() {
  const ed = getEditor()
  if (!ed) return
  try {
    const changes = trackChangesHelpers.getTrackChanges(ed.state)
    if (!changes?.length) return
    const { from } = ed.state.selection
    const next = changes.find(c => c.from > from) || changes[0]
    if (next) {
      ed.view.dispatch(ed.state.tr.setSelection(
        ed.state.selection.constructor.create(ed.state.doc, next.from)
      ))
      ed.view?.focus()
    }
  } catch {}
}

function goToPrevChange() {
  const ed = getEditor()
  if (!ed) return
  try {
    const changes = trackChangesHelpers.getTrackChanges(ed.state)
    if (!changes?.length) return
    const { from } = ed.state.selection
    const prev = [...changes].reverse().find(c => c.from < from) || changes[changes.length - 1]
    if (prev) {
      ed.view.dispatch(ed.state.tr.setSelection(
        ed.state.selection.constructor.create(ed.state.doc, prev.from)
      ))
      ed.view?.focus()
    }
  } catch {}
}

// --- Zoom presets ---
function setZoomPreset(pct) {
  workspace.setDocxZoom(pct)
  closeDropdown()
}

// --- Mode ---
function setMode(mode) {
  emit('mode-change', mode)
  closeDropdown()
}
</script>

<style scoped>
.docx-toolbar-wrap {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 3px 6px;
  user-select: none;
  flex-shrink: 0;
}
.dtb-row {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: nowrap;
  overflow: hidden;
}
.dtb-mgroup {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.dtb-group {
  display: flex;
  align-items: center;
  gap: 1px;
}
.dtb-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
  flex-shrink: 0;
}
.dtb-spacer {
  flex: 1;
}

/* Buttons */
.dtb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 28px;
  min-width: 28px;
  padding: 0 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--ui-font, 'Inter', sans-serif);
  white-space: nowrap;
  transition: background 0.08s, color 0.08s;
}
.dtb-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--fg-primary);
}
.dtb-btn.active {
  background: var(--bg-hover);
  color: var(--accent);
}
.dtb-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.dtb-btn.dtb-accept:not(:disabled):hover {
  color: #9ece6a;
}
.dtb-btn.dtb-reject:not(:disabled):hover {
  color: #f7768e;
}

.dtb-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 1;
}
.dtb-badge {
  font-size: 10px;
  line-height: 1;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(224,175,104,0.2);
  color: var(--warning, #e0af68);
  font-family: var(--ui-font, 'Inter', sans-serif);
}

/* Color button underbar */
.dtb-color-btn {
  position: relative;
}
.dtb-color-bar {
  position: absolute;
  bottom: 3px;
  left: 5px;
  right: 5px;
  height: 2.5px;
  border-radius: 1px;
}

/* Overflow button */
.dtb-overflow-btn {
  flex-shrink: 0;
}

/* Page zoom controls */
.dtb-zoom-group {
  flex-shrink: 0;
  gap: 0;
}
.dtb-zoom-btn {
  min-width: 24px;
  padding: 0 3px;
  color: var(--fg-muted);
  opacity: 0.7;
}
.dtb-zoom-btn:hover:not(:disabled) {
  opacity: 1;
}
.dtb-zoom-pct {
  min-width: 40px;
  padding: 0 2px;
  color: var(--fg-muted);
  font-size: 11px;
  opacity: 0.8;
}
.dtb-zoom-pct:hover {
  opacity: 1;
}
</style>

<style>
/* Popover & dropdown styles (global — teleported) */
.dtb-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.dtb-popover {
  position: fixed;
  z-index: 10000;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  padding: 4px;
  max-height: 320px;
  overflow-y: auto;
  min-width: 140px;
}
.dtb-popover-narrow {
  min-width: 100px;
}
.dtb-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--fg-primary);
  font-family: var(--ui-font, 'Inter', sans-serif);
  white-space: nowrap;
}
.dtb-popover-item:hover {
  background: var(--bg-hover);
}
.dtb-popover-item.active {
  color: var(--accent);
  background: rgba(122,162,247,0.1);
}

/* Color picker */
.dtb-color-popover {
  min-width: 180px;
  padding: 8px;
}
.dtb-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}
.dtb-color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.1s, transform 0.1s;
}
.dtb-color-swatch:hover {
  transform: scale(1.15);
  border-color: var(--fg-muted);
}
.dtb-color-swatch.active {
  border-color: var(--accent);
}

/* Link input popover */
.dtb-link-popover {
  min-width: 260px;
  padding: 8px;
}
.dtb-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 12px;
  font-family: var(--ui-font, 'Inter', sans-serif);
  outline: none;
}
.dtb-input:focus {
  border-color: var(--accent);
}
.dtb-link-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  justify-content: flex-end;
}
.dtb-link-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--fg-primary);
  font-size: 11px;
  cursor: pointer;
  font-family: var(--ui-font, 'Inter', sans-serif);
}
.dtb-link-btn:hover {
  background: var(--bg-hover);
}
.dtb-link-btn:disabled {
  opacity: 0.4;
}

/* Table grid selector */
.dtb-table-popover {
  min-width: auto;
  padding: 8px;
}
.dtb-table-label {
  font-size: 11px;
  color: var(--fg-muted);
  text-align: center;
  margin-bottom: 6px;
  font-family: var(--ui-font, 'Inter', sans-serif);
}
.dtb-table-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dtb-table-row {
  display: flex;
  gap: 3px;
}
.dtb-table-cell {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.08s;
}
.dtb-table-cell:hover,
.dtb-table-cell.active {
  background: var(--accent);
  border-color: var(--accent);
}

/* Overflow popover */
.dtb-overflow-popover {
  min-width: 200px;
  padding: 6px;
}
.dtb-overflow-section {
  padding: 4px 2px;
}
.dtb-overflow-section + .dtb-overflow-section {
  border-top: 1px solid var(--border);
}
.dtb-overflow-label {
  font-size: 10px;
  color: var(--fg-muted);
  padding: 0 6px 4px;
  font-family: var(--ui-font, 'Inter', sans-serif);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Font dropdown — slightly wider for font name previews */
.dtb-font-popover {
  min-width: 170px;
}

/* Styles dropdown */
.dtb-styles-popover {
  min-width: 180px;
}
.dtb-style-item {
  line-height: 1.3;
  padding: 4px 10px;
  white-space: nowrap;
}
</style>
