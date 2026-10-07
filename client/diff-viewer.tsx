/** Copyright (c) 2025-present Mohamed Boudra. Apache-2.0; see licenses/PASEO-LICENSE.
 * Adapted from Paseo's diff-viewer.tsx: plugin theme, numbered/virtualized rows and split layout.
 */
import type { PluginTheme } from "@getpaseo/plugin";
import { FlatList, ScrollView } from "@getpaseo/plugin/client/react-native";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { monoAttributes, useAppearance } from "./appearance";
import { resolveSyntaxColors } from "../shared/paseo-syntax-themes";
import { colorScheme, syntaxRole } from "../shared/syntax-color";
import { buildSplitDiffRows, buildUnifiedDiffLines } from "../shared/paseo-diff-layout";
import { compactHighlightTokens, formatDiffContentText, formatDiffGutterText } from "../shared/paseo-diff-rendering";
import type { DiffLine, ParsedDiffFile } from "../shared/diff-types";
import { Label } from "./ui";

export function DiffViewer({ file, mode, wrap, theme }: {
  file: ParsedDiffFile; mode: "auto" | "unified" | "split"; wrap: boolean; theme: PluginTheme;
}) {
  const appearance = useAppearance();
  const palette = resolveSyntaxColors(appearance.syntaxTheme, colorScheme(theme.colors.surface0, theme.colors.foreground));
  const lineHeight = appearance.diffLineHeight;
  const characterWidth = appearance.codeFontSize * 0.65;
  const [width, setWidth] = useState(0);
  const split = mode === "split" || (mode === "auto" && width >= 900);
  const unified = useMemo(() => buildUnifiedDiffLines(file), [file]);
  const paired = useMemo(() => buildSplitDiffRows(file), [file]);
  const longest = useMemo(() => file.hunks.reduce((max, hunk) => hunk.lines.reduce((length, line) => Math.max(length, displayText(line.content).length), max), 1), [file]);
  const gutter = Math.max(38, String(file.hunks.reduce((max, hunk) => Math.max(max, hunk.oldStart + hunk.oldCount, hunk.newStart + hunk.newCount), 1)).length * characterWidth + 16);
  const cellWidth = wrap ? 0 : Math.max(200, longest * characterWidth + gutter + 32);
  const contentWidth = Math.max(width, split ? cellWidth * 2 : cellWidth);
  const code = (line: DiffLine, numbered: number | null, prefix = "") => <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "stretch", minHeight: lineHeight,
    backgroundColor: theme.colors.surface0 }}>
    {(line.type === "add" || line.type === "remove") && <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject,
      backgroundColor: line.type === "add" ? theme.colors.statusSuccess : theme.colors.statusDanger, opacity: 0.12 }} />}
    <Text selectable style={{ ...appearance.code, width: gutter, paddingHorizontal: 8, textAlign: "right",
      color: theme.colors.foregroundMuted, backgroundColor: theme.colors.surface1 }}>{formatDiffGutterText(numbered)}</Text>
    <Text testID="git-diff-line-text" selectable style={{ ...appearance.code, flex: 1, paddingHorizontal: 10, color: theme.colors.foreground }}>
      {prefix}{line.tokens?.length ? compactHighlightTokens(line.tokens).map((token, index) => <Text key={index} style={{ color: syntaxRole(token.style) ? palette[syntaxRole(token.style)!] : theme.colors.foreground }}>{displayText(token.text)}</Text>)
        : formatDiffContentText(displayText(line.content))}
    </Text>
  </View>;
  const header = (content: string) => <Text selectable style={{ ...appearance.code, paddingHorizontal: 12, paddingVertical: 5,
    color: theme.colors.foregroundMuted, backgroundColor: theme.colors.surface1 }}>{content}</Text>;
  const content = split ? <FlatList key={`split:${wrap}`} style={{ flex: 1 }} data={paired} keyExtractor={(_, index) => String(index)}
    initialNumToRender={50} windowSize={7} renderItem={({ item }) => item.kind === "header" ? header(item.content)
      : <View style={{ flexDirection: "row", minHeight: lineHeight }}>
        <View style={{ flex: 1, minWidth: 0, borderRightWidth: 1, borderColor: theme.colors.border }}>
          {item.left ? code({ type: item.left.type, content: item.left.content, tokens: item.left.tokens }, item.left.lineNumber) : code({ type: "context", content: "" }, null)}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>{item.right ? code({ type: item.right.type, content: item.right.content, tokens: item.right.tokens }, item.right.lineNumber)
          : code({ type: "context", content: "" }, null)}</View>
      </View>} />
    : <FlatList key={`unified:${wrap}`} style={{ flex: 1 }} data={unified} keyExtractor={item => item.key} initialNumToRender={50} windowSize={7}
      renderItem={({ item }) => item.line.type === "header" || item.line.type === "note" ? header(item.line.content)
        : code(item.line, item.lineNumber, item.line.type === "add" ? "+" : item.line.type === "remove" ? "−" : " ")} />;
  return <View {...monoAttributes} testID="git-diff-content" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, minHeight: 0 }}>
    {file.binary ? <View style={{ padding: 16 }}><Label theme={theme} muted>Binary file — no text preview.</Label></View>
      : !file.hunks.length ? <View style={{ padding: 16 }}><Label theme={theme} muted>No text changes. File mode or name may have changed.</Label></View>
      : wrap ? content : <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ width: contentWidth, flexGrow: 1 }}>{content}</ScrollView>}
  </View>;
}
function displayText(text: string): string { return text.replace(/\t/g, "    "); }
