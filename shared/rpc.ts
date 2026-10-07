import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const gitRequest = defineRpc({
  name: "git.request",
  input: z.object({
    workspaceId: z.string().min(1),
    request: z.object({
      op: z.enum(["workspaces", "repositoryLevel", "commits", "commit", "compare", "diff", "patch", "blob", "fetch", "working", "workingDiff", "state", "plan", "action"]),
    }).catchall(z.json()),
  }),
  output: z.object({ result: z.json().nullable(), error: z.string().nullable() }),
});

export interface Commit {
  hash: string; parents: string[]; subject: string; refs: string[]; synthetic?: boolean;
  authorName: string; authorEmail: string; authorDate: string;
}
export interface GitRef { name: string; target: string; kind: string; isHead: boolean }
export interface Stash { index: number; hash: string; selector: string; subject: string }
export interface FileChange {
  path: string; oldPath?: string; status: string;
  additions: number | null; deletions: number | null; group?: string; staged?: boolean;
}
export interface History {
  root: string; commits: Commit[]; refs: { refs: GitRef[]; head: string | null; remotes: string[] } | null;
  stashes: Stash[]; nextSkip: number; exhausted: boolean;
}
export interface Working { root: string; head: string | null; staged: FileChange[]; unstaged: FileChange[]; untracked: FileChange[] }
export interface Detail extends Commit { message: string; committerName?: string; committerEmail?: string; committerDate?: string; files: FileChange[] }
export interface Badge { key: string; kind: string; text: string; label: string; title: string; remote: string | null; remotes: { name: string; full: string }[] }
export interface Field {
  name: string; label: string; type?: "text" | "select" | "checkbox";
  required?: boolean; initial?: string | boolean; placeholder?: string; help?: string;
  options?: { value: string; label: string }[];
}
export interface Action {
  action: string; label: string; title: string; note?: string; danger?: boolean;
  params?: Record<string, unknown>; fields?: Field[];
}
export interface Plan {
  root: string; plan: { summary: string; destructive: boolean; argv: string[] };
  blocked: string | null; warnings: string[];
}
export interface Target { workspaceId?: string; session?: boolean; path?: string; containing?: boolean }
export interface Repository { target: Target; root: string; label: string; relativePath: string }
export interface Folder { path: string; label: string; repository: Repository | null }
export interface WorkspaceRoots {
  groups: { id: string; title: string; path: string; current: boolean; session?: boolean }[];
  currentGroupId: string; containing: Repository | null;
}
export type Call = <T>(request: Record<string, unknown> & { op: string }) => Promise<T>;
export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
