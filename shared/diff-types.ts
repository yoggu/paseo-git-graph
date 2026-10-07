import type { Target } from "./rpc";
import type { HighlightToken } from "./paseo-syntax-types";
export type { HighlightToken } from "./paseo-syntax-types";
export interface DiffLine {
  type: "header" | "add" | "remove" | "context" | "note";
  content: string;
  tokens?: HighlightToken[];
}
export interface ParsedDiffFile {
  path: string;
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: { oldStart: number; oldCount: number; newStart: number; newCount: number; lines: DiffLine[] }[];
}
export interface PatchResult {
  root: string; patch: string; truncated: boolean;
  highlights: Record<string, HighlightToken[]> | null;
}
export interface DiffSource {
  workspaceId: string;
  target?: Target;
  repository: string;
  path: string;
  oldPath?: string;
  comparison: { kind: "revisions"; from: string; to: string | null }
    | { kind: "working"; group: "staged" | "unstaged" | "untracked" };
}
export type OpenDiff = (source: DiffSource) => void;
