import { isSyntaxThemeId, type SyntaxThemeId } from "./paseo-syntax-themes.ts";

export const APP_SETTINGS_KEY = "@paseo:app-settings";
export const LEGACY_SETTINGS_KEY = "@paseo:settings";
export interface Appearance {
  uiFontFamily: string; monoFontFamily: string;
  uiFontSize: number; smallFontSize: number; codeFontSize: number;
  diffLineHeight: number; rowHeight: number; syntaxTheme: SyntaxThemeId;
}
export function buildAppearance(settings: unknown, platform = "web", appliedUiFont = ""): Appearance {
  const value = settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : {};
  const uiDefault = platform === "web" ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    : platform === "ios" ? "system-ui" : "normal";
  const monoDefault = platform === "web" ? "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    : platform === "ios" ? "ui-monospace" : "monospace";
  const uiFontSize = size(value.uiBaseFontSize ?? value.uiFontSize, platform === "web" ? 14 : 15, 10, 21);
  const codeFontSize = size(value.codeFontSize, 12, 9, 22);
  return {
    uiFontFamily: font(appliedUiFont, font(value.uiFontFamily, uiDefault)),
    monoFontFamily: font(value.monoFontFamily, monoDefault),
    uiFontSize, smallFontSize: Math.round(12 * uiFontSize / 14), codeFontSize,
    diffLineHeight: Math.round(codeFontSize * 1.5),
    rowHeight: Math.max(32, Math.round(uiFontSize * 1.5) + 8),
    syntaxTheme: typeof value.syntaxTheme === "string" && isSyntaxThemeId(value.syntaxTheme) ? value.syntaxTheme : "one",
  };
}
export function parseAppearance(raw: string | null, platform: string, appliedUiFont = ""): Appearance {
  let settings: unknown;
  try { settings = raw ? JSON.parse(raw) : undefined; } catch {}
  return buildAppearance(settings, platform, appliedUiFont);
}
function size(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}
function font(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 && !/[;{}<>\r\n]/.test(trimmed) ? trimmed : fallback;
}
