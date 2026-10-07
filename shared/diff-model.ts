import { parseUnifiedPatch } from "./diff-layout.js";
import type { DiffSource, ParsedDiffFile, PatchResult } from "./diff-types";

export function diffIdentity(source: DiffSource): string {
  const target = source.target;
  return JSON.stringify([source.workspaceId, target?.workspaceId ?? null, target?.session ?? false,
    target?.path ?? null, target?.containing ?? false, source.path, source.oldPath ?? null,
    source.comparison.kind === "working" ? ["working", source.comparison.group] : ["revisions", source.comparison.from, source.comparison.to]]);
}
export function diffPanelId(source: DiffSource): string {
  const identity = diffIdentity(source);
  const hash = (seed: number) => {
    for (const char of identity) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    return (seed >>> 0).toString(16).padStart(8, "0");
  };
  return `diff-${hash(2166136261)}-${hash(3339675911)}`;
}
export function patchRequest(source: DiffSource, context: number): Record<string, unknown> & { op: string } {
  return { op: "patch", path: source.path, oldPath: source.oldPath, context,
    ...(source.comparison.kind === "working"
      ? { mode: "working", staged: source.comparison.group === "staged", untracked: source.comparison.group === "untracked" }
      : { mode: "revisions", from: source.comparison.from, to: source.comparison.to }) };
}
export function isLiveDiff(source: DiffSource): boolean {
  return source.comparison.kind === "working" || source.comparison.to === null;
}
export function parsePatch(result: PatchResult, path: string, syntax: boolean): ParsedDiffFile {
  const parsed = parseUnifiedPatch(result.patch);
  const file: ParsedDiffFile = { path, binary: parsed.binary, additions: parsed.additions, deletions: parsed.deletions, hunks: [] };
  let hunk: ParsedDiffFile["hunks"][number] | undefined;
  parsed.rows.forEach((row, index) => {
    if (row.kind === "hunk") {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(row.text)!;
      hunk = { oldStart: Number(match[1]), oldCount: Number(match[2] ?? 1), newStart: Number(match[3]), newCount: Number(match[4] ?? 1),
        lines: [{ type: "header", content: row.text }] };
      file.hunks.push(hunk);
    } else if (hunk && row.kind !== "meta") {
      const type = row.kind === "add" ? "add" : row.kind === "del" ? "remove" : row.kind === "ctx" ? "context" : "note";
      const tokens = syntax ? result.highlights?.[index] : undefined;
      hunk.lines.push({ type, content: type === "note" ? row.text : row.text.slice(1), ...(tokens ? { tokens } : {}) });
    }
  });
  return file;
}
