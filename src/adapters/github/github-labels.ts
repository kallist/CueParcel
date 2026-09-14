/**
 * Shared GitHub label extraction (issues and pull requests use the same
 * sidebar Labels UI). Selector policy stays in the per-page selector modules;
 * this module only normalizes the container content.
 */
import { normalizeInlineText } from "../../shared/dom/text";
import { firstMatch } from "./github-issue-selectors";

/**
 * GitHub renders this literal placeholder inside the labels container when a
 * source has no labels. It is chrome, not a label: treating it as one made the
 * Context Receipt claim "Labels" for a source that has none (Final QA M-04).
 */
const NO_LABELS_PLACEHOLDER = "None yet";

export function extractLabelsFromContainer(
  root: ParentNode,
  containerSelectors: readonly string[],
): string[] {
  const container = firstMatch(root, containerSelectors);
  if (container === null) {
    return [];
  }
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const element of container.querySelectorAll("a")) {
    if (element.getAttribute("aria-hidden") === "true") {
      continue;
    }
    const visibleText = element.querySelector('[data-component="Text"]')?.textContent;
    const text = normalizeInlineText(visibleText ?? element.textContent ?? "");
    if (text.length === 0 || text === NO_LABELS_PLACEHOLDER || seen.has(text)) {
      continue;
    }
    seen.add(text);
    labels.push(text);
  }
  return labels;
}
