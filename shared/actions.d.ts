import type { Action, Badge, Commit, FileChange, GitRef, Stash } from "./rpc";
interface Context { branch: string | null; remotes: string[]; branches?: string[] }
export function commitActions(commit: Commit, ctx: Context): Action[];
export function workingActions(): Action[];
export function refActions(ref: Record<string, unknown>, ctx: Context): Action[];
export function stashActions(stash: Record<string, unknown>): Action[];
export function fileActions(file: FileChange): Action[];
export function operationActions(state: { operation?: string | null }): Action[];
export function describeBadge(badge: Badge, refs?: GitRef[], stashes?: Stash[]): Record<string, unknown> | null;
export function initialValues(request: Action): Record<string, string | boolean>;
export function paramsFor(request: Action, values?: Record<string, string | boolean>): Record<string, unknown>;
export function missingFields(request: Action, values?: Record<string, string | boolean>): string[];
