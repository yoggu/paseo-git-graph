import { internals } from "./git.js";
import { readPreview, MAX_PREVIEW_BYTES } from "./untracked.ts";

export interface SyntaxContents { oldFileContent?: string | null; newFileContent?: string | null }
export async function syntaxContents(root: string, request: Record<string, unknown>): Promise<SyntaxContents> {
  const path = internals.requirePath(request.path, "path");
  const oldPath = typeof request.oldPath === "string" && request.oldPath ? internals.requirePath(request.oldPath, "oldPath") : path;
  const blob = async (revision: string, paths: string[]) => {
    for (const path of new Set(paths)) {
      try {
        const result = await internals.showBlob(root, { rev: revision, path, maxBytes: MAX_PREVIEW_BYTES });
        if (result.absent) continue;
        return result.binary ? null : bounded(result.text);
      } catch { return null; }
    }
    return "";
  };
  const working = async () => {
    try {
      const preview = await readPreview(root, path);
      return preview.truncated || preview.bytes.includes(0) ? null : bounded(preview.bytes.toString("utf8"));
    } catch { return null; }
  };
  let oldContent: Promise<string | null>, newContent: Promise<string | null>;
  if (request.mode === "working") {
    if (request.untracked === true) { oldContent = Promise.resolve(""); newContent = working(); }
    else if (request.staged === true) { oldContent = blob("HEAD", [oldPath, path]); newContent = blob(":0", [path]); }
    else { oldContent = blob(":0", [oldPath, path]); newContent = working(); }
  } else {
    oldContent = blob(internals.requireRev(request.from), [oldPath, path]);
    newContent = request.to === undefined || request.to === null || request.to === ""
      ? working() : blob(internals.requireRev(request.to), [path]);
  }
  const [oldFileContent, newFileContent] = await Promise.all([oldContent, newContent]);
  return { oldFileContent, newFileContent };
}
function bounded(text: string): string | null {
  return text.split("\n").length <= 50_000 ? text : null;
}
