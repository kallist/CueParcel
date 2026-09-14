/**
 * Shared site-neutral DOM text utilities.
 * Used by both the generic article adapter and the GitHub issue adapter.
 * No Readability dependency, no site-specific policy.
 */

const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "FORM",
  "INPUT",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
  "SVG",
  "MATH",
  "HEAD",
]);

/**
 * Block-level tags act as word boundaries inside text collection (e.g. a
 * nested <ul> inside an <li>, or table cells) so concatenated text keeps
 * spaces between segments.
 */
const TEXT_BOUNDARY_TAGS = new Set([
  "P",
  "DIV",
  "UL",
  "OL",
  "LI",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TD",
  "TH",
  "PRE",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "SECTION",
  "ARTICLE",
  "FIGURE",
  "FIGCAPTION",
  "HEADER",
  "FOOTER",
  "ASIDE",
  "MAIN",
  "NAV",
  "HR",
  "FORM",
]);

/** Normalize whitespace for ordinary text (NBSP → space, collapse runs). */
export function normalizeInlineText(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Visible text of a node with <br> boundaries turned into real line breaks.
 *
 * Ordinary text normalization intentionally collapses whitespace, but
 * whitespace-significant content (config blocks, environment dumps,
 * pre-like text) expresses meaningful line structure through <br> and
 * leading indentation. Callers that have decided a node is preformatted use
 * this function instead of getNormalizedText() so the structure survives.
 *
 * Leading indentation is preserved (it is the alignment the author wrote);
 * blank lines collapse and trailing whitespace per line is removed so the
 * result is stable and safe to serialize.
 */
export function getPreformattedText(node: Node): string {
  return normalizePreformattedText(collectTextWithBreaks(node));
}

/** Normalize already-broken text (shared by text and serialization paths). */
export function normalizePreformattedText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    // Leading and trailing whitespace on a line is collapsed by HTML rendering
    // anyway, so it is not author intent. Everything inside a line is preserved
    // verbatim: in whitespace-significant content the column alignment IS the
    // information (e.g. "llm_model_func      -> gpt-4o-mini").
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/^[ \t]+/, ""))
    .filter((line) => line.length > 0)
    .join("\n");
}

function collectTextWithBreaks(node: Node): string {
  const parts: string[] = [];
  collectText(node, parts, { breaksAreNewlines: true });
  return parts.join("");
}

/** Visible semantic text of a node; <br> counts as whitespace, skipped tags excluded. */
export function getNormalizedText(node: Node): string {
  const parts: string[] = [];
  collectText(node, parts);
  return normalizeInlineText(parts.join(""));
}

interface CollectOptions {
  /** When true a <br> contributes a line break instead of a word boundary. */
  breaksAreNewlines?: boolean;
}

function collectText(node: Node, parts: string[], options: CollectOptions = {}): void {
  if (node.nodeType === Node.TEXT_NODE) {
    parts.push(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const element = node as Element;
  if (SKIPPED_TAGS.has(element.tagName)) {
    return;
  }
  const preformatted = options.breaksAreNewlines === true;
  if (element.tagName === "BR") {
    parts.push(preformatted ? "\n" : " ");
    return;
  }
  // Block boundaries become word boundaries in inline mode. In preformatted
  // mode they must not: the padding would indent every collected line, and the
  // line structure comes from <br> alone.
  const isBoundary = !preformatted && TEXT_BOUNDARY_TAGS.has(element.tagName);
  if (isBoundary) {
    parts.push(" ");
  }
  for (const child of node.childNodes) {
    collectText(child, parts, options);
  }
  if (isBoundary) {
    parts.push(" ");
  }
}
