import { layout } from "./graph-layout.js";
import type { Commit, Working } from "./rpc";

export const WORKTREE_HASH = "WORKTREE";
export function changedFileCount(working?: Working): number {
  return working ? new Set([...working.staged, ...working.unstaged, ...working.untracked].map(file => file.path)).size : 0;
}
export function workingGraph(commits: Commit[], hasMore: boolean, working?: Working, headInScope = true) {
  const base = layout(commits, hasMore);
  const count = changedFileCount(working);
  if (!count) return base;
  const headLoaded = commits.some(commit => commit.hash === working?.head);
  const synthetic: Commit = { hash: WORKTREE_HASH, synthetic: true,
    parents: working?.head && (headLoaded || headInScope) ? [working.head] : [],
    subject: `Uncommitted Changes (${count})`, refs: [], authorName: "", authorEmail: "", authorDate: "" };
  const graph = layout([synthetic, ...commits], hasMore);
  // Reserving a working-tree rail must not recolor the committed history.
  const slots = new Map(base.rows.map(row => [row.commit.hash, row.slot]));
  const edges = new Map(base.edges.map(edge => [`${base.rows[edge.from.row].commit.hash}:${edge.parent}`, edge.slot]));
  for (const row of graph.rows) row.slot = slots.get(row.commit.hash) ?? row.slot;
  for (const edge of graph.edges) edge.slot = edges.get(`${graph.rows[edge.from.row].commit.hash}:${edge.parent}`) ?? edge.slot;
  return graph;
}
