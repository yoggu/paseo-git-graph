import test from 'node:test'
import assert from 'node:assert/strict'
import { layout } from '../shared/graph-layout.js'
import { graphRails, graphRowMetrics } from '../shared/graph-rails.ts'

const commits = [['m', 'b', 'a'], ['b', 'r'], ['a', 'r'], ['r']].map(([hash, ...parents]) => ({ hash, parents }))

test('expanded graph rows reserve exact accordion space without shifting the selected dot', () => {
  assert.deepEqual(graphRowMetrics(0, 32, 1, 220), { top: 0, height: 32 })
  assert.deepEqual(graphRowMetrics(1, 32, 1, 220), { top: 32, height: 252 })
  assert.deepEqual(graphRowMetrics(2, 32, 1, 220), { top: 284, height: 32 })
  assert.deepEqual(graphRowMetrics(2, 32, -1, 220), { top: 64, height: 32 })
})

test('merge tracks continue through inline accordions and meet the next row without gaps', () => {
  const graph = layout(commits, false)
  for (const expanded of [0, 1, 2]) {
    const rails = graphRails(graph, 32, expanded, 220)
    const ending = rails[expanded].filter(rail => Math.abs(rail.y2 - 252) < 0.001)
    assert.ok(ending.length)
    for (const rail of ending) {
      assert.ok(rails[expanded + 1].some(next => next.slot === rail.slot && Math.abs(next.y1) < 0.001 && Math.abs(next.x1 - rail.x2) < 0.001))
    }
    for (let index = 0; index < rails.length; index++) {
      const height = index === expanded ? 252 : 32
      for (const rail of rails[index]) {
        assert.ok(rail.y1 >= -0.001)
        assert.ok(rail.y2 <= height + 0.001)
      }
    }
  }
})
