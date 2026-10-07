import type { PluginTheme } from "@getpaseo/plugin";
import { Icon, TextInput } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useAppearance } from "./appearance";

export function Button({ title, icon, theme, onPress, disabled, active, accessibilityLabel }: {
  title: string; icon?: string; theme: PluginTheme; onPress: () => void; disabled?: boolean; active?: boolean; accessibilityLabel?: string;
}) {
  const appearance = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} disabled={disabled} onPress={onPress}
    style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 4, opacity: disabled ? 0.5 : 1,
      backgroundColor: theme.colors.surface2 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {icon && <Icon name={icon} size={14} color={active ? theme.colors.accent : theme.colors.foreground} />}
      <Text style={{ ...appearance.small, color: active ? theme.colors.accent : theme.colors.foreground }}>{title}</Text>
    </View>
  </Pressable>;
}
export function Label({ children, theme, muted = false }: { children: ReactNode; theme: PluginTheme; muted?: boolean }) {
  const appearance = useAppearance();
  return <Text selectable style={{ ...appearance.text, color: muted ? theme.colors.foregroundMuted : theme.colors.foreground }}>{children}</Text>;
}
export function Input({ value, onChangeText, placeholder, theme, multiline = false }: {
  value: string; onChangeText: (text: string) => void; placeholder?: string; theme: PluginTheme; multiline?: boolean;
}) {
  const appearance = useAppearance();
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} multiline={multiline}
    placeholderTextColor={theme.colors.foregroundMuted} autoCapitalize="none" autoCorrect={false}
    style={{ ...appearance.text, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 4, padding: 8,
      color: theme.colors.foreground, backgroundColor: theme.colors.surface2 }} />;
}
export function ErrorMessage({ error, theme }: { error: unknown; theme: PluginTheme }) {
  const appearance = useAppearance();
  if (!error) return null;
  return <View style={{ padding: 10 }}><Text selectable style={{ ...appearance.text, color: theme.colors.statusDanger }}>{error instanceof Error ? error.message : String(error)}</Text></View>;
}
