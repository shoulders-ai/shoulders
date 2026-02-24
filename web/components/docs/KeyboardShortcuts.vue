<template>
  <div>
    <h1>Keyboard Shortcuts</h1>
    <p class="docs-subtitle">Complete reference. On Windows and Linux, use Ctrl instead of Cmd and Alt instead of Option.</p>

    <h2>Navigation</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Quick open (files, content, references)</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>P</kbd></td>
        </tr>
        <tr>
          <td>Open settings</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd></td>
        </tr>
        <tr>
          <td>Toggle left sidebar</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>B</kbd></td>
        </tr>
        <tr>
          <td>Toggle right sidebar</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>J</kbd></td>
        </tr>
        <tr>
          <td>Focus AI chat</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd></td>
        </tr>
        <tr>
          <td>Filter file tree</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> <span class="text-stone-400 text-xs">(sidebar focused)</span></td>
        </tr>
      </tbody>
    </table>

    <h2>Files & tabs</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Save and commit</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd></td>
        </tr>
        <tr>
          <td>New file</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>N</kbd></td>
        </tr>
        <tr>
          <td>Close tab</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>W</kbd></td>
        </tr>
        <tr>
          <td>Switch tab left</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Option/Alt</kbd>+<kbd>Left</kbd></td>
        </tr>
        <tr>
          <td>Switch tab right</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Option/Alt</kbd>+<kbd>Right</kbd></td>
        </tr>
        <tr>
          <td>Split vertically</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>\</kbd></td>
        </tr>
        <tr>
          <td>Split horizontally</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>\</kbd></td>
        </tr>
      </tbody>
    </table>

    <h2>Editing</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Bold</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>B</kbd> <span class="text-stone-400 text-xs">(editor focused)</span></td>
        </tr>
        <tr>
          <td>Italic</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>I</kbd></td>
        </tr>
        <tr>
          <td>Link</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>K</kbd></td>
        </tr>
        <tr>
          <td>Inline code</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>E</kbd></td>
        </tr>
        <tr>
          <td>Find</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> <span class="text-stone-400 text-xs">(editor focused)</span></td>
        </tr>
        <tr>
          <td>Find and replace</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>H</kbd></td>
        </tr>
      </tbody>
    </table>

    <h2>AI features</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Trigger inline suggestion</td>
          <td><code>++</code> <span class="text-stone-400 text-xs">(two plus signs quickly)</span></td>
        </tr>
        <tr>
          <td>Accept suggestion</td>
          <td><kbd>Tab</kbd>, <kbd>Enter</kbd>, or <kbd>Right</kbd></td>
        </tr>
        <tr>
          <td>Cycle suggestions forward</td>
          <td><kbd>Down</kbd></td>
        </tr>
        <tr>
          <td>Cycle suggestions back</td>
          <td><kbd>Up</kbd></td>
        </tr>
        <tr>
          <td>Dismiss suggestion</td>
          <td><kbd>Esc</kbd>, <kbd>Left</kbd>, or click elsewhere</td>
        </tr>
        <tr>
          <td>Send selection to chat</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd></td>
        </tr>
        <tr>
          <td>Add comment on selection</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd></td>
        </tr>
      </tbody>
    </table>

    <h2>Code execution</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Run selection or current line</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Enter</kbd></td>
        </tr>
        <tr>
          <td>Run entire file</td>
          <td><kbd>Shift</kbd>+<kbd>Cmd/Ctrl</kbd>+<kbd>Enter</kbd></td>
        </tr>
      </tbody>
    </table>

    <h2>View</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Zoom in</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>+</kbd></td>
        </tr>
        <tr>
          <td>Zoom out</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>-</kbd></td>
        </tr>
        <tr>
          <td>Toggle word wrap</td>
          <td><kbd>Option/Alt</kbd>+<kbd>Z</kbd></td>
        </tr>
      </tbody>
    </table>

    <h2>File explorer</h2>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Navigate up / down</td>
          <td><kbd>↑</kbd> / <kbd>↓</kbd></td>
        </tr>
        <tr>
          <td>Expand folder</td>
          <td><kbd>→</kbd></td>
        </tr>
        <tr>
          <td>Collapse folder / go to parent</td>
          <td><kbd>←</kbd></td>
        </tr>
        <tr>
          <td>Open file / toggle folder</td>
          <td><kbd>Space</kbd></td>
        </tr>
        <tr>
          <td>Rename</td>
          <td><kbd>Enter</kbd></td>
        </tr>
        <tr>
          <td>Jump to first / last item</td>
          <td><kbd>Home</kbd> / <kbd>End</kbd></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
