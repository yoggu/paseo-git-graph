import test from 'node:test'
import assert from 'node:assert/strict'
import { highlightCode, getSupportedExtensions } from '@getpaseo/highlight'
import { parseUnifiedPatch } from '../shared/diff-layout.js'
import { highlightRows } from '../server/syntax.js'
import { highlightRows as bundled } from '../server/syntax-runtime.js'

const patchRows = code => parseUnifiedPatch(`@@ -0,0 +1,${code.split('\n').length} @@\n${code.split('\n').map(line => '+' + line).join('\n')}\n`).rows

test('all Paseo grammars produce exactly the same tokens as the built-in highlighter', () => {
  const samples = {
    ts: 'export const value: number = 1;',
    tsx: 'export const element = <Button count={1} />;',
    py: 'def greet(name):\n    return "hello " + name',
    php: '<?php\n$version = 2;\necho $version;',
    vue: '<script setup lang="ts">\nconst count: number = 1\n</script>\n<template><span>{{ count }}</span></template>',
    svelte: '<script lang="ts">\nlet count: number = 1;\n</script>\n{#if count > 0}<span>{count}</span>{/if}',
    astro: '---\nconst title = "Hello";\n---\n<main><h1>{title}</h1></main>',
    css: '.page { color: red; }',
    md: '# Heading\n\n**bold** text',
  }
  for (const extension of getSupportedExtensions()) {
    const code = samples[extension] ?? 'const value = 1;\n// example'
    const path = 'example.' + extension, rows = patchRows(code)
    const expected = highlightCode(code, path)
    const actual = highlightRows(rows, path, true, { oldFileContent: '', newFileContent: code })
    assert.ok(actual, path)
    assert.deepEqual([...actual.values()], expected, path)
    assert.deepEqual([...bundled(rows, path, true, { oldFileContent: '', newFileContent: code })], [...actual], path)
  }
})

test('full old/new file context recognizes comments whose opening delimiter is outside the hunk', () => {
  const old = '/*\n' + Array.from({ length: 6 }, (_, n) => 'comment ' + n).join('\n') + '\nold comment\n*/\nconst value = 1;\n'
  const next = old.replace('old comment', 'new comment')
  const rows = parseUnifiedPatch('@@ -8 +8 @@\n-old comment\n+new comment\n').rows
  const highlighted = highlightRows(rows, 'code.ts', true, { oldFileContent: old, newFileContent: next })
  assert.deepEqual(highlighted.get(1), highlightCode(old, 'code.ts')[7])
  assert.deepEqual(highlighted.get(2), highlightCode(next, 'code.ts')[7])
  assert.equal(highlighted.get(1)[0].style, 'comment')
  assert.equal(highlighted.get(2)[0].style, 'comment')
})

test('removed and added documents keep independent lexical state', () => {
  const rows = parseUnifiedPatch('@@ -1,3 +1,3 @@\n-/*\n-old comment\n-*/\n+const value = 1;\n+export { value };\n+// tail\n').rows
  const old = '/*\nold comment\n*/', next = 'const value = 1;\nexport { value };\n// tail'
  const highlighted = highlightRows(rows, 'code.ts', true, { oldFileContent: old, newFileContent: next })
  assert.deepEqual(highlighted.get(2), [{ text: 'old comment', style: 'comment' }])
  assert.ok(highlighted.get(4).some(token => token.text === 'const' && token.style === 'keyword'))
})

test('multiple hunks use native line-number reconstruction, not concatenated hunk snippets', () => {
  const rows = parseUnifiedPatch('@@ -4 +4 @@\n-oldOne\n+newOne\n@@ -10 +10 @@\n-oldTwo\n+newTwo\n').rows
  const highlighted = highlightRows(rows, 'code.ts')
  const expected = highlightCode('newOne\n\n\n\n\n\nnewTwo', 'code.ts')
  assert.deepEqual(highlighted.get(2), expected[0])
  assert.deepEqual(highlighted.get(5), expected[6])
})

test('a changed file/index cannot substitute current text for snapshot diff lines', () => {
  const rows = patchRows('const snapshot = 1;')
  const highlighted = highlightRows(rows, 'code.ts', true, { oldFileContent: '', newFileContent: 'const newer = 2;' })
  assert.equal(highlighted.get(1).map(token => token.text).join(''), 'const snapshot = 1;')
  assert.ok(highlighted.get(1).some(token => token.style === 'keyword'))
})

test('unsupported languages, disabled syntax and oversized/sparse diffs fall back safely', () => {
  const rows = patchRows('plain text')
  assert.equal(highlightRows(rows, 'notes.txt'), null)
  assert.equal(highlightRows(rows, 'code.ts', false), null)
  assert.equal(highlightRows(patchRows('x'.repeat(10002)), 'code.ts'), null)
  const sparse = parseUnifiedPatch('@@ -1 +1 @@\n-a\n+b\n@@ -1000000000 +1000000000 @@\n-c\n+d\n').rows
  assert.equal(highlightRows(sparse, 'code.ts'), null)
  assert.equal(highlightRows(patchRows(Array(5001).fill('x').join('\n')), 'code.ts'), null)
})

test('newline notes, empty lines, Unicode and markup remain literal text', () => {
  const rows = parseUnifiedPatch('@@ -0,0 +1,3 @@\n+const text = "<script>&lt;🙂</script>";\n+\n+// end\n\\ No newline at end of file\n').rows
  const highlighted = highlightRows(rows, 'code.ts')
  assert.equal(highlighted.get(1).map(token => token.text).join(''), 'const text = "<script>&lt;🙂</script>";')
  assert.deepEqual(highlighted.get(2), [{ text: '', style: null }])
  assert.equal(highlighted.has(4), false)
})
