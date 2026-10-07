import type { HighlightStyle } from "./paseo-syntax-types";

const roles = new Set<string>(["keyword", "comment", "string", "number", "literal", "function", "definition", "class", "type", "tag",
  "attribute", "property", "variable", "operator", "punctuation", "regexp", "escape", "meta", "heading", "link"]);
export function syntaxRole(style: string | null): HighlightStyle | null {
  return style && roles.has(style) ? style as HighlightStyle : null;
}
export function colorScheme(background: string, foreground: string): "light" | "dark" {
  const bg = luminance(background), fg = luminance(foreground);
  if (bg !== null && fg !== null) return bg > fg ? "light" : "dark";
  if (bg !== null) return bg > 0.5 ? "light" : "dark";
  return fg !== null && fg < 0.5 ? "light" : "dark";
}
export function contrastingTextColor(background: string, first: string, ...others: string[]): string {
  const candidates = [first, ...others];
  const bg = luminance(background);
  if (bg === null) return candidates[0];
  let best = candidates[0], bestRatio = 0;
  for (const color of candidates) {
    const fg = luminance(color);
    if (fg === null) continue;
    const ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    if (ratio > bestRatio) { best = color; bestRatio = ratio; }
  }
  return best;
}
function luminance(color: string): number | null {
  let value = color.trim();
  if (value === "white") value = "#ffffff";
  if (value === "black") value = "#000000";
  if (/^#[\da-f]{3}$/i.test(value)) value = "#" + [...value.slice(1)].map(char => char + char).join("");
  let rgb: number[];
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) rgb = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
  else {
    const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i);
    if (!match) return null;
    rgb = match.slice(1, 4).map(Number);
  }
  const linear = rgb.map(channel => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
