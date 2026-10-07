import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requestGit } from '../server/adapter.ts'
import { gitRequest } from '../shared/rpc.ts'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'paseo-graph-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const create = name => {
    const root = join(base, name)
    mkdirSync(root)
    git(root, 'init', '-q', '-b', 'main')
    git(root, 'config', 'user.name', 'Paseo test')
    git(root, 'config', 'user.email', 'paseo@example.invalid')
    writeFileSync(join(root, 'file.txt'), 'one\n')
    git(root, 'add', '.')
    git(root, 'commit', '-qm', 'Initial history')
    return root
  }
  const local = create('local'), other = create('other')
  const workspaces = new Map([['local', { id: 'local', workspaceDirectory: local, name: 'Local', archivingAt: null }]])
  let projects = [{ projectId: 'other', projectRootPath: other, projectDisplayName: 'Other' }]
  const paseo = {
    workspaces: { ref: id => ({ refresh: async () => workspaces.get(id) ?? null }) },
    projects: { list: async () => ({ projects }) },
  }
  const call = request => requestGit(gitRequest.input.parse({ workspaceId: 'local', request }), { paseo })
  return { base, local, other, call, workspaces, removeProjects: () => { projects = [] } }
}

test('adapter resolves server-owned workspace directory; history pages include old commits', async t => {
  const { local, call } = fixture(t)
  for (let n = 2; n <= 5; n++) {
    writeFileSync(join(local, 'file.txt'), `${n}\n`)
    git(local, 'commit', '-qam', `History ${n}`)
  }
  const first = await call({ op: 'commits', limit: 2 })
  assert.equal(first.error, null)
  assert.equal(first.result.commits.length, 2)
  assert.equal(first.result.exhausted, false)
  const second = await call({ op: 'commits', limit: 2, skip: first.result.nextSkip })
  const third = await call({ op: 'commits', limit: 2, skip: second.result.nextSkip })
  assert.equal(third.result.commits[0].subject, 'Initial history')
  assert.equal(third.result.exhausted, true)
  assert.equal(new Set([...first.result.commits, ...second.result.commits, ...third.result.commits].map(commit => commit.hash)).size, 5)
})

test('project repository selection is independent and removed projects fail closed', async t => {
  const { local, other, call, removeProjects } = fixture(t)
  const target = { workspaceId: 'project:other', path: '.' }
  const result = await call({ op: 'working', target })
  assert.equal(result.error, null)
  assert.equal(result.result.root, git(other, 'rev-parse', '--show-toplevel'))
  await call({ op: 'action', target, action: 'branch.create', params: { name: 'new-branch' } })
  assert.equal(git(other, 'branch', '--list', 'new-branch'), 'new-branch')
  assert.equal(git(local, 'branch', '--list', 'new-branch'), '')
  removeProjects()
  assert.match((await call({ op: 'working', target })).error, /unknown or removed/)
})

test('a removed or archiving calling workspace never falls back to another repository', async t => {
  const { call, workspaces } = fixture(t)
  workspaces.get('local').archivingAt = 'now'
  assert.match((await call({ op: 'working' })).error, /unavailable/)
  workspaces.delete('local')
  assert.match((await call({ op: 'commits' })).error, /unavailable/)
})

test('request session identity cannot override the owning Paseo workspace', async t => {
  const { local, call } = fixture(t)
  const answer = await call({ op: 'working', sessionId: 'some-other-workspace', directory: '/etc' })
  assert.equal(answer.error, null)
  assert.equal(answer.result.root, git(local, 'rev-parse', '--show-toplevel'))
  for (const path of ['/etc', '../other', 'C:\\Windows']) {
    const invalid = await call({ op: 'working', target: { session: true, path } })
    assert.ok(invalid.error)
  }
})

test('directory picker skips escaping child symlinks and loads only one level', async t => {
  const { local, other, call } = fixture(t)
  mkdirSync(join(local, 'folder'))
  mkdirSync(join(local, 'folder', 'deeper'))
  symlinkSync(other, join(local, 'escape'))
  const answer = await call({ op: 'repositoryLevel', path: '.', includeChildren: true })
  assert.equal(answer.error, null)
  assert.deepEqual(answer.result.children.map(child => child.label), ['folder'])
  const invalid = await call({ op: 'working', target: { session: true, path: 'escape' } })
  assert.match(invalid.error, /escapes/)
})

