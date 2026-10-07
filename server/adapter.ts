import type { RpcInput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { z } from "zod";
import { dispatch } from "./git.js";
import { gitRequest } from "../shared/rpc.ts";
import { parseUnifiedPatch } from "../shared/diff-layout.js";
import { canHighlightRows, highlightRows } from "./syntax-runtime.js";
import { syntaxContents } from "./syntax-content.ts";
import { untrackedPatch } from "./untracked.ts";

export async function requestGit(input: RpcInput<typeof gitRequest>, { paseo }: PluginHandlerContext) {
  try {
    const current = await paseo.workspaces.ref(input.workspaceId).refresh();
    if (!current || current.archivingAt) throw new Error("Workspace is unavailable or being archived.");
    const projects = await paseo.projects.list();
    const roots = new Map(projects.projects.map(project => [
      `project:${project.projectId}`,
      { id: `project:${project.projectId}`, title: project.projectDisplayName, path: project.projectRootPath },
    ]));
    roots.set(current.id, { id: current.id, title: current.name, path: current.workspaceDirectory });
    const selected = input.request.target as { workspaceId?: string } | undefined;
    const rootId = input.request.op === "repositoryLevel" ? input.request.workspaceId : selected?.workspaceId;
    if (typeof rootId === "string" && !roots.has(rootId)) {
      const workspace = await paseo.workspaces.ref(rootId).refresh();
      if (workspace && !workspace.archivingAt) roots.set(rootId, { id: rootId, title: workspace.name, path: workspace.workspaceDirectory });
    }
    const ctx = {
      get(service: string) {
        if (service === "sessions") return { get: (id: string) => id === current.id ? { header: { cwd: current.workspaceDirectory } } : undefined };
        if (service === "workspaceRegistry") return { get: (id: string) => roots.get(id), list: () => [...roots.values()] };
        return undefined;
      },
    };
    const patch = input.request.op === "patch";
    const op = patch ? input.request.mode === "working" ? "workingDiff" : "diff" : input.request.op;
    const request = { ...input.request, op, sessionId: current.id };
    const result = patch && input.request.mode === "working" && input.request.untracked === true
      ? await (async () => {
        const working = await dispatch(ctx, { ...request, op: "working" });
        if (!("untracked" in working)) throw new Error("Unable to read the working tree.");
        return untrackedPatch(working.root, input.request.path, working.untracked);
      })()
      : await dispatch(ctx, request);
    if (patch && typeof input.request.expectedRoot === "string" && "root" in result && result.root !== input.request.expectedRoot) {
      throw new Error("Repository location changed; reopen the file from Git Graph.");
    }
    if (patch && "patch" in result && typeof result.patch === "string") {
      const rows = parseUnifiedPatch(result.patch).rows;
      const contents = canHighlightRows(rows, input.request.path) && rows.some(row => row.kind === "hunk")
        ? await syntaxContents(result.root, input.request) : {};
      const highlights = highlightRows(rows, input.request.path, true, contents);
      return { result: z.json().parse({ ...result, highlights: highlights ? Object.fromEntries(highlights) : null }), error: null };
    }
    return { result: z.json().parse(result), error: null };
  } catch (error) {
    return { result: null, error: error instanceof Error ? error.message : String(error) };
  }
}
