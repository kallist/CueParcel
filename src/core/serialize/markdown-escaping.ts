/**
 * Markdown escaping for serialized domain text. Pure and deterministic.
 *
 * Goal: the rendered Markdown preserves the source's visible text without
 * over-escaping ordinary characters. Markdown escaping is a rendering
 * fidelity concern, NOT a prompt-injection defense (see ADR-001).
 *
 * Design rules (Final QA L-01 / L-02 / L-03):
 * - Only characters that can actually change rendering are escaped, and only
 *   in positions where they can. CommonMark does not treat an underscore or
 *   asterisk inside a word as emphasis, so `insert_content_list` and
 *   `llm_model*` stay readable instead of becoming `insert\_content\_list`.
 * - Parentheses carry no special meaning in ordinary text, so they are never
 *   escaped here (link and image destinations have their own escaper). The
 *   previous asymmetry — escaping ")" but never "(" — produced broken-looking
 *   prose such as `least privilege\)`.
 * - Human-facing text (titles, headings) must not gain escapes that show up in
 *   copied output, so a bracket is escaped only when leaving it bare could
 *   actually be parsed as a link or image label (HQA-01 / HQA-05). Square
 *   brackets are ordinary punctuation otherwise: `This [Bug]:` and
 *   `[Community] notes` stay readable, while `[label][ref]` and
 *   `[label](/dest)` are neutralized.
 */

/** Explicit escapes: always safe to escape, no readability cost. */
const ALWAYS_ESCAPED = /([\\`])/g;

/**
 * Emphasis characters that are NOT intraword. CommonMark cannot open or close
 * emphasis inside a word, so `snake_case`, `a*b`, `max_parallel_insert=12` and
 * `llm_model_func` stay readable. Anything else (line start, after a space,
 * before punctuation, end of line) can start or end real emphasis and is
 * escaped.
 */
const EMPHASIS_NOT_INTRAWORD = /(^|[^0-9A-Za-z])([*_])|([*_])(?![0-9A-Za-z])/g;

/**
 * A bracket run that would be parsed as a link or image label: `[text]`
 * immediately followed by a destination `(...)` or a reference `[ref]`.
 * Only that `[` is escaped; `[Bug]` with nothing after it cannot start a link.
 */
const LINK_LABEL_OPENER = /\[(?=[^\]]*\](?:\(|\[))/g;

/** Escape inline special characters in ordinary semantic text. */
export function escapeMarkdownText(text: string): string {
  return text.split("\n").map(escapeMarkdownLine).join("\n");
}

function escapeMarkdownLine(line: string): string {
  // Block-level prefixes are escaped LAST: the structural backslash must not be
  // doubled by the general backslash pass, and the prefix backslashes are
  // inserted directly so they stay single.
  const result = line
    .replace(ALWAYS_ESCAPED, "\\$1")
    .replace(EMPHASIS_NOT_INTRAWORD, (_match, boundary, atStart, atEnd) =>
      atStart !== undefined
        ? `${boundary}\\${atStart}`
        : `${boundary === undefined ? "" : boundary}\\${atEnd}`,
    )
    .replace(LINK_LABEL_OPENER, "\\[");
  let prefixed = result.replace(/^(\s*)(#{1,6})(\s)/, "$1\\$2$3");
  prefixed = prefixed.replace(/^(\s*)(>)(\s)/, "$1\\$2$3");
  prefixed = prefixed.replace(/^(\s*)([-+])(\s)/, "$1\\$2$3");
  prefixed = prefixed.replace(/^(\s*)(\d+)(\.)(\s)/, "$1$2\\.$4");
  return prefixed;
}

/**
 * Escape a Markdown link/image destination. URLs in the domain are already
 * normalized and safe; here we only handle Markdown syntax characters so
 * query strings and fragments are never altered. Destinations are delimited by
 * parentheses, so BOTH sides must be escaped — unlike ordinary text above.
 */
export function escapeMarkdownUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Escape a Markdown link/image title attribute. */
export function escapeMarkdownTitle(title: string): string {
  return title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Escape a table cell (pipes, newlines via <br>, plus inline specials). */
export function escapeMarkdownTableCell(text: string): string {
  return escapeMarkdownText(text).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
