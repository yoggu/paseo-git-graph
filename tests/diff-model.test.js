import test from 'node:test'
import assert from 'node:assert/strict'
import { diffIdentity, diffPanelId, isLiveDiff, parsePatch, patchRequest } from '../shared/diff-model.ts'
import { buildSplitDiffRows, buildUnifiedDiffLines } from '../shared/paseo-diff-layout.ts'
import { compactHighlightTokens, formatDiffGutterText } from '../shared/paseo-diff-rendering.ts'
import { highlightRows, tokenize } from '../server/syntax.js'
import { highlightRows as bundledHighlightRows } from '../server/syntax-runtime.js'
import { parseUnifiedPatch } from '../shared/diff-layout.js'

const source = { workspaceId: 'workspace', repository: '/repo', path: 'code.ts', comparison: { kind: 'revisions', from: 'abc', to: 'def' } }
const patch = 'diff --git a/code.ts b/code.ts\n--- a/code.ts\n+++ b/code.ts\n@@ -10,2 +20,3 @@\n context\n-old\n+new\n+extra\n\\ No newline at end of file\n'
const result = { patch, root: '/repo', truncated: false, highlights: null }

test('diff tabs deduplicate equivalent descriptors without mixing repository, revision or index groups', () => {
  const equivalent = { ...source, comparison: { to: 'def', from: 'abc', kind: 'revisions' } }
  assert.equal(diffIdentity(source), diffIdentity(equivalent))
  assert.equal(diffPanelId(source), diffPanelId(equivalent))
  assert.match(diffPanelId(source), /^diff-[a-f0-9]{8}-[a-f0-9]{8}$/)
  const variants = [source, { ...source, workspaceId: 'another' }, { ...source, target: { workspaceId: 'other', path: '.' } },
    { ...source, path: 'other.ts' }, { ...source, comparison: { ...source.comparison, to: '123' } },
    ...['staged', 'unstaged', 'untracked'].map(group => ({ ...source, comparison: { kind: 'working', group } }))]
  assert.equal(new Set(variants.map(diffPanelId)).size, variants.length)
})

test('patch requests retain immutable comparison and staged/unstaged identity', () => {
  assert.deepEqual(patchRequest(source, 25), { op: 'patch', path: 'code.ts', oldPath: undefined, context: 25, mode: 'revisions', from: 'abc', to: 'def' })
  for (const group of ['staged', 'unstaged', 'untracked']) {
    const request = patchRequest({ ...source, comparison: { kind: 'working', group } }, 3)
    assert.equal(request.staged, group === 'staged')
    assert.equal(request.untracked, group === 'untracked')
  }
  assert.equal(isLiveDiff(source), false)
  assert.equal(isLiveDiff({ ...source, comparison: { ...source.comparison, to: null } }), true)
  assert.equal(isLiveDiff({ ...source, comparison: { kind: 'working', group: 'staged' } }), true)
})

test('Paseo numbered layouts preserve offsets, replacement pairing and newline notes', () => {
  const file = parsePatch(result, 'code.ts', true)
  assert.equal(file.additions, 2)
  assert.equal(file.deletions, 1)
  const unified = buildUnifiedDiffLines(file)
  assert.deepEqual(unified.map(row => row.lineNumber), [null, 20, 11, 21, 22, null])
  const split = buildSplitDiffRows(file)
  assert.equal(split[1].left.lineNumber, 10)
  assert.equal(split[1].right.lineNumber, 20)
  assert.equal(split[2].left.content, 'old')
  assert.equal(split[2].right.content, 'new')
  assert.equal(split[3].left, null)
  assert.equal(split[3].right.lineNumber, 22)
  assert.equal(split[4].content, '\\ No newline at end of file')
})

test('new/root file starts new numbering at one; binary and metadata-only changes have no text rows', () => {
  const addition = parsePatch({ ...result, patch: '@@ -0,0 +1 @@\n+first\n' }, 'new.txt', true)
  const rows = buildSplitDiffRows(addition)
  assert.equal(rows[1].left, null)
  assert.equal(rows[1].right.lineNumber, 1)
  assert.equal(parsePatch({ ...result, patch: 'Binary files a/x and b/x differ\n' }, 'x', true).binary, true)
  assert.deepEqual(parsePatch({ ...result, patch: 'old mode 100644\nnew mode 100755\n' }, 'x', true).hunks, [])
})

test('syntax tokens preserve literal markup and disabled syntax returns plain rows', () => {
  const code = 'const value = "<script>&lt;🙂</script>";'
  assert.equal(tokenize(code, 'code.js')[0].map(token => token.text).join(''), code)
  const patch = `@@ -0,0 +1 @@\n+${code}\n`
  const rows = parseUnifiedPatch(patch).rows
  assert.deepEqual([...bundledHighlightRows(rows, 'code.ts')], [...highlightRows(rows, 'code.ts')])
  const highlights = Object.fromEntries(highlightRows(rows, 'code.ts'))
  const withSyntax = parsePatch({ ...result, patch, highlights }, 'code.ts', true)
  assert.equal(withSyntax.hunks[0].lines[1].tokens.map(token => token.text).join(''), code)
  assert.equal(parsePatch({ ...result, patch, highlights }, 'code.ts', false).hunks[0].lines[1].tokens, undefined)
})

test('Paseo token compaction does not mutate inputs and blank gutters preserve line height', () => {
  const tokens = [{ text: 'one', style: 'keyword' }, { text: 'two', style: 'keyword' }, { text: '', style: null }, { text: 'three', style: null }]
  assert.deepEqual(compactHighlightTokens(tokens), [{ text: 'onetwo', style: 'keyword' }, { text: 'three', style: null }])
  assert.equal(tokens[0].text, 'one')
  assert.equal(formatDiffGutterText(null), '\u00a0')
})
