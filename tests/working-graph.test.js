import test from 'node:test'
import assert from 'node:assert/strict'
import { layout } from '../shared/graph-layout.js'
import { graphRails } from '../shared/graph-rails.ts'
import { WORKTREE_HASH, changedFileCount, workingGraph } from '../shared/working-graph.ts'

const commit = (hash, parents = []) => ({ hash, parents, refs: [], subject: hash, authorName: '', authorEmail: '', authorDate: '' })
const commits = [commit('other', ['older-other']), commit('older-other', ['root']), commit('head', ['root']), commit('root')]
const working = { root: '/repo', head: 'head', staged: [{ path: 'partial.txt' }], unstaged: [{ path: 'partial.txt' }, { path: 'edited.txt' }], untracked: [{ path: 'new.txt' }] }

test('working-tree count is files, not staged/unstaged entries', () => {
  assert.equal(changedFileCount(working), 3)
  assert.equal(changedFileCount(undefined), 0)
  assert.equal(changedFileCount({ ...working, staged: [], unstaged: [], untracked: [] }), 0)
})

test('working tree is a synthetic first graph row connected to actual HEAD, not the newest commit', () => {
  const graph = workingGraph(commits, false, working)
  assert.equal(graph.rows[0].commit.hash, WORKTREE_HASH)
  assert.equal(graph.rows[0].commit.subject, 'Uncommitted Changes (3)')
  assert.equal(graph.rows[0].commit.synthetic, true)
  const edge = graph.edges.find(edge => edge.from.row === 0)
  assert.equal(edge.parent, 'head')
  assert.equal(edge.to.row, 3)
  assert.equal(graph.rows[edge.to.row].commit.hash, 'head')
  assert.notEqual(graph.rows[1].column, graph.rows[0].column)
  assert.equal(graph.rows[3].column, graph.rows[0].column)
})

test('committed graph colors survive a working-tree insertion', () => {
  const base = layout(commits, false), graph = workingGraph(commits, false, working)
  for (const row of base.rows) assert.equal(graph.rows.find(other => other.commit.hash === row.commit.hash).slot, row.slot)
  for (const edge of base.edges) {
    const hash = base.rows[edge.from.row].commit.hash
    const added = graph.edges.find(other => graph.rows[other.from.row].commit.hash === hash && other.parent === edge.parent)
    assert.equal(added.slot, edge.slot)
  }
})

test('working-tree rail stays distinct and continuous through an expanded accordion', () => {
  const graph = workingGraph(commits, false, working)
  const rails = graphRails(graph, 32, 0, 220)
  const workingRails = rails.flat().filter(rail => rail.synthetic)
  assert.ok(workingRails.length)
  assert.ok(rails[0].some(rail => rail.synthetic && rail.y2 === 252))
  assert.ok(rails[1].some(rail => rail.synthetic && rail.y1 === 0))
  assert.ok(rails[2].some(rail => rail.synthetic))
  assert.ok(rails[3].some(rail => rail.synthetic && Math.abs(rail.y2 - 16) < 0.001))
  assert.ok(rails[1].some(rail => !rail.synthetic))
  assert.equal(rails[4].some(rail => rail.synthetic), false)
})

test('clean repositories omit the row; unborn repositories have an isolated hollow node', () => {
  assert.deepEqual(workingGraph(commits, false, { ...working, staged: [], unstaged: [], untracked: [] }), layout(commits, false))
  const unborn = workingGraph([], false, { ...working, head: null })
  assert.equal(unborn.rows.length, 1)
  assert.deepEqual(unborn.rows[0].commit.parents, [])
  assert.equal(unborn.edges.length, 0)
})

test('pagination and branch filters never attach working changes to another branch', () => {
  const filtered = commits.slice(0, 2)
  assert.equal(workingGraph(filtered, true, working, false).edges.some(edge => edge.from.row === 0), false)
  const pending = workingGraph(filtered, true, working, true).edges.find(edge => edge.from.row === 0)
  assert.equal(pending.parent, 'head')
  assert.equal(pending.to, null)
  assert.equal(workingGraph(filtered, false, working, true).edges.some(edge => edge.from.row === 0), false)
  assert.equal(workingGraph(commits, false, working, false).edges.find(edge => edge.from.row === 0).to.row, 3)
})

test('detached HEAD and repositories containing only untracked files remain valid', () => {
  const detached = workingGraph([commit('detached')], false, { ...working, head: 'detached', staged: [], unstaged: [] })
  assert.equal(detached.rows[0].commit.subject, 'Uncommitted Changes (1)')
  assert.equal(detached.edges[0].parent, 'detached')
  assert.equal(detached.edges[0].to.row, 1)
})
