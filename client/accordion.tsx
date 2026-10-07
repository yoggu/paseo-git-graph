import type { PluginTheme } from "@getpaseo/plugin";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { fileActions } from "../shared/actions.js";
import { changedFileCount } from "../shared/working-graph";
import type { DiffSource, OpenDiff } from "../shared/diff-types";
import { EMPTY_TREE, type Action, type Call, type Detail, type FileChange, type Working } from "../shared/rpc";
import { Button, ErrorMessage, Label } from "./ui";
import { useAppearance } from "./appearance";

export type Selection = { kind: "commit"; hash: string } | { kind: "working" } | { kind: "compare"; from: string; to: string | null };
export function FileAccordion({ selection, call, scopeKey, theme, compact, working, source, openDiff, openActions, close }: {
  selection: Selection; call: Call; scopeKey: string; theme: PluginTheme; compact: boolean;
  working?: Working; source: Pick<DiffSource, "workspaceId" | "target" | "repository">; openDiff: OpenDiff;
  openActions: (title: string, actions: Action[]) => void; close: () => void;
}) {
  const appearance = useAppearance();
  const query = useQuery<{ detail: Detail } | { files: FileChange[] } | null>({ queryKey: [scopeKey, "detail", selection],
    queryFn: () => selection.kind === "commit" ? call<{ detail: Detail }>({ op: "commit", hash: selection.hash })
      : selection.kind === "compare" ? call<{ files: FileChange[] }>({ op: "compare", from: selection.from, to: selection.to }) : Promise.resolve(null),
    enabled: selection.kind !== "working", retry: false, refetchInterval: selection.kind === "compare" && selection.to === null ? 3_000 : false });
  const detail = query.data && "detail" in query.data ? query.data.detail : null;
  const files: FileChange[] = selection.kind === "working" ? [
    ...(working?.staged ?? []).map(file => ({ ...file, group: "staged", staged: true })),
    ...(working?.unstaged ?? []).map(file => ({ ...file, group: "unstaged" })),
    ...(working?.untracked ?? []).map(file => ({ ...file, group: "untracked" })),
  ] : detail?.files ?? (query.data && "files" in query.data ? query.data.files : []);
  const groups = selection.kind === "working" ? ["staged", "unstaged", "untracked"] : ["changes"];
  const openFile = (file: FileChange) => openDiff({ ...source, path: file.path, oldPath: file.oldPath || undefined,
    comparison: selection.kind === "working" ? { kind: "working", group: file.group === "staged" ? "staged" : file.group === "untracked" ? "untracked" : "unstaged" }
      : { kind: "revisions", from: selection.kind === "compare" ? selection.from : detail!.parents[0] ?? EMPTY_TREE,
        to: selection.kind === "compare" ? selection.to : selection.hash } });
  return <View testID="git-file-accordion" style={{ flex: 1, minHeight: 0, padding: 8, gap: 5, backgroundColor: theme.colors.surface1,
    borderBottomWidth: 1, borderColor: theme.colors.border }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1 }}><Label theme={theme}>{selection.kind === "working" ? "Uncommitted changes" : selection.kind === "compare" ? "Compare revisions" : "Commit details"} · {selection.kind === "working" ? changedFileCount(working) : files.length} files</Label></View>
      <Button title="Collapse details" theme={theme} onPress={close} />
    </View>
    <ErrorMessage theme={theme} error={query.error} />
    {query.error && <Button title="Retry" theme={theme} onPress={() => { void query.refetch(); }} />}
    <View style={{ flex: 1, minHeight: 0, flexDirection: compact ? "column" : "row", gap: 12 }}>
      <ScrollView style={compact ? { maxHeight: 80, flexShrink: 0 } : { flex: 1 }} contentContainerStyle={{ gap: 4 }}>
        {detail ? <>
          <Label theme={theme}>{detail.message}</Label>
          <Label theme={theme} muted>Commit: {detail.hash}</Label>
          <Label theme={theme} muted>Parents: {detail.parents.map(parent => parent.slice(0, 16)).join(", ") || "None"}</Label>
          <Label theme={theme} muted>Author: {detail.authorName} &lt;{detail.authorEmail}&gt;</Label>
          <Label theme={theme} muted>{detail.authorDate}</Label>
          {detail.committerName && <Label theme={theme} muted>Committer: {detail.committerName} · {detail.committerDate}</Label>}
        </> : selection.kind === "working" ? <>
          <Label theme={theme}>Staged, unstaged and untracked files.</Label>
          <Label theme={theme} muted>Click a file to open a diff tab. Long-press for file actions.</Label>
        </> : selection.kind === "compare" ? <>
          <Label theme={theme}>{selection.from.slice(0, 16)} ↔ {selection.to?.slice(0, 16) ?? "working tree"}</Label>
          <Label theme={theme} muted>Click a file to open a diff tab.</Label>
        </> : <Label theme={theme} muted>Loading commit details…</Label>}
      </ScrollView>
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ gap: 2 }}>
        {!files.length && <Label theme={theme} muted>{query.isFetching ? "Loading files…" : "No changed files"}</Label>}
        {groups.map(group => {
          const entries = group === "changes" ? files : files.filter(file => file.group === group);
          if (!entries.length) return null;
          return <View key={group} style={{ gap: 2 }}>
            {group !== "changes" && <Label theme={theme} muted>{group[0].toUpperCase() + group.slice(1)} ({entries.length})</Label>}
            {entries.map(file => <View key={file.path} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${group === "changes" ? "" : `${group} `}${file.path}`}
                onPress={() => openFile(file)} onLongPress={() => { if (selection.kind === "working") openActions(file.path, fileActions(file)); }}
                style={{ flex: 1, flexDirection: "row", paddingVertical: 6, gap: 6, alignItems: "center" }}>
                <Text style={{ ...appearance.small, color: theme.colors.foregroundMuted }}>{file.status}</Text>
                <Text numberOfLines={1} style={{ ...appearance.text, flex: 1, color: theme.colors.foreground }}>{file.oldPath ? `${file.oldPath} → ` : ""}{file.path}</Text>
                <Text style={{ ...appearance.small, color: theme.colors.statusSuccess }}>+{file.additions ?? "?"}</Text>
                <Text style={{ ...appearance.small, color: theme.colors.statusDanger }}>−{file.deletions ?? "?"}</Text>
              </Pressable>
              {selection.kind === "working" && <Button title="⋯" accessibilityLabel={`Actions for ${group} ${file.path}`} theme={theme} onPress={() => openActions(file.path, fileActions(file))} />}
            </View>)}
          </View>;
        })}
      </ScrollView>
    </View>
  </View>;
}
