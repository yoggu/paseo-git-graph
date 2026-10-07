import { Platform } from "react-native";
import { APP_SETTINGS_KEY, LEGACY_SETTINGS_KEY } from "../shared/appearance";

declare const window: {
  localStorage: { getItem(key: string): string | null };
  getComputedStyle(element: unknown): { getPropertyValue(name: string): string };
  addEventListener(name: string, listener: () => void): void;
  removeEventListener(name: string, listener: () => void): void;
};
declare const document: { documentElement: unknown };
declare const MutationObserver: new (callback: () => void) => {
  observe(element: unknown, options: { attributes: boolean; attributeFilter: string[] }): void;
  disconnect(): void;
};

// The current SDK exposes colors, not appearance settings. Read the client's storage without writing it.
export function readWebAppearance(): { raw: string | null; uiFont: string } {
  if (Platform.OS !== "web" || typeof window === "undefined") return { raw: null, uiFont: "" };
  let raw: string | null = null, uiFont = "";
  try { raw = window.localStorage.getItem(APP_SETTINGS_KEY) ?? window.localStorage.getItem(LEGACY_SETTINGS_KEY); } catch {}
  try { uiFont = window.getComputedStyle(document.documentElement).getPropertyValue("--paseo-ui-font").trim(); } catch {}
  return { raw, uiFont };
}
export function observeWebAppearance(changed: () => void): () => void {
  if (Platform.OS !== "web" || typeof window === "undefined") return () => {};
  window.addEventListener("storage", changed);
  window.addEventListener("focus", changed);
  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(changed);
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  return () => {
    window.removeEventListener("storage", changed);
    window.removeEventListener("focus", changed);
    observer?.disconnect();
  };
}
