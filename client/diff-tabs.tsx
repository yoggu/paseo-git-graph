import type { PluginClientContext } from "@getpaseo/plugin/client";
import { diffIdentity, diffPanelId } from "../shared/diff-model";
import type { DiffSource, OpenDiff } from "../shared/diff-types";
import { DiffPanel } from "./diff-panel";

export function createDiffTabs(client: PluginClientContext): { open: OpenDiff; dispose: () => void } {
  const tabs = new Map<string, { key: string; remove: () => void }>();
  return {
    open(input: DiffSource) {
      const source: DiffSource = JSON.parse(JSON.stringify(input));
      const id = diffPanelId(source);
      const key = diffIdentity(source);
      const existing = tabs.get(id);
      if (existing && existing.key !== key) throw new Error("Diff tab identity collision.");
      if (!existing) {
        const filename = source.path.split("/").pop() ?? source.path;
        const comparison = source.comparison;
        const suffix = comparison.kind === "working" ? comparison.group : comparison.to?.slice(0, 7) ?? "working tree";
        const remove = client.addWorkspacePanel({ id, title: `${filename} · ${suffix}`, icon: "FileDiff", context: "workspace",
          locations: ["workspace", "explorer"], Component: props => <DiffPanel {...props} source={source} /> });
        tabs.set(id, { key, remove });
      }
      client.openPanel(id, { workspaceId: source.workspaceId });
    },
    dispose() { for (const tab of tabs.values()) tab.remove(); tabs.clear(); },
  };
}
