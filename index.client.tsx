import type { PluginClientContext } from "@getpaseo/plugin/client";
import { GraphPanel } from "./client/graph-panel";
import { createDiffTabs } from "./client/diff-tabs";

export default function contribute(client: PluginClientContext) {
  const diffs = createDiffTabs(client);
  const removeGraph = client.addWorkspacePanel({ id: "git-graph", title: "Git Graph", icon: "GitGraph", context: "workspace",
    locations: ["workspace", "explorer"], Component: props => <GraphPanel {...props} openDiff={diffs.open} /> });
  const removeCommand = client.addCommandCenterItem({ id: "open-git-graph", title: "Open Git Graph", icon: "GitGraph", context: "workspace",
    onSelect({ openPanel }) { openPanel("git-graph"); } });
  return () => { removeCommand(); removeGraph(); diffs.dispose(); };
}
