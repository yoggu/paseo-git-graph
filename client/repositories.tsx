import type { PluginTheme } from "@getpaseo/plugin";
import { Modal } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import type { Call, Folder, Repository, WorkspaceRoots } from "../shared/rpc";
import { Button, ErrorMessage, Input, Label } from "./ui";

export function RepositoryPicker({ call, scopeKey, theme, close, choose }: {
  call: Call; scopeKey: string; theme: PluginTheme; close: () => void; choose: (repository: Repository) => void;
}) {
  const [filter, setFilter] = useState("");
  const roots = useQuery({ queryKey: [scopeKey, "roots"], queryFn: () => call<WorkspaceRoots>({ op: "workspaces" }), retry: false });
  const select = (repository: Repository) => { choose(repository); close(); };
  return <Modal title="Select repository" open onOpenChange={open => { if (!open) close(); }}>
    <Modal.Content>
      <Input theme={theme} value={filter} onChangeText={setFilter} placeholder="Filter registered projects" />
      <Label theme={theme} muted>Only expands folders you open. Does not change the active Paseo workspace.</Label>
      <ErrorMessage theme={theme} error={roots.error} />
      {roots.error && <Button theme={theme} title="Retry" onPress={() => { void roots.refetch(); }} />}
      {roots.data?.containing && <Button title={`Current: ${roots.data.containing.root}`} theme={theme} onPress={() => select(roots.data!.containing!)} />}
      {[...(roots.data?.groups ?? [])].sort((a, b) => Number(b.current) - Number(a.current))
        .filter(group => `${group.title} ${group.path}`.toLowerCase().includes(filter.toLowerCase()))
        .map(group => <FolderNode key={group.id} groupId={group.session ? undefined : group.id} path="." title={group.title}
          call={call} scopeKey={scopeKey} theme={theme} select={select} depth={0} />)}
    </Modal.Content>
  </Modal>;
}
function FolderNode({ groupId, path, title, initial, call, scopeKey, theme, select, depth }: {
  groupId?: string; path: string; title: string; initial?: Folder; call: Call; scopeKey: string;
  theme: PluginTheme; select: (repository: Repository) => void; depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const level = useQuery({ queryKey: [scopeKey, "folder", groupId, path, expanded],
    queryFn: () => call<{ node: Folder; children: Folder[] }>({ op: "repositoryLevel", workspaceId: groupId, path, includeChildren: expanded }),
    enabled: expanded || !initial, retry: false, staleTime: 15_000 });
  const node = level.data?.node ?? initial;
  return <View style={{ gap: 4, paddingLeft: depth ? 14 : 0 }}>
    <View style={{ flexDirection: "row", gap: 4 }}>
      <Button title={expanded ? "▾" : "▸"} theme={theme} onPress={() => setExpanded(!expanded)} />
      <View style={{ flex: 1 }}><Button title={`${node?.repository ? "Git · " : ""}${title}`} theme={theme}
        onPress={() => node?.repository ? select(node.repository) : setExpanded(!expanded)} /></View>
    </View>
    <ErrorMessage error={level.error} theme={theme} />
    {level.error && <Button theme={theme} title="Retry folder" onPress={() => { void level.refetch(); }} />}
    {expanded && level.isFetching && !level.data && <Label theme={theme} muted>Loading folder…</Label>}
    {expanded && level.data?.children.map(child => <FolderNode key={child.path} groupId={groupId} path={child.path}
      title={child.label} initial={child} call={call} scopeKey={scopeKey} theme={theme} select={select} depth={depth + 1} />)}
  </View>;
}
