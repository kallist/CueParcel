/**
 * Whitespace-significance detection for semantic DOM conversion.
 *
 * Ordinary page text collapses whitespace; the browser already renders it with
 * single spaces, and Markdown prose has no line structure. Some elements are
 * different: a paragraph whose author wrote explicit <br> breaks and leading
 * indentation to express a config block, an environment dump, or pre-like text.
 * Flattening those into one prose line destroys real information.
 *
 * This module decides, conservatively and deterministically, whether an
 * element's visible text is whitespace-significant. It intentionally returns
 * false for decorative single breaks and for ordinary sentences that merely
 * happen to contain a <br>, so no prose is turned into code by accident.
 *
 * Accepted signals: `key=value`, `key -> value`, and a majority of colon-keyed
 * `key: value` lines. Each is structural — nothing is matched against specific
 * pages, sites, or strings.
 */
import { getPreformattedText } from "./text";

/** A break must fragment the text into at least this many segments. */
const MIN_BREAKS = 3;

/** Explicitly aligned or assignment-like lines needed to accept a block. */
const MIN_STRUCTURED_LINES = 2;

/**
 * A segment longer than this is prose or a wrapped sentence, not a
 * whitespace-structured data line.
 */
const MAX_STRUCTURED_SEGMENT_LENGTH = 240;

const ASSIGNMENT_PATTERN = /^[\w.-]+\s*=\s*\S/;
const KEYED_ARROW_PATTERN = /^[\w.-]+[ \t]*->/;

/**
 * Colon-keyed `key: value` data line (a config block or environment dump).
 *
 * This shape needs its own rule because it carries none of the other signals:
 * "lightrag-hku: 1.4.16" has no `=`, no `->`, and — after HTML whitespace
 * collapsing — no leading indentation to detect. Real-world case: the
 * "LightRAG Config Used" block of github.com/HKUDS/RAG-Anything/issues/348 is
 * nine such lines joined by <br> in a single <p>, and flattening it into one
 * prose line destroys the source's structure (HQA-02).
 *
 * Deliberately stricter than the other patterns so prose is never captured:
 * a majority of the lines must be colon-keyed, at least MIN_KEY_VALUE_LINES of
 * them must exist, and both the key and the value are length-bounded. That
 * rejects ordinary sentences such as "Observed: … Expected: …", where the keys
 * are few and the values are long prose.
 */
const KEY_VALUE_PATTERN = /^[A-Za-z][A-Za-z0-9 ._/+()-]{0,39}: \S/;
const MIN_KEY_VALUE_LINES = 3;
const MIN_KEY_VALUE_RATIO = 0.6;
const MAX_KEY_VALUE_LENGTH = 200;

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

/** Count <br> elements in the subtree, ignoring skipped subtrees. */
export function countBreaks(element: Element): number {
  let count = 0;
  const visit = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) {
        continue;
      }
      const childElement = child as Element;
      if (SKIPPED_TAGS.has(childElement.tagName)) {
        continue;
      }
      if (childElement.tagName === "BR") {
        count += 1;
        continue;
      }
      visit(childElement);
    }
  };
  visit(element);
  return count;
}

/**
 * A line whose shape identifies it as machine-readable data rather than prose.
 *
 * Indentation is deliberately NOT a signal here: `normalizePreformattedText`
 * removes leading whitespace on every line (the browser collapses it anyway),
 * so an indentation test could never match the text this function receives.
 */
function isStructuredLine(line: string): boolean {
  return ASSIGNMENT_PATTERN.test(line) || KEYED_ARROW_PATTERN.test(line);
}

/** A single, self-contained `key: value` data line. */
function isKeyValueLine(line: string): boolean {
  return line.length <= MAX_KEY_VALUE_LENGTH && KEY_VALUE_PATTERN.test(line);
}

/**
 * True when the lines are dominated by colon-keyed data lines.
 *
 * A ratio rather than a fixed count: a config block may legitimately open with
 * an unkeyed header line ("Environment:") or interleave a sentence, but prose
 * that merely contains two colons can never reach the majority threshold.
 */
function isKeyValueBlock(lines: readonly string[]): boolean {
  const matches = lines.filter(isKeyValueLine).length;
  return matches >= MIN_KEY_VALUE_LINES && matches / lines.length >= MIN_KEY_VALUE_RATIO;
}

/**
 * True when a set of text lines carries whitespace-significant structure:
 * enough explicit breaks, every segment short enough to be a data line, and
 * either two or more assignment/arrow-keyed lines OR a colon-keyed data block.
 */
export function isPreformattedTextLines(lines: readonly string[]): boolean {
  const meaningful = lines.filter((line) => line.trim().length > 0);
  if (meaningful.length < MIN_BREAKS + 1) {
    return false;
  }
  if (meaningful.some((line) => line.length > MAX_STRUCTURED_SEGMENT_LENGTH)) {
    return false;
  }
  if (isKeyValueBlock(meaningful)) {
    return true;
  }
  const structured = meaningful.filter(isStructuredLine).length;
  return structured >= MIN_STRUCTURED_LINES;
}

/**
 * Decide whether an element's visible text must keep its line structure.
 * Text is collected with <br> as line breaks and leading indentation intact.
 */
export function isPreformattedElement(element: Element): boolean {
  if (countBreaks(element) < MIN_BREAKS) {
    return false;
  }
  return isPreformattedTextLines(getPreformattedText(element).split("\n"));
}
