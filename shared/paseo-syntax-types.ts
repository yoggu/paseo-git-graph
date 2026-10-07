/** Copyright (c) 2025-present Mohamed Boudra. Apache-2.0; see licenses/PASEO-LICENSE.
 * Adapted from Paseo highlight palettes; local imports only.
 */
export type HighlightStyle =
  | "keyword"
  | "comment"
  | "string"
  | "number"
  | "literal"
  | "function"
  | "definition"
  | "class"
  | "type"
  | "tag"
  | "attribute"
  | "property"
  | "variable"
  | "operator"
  | "punctuation"
  | "regexp"
  | "escape"
  | "meta"
  | "heading"
  | "link";

export interface HighlightToken {
  text: string;
  style: HighlightStyle | null;
}
