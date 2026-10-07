export interface PatchRow { text: string; kind: string; old: number | null; new: number | null; hunk?: number }
export interface SplitCell { text: string; number: number | null; row: PatchRow; index: number }
export interface SplitRow { kind: string; row?: PatchRow; old?: SplitCell | null; new?: SplitCell | null; index?: number; indices?: number[] }
export function parseUnifiedPatch(patch: string): { rows: PatchRow[]; hunks: number[]; additions: number; deletions: number; binary: boolean };
export function planSplitRows(rows: PatchRow[]): SplitRow[];
export function resolveDiffLayout(mode?: string, width?: number | null, splitAt?: number): string;
export function diffFileIdentity(file: { group?: string; staged?: boolean; status?: string; path: string }, mode?: string): string;
