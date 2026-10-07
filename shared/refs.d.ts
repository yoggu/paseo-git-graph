import type { Badge, Commit, Stash } from "./rpc";
export function laneColor(slot: number): string;
export function groupRefs(refs: string[], remotes: string[], options?: { hash?: string; stashes?: Stash[] }): Badge[];
export function matchesFilter(commit: Commit, remotes: string[], query: string): boolean;
