/** Copyright (c) 2025-present Mohamed Boudra. Apache-2.0; see licenses/PASEO-LICENSE.
 * Adapted from Paseo server/utils/diff-highlighter.ts: highlighting only, explicit bounded contents, no filesystem fallback.
 */
import { highlightCode, isLanguageSupported, type HighlightToken } from "@getpaseo/highlight";

const MAX_DIFF_HIGHLIGHT_LINE_CHARS = 10_000;

export interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  tokens?: HighlightToken[];
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface ParsedDiffFile {
  path: string;
  isNew: boolean;
  isDeleted: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  status?: "ok" | "too_large" | "binary";
}

interface HighlightDiffWithFileContentOptions {
  oldFileContent?: string | null;
  newFileContent?: string | null;
}

export function reconstructNewFile(hunks: DiffHunk[]): Map<number, string> {
  const lines = new Map<number, string>();

  for (const hunk of hunks) {
    let newLineNum = hunk.newStart;

    for (const line of hunk.lines) {
      if (line.type === "header") continue;

      if (line.type === "add" || line.type === "context") {
        lines.set(newLineNum, line.content);
        newLineNum++;
      }
    }
  }

  return lines;
}

/**
 * Reconstruct the "old" version of a file from diff hunks.
 * Returns a map of old line numbers to their content.
 */
export function reconstructOldFile(hunks: DiffHunk[]): Map<number, string> {
  const lines = new Map<number, string>();

  for (const hunk of hunks) {
    let oldLineNum = hunk.oldStart;

    for (const line of hunk.lines) {
      if (line.type === "header") continue;

      if (line.type === "remove" || line.type === "context") {
        lines.set(oldLineNum, line.content);
        oldLineNum++;
      }
    }
  }

  return lines;
}

function buildFileContent(lineMap: Map<number, string>): string {
  if (lineMap.size === 0) return "";

  const lineNumbers = Array.from(lineMap.keys()).sort((a, b) => a - b);
  const minLine = lineNumbers[0];
  const maxLine = lineNumbers[lineNumbers.length - 1];

  const lines: string[] = [];
  for (let i = minLine; i <= maxLine; i++) {
    lines.push(lineMap.get(i) ?? "");
  }

  return lines.join("\n");
}

function hasOversizedLine(content: string): boolean {
  let lineStart = 0;
  for (let index = 0; index <= content.length; index++) {
    if (index !== content.length && content.charCodeAt(index) !== 10) continue;
    if (index - lineStart > MAX_DIFF_HIGHLIGHT_LINE_CHARS) return true;
    lineStart = index + 1;
  }
  return false;
}

function hasOversizedDiffLine(file: ParsedDiffFile): boolean {
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.content.length > MAX_DIFF_HIGHLIGHT_LINE_CHARS) return true;
    }
  }
  return false;
}

function buildTokenLookup(
  lineMap: Map<number, string>,
  highlighted: HighlightToken[][],
): Map<number, HighlightToken[]> {
  const lookup = new Map<number, HighlightToken[]>();

  if (lineMap.size === 0) return lookup;

  const lineNumbers = Array.from(lineMap.keys()).sort((a, b) => a - b);
  const minLine = lineNumbers[0];

  for (let i = 0; i < highlighted.length; i++) {
    const lineNum = minLine + i;
    if (lineMap.has(lineNum)) {
      lookup.set(lineNum, highlighted[i]);
    }
  }

  return lookup;
}

function buildFullFileTokenLookup(
  fileContent: string,
  path: string,
): Map<number, HighlightToken[]> | null {
  if (hasOversizedLine(fileContent)) return null;

  const lookup = new Map<number, HighlightToken[]>();
  const highlighted = highlightCode(fileContent, path);

  for (let i = 0; i < highlighted.length; i++) {
    lookup.set(i + 1, highlighted[i]);
  }

  return lookup;
}

function buildReconstructedTokenLookups(file: ParsedDiffFile): {
  newTokensByLine: Map<number, HighlightToken[]>;
  oldTokensByLine: Map<number, HighlightToken[]>;
} {
  const newFileLines = reconstructNewFile(file.hunks);
  const oldFileLines = reconstructOldFile(file.hunks);
  const newFileContent = buildFileContent(newFileLines);
  const oldFileContent = buildFileContent(oldFileLines);
  const newHighlighted = highlightCode(newFileContent, file.path);
  const oldHighlighted = highlightCode(oldFileContent, file.path);

  return {
    newTokensByLine: buildTokenLookup(newFileLines, newHighlighted),
    oldTokensByLine: buildTokenLookup(oldFileLines, oldHighlighted),
  };
}

/**
 * Apply syntax highlighting to diff hunks using reconstructed file content.
 * This is the fallback when actual file content is not available.
 */
export function highlightDiffFromHunks(file: ParsedDiffFile): ParsedDiffFile {
  if (!isLanguageSupported(file.path) || hasOversizedDiffLine(file)) {
    return file;
  }

  const reconstructedTokens = buildReconstructedTokenLookups(file);
  return applyTokensToHunks(
    file,
    reconstructedTokens.newTokensByLine,
    reconstructedTokens.oldTokensByLine,
  );
}

/**
 * Apply syntax highlighting to diff hunks using actual file content.
 * This provides better context for the parser.
 */
export function highlightDiffWithFileContent(
  file: ParsedDiffFile,
  options: HighlightDiffWithFileContentOptions = {},
): ParsedDiffFile {
  if (!isLanguageSupported(file.path) || hasOversizedDiffLine(file)) {
    return file;
  }

  let newTokensByLine: Map<number, HighlightToken[]> | null = null;
  const oldTokensByLine =
    typeof options.oldFileContent === "string"
      ? buildFullFileTokenLookup(options.oldFileContent, file.path)
      : null;
  if (typeof options.newFileContent === "string") {
    newTokensByLine = buildFullFileTokenLookup(options.newFileContent, file.path);

  }

  if (newTokensByLine && oldTokensByLine)
    return applyTokensToHunks(file, newTokensByLine, oldTokensByLine);
  const reconstructedTokens = buildReconstructedTokenLookups(file);
  return applyTokensToHunks(
    file,
    newTokensByLine ?? reconstructedTokens.newTokensByLine,
    oldTokensByLine ?? reconstructedTokens.oldTokensByLine,
  );
}

function applyTokensToHunks(
  file: ParsedDiffFile,
  newTokensByLine: Map<number, HighlightToken[]>,
  oldTokensByLine: Map<number, HighlightToken[]>,
): ParsedDiffFile {
  const highlightedHunks = file.hunks.map((hunk) => {
    let oldLineNum = hunk.oldStart;
    let newLineNum = hunk.newStart;

    const highlightedLines = hunk.lines.map((line): DiffLine => {
      if (line.type === "header") {
        return line;
      }

      let tokens: HighlightToken[] | undefined;

      if (line.type === "add") {
        tokens = newTokensByLine.get(newLineNum);
        newLineNum++;
      } else if (line.type === "remove") {
        tokens = oldTokensByLine.get(oldLineNum);
        oldLineNum++;
      } else if (line.type === "context") {
        // Context lines exist in both - use new file version
        tokens = newTokensByLine.get(newLineNum);
        oldLineNum++;
        newLineNum++;
      }

      return tokens ? { ...line, tokens } : line;
    });

    return { ...hunk, lines: highlightedLines };
  });

  return { ...file, hunks: highlightedHunks };
}

