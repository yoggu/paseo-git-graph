import type { PluginTheme } from "@getpaseo/plugin";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { Platform } from "react-native";
import { buildAppearance } from "../shared/appearance";
import { appearanceSnapshot, subscribeAppearance } from "./appearance-store";

const Context = createContext(buildAppearance(undefined, Platform.OS));
export const monoAttributes = Platform.OS === "web" ? { dataSet: { pmono: "true" } } : {};
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const appearance = useSyncExternalStore(subscribeAppearance, appearanceSnapshot, appearanceSnapshot);
  return <Context.Provider value={appearance}>{children}</Context.Provider>;
}
export function useAppearance() {
  const appearance = useContext(Context);
  return { ...appearance,
    text: { fontFamily: appearance.uiFontFamily, fontSize: appearance.uiFontSize },
    small: { fontFamily: appearance.uiFontFamily, fontSize: appearance.smallFontSize },
    mono: { fontFamily: appearance.monoFontFamily, fontSize: appearance.smallFontSize },
    code: { fontFamily: appearance.monoFontFamily, fontSize: appearance.codeFontSize, lineHeight: appearance.diffLineHeight },
  };
}
export function themedLaneColor(slot: number, theme: PluginTheme) {
  const palette = [theme.colors.accent, theme.colors.statusSuccess, theme.colors.statusWarning, theme.colors.statusDanger];
  return palette[Math.abs(slot) % palette.length];
}
