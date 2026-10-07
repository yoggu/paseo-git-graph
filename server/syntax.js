import { highlightCode, isLanguageSupported } from '@getpaseo/highlight'
import { highlightDiffFromHunks, highlightDiffWithFileContent } from './paseo-diff-highlighter.ts'

export const tokenize = highlightCode

export function canHighlightRows(rows, path) {
  return typeof path === 'string' && isLanguageSupported(path) && rows.length <= 5000
    && rows.reduce((n, row) => n + row.text.length, 0) <= 200000
    && rows.every(row => row.text.length <= 10001)
}

export function highlightRows(rows, path, enabled = true, contents = {}) {
  if (!enabled || !canHighlightRows(rows, path)) return null
  const hunks = []
  let hunk
  for (const row of rows) {
    if (row.kind === 'hunk') {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(row.text)
      if (!match) continue
      hunk = { oldStart: Number(match[1]), oldCount: Number(match[2] ?? 1), newStart: Number(match[3]), newCount: Number(match[4] ?? 1), lines: [{ type: 'header', content: row.text }] }
      hunks.push(hunk)
    } else if (hunk && ['add', 'del', 'ctx'].includes(row.kind)) {
      hunk.lines.push({ type: row.kind === 'add' ? 'add' : row.kind === 'del' ? 'remove' : 'context', content: row.text.slice(1) })
    }
  }
  if (!hunks.length) return null
  // Bound blank-line reconstruction for sparse/malformed hunk coordinates before allocating it.
  for (const side of ['old', 'new']) {
    const starts = hunks.filter(hunk => hunk[side + 'Count'] > 0).map(hunk => hunk[side + 'Start'])
    const ends = hunks.filter(hunk => hunk[side + 'Count'] > 0).map(hunk => hunk[side + 'Start'] + hunk[side + 'Count'])
    if (starts.length && Math.max(...ends) - Math.min(...starts) > 50000) return null
  }
  try {
    const file = { path, isNew: false, isDeleted: false, additions: 0, deletions: 0, hunks }
    const highlighted = highlightDiffWithFileContent(file, contents)
    let fallback
    const result = new Map()
    let hunkIndex = -1, lineIndex = 0
    rows.forEach((row, index) => {
      if (row.kind === 'hunk') { hunkIndex++; lineIndex = 1; return }
      if (hunkIndex < 0 || !['add', 'del', 'ctx'].includes(row.kind)) return
      const text = row.text.slice(1)
      let tokens = highlighted.hunks[hunkIndex]?.lines[lineIndex]?.tokens
      // File/index contents can change after Git produced the patch; never replace snapshot text.
      if (!tokens || tokens.map(token => token.text).join('') !== text) {
        fallback ??= highlightDiffFromHunks(file)
        tokens = fallback.hunks[hunkIndex]?.lines[lineIndex]?.tokens
      }
      if (tokens && tokens.map(token => token.text).join('') === text) result.set(index, tokens)
      lineIndex++
    })
    return result.size ? result : null
  } catch { return null }
}
