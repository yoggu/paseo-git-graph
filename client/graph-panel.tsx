import { type PluginWorkspacePanelProps, useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { FlatList, Icon, Modal, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import { commitActions, describeBadge, operationActions, refActions, stashActions, workingActions } from "../shared/actions.js";
import { WORKTREE_HASH, changedFileCount, workingGraph } from "../shared/working-graph";
import type { Segment } from "../shared/geometry";
import { graphRails, graphRowMetrics } from "../shared/graph-rails";
import type { OpenDiff } from "../shared/diff-types";
import { groupRefs, matchesFilter } from "../shared/refs.js";
import { gitRequest, type Action, type Badge, type Call, type Commit, type History, type Repository, type Target, type Working } from "../shared/rpc";
import { ActionDialog, ActionsMenu } from "./action-dialog";
import { FileAccordion, type Selection } from "./accordion";
import { recallGraph, rememberGraph } from "./graph-memory";
import { RepositoryPicker } from "./repositories";
import { RefBadge } from "./ref-badge";
import { Button, ErrorMessage, Input, Label } from "./ui";

import { AppearanceProvider, monoAttributes, themedLaneColor, useAppearance } from "./appearance";
const PAGE_SIZE = 120;
interface PaintedSegment extends Segment { color: string }

export function GraphPanel(props: PluginWorkspacePanelProps & { openDiff: OpenDiff }) {
  return <AppearanceProvider><WorkspaceGraph {...props} /></AppearanceProvider>;
}
function WorkspaceGraph(props: PluginWorkspacePanelProps & { openDiff: OpenDiff }) {
  const workspace = useWorkspace(props.workspaceId, ({ directory, name }) => ({ directory, name }));
  if (!workspace) return <View style={{ padding: 12 }}><Label theme={props.theme}>Workspace unavailable.</Label></View>;
  return <RepositoryGraph key={`${props.workspaceId}:${workspace.directory}`} {...props} workspaceName={workspace.name} />;
}
function RepositoryGraph({ theme, layout, workspaceId, workspaceName, openDiff }: PluginWorkspacePanelProps & { workspaceName: string; openDiff: OpenDiff }) {
  const appearance = useAppearance();
  const ROW = appearance.rowHeight;
  const rpc = useRpc(gitRequest);
  const cache = useQueryClient();
  const toast = useToast();
  const remembered = recallGraph(workspaceId);
  const [target, setTarget] = useState<Target | undefined>(remembered?.target);
  const [repositoryName, setRepositoryName] = useState(remembered?.repositoryName ?? workspaceName);
  const [ref, setRef] = useState<string | null>(remembered?.ref ?? null);
  const [search, setSearch] = useState(remembered?.search ?? "");
  const [repositoriesOpen, setRepositoriesOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(remembered?.selection ?? null);
  const [compareBase, setCompareBase] = useState<Commit | null>(remembered?.compareBase ?? null);
  const [menu, setMenu] = useState<{ title: string; actions: Action[] } | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  useEffect(() => rememberGraph(workspaceId, { target, repositoryName, ref, search, selection, compareBase }),
    [workspaceId, target, repositoryName, ref, search, selection, compareBase]);
  const scopeKey = JSON.stringify([workspaceId, target ?? null]);
  const call: Call = useCallback(async <T,>(request: Record<string, unknown> & { op: string }): Promise<T> => {
    const scoped = request.op === "workspaces" || request.op === "repositoryLevel" ? request : { ...request, target };
    const input = gitRequest.input.parse(JSON.parse(JSON.stringify({ workspaceId, request: scoped })));
    const answer = await rpc(input);
    if (answer.error) throw new Error(answer.error);
    return answer.result as T;
  }, [rpc, workspaceId, target]);
  const history = useInfiniteQuery({ queryKey: [scopeKey, "history", ref], initialPageParam: 0,
    queryFn: ({ pageParam }) => call<History>({ op: "commits", skip: pageParam, limit: PAGE_SIZE, ref }),
    getNextPageParam: page => page.exhausted ? undefined : page.nextSkip,
    refetchInterval: 10_000, retry: false });
  const working = useQuery({ queryKey: [scopeKey, "working"], queryFn: () => call<Working>({ op: "working" }),
    refetchInterval: 3_000, retry: false });
  const previousHead = useRef<{ scope: string; head: string | null } | null>(null);
  useEffect(() => {
    if (!working.data) return;
    const previous = previousHead.current;
    previousHead.current = { scope: scopeKey, head: working.data.head };
    if (previous?.scope === scopeKey && previous.head !== working.data.head) {
      void cache.invalidateQueries({ predicate: query => query.queryKey[0] === scopeKey && query.queryKey[1] === "history" });
    }
  }, [working.data?.head, scopeKey, cache]);
  useEffect(() => {
    if (selection?.kind === "working" && working.data && !changedFileCount(working.data)) setSelection(null);
  }, [selection, working.data]);
  const state = useQuery({ queryKey: [scopeKey, "state"], queryFn: () => call<{ state: { operation: string | null } }>({ op: "state" }),
    refetchInterval: 10_000, retry: false });
  const refresh = useCallback(() => {
    void cache.invalidateQueries({ predicate: query => query.queryKey[0] === scopeKey || query.queryKey[0] === "git-diff" });
  }, [cache, scopeKey]);
  const fetch = useMutation({ mutationFn: () => call<{ skipped?: string; added: unknown[]; updated: unknown[]; pruned: unknown[]; error?: string }>({ op: "fetch", prune: false }),
    onSuccess(result) {
      if (result.error) toast.error(result.error);
      else toast.show(result.skipped ?? `Fetch: ${result.added?.length ?? 0} new, ${result.updated?.length ?? 0} updated, ${result.pruned?.length ?? 0} removed refs`);
      refresh();
    }, onError(error) { toast.error(error.message); } });
  const first = history.data?.pages[0];
  const commits = useMemo(() => {
    const seen = new Set<string>();
    return (history.data?.pages.flatMap(page => page.commits) ?? []).filter(commit => !seen.has(commit.hash) && !!seen.add(commit.hash));
  }, [history.data]);
  const headInScope = !ref || ref === "HEAD" || first?.refs?.refs.some(entry => entry.name === ref && entry.isHead) === true;
  const graph = useMemo(() => workingGraph(commits, history.hasNextPage, working.data, headInScope),
    [commits, history.hasNextPage, working.data, headInScope]);
  const accordionHeight = Math.round((layout.compact ? 280 : 220) * appearance.uiFontSize / 14);
  const expandedHash = selection?.kind === "working" ? WORKTREE_HASH : selection?.kind === "commit" ? selection.hash : selection?.kind === "compare" ? selection.from : null;
  const expandedIndex = expandedHash ? graph.rows.findIndex(row => row.commit.hash === expandedHash) : -1;
  const segments = useMemo(() => graphRails(graph, ROW, expandedIndex, accordionHeight), [graph, ROW, expandedIndex, accordionHeight]);
  const refs = first?.refs?.refs ?? [];
  const remotes = first?.refs?.remotes ?? [];
  const branch = first?.refs?.head ?? null;
  const actionContext = { branch, remotes, branches: refs.filter(entry => entry.kind === "branch").map(entry => entry.name.replace(/^refs\/heads\//, "")) };
  const openActions = (title: string, actions: Action[]) => setMenu({ title, actions });
  const badgeActions = (badge: Badge) => {
    const descriptor = describeBadge(badge, refs, first?.stashes ?? []);
    if (descriptor) openActions(badge.title, badge.kind === "stash" ? stashActions(descriptor) : refActions(descriptor, actionContext));
  };
  const compare = (commit: Commit) => {
    if (!compareBase) { setCompareBase(commit); return; }
    if (compareBase.hash === commit.hash) { setCompareBase(null); return; }
    setSelection({ kind: "compare", from: compareBase.hash, to: commit.hash });
  };
  const choose = (repository: Repository) => {
    setTarget(repository.target); setRepositoryName(repository.root); setRef(null); setSearch("");
    setSelection(null); setCompareBase(null); setMenu(null); setAction(null);
  };
  const graphWidth = 12 + graph.columnCount * 14 + 12;
  const accordion = (selected: Selection) => <FileAccordion key={JSON.stringify([scopeKey, selected])} selection={selected} call={call}
    scopeKey={scopeKey} theme={theme} compact={layout.compact} working={working.data} openDiff={openDiff}
    source={{ workspaceId, target, repository: first?.root ?? working.data?.root ?? repositoryName }} openActions={openActions} close={() => setSelection(null)} />;
  return <View style={{ flex: 1, minHeight: 0, backgroundColor: theme.colors.surface0 }}>
    <View style={{ padding: 8, gap: 7, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        <Button title="Repository" icon="FolderGit2" theme={theme} onPress={() => setRepositoriesOpen(true)} />
        <Button title={ref ? ref.replace(/^refs\/(heads|remotes|tags)\//, "") : "All branches"} icon="GitBranch" theme={theme} onPress={() => setRefsOpen(true)} />
        <Button title={fetch.isPending ? "Fetching…" : "Fetch"} icon="Download" theme={theme} disabled={fetch.isPending} onPress={() => fetch.mutate()} />
        <Button title="Refresh" icon="RefreshCw" theme={theme} disabled={history.isFetching} onPress={refresh} />
        <Button title="⋯" theme={theme} onPress={() => openActions("Repository actions", state.data?.state.operation ? operationActions(state.data.state) : [
          { action: "branch.create", label: "Create branch…", title: "Create branch", fields: [
            { name: "name", label: "Branch name", required: true }, { name: "checkout", label: "Check out", type: "checkbox", initial: true }], },
          ...workingActions(),
        ])} />
      </View>
      <Text numberOfLines={1} selectable style={{ ...appearance.small, color: theme.colors.foregroundMuted }}>{first?.root ?? repositoryName}</Text>
      <Input theme={theme} value={search} onChangeText={setSearch} placeholder="Search loaded history: message, author, hash, ref" />
      {compareBase && <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Label theme={theme}>A: {compareBase.hash.slice(0, 8)} — select B via ⇔ or Ctrl/Cmd-click</Label>
        <Button title="Working tree" theme={theme} onPress={() => setSelection({ kind: "compare", from: compareBase.hash, to: null })} />
        <Button title="Clear" theme={theme} onPress={() => setCompareBase(null)} />
      </View>}
      {state.data?.state.operation && <Label theme={theme}>In progress: {state.data.state.operation}</Label>}
    </View>
    <ErrorMessage theme={theme} error={history.error ?? working.error} />
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <FlatList testID="git-graph-history" style={{ flex: 1, minWidth: Math.max(550, graphWidth + 400) }} data={graph.rows}
          keyExtractor={row => row.commit.hash} getItemLayout={(_, index) => {
            const metrics = graphRowMetrics(index, ROW, expandedIndex, accordionHeight);
            return { length: metrics.height, offset: metrics.top, index };
          }}
          initialNumToRender={40} windowSize={9} extraData={[selection, search, compareBase, appearance]}
          ListEmptyComponent={<View style={{ padding: 12 }}><Label theme={theme} muted>{history.isPending ? "Loading history…" : "No commits"}</Label></View>}
          ListFooterComponent={<View style={{ padding: 8, gap: 5 }}><Label theme={theme} muted>{commits.length} commits loaded{history.hasNextPage ? " · more available" : " · end of history"}</Label>
            {history.hasNextPage && <Button theme={theme} title={history.isFetchingNextPage ? "Loading…" : "Load older commits"}
              disabled={history.isFetching} onPress={() => { void history.fetchNextPage(); }} />}</View>}
          renderItem={({ item, index }) => {
            const commit = item.commit;
            const synthetic = commit.synthetic === true;
            const selected = index === expandedIndex;
            const height = ROW + (selected ? accordionHeight : 0);
            const matches = synthetic || matchesFilter(commit, remotes, search);
            const badges = synthetic ? [] : groupRefs(commit.refs, remotes, { hash: commit.hash, stashes: first?.stashes ?? [] });
            const color = themedLaneColor(item.slot, theme);
            const currentHead = !synthetic && (working.data ? working.data.head === commit.hash
              : badges.some(badge => badge.kind === "head" || badge.kind === "detached"));
            const selectCommit = (event: GestureResponderEvent) => {
              const modifiers = event.nativeEvent as typeof event.nativeEvent & { ctrlKey?: boolean; metaKey?: boolean };
              if (synthetic) setSelection(current => current?.kind === "working" ? null : { kind: "working" });
              else if (modifiers.ctrlKey || modifiers.metaKey) compare(commit);
              else setSelection(current => current?.kind === "commit" && current.hash === commit.hash ? null : { kind: "commit", hash: commit.hash });
            };
            const commitMenu = () => openActions(commit.subject, synthetic ? workingActions() : commitActions(commit, actionContext));
            return <View testID={synthetic ? "git-working-row" : `git-commit-row-${commit.hash}`} style={{ height, flexDirection: "row", backgroundColor: selected ? theme.colors.surface2 : theme.colors.surface0 }}>
              <View pointerEvents="none" style={{ width: graphWidth, height, position: "relative", opacity: matches ? 1 : 0.3 }}>
                {segments[index]?.map((segment, n) => <Rail key={n} {...segment} color={segment.synthetic ? theme.colors.foregroundMuted : themedLaneColor(segment.slot, theme)} />)}
                <View testID={synthetic ? "git-working-node" : `git-commit-node-${commit.hash}`} style={{ position: "absolute", width: synthetic ? 10 : 8, height: synthetic ? 10 : 8,
                  borderRadius: 5, left: 12 + item.column * 14 - (synthetic ? 5 : 4), top: ROW / 2 - (synthetic ? 5 : 4),
                  backgroundColor: synthetic ? selected ? theme.colors.surface2 : theme.colors.surface0 : color,
                  borderWidth: synthetic ? 2 : 1, borderColor: synthetic ? theme.colors.foregroundMuted : theme.colors.surface0 }} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}><View style={{ height: ROW, flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, height: ROW, opacity: matches ? 1 : 0.3 }}>
                {synthetic ? <View style={{ width: 12 }} /> : <Pressable accessibilityRole="button"
                  accessibilityLabel={`Toggle details for commit ${commit.hash.slice(0, 7)}`} accessibilityState={{ expanded: selected }}
                  onPress={selectCommit} onLongPress={commitMenu} style={{ height: ROW, justifyContent: "center", width: 12 }}>
                  <Icon name={selected ? "ChevronDown" : "ChevronRight"} size={12} color={theme.colors.foregroundMuted} />
                </Pressable>}
                {currentHead && <View testID="git-checkout-dot" accessible accessibilityLabel="Currently checked out commit"
                  style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, backgroundColor: color }} />}
                {badges.map(badge => <RefBadge key={badge.key} badge={badge} color={color} theme={theme} onPress={() => badgeActions(badge)} onRemotePress={remote => badgeActions({ ...badge, kind: "remote", remote: remote.name,
                  text: remote.full, title: remote.full, remotes: [] })} />)}
                <Pressable accessibilityRole="button" accessibilityLabel={synthetic ? "Toggle uncommitted changes" : `Commit ${commit.hash.slice(0, 7)} ${commit.subject}`}
                  accessibilityState={{ expanded: selected }} onPress={selectCommit} onLongPress={commitMenu}
                  style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6, height: ROW }}>
                  <Text numberOfLines={1} style={{ ...appearance.text, flex: 1, color: theme.colors.foreground, fontWeight: synthetic || currentHead ? "600" : "400" }}>{commit.subject}</Text>
                  {!synthetic && !layout.compact && <Text numberOfLines={1} style={{ ...appearance.small, width: Math.round(95 * appearance.uiFontSize / 14), color: theme.colors.foregroundMuted }}>{commit.authorName}</Text>}
                  {!synthetic && <Text {...monoAttributes} style={{ ...appearance.mono, color: theme.colors.foregroundMuted }}>{commit.hash.slice(0, 7)}</Text>}
                </Pressable>
              </View>
              {!synthetic && <Pressable accessibilityLabel="Select comparison revision" onPress={() => compare(commit)} style={{ padding: 7 }}>
                <Icon name="GitCompareArrows" size={14} color={compareBase?.hash === commit.hash ? theme.colors.accent : theme.colors.foregroundMuted} />
              </Pressable>}
              <Pressable accessibilityLabel={synthetic ? "Working tree actions" : "Commit actions"} onPress={() => openActions(commit.subject, synthetic ? workingActions() : commitActions(commit, actionContext))} style={{ padding: 7 }}>
                <Icon name="Ellipsis" size={16} color={theme.colors.foregroundMuted} />
              </Pressable>
              </View>
              {selected && selection && <View style={{ height: accordionHeight }}>{accordion(selection)}</View>}
              </View>
            </View>;
          }} />
      </ScrollView>
    </View>
    {repositoriesOpen && <RepositoryPicker call={call} scopeKey={scopeKey} theme={theme} close={() => setRepositoriesOpen(false)} choose={choose} />}
    {refsOpen && <Modal title="History scope" open onOpenChange={setRefsOpen}><Modal.Content>
      <Button title="All branches, remotes, tags and stashes" active={!ref} theme={theme} onPress={() => { setRef(null); setSelection(null); setCompareBase(null); setRefsOpen(false); }} />
      <Button title="HEAD" active={ref === "HEAD"} theme={theme} onPress={() => { setRef("HEAD"); setSelection(null); setCompareBase(null); setRefsOpen(false); }} />
      {refs.map(entry => <Button key={entry.name} title={entry.name.replace(/^refs\/(heads|remotes|tags)\//, "")}
        active={ref === entry.name} theme={theme} onPress={() => { setRef(entry.name); setSelection(null); setCompareBase(null); setRefsOpen(false); }} />)}
    </Modal.Content></Modal>}
    {menu && <ActionsMenu {...menu} theme={theme} close={() => setMenu(null)} select={setAction} />}
    {action && <ActionDialog key={JSON.stringify([scopeKey, action])} action={action} call={call} scopeKey={scopeKey} theme={theme}
      close={() => setAction(null)} refreshed={refresh} />}
  </View>;
}
function Rail({ x1, y1, x2, y2, color }: PaintedSegment) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (!length) return null;
  return <View style={{ position: "absolute", left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - 0.8,
    width: length + 0.3, height: 1.6, backgroundColor: color, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />;
}