test('fetch into a checked-out local branch is blocked before execution in this or a linked worktree', async t => {
  const { base, local, call } = fixture(t)
  git(local, 'remote', 'add', 'origin', 'https://example.invalid/repo.git')
  const request = { action: 'branch.fetchIntoLocal', params: { remote: 'origin', branch: 'main', force: true } }
  const first = await call({ op: 'plan', ...request })
  assert.equal(first.error, null)
  assert.ok(first.result.blocked.includes(local))
  const head = git(local, 'rev-parse', 'main')
  git(local, 'checkout', '-qb', 'topic')
  const linked = join(base, 'linked main\nworktree')
  git(local, 'worktree', 'add', '-q', linked, 'main')
  for (const force of [false, true]) {
    const params = { ...request.params, force }
    const plan = await call({ op: 'plan', action: request.action, params })
    assert.equal(plan.error, null)
    assert.ok(plan.result.blocked.includes(linked))
    assert.match(plan.result.blocked, /remote-tracking only/)
    const run = await call({ op: 'action', action: request.action, params })
    assert.ok(run.error.includes(linked))
    assert.equal(git(local, 'rev-parse', 'main'), head)
    assert.equal(git(linked, 'status', '--porcelain'), '')
  }
})

test('partially staged file has distinct staged and unstaged patches', async t => {
  const { local, call } = fixture(t)
  writeFileSync(join(local, 'file.txt'), 'two\n')
  git(local, 'add', 'file.txt')
  writeFileSync(join(local, 'file.txt'), 'three\n')
  const working = (await call({ op: 'working' })).result
  assert.equal(working.head, git(local, "rev-parse", "HEAD"))
  assert.equal(working.staged.length, 1)
  assert.equal(working.unstaged.length, 1)
  const staged = await call({ op: 'workingDiff', path: 'file.txt', staged: true })
  const unstaged = await call({ op: 'workingDiff', path: 'file.txt', staged: false })
  assert.match(staged.result.patch, /\+two/)
  assert.match(unstaged.result.patch, /\+three/)
})

test('patch RPC returns syntax tokens while keeping historical and working comparisons separate', async t => {
  const { local, call } = fixture(t)
  writeFileSync(join(local, 'code.ts'), 'export const before = 1;\n')
  git(local, 'add', '.')
  git(local, 'commit', '-qm', 'Add code')
  const before = git(local, 'rev-parse', 'HEAD')
  writeFileSync(join(local, 'code.ts'), 'export const after = "<script>literal</script>";\n')
  git(local, 'commit', '-qam', 'Change code')
  const after = git(local, 'rev-parse', 'HEAD')
  const historical = await call({ op: 'patch', mode: 'revisions', from: before, to: after, path: 'code.ts' })
  assert.equal(historical.error, null)
  assert.match(historical.result.patch, /\+export const after/)
  assert.ok(historical.result.highlights)
  writeFileSync(join(local, 'code.ts'), 'export const unstaged = 2;\n')
  const working = await call({ op: 'patch', mode: 'working', path: 'code.ts', staged: false })
  assert.equal(working.error, null)
  assert.match(working.result.patch, /\+export const unstaged/)
  assert.equal((await call({ op: 'patch', mode: 'revisions', from: before, to: after, path: 'code.ts' })).result.patch, historical.result.patch)
})

test('untracked previews are additions and reject arbitrary, tracked and escaping paths', async t => {
  const { local, other, call } = fixture(t)
  writeFileSync(join(local, 'new.txt'), 'new content\n')
  const request = { op: 'patch', mode: 'working', untracked: true }
  const added = await call({ ...request, path: 'new.txt' })
  assert.equal(added.error, null)
  assert.match(added.result.patch, /@@ -0,0 \+1,1 @@/)
  assert.match(added.result.patch, /\+new content/)
  assert.equal(added.result.truncated, false)
  for (const path of ['file.txt', '../other/file.txt', '/etc/passwd', 'missing.txt']) {
    assert.ok((await call({ ...request, path })).error)
  }
  symlinkSync(other, join(local, 'escape'))
  assert.ok((await call({ ...request, path: 'escape/file.txt' })).error)
})

test('untracked symlinks preview their link text, never the target contents', async t => {
  const { local, other, call } = fixture(t)
  symlinkSync(join(other, 'file.txt'), join(local, 'link.txt'))
  const result = await call({ op: 'patch', mode: 'working', untracked: true, path: 'link.txt' })
  assert.equal(result.error, null)
  assert.match(result.result.patch, /new file mode 120000/)
  assert.ok(result.result.patch.includes(join(other, 'file.txt')))
  assert.doesNotMatch(result.result.patch, /^\+one$/m)
})

