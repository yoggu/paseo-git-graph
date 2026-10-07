import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { internals } from '../server/git.js'
import { requestGit } from '../server/adapter.ts'
import { initialValues, paramsFor, refActions } from '../shared/actions.js'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'gg-checkout-pull-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const root = join(base, 'root'), remote = join(base, 'remote.git'), writer = join(base, 'writer')
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  git(root, 'config', 'user.name', 'Checkout Test')
  git(root, 'config', 'user.email', 'checkout@example.invalid')
  writeFileSync(join(root, 'file.txt'), 'base\n')
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Base')
  const before = git(root, 'rev-parse', 'HEAD')
  execFileSync('git', ['clone', '-q', '--bare', root, remote])
  git(root, 'remote', 'add', 'origin', remote)
  git(root, 'fetch', '-q', 'origin')
  git(root, 'branch', '--set-upstream-to=origin/main', 'main')
  execFileSync('git', ['clone', '-q', '-b', 'main', remote, writer])
  git(writer, 'config', 'user.name', 'Remote Test')
  git(writer, 'config', 'user.email', 'remote@example.invalid')
  writeFileSync(join(writer, 'file.txt'), 'remote update\n')
  git(writer, 'commit', '-qam', 'Remote update')
  git(writer, 'push', '-q', 'origin', 'main')
  const latest = git(writer, 'rev-parse', 'HEAD')
  git(root, 'checkout', '-qb', 'feature')
  const paseo = {
    workspaces: { ref: () => ({ refresh: async () => ({ id: 'fixture', workspaceDirectory: root, archivingAt: null }) }) },
    projects: { list: async () => ({ projects: [] }) },
  }
  const call = request => requestGit({ workspaceId: 'fixture', request }, { paseo })
  const run = (params = {}) => internals.runAction(root, {
    action: 'branch.checkoutRemote', params: { remote: 'origin', branch: 'main', name: 'main', ...params },
  })
  return { base, root, remote, latest, before, call, run }
}

test('remote menu provides checkout-and-pull, explicit current-branch pull, merge, fetch and delete', () => {
  const ref = { kind: 'remote', label: 'main', remote: 'origin' }
  const ctx = { branch: 'feature', remotes: ['origin'], branches: ['main', 'feature'] }
  const menu = refActions(ref, ctx)
  assert.equal(menu[0].action, 'branch.checkoutRemote')
  const params = paramsFor(menu[0], initialValues(menu[0]))
  assert.deepEqual(params, { remote: 'origin', branch: 'main', name: 'main', pull: true, ffOnly: true })
  assert.ok(menu.some(item => item.action === 'branch.fetchIntoLocal'))
  assert.ok(menu.some(item => item.action === 'branch.deleteRemote' && item.danger))
  const pull = menu.find(item => item.action === 'branch.pull')
  assert.match(pull.label, /feature/)
  assert.equal(pull.params.expectedBranch, 'feature')
  for (const branches of [[], ['main']]) {
    const current = refActions(ref, { ...ctx, branch: 'main', branches })
    assert.ok(!current.some(item => item.action === 'branch.fetchIntoLocal'))
  }
  assert.ok(!refActions(ref, { ...ctx, branches: ['feature'] }).some(item => item.action === 'branch.fetchIntoLocal'))
})

test('checkout and pull reuses an existing branch and updates it from the real remote', async t => {
  const { root, latest, before, run } = fixture(t)
  await run()
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'main')
  assert.equal(git(root, 'rev-parse', 'HEAD'), latest)
  assert.equal(readFileSync(join(root, 'file.txt'), 'utf8'), 'remote update\n')
  assert.equal(git(root, 'rev-parse', 'feature'), before)
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', 'main@{upstream}'), 'origin/main')
  await run()
  assert.equal(git(root, 'rev-parse', 'HEAD'), latest)
})

test('checkout creates a missing tracking branch, then pulls fresh commits; checkout-only performs no fetch', async t => {
  const { root, latest, before, run } = fixture(t)
  await run({ name: 'local-main', pull: false })
  assert.equal(git(root, 'rev-parse', 'HEAD'), before)
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', 'local-main@{upstream}'), 'origin/main')
  await run({ name: 'fresh-main' })
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'fresh-main')
  assert.equal(git(root, 'rev-parse', 'HEAD'), latest)
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', 'fresh-main@{upstream}'), 'origin/main')
})

