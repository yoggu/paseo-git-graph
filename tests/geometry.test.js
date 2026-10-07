import test from 'node:test'
import assert from 'node:assert/strict'
import { pathSegments, sliceSegment } from '../shared/geometry.ts'
import { graphEdgePath, layout } from '../shared/graph-layout.js'
import { groupRefs, matchesFilter } from '../shared/refs.js'

test('native graph rails preserve original cubic endpoints', () => {
  const commits = [['m', 'a', 'b'], ['b', 'r'], ['a', 'r'], ['r']].map(([hash, ...parents]) => ({ hash, parents }))
  const graph = layout(commits, false)
  for (const edge of graph.edges) {
    const segments = pathSegments(graphEdgePath(edge, graph.rows.length))
    assert.ok(segments.length)
    assert.equal(segments[0].x1, 12 + edge.from.column * 14)
    assert.equal(segments[0].y1, edge.from.row * 26 + 13)
    assert.equal(segments.at(-1).x2, 12 + edge.to.column * 14)
    assert.equal(segments.at(-1).y2, edge.to.row * 26 + 13)
    for (const segment of segments) assert.ok(segment.y2 >= segment.y1)
  }
})

test('virtualized graph clipping preserves continuous tracks at row boundaries', () => {
  const segment = { x1: 14, y1: 13, x2: 28, y2: 91 }
  const slices = [0, 26, 52, 78].map(top => sliceSegment(segment, top, top + 26))
  for (let i = 1; i < slices.length; i++) {
    assert.equal(slices[i - 1].x2, slices[i].x1)
    assert.equal(slices[i - 1].y2, 26)
    assert.equal(slices[i].y1, 0)
  }
  assert.equal(sliceSegment(segment, 100, 126), null)
})

test('same-commit remote labels collapse and diverged remotes remain separate', () => {
  const [head] = groupRefs(['HEAD -> main', 'origin/main', 'upstream/main'], ['origin', 'upstream'])
  assert.equal(head.kind, 'head')
  assert.deepEqual(head.remotes.map(remote => remote.name), ['origin', 'upstream'])
  assert.equal(groupRefs(['origin/topic'], ['origin'])[0].text, 'origin/topic')
  assert.equal(groupRefs(['tag: v1'], ['origin'])[0].kind, 'tag')
})

test('loaded-history search matches author, subject, hash and ref without rerouting graph', () => {
  const commit = { hash: 'abcdef0123', subject: 'Fix parser', authorName: 'Anna', authorEmail: 'anna@example.invalid', refs: ['HEAD -> main'] }
  assert.equal(matchesFilter(commit, [], 'anna parser'), true)
  assert.equal(matchesFilter(commit, [], 'abc main'), true)
  assert.equal(matchesFilter(commit, [], 'absent'), false)
})