test('untracked binary markers and bounded large-file previews are explicit', async t => {
  const { local, call } = fixture(t)
  writeFileSync(join(local, 'binary.bin'), Buffer.from([0, 1, 2]))
  const binary = await call({ op: 'patch', mode: 'working', untracked: true, path: 'binary.bin' })
  assert.equal(binary.error, null)
  assert.match(binary.result.patch, /Binary files/)
  writeFileSync(join(local, 'large.txt'), 'line\n'.repeat(150000))
  const large = await call({ op: 'patch', mode: 'working', untracked: true, path: 'large.txt' })
  assert.equal(large.error, null)
  assert.equal(large.result.truncated, true)
  assert.ok(large.result.patch.length < 800000)
})

test('staged additions in an unborn repository diff against the empty tree', async t => {
  const { local, call } = fixture(t)
  git(local, 'update-ref', '-d', 'refs/heads/main')
  assert.equal((await call({ op: 'working' })).result.head, null)
  const result = await call({ op: 'patch', mode: 'working', staged: true, path: 'file.txt' })
  assert.equal(result.error, null)
  assert.match(result.result.patch, /\+one/)
})

test('open diff snapshots reject a changed workspace directory instead of displaying another repository', async t => {
  const { local, other, call, workspaces } = fixture(t)
  const expectedRoot = git(local, 'rev-parse', '--show-toplevel')
  const request = { op: 'patch', mode: 'working', staged: false, path: 'file.txt', expectedRoot }
  assert.equal((await call(request)).error, null)
  workspaces.get('local').workspaceDirectory = other
  assert.match((await call(request)).error, /Repository location changed/)
})

test('native highlighting reads historical, staged and unstaged sides with full multiline context', async t => {
  const { local, call } = fixture(t)
  const headContent = '/*\n' + Array.from({ length: 6 }, (_, n) => 'comment ' + n).join('\n') + '\nHEAD comment\n*/\nconst value = 1;\n'
  writeFileSync(join(local, 'code.ts'), headContent)
  git(local, 'add', '.')
  git(local, 'commit', '-qm', 'Comment baseline')
  const from = git(local, 'rev-parse', 'HEAD')
  const stagedContent = headContent.replace('HEAD comment', 'staged comment')
  writeFileSync(join(local, 'code.ts'), stagedContent)
  git(local, 'add', 'code.ts')
  writeFileSync(join(local, 'code.ts'), stagedContent.replace('staged comment', 'working comment'))
  const check = (answer, removed, added) => {
    assert.equal(answer.error, null)
    const tokens = Object.values(answer.result.highlights).flat()
    assert.ok(tokens.some(token => token.text === removed && token.style === 'comment'))
    assert.ok(tokens.some(token => token.text === added && token.style === 'comment'))
    assert.equal(tokens.some(token => 'classes' in token), false)
  }
  check(await call({ op: 'patch', mode: 'working', staged: true, path: 'code.ts', context: 0 }), 'HEAD comment', 'staged comment')
  check(await call({ op: 'patch', mode: 'working', staged: false, path: 'code.ts', context: 0 }), 'staged comment', 'working comment')
  git(local, 'commit', '-qm', 'Commit staged comment')
  const to = git(local, 'rev-parse', 'HEAD')
  check(await call({ op: 'patch', mode: 'revisions', from, to, path: 'code.ts', context: 0 }), 'HEAD comment', 'staged comment')
  check(await call({ op: 'patch', mode: 'revisions', from, to: null, path: 'code.ts', context: 0 }), 'HEAD comment', 'working comment')
})

test('renamed files use old revision paths and new index paths for native syntax context', async t => {
  const { local, call } = fixture(t)
  const before = '/*\n' + Array(7).fill('comment').join('\n') + '\nold comment\n*/\n'
  writeFileSync(join(local, 'old.ts'), before)
  git(local, 'add', '.'); git(local, 'commit', '-qm', 'Before rename')
  git(local, 'mv', 'old.ts', 'new.ts')
  writeFileSync(join(local, 'new.ts'), before.replace('old comment', 'index comment'))
  git(local, 'add', '.')
  const staged = await call({ op: 'patch', mode: 'working', staged: true, oldPath: 'old.ts', path: 'new.ts', context: 0 })
  assert.equal(staged.error, null)
  assert.ok(Object.values(staged.result.highlights).flat().some(token => token.text === 'index comment' && token.style === 'comment'))
  writeFileSync(join(local, 'new.ts'), before.replace('old comment', 'working comment'))
  const unstaged = await call({ op: 'patch', mode: 'working', staged: false, oldPath: 'old.ts', path: 'new.ts', context: 0 })
  assert.equal(unstaged.error, null)
  assert.ok(Object.values(unstaged.result.highlights).flat().some(token => token.text === 'index comment' && token.style === 'comment'))
  assert.ok(Object.values(unstaged.result.highlights).flat().some(token => token.text === 'working comment' && token.style === 'comment'))
})
