import { NativeModules, Platform } from "react-native";
import { APP_SETTINGS_KEY, LEGACY_SETTINGS_KEY, parseAppearance } from "../shared/appearance";
import { observeWebAppearance, readWebAppearance } from "./web";

const listeners = new Set<() => void>();
const initial = Platform.OS === "web" ? readWebAppearance() : { raw: null, uiFont: "" };
let snapshot = parseAppearance(initial.raw, Platform.OS, initial.uiFont);
let signature = JSON.stringify([initial.raw, initial.uiFont]);
let polling: ReturnType<typeof setInterval> | null = null;
let stopWeb: (() => void) | null = null;
let nativeRead: number | null = null, generation = 0;
function update(raw: string | null, uiFont = "") {
  const next = JSON.stringify([raw, uiFont]);
  if (signature === next) return;
  signature = next;
  const appearance = parseAppearance(raw, Platform.OS, uiFont);
  if (JSON.stringify(appearance) === JSON.stringify(snapshot)) return;
  snapshot = appearance;
  for (const listener of listeners) listener();
}
function poll() {
  if (Platform.OS === "web") {
    const { raw, uiFont } = readWebAppearance();
    update(raw, uiFont);
    return;
  }
  if (nativeRead === generation) return;
  const storage = NativeModules.RNCAsyncStorage ?? NativeModules.AsyncSQLiteDBStorage ?? NativeModules.AsyncLocalStorage;
  if (typeof storage?.multiGet !== "function") return;
  const current = generation;
  nativeRead = current;
  try {
    storage.multiGet([APP_SETTINGS_KEY, LEGACY_SETTINGS_KEY], (error: unknown, entries?: [string, string | null][]) => {
      if (nativeRead === current) nativeRead = null;
      if (error || current !== generation || !Array.isArray(entries)) return;
      const values = new Map(entries.filter(entry => Array.isArray(entry) && entry.length === 2));
      update(values.get(APP_SETTINGS_KEY) ?? values.get(LEGACY_SETTINGS_KEY) ?? null);
    });
  } catch { if (nativeRead === current) nativeRead = null; }
}
export function appearanceSnapshot() { return snapshot; }
export function subscribeAppearance(listener: () => void) {
  listeners.add(listener);
  if (!polling) {
    generation++;
    stopWeb = observeWebAppearance(poll);
    polling = setInterval(poll, 500);
    poll();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      generation++;
      if (polling) clearInterval(polling);
      polling = null;
      stopWeb?.(); stopWeb = null;
    }
  };
}
