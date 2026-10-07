import { type PluginWorkspacePanelProps, useRpc } from "@getpaseo/plugin/client";
import { copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { DiffSource, PatchResult } from "../shared/diff-types";
import { diffIdentity, isLiveDiff, parsePatch, patchRequest } from "../shared/diff-model";
import { gitRequest } from "../shared/rpc";
import { DiffViewer } from "./diff-viewer";
import { Button, ErrorMessage, Label } from "./ui";
import { AppearanceProvider, useAppearance } from "./appearance";

export function DiffPanel(props: PluginWorkspacePanelProps & { source: DiffSource }) {
  return <AppearanceProvider><DiffPanelContent {...props} /></AppearanceProvider>;
}
function DiffPanelContent({ source, theme, workspaceId }: PluginWorkspacePanelProps & { source: DiffSource }) {
  const appearance = useAppearance();
  const rpc = useRpc(gitRequest);
  const toast = useToast();
  const [mode, setMode] = useState<"auto" | "unified" | "split">("auto");
  const [wrap, setWrap] = useState(false);
  const [syntax, setSyntax] = useState(true);
  const [context, setContext] = useState(3);
  const query = useQuery({ queryKey: ["git-diff", "paseo-highlighter", diffIdentity(source), context], enabled: workspaceId === source.workspaceId,
    queryFn: async () => {
      const input = gitRequest.input.parse(JSON.parse(JSON.stringify({ workspaceId: source.workspaceId,
        request: { ...patchRequest(source, context), target: source.target, expectedRoot: source.repository } })));
      const answer = await rpc(input);
      if (answer.error) throw new Error(answer.error);
      return answer.result as unknown as PatchResult;
    }, refetchInterval: isLiveDiff(source) ? 3_000 : false, retry: false });
  const file = useMemo(() => query.data ? parsePatch(query.data, source.path, syntax) : null, [query.data, source.path, syntax]);
  const comparison = source.comparison;
  if (workspaceId !== source.workspaceId) return <View style={{ padding: 16 }}><Label theme={theme}>Open this diff from its original Git Graph workspace.</Label></View>;
  return <View style={{ flex: 1, minHeight: 0, backgroundColor: theme.colors.surface0 }}>
    <View style={{ padding: 8, gap: 6, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
        <Button title="Auto" active={mode === "auto"} theme={theme} onPress={() => setMode("auto")} />
        <Button title="Unified" active={mode === "unified"} theme={theme} onPress={() => setMode("unified")} />
        <Button title="Split" active={mode === "split"} theme={theme} onPress={() => setMode("split")} />
        <Button title="Wrap" active={wrap} theme={theme} onPress={() => setWrap(value => !value)} />
        <Button title="Syntax" active={syntax} theme={theme} onPress={() => setSyntax(value => !value)} />
        <Button title="Less context" disabled={context === 3} theme={theme} onPress={() => setContext(value => value > 25 ? 25 : value > 10 ? 10 : 3)} />
        <Button title="More context" disabled={context === 100} theme={theme} onPress={() => setContext(value => value < 10 ? 10 : value < 25 ? 25 : 100)} />
        <Button title="Refresh" disabled={query.isFetching} theme={theme} onPress={() => { void query.refetch(); }} />
        <Button title="Copy patch" disabled={!query.data} theme={theme} onPress={() => {
          void copyText(query.data!.patch).then(() => toast.show("Patch copied"), error => toast.error(String(error)));
        }} />
      </View>
      <Text selectable style={{ ...appearance.text, color: theme.colors.foreground }}>{source.oldPath ? `${source.oldPath} → ` : ""}{source.path}</Text>
      <Label theme={theme} muted>{comparison.kind === "working" ? `${comparison.group} · ${comparison.group === "staged" ? "HEAD / index" : comparison.group === "untracked" ? "new file" : "index / working tree"}`
        : `${comparison.from.slice(0, 8)} ↔ ${comparison.to?.slice(0, 8) ?? "working tree"}`} · {context} context lines</Label>
      {file && <View style={{ flexDirection: "row", gap: 8 }}>
        <Text style={{ ...appearance.small, color: theme.colors.statusSuccess }}>+{file.additions}</Text>
        <Text style={{ ...appearance.small, color: theme.colors.statusDanger }}>−{file.deletions}</Text>
      </View>}
      <Text numberOfLines={1} selectable style={{ ...appearance.small, color: theme.colors.foregroundMuted }}>{query.data?.root ?? source.repository}</Text>
      {query.data?.truncated && <Label theme={theme}>Diff truncated by the server.</Label>}
    </View>
    <ErrorMessage error={query.error} theme={theme} />
    {query.error && <View style={{ padding: 8 }}><Button title="Retry" theme={theme} onPress={() => { void query.refetch(); }} /></View>}
    {file ? <DiffViewer file={file} mode={mode} wrap={wrap} theme={theme} />
      : !query.error && <View style={{ padding: 16 }}><Label theme={theme} muted>Loading diff…</Label></View>}
  </View>;
}
