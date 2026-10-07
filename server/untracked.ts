import { constants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { internals } from "./git.js";

export const MAX_PREVIEW_BYTES = 512 * 1024;
export async function readPreview(root: string, requested: unknown) {
  const path = internals.requirePath(requested, "path");
  const absolute = resolve(root, path);
  if (!internals.isContained(root, await realpath(dirname(absolute)))) throw new Error("File escapes the repository.");
  const info = await lstat(absolute);
  let bytes: Buffer;
  let truncated = false;
  if (info.isSymbolicLink()) bytes = Buffer.from(await readlink(absolute));
  else {
    const file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!(await file.stat()).isFile()) throw new Error("Only regular files can be previewed.");
      if (!internals.isContained(root, await realpath(absolute))) throw new Error("File escapes the repository.");
      const buffer = Buffer.alloc(MAX_PREVIEW_BYTES + 1);
      let read = 0;
      while (read < buffer.length) {
        const next = await file.read(buffer, read, buffer.length - read, read);
        if (next.bytesRead === 0) break;
        read += next.bytesRead;
      }
      truncated = read > MAX_PREVIEW_BYTES;
      bytes = buffer.subarray(0, Math.min(read, MAX_PREVIEW_BYTES));
    } finally { await file.close(); }
  }
  return { bytes, truncated, symbolicLink: info.isSymbolicLink() };
}
export async function untrackedPatch(root: string, requested: unknown, allowed: { path: string }[]) {
  const path = internals.requirePath(requested, "path");
  if (!allowed.some(file => file.path === path)) throw new Error("File is no longer untracked in this repository.");
  const { bytes, truncated, symbolicLink } = await readPreview(root, path);
  const header = `diff --git ${JSON.stringify(`a/${path}`)} ${JSON.stringify(`b/${path}`)}\nnew file mode ${symbolicLink ? "120000" : "100644"}\n--- /dev/null\n+++ ${JSON.stringify(`b/${path}`)}\n`;
  if (bytes.includes(0)) return { root, patch: header + "Binary files /dev/null and new file differ\n", truncated };
  const text = bytes.toString("utf8");
  const lines = text ? text.split("\n") : [];
  if (text.endsWith("\n")) lines.pop();
  const hunk = lines.length ? `@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}\n`).join("")}` : "";
  return { root, patch: header + hunk + (text && !text.endsWith("\n") && !truncated ? "\\ No newline at end of file\n" : ""), truncated };
}
