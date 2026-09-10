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
 * All rules are structural — nothing is matched against specific pages, sites,
 * or strings.
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

const LEADING_INDENT_PATTERN = /^[ \t]{2,}/;
const ASSIGNMENT_PATTERN = /^[\w.-]+\s*=\s*\S/;
const KEYED_ARROW_PATTERN = /^[\w.-]+[ \t]*->/;

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

function isStructuredLine(line: string): boolean {
  return (
    LEADING_INDENT_PATTERN.test(line) ||
    ASSIGNMENT_PATTERN.test(line) ||
    KEYED_ARROW_PATTERN.test(line)
  );
}

/**
 * True when a set of text lines carries whitespace-significant structure:
 * enough explicit breaks, every segment short enough to be a data line, and at
 * least two lines that are indented or assignment/arrow keyed.
 */
export function isPreformattedTextLines(lines: readonly string[]): boolean {
  const meaningful = lines.filter((line) => line.trim().length > 0);
  if (meaningful.length < MIN_BREAKS + 1) {
    return false;
  }
  if (meaningful.some((line) => line.length > MAX_STRUCTURED_SEGMENT_LENGTH)) {
    return false;
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
