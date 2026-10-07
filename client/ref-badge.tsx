import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { Badge } from "../shared/rpc";
import { contrastingTextColor } from "../shared/syntax-color";
import { useAppearance } from "./appearance";

export function RefBadge({ badge, color, theme, onPress, onRemotePress }: {
  badge: Badge; color: string; theme: PluginTheme; onPress: () => void; onRemotePress: (remote: Badge["remotes"][number]) => void;
}) {
  const appearance = useAppearance();
  const current = badge.kind === "head" || badge.kind === "detached";
  const icon = badge.kind === "tag" ? "Tag" : badge.kind === "stash" ? "Archive" : badge.kind === "detached" ? "GitCommitHorizontal" : "GitBranch";
  const ink = contrastingTextColor(color, theme.colors.foreground, theme.colors.surface0, theme.colors.accentForeground);
  return <View testID="git-ref-badge" style={{ flexDirection: "row", alignItems: "stretch", flexShrink: 1, minWidth: 0,
    borderWidth: 1, borderRadius: 4, overflow: "hidden", borderColor: current ? color : theme.colors.border,
    backgroundColor: current ? theme.colors.surface2 : theme.colors.surface1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Reference actions: ${badge.title}`} accessibilityState={{ selected: current }}
      onPress={event => { event.stopPropagation(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "stretch", flexShrink: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 })}>
      <View testID="git-ref-color" style={{ width: Math.max(22, appearance.smallFontSize + 10), alignItems: "center", justifyContent: "center",
        backgroundColor: color }}><Icon name={icon} size={14} color={ink} /></View>
      <Text testID="git-ref-label" numberOfLines={1} style={{ ...appearance.small, flexShrink: 1, paddingHorizontal: 6, paddingVertical: 2,
        color, fontWeight: current ? "600" : "400" }}>{badge.text}</Text>
    </Pressable>
    {badge.remotes.map(remote => <Pressable key={remote.name} accessibilityRole="button" accessibilityLabel={`Reference actions: ${remote.full}`}
      onPress={event => { event.stopPropagation(); onRemotePress(remote); }}
      style={({ pressed }) => ({ justifyContent: "center", flexShrink: 1, minWidth: 0, paddingRight: 6, opacity: pressed ? 0.7 : 1 })}>
      <Text numberOfLines={1} style={{ ...appearance.small, color, fontStyle: "italic", fontWeight: current ? "600" : "400" }}>· {remote.name}</Text>
    </Pressable>)}
  </View>;
}
