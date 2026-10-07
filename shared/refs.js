import { LANE_COLORS } from './constants.js'

export function laneColor(slot) {
  return LANE_COLORS[Math.abs(slot) % LANE_COLORS.length]
}

/**
 * Classify a ref name into the badge it should wear.
 *
 * @param ref - the raw ref token from `git log --decorate`.
 * @returns the label, its kind, and whether HEAD points here.
 */
export function parseRef(ref, remotes) {
  const text = ref.trim()
  const isHead = text.startsWith('HEAD -> ')
  const name = isHead ? text.slice('HEAD -> '.length) : text
  // `HEAD` alone means a detached HEAD: there is no branch name to show, so
  // the badge says only that, rather than claiming a branch called HEAD.
  if (name === 'HEAD') return { label: 'HEAD', kind: 'detached', prefix: null, remote: null }
  if (isHead) return { label: name, kind: 'head', prefix: 'HEAD', remote: null }
  if (name.startsWith('tag: ')) return { label: name.slice(5), kind: 'tag', prefix: null, remote: null }
  // A stash is not a branch: `refs/stash` is the newest one and it is spelled
  // with a full ref path, which would otherwise be read as a branch of that
  // name. The position the row's badge shows comes from the stash list.
  if (name === 'refs/stash') return { label: 'stash', kind: 'stash', prefix: null, remote: null }
  // A remote-tracking name is `<remote>/<branch>`, and the remote names are
  // known, so the split is made against them rather than at the first slash:
  // `origin/feature/x` is remote `origin`, branch `feature/x`, not remote
  // `origin/feature`. Longest name first, so `my/remote` beats `my`.
  const ordered = [...(remotes ?? [])].sort((a, b) => b.length - a.length)
  for (const remote of ordered) {
    if (name.startsWith(`${remote}/`) && name.length > remote.length + 1) {
      return { label: name.slice(remote.length + 1), kind: 'remote', prefix: null, remote }
    }
  }
  return { label: name, kind: 'branch', prefix: null, remote: null }
}

/**
 * Fold a row's decoration into one badge per branch.
 *
 * Git reports a local branch and each remote-tracking branch as separate
 * tokens. Printing them all produces several pills that mostly repeat one
 * name — `main`, `origin/main`, `upstream/main` — and pushes the subject out
 * of the row.
 *
 * A remote-tracking branch that still sits on its local branch's commit says
 * nothing the local branch has not already said, so it rides along inside that
 * branch's badge as the remote's name. One that has drifted sits on another
 * commit with no local branch of that name beside it, and therefore keeps its
 * own full-name badge — which is the only case where `origin/…` is worth the
 * space. This mirrors VS Code Git Graph's combined local/remote labels.
 *
 * @param refs - the row's decoration tokens.
 * @param remotes - the configured remote names, which decide where a
 *   remote-tracking name stops being a remote and starts being a branch.
 * @param options - the row's commit id, and the stashes, so a stash badge can
 *   be named by the position it holds in the stash list rather than by the one
 *   ref name every stash shares.
 * @returns one entry per distinct branch, tag, stash or detached HEAD.
 */
export function groupRefs(refs, remotes, options = {}) {
  const priority = { head: 0, branch: 1, remote: 2, tag: 3, stash: 4, detached: 5 }
  const stashes = options.stashes ?? []
  const parsed = refs.map(ref => parseRef(ref, remotes))
  const entries = []
  // Local branches, indexed by the name a remote-tracking branch would carry.
  const local = new Map()
  const simple = (ref, title) => ({
    key: `${ref.kind}:${ref.label}`,
    kind: ref.kind,
    text: ref.label,
    label: ref.label,
    remote: null,
    title,
    remotes: [],
  })
  for (const ref of parsed) {
    if (ref.kind !== 'head' && ref.kind !== 'branch') continue
    const entry = simple(ref, ref.kind === 'head' ? `HEAD is at ${ref.label}` : ref.label)
    if (!local.has(ref.label)) local.set(ref.label, entry)
    entries.push(entry)
  }
  for (const ref of parsed) {
    if (ref.kind === 'tag') { entries.push(simple(ref, `tag ${ref.label}`)); continue }
    if (ref.kind === 'detached') { entries.push(simple(ref, ref.label)); continue }
    if (ref.kind === 'stash') {
      const entry = stashes.find(item => item.hash === options.hash)
      const label = entry === undefined ? ref.label : `stash@{${entry.index}}`
      entries.push({
        key: `stash:${label}`,
        kind: 'stash',
        text: label,
        label,
        remote: null,
        title: entry?.subject ?? 'stash',
        remotes: [],
      })
      continue
    }
    if (ref.kind !== 'remote') continue
    const text = `${ref.remote}/${ref.label}`
    const host = local.get(ref.label)
    if (host !== undefined) {
      if (!host.remotes.some(remote => remote.name === ref.remote)) {
        host.remotes.push({ name: ref.remote, full: text })
      }
      continue
    }
    entries.push({
      key: `remote:${text}`, kind: 'remote', text, label: ref.label, remote: ref.remote, title: text, remotes: [],
    })
  }
  const seen = new Set()
  return entries.filter(entry => seen.has(entry.key) ? false : (seen.add(entry.key), true))
    .sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9))
}

/**
 * Whether one commit answers a find query.
 *
 * The search runs over what is loaded rather than over the whole history: it is
 * instant, it needs no round trip, and it cannot promise a row the graph is not
 * showing anyway. Every term must match something, so `anna parser` narrows
 * instead of widening — and the ref labels a reader can see are searchable too,
 * because "which commit is on that branch" is the same question.
 *
 * @param commit - the row's commit.
 * @param remotes - the configured remote names, for reading ref labels.
 * @param query - what the reader typed.
 * @returns whether the commit matches.
 */
export function matchesFilter(commit, remotes, query) {
  const text = String(query ?? '').trim().toLocaleLowerCase()
  if (text === '') return true
  const haystack = [
    commit.hash,
    commit.subject,
    commit.authorName,
    commit.authorEmail,
    ...(commit.refs ?? []).map(ref => parseRef(ref, remotes).label),
  ].join('\n').toLocaleLowerCase()
  return text.split(/\s+/).every(term => haystack.includes(term))
}