test('default checkout-and-pull refuses divergence without losing commits; explicit merge keeps both histories', async t => {
  const { root, latest, run } = fixture(t)
  git(root, 'checkout', '-q', 'main')
  writeFileSync(join(root, 'local.txt'), 'local commit\n')
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'Local commit')
  const local = git(root, 'rev-parse', 'HEAD')
  git(root, 'config', 'pull.rebase', 'true')
  git(root, 'config', 'pull.ff', 'only')
  await assert.rejects(() => run(), /fast-forward/)
  assert.equal(git(root, 'rev-parse', 'HEAD'), local)
  await run({ ffOnly: false })
  git(root, 'merge-base', '--is-ancestor', local, 'HEAD')
  git(root, 'merge-base', '--is-ancestor', latest, 'HEAD')
  assert.equal(git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3)
})

test('worktree ownership blocks checkout before switching; current-branch pull detects a stale checkout', async t => {
  const { base, root, before, call } = fixture(t)
  const linked = join(base, 'linked main\nworktree')
  git(root, 'worktree', 'add', '-q', linked, 'main')
  const request = { action: 'branch.checkoutRemote', params: { remote: 'origin', branch: 'main', name: 'main' } }
  const plan = await call({ op: 'plan', ...request })
  assert.equal(plan.error, null)
  assert.ok(plan.result.blocked.includes(linked))
  const action = await call({ op: 'action', ...request })
  assert.ok(action.error.includes(linked))
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'feature')
  assert.equal(git(root, 'rev-parse', 'main'), before)
  const pull = await call({ op: 'plan', action: 'branch.pull', params: { remote: 'origin', branch: 'main', expectedBranch: 'main' } })
  assert.match(pull.result.blocked, /Checkout changed/)
})

test('queued checkout rechecks worktree ownership before switching or pulling', async t => {
  const { base, root, run } = fixture(t)
  let release
  let action
  const held = internals.queueWrite(root, () => new Promise(resolve => { release = resolve }))
  try {
    const deadline = performance.now() + 5000
    while (!release) {
      assert.ok(performance.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 1))
    }
    const previous = internals.writeQueues.get(root)
    action = run()
    let failure
    action.catch(error => { failure = error })
    while (internals.writeQueues.get(root) === previous) {
      if (failure) throw failure
      assert.ok(performance.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 1))
    }
    git(root, 'worktree', 'add', '-q', join(base, 'new worktree'), 'main')
    release()
    await assert.rejects(() => action, /already checked out in worktree/)
    assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'feature')
  } finally {
    release?.()
    await Promise.allSettled([held, action])
  }
})

test('remote deletion removes only the confirmed remote branch and keeps the local branch', async t => {
  const { root, remote, before } = fixture(t)
  git(root, 'branch', 'topic')
  git(root, 'push', '-q', 'origin', 'topic')
  await internals.runAction(root, { action: 'branch.deleteRemote', params: { remote: 'origin', branch: 'topic' } })
  assert.equal(git(remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/topic'), '')
  assert.equal(git(root, 'rev-parse', 'topic'), before)
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'feature')
})

test('dirty working files survive a refused pull', async t => {
  const { root, before, run } = fixture(t)
  writeFileSync(join(root, 'file.txt'), 'uncommitted work\n')
  await assert.rejects(() => run(), /overwritten|local changes/)
  assert.equal(git(root, 'rev-parse', 'main'), before)
  assert.equal(readFileSync(join(root, 'file.txt'), 'utf8'), 'uncommitted work\n')
})

test('checkout-and-pull rejects invalid names and contradictory pull options', async t => {
  const { root } = fixture(t)
  for (const params of [{ remote: '--force', branch: 'main' }, { remote: 'origin', branch: '--upload-pack=x' }, { remote: 'origin', branch: 'main', name: '../escape' }]) {
    await assert.rejects(() => internals.planAction(root, { action: 'branch.checkoutRemote', params }))
  }
  await assert.rejects(() => internals.planAction(root, { action: 'branch.pull', params: { remote: 'origin', branch: 'main', ffOnly: true, squash: true } }), /Disable Fast-forward only/)
  const plan = await internals.planAction(root, { action: 'branch.pull', params: { remote: 'origin', branch: 'main', noFastForward: true } })
  assert.deepEqual(plan.argv, ['pull', '--no-edit', '--no-rebase', '--no-ff', 'origin', 'refs/heads/main'])
})
