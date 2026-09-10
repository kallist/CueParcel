/**
 * Context Lens materialization — turns retained page picks into a validated
 * fragment NormalizedDocument plus per-region metadata for receipts.
 *
 * Semantic identity (Final QA M-01): the fragment records the page's SEMANTIC
 * adapter, resolved through the same production registry priority a full-page
 * capture uses, and records the capture METHOD separately. Cropping a GitHub
 * Issue therefore still reports "GitHub Issue" as the adapter and
 * "Context Lens" as the method, instead of the method overwriting the
 * page's identity.
 *
 * GitHub fidelity: when every picked element lives inside an issue/PR body,
 * the GitHub region converter runs (task lists, checkboxes, clone-only
 * mutation); everything else converts with the generic semantic walker.
 */
import { Page2AgentError, Page2AgentErrorCode, countDocumentCharacters, DOCUMENT_ADAPTER_IDS, MAX_DOCUMENT_CHARACTERS } from "../../../core";
import type { ContentBlock, DocumentAdapterId, NormalizedDocument, PageContext } from "../../../core";
import { domToBlocks } from "../../../shared/dom/blocks";
import { githubRegionElementsToBlocks, isInsideGitHubBodyRegion } from "../../../adapters/github";
import { assessDocsKind } from "../../../adapters/techdocs";
import { buildSelectionDocument } from "../../../application/workbench";
import { createProductionRegistry } from "../content-capture";
import type { LensRegion } from "./semantic-region";
import { regionLabel } from "./semantic-region";

export interface LensRegionMeta {
  label: string;
  tokens: number;
  characters: number;
}

export interface LensMaterialization {
  document: NormalizedDocument;
  regions: LensRegionMeta[];
}

export interface MaterializationSession {
  captureId: string;
  url: string;
  capturedAt: string;
  title?: string;
  /**
   * The page document, used only to let the docs adapter classify the page the
   * fragment came from (its decision, never a default claim). Optional: when
   * absent the semantic identity honestly degrades to the generic adapter.
   */
  document?: Document;
}

export interface MaterializeLensInput {
  session: MaterializationSession;
  regions: readonly LensRegion[];
}

/**
 * Semantic adapter for the page a fragment came from.
 *
 * The registry resolves by ELIGIBILITY, and the docs adapter decides
 * docs-vs-generic during extract(), so eligibility alone is not the page's
 * identity. This reuses the adapter's own decision: when the resolved adapter
 * is the docs one, its classifier decides the identity — never a default
 * "Technical Documentation" claim.
 */
export function resolveSemanticAdapterId(session: MaterializationSession, tabId = 0): DocumentAdapterId {
  const context: PageContext = {
    captureId: session.captureId,
    tabId,
    url: session.url,
    title: session.title ?? "page",
    capturedAt: session.capturedAt,
  };
  const extractor = createProductionRegistry().resolve(context);
  if (extractor === null) {
    return "generic-article";
  }
  if (extractor.id === "technical-docs") {
    return assessDocsKind(docsKindSourceDocument(session), session.url).isDocs
      ? "technical-docs"
      : "generic-article";
  }
  return isDocumentAdapterId(extractor.id) ? extractor.id : "generic-article";
}

/**
 * Document the docs classifier scores. Lens runs in the content script with
 * the live page, but a caller may supply only a session, so a missing document
 * degrades to the honest generic identity.
 */
function docsKindSourceDocument(session: MaterializationSession): Document {
  return session.document ?? EMPTY_DOCUMENT;
}

const EMPTY_DOCUMENT = {
  querySelector: () => null,
  querySelectorAll: () => [],
} as unknown as Document;

function isDocumentAdapterId(value: string): value is DocumentAdapterId {
  return (DOCUMENT_ADAPTER_IDS as readonly string[]).includes(value);
}

/**
 * Build the combined fragment document for the retained picks. Returns null
 * when nothing is picked (the caller shows the empty hint instead).
 */
export function materializeLensRegions(input: MaterializeLensInput): LensMaterialization | null {
  const { session, regions } = input;
  if (regions.length === 0) {
    return null;
  }
  const allInsideGitHubBody = regions.every((region) =>
    region.elements.every((element) => isInsideGitHubBodyRegion(element)),
  );

  const blocks: ContentBlock[] = [];
  const regionMeta: LensRegionMeta[] = [];
  for (const region of regions) {
    const regionBlocks = allInsideGitHubBody
      ? githubRegionElementsToBlocks(region.elements, session.url)
      : genericElementsToBlocks(region.elements, session.url);
    blocks.push(...regionBlocks);
    const label = regionLabel(region);
    regionMeta.push({
      label,
      tokens: region.estimatedTokens,
      characters: (region.elements.reduce((sum, element) => sum + (element.textContent ?? "").length, 0)),
    });
  }

  const document = buildSelectionDocument({
    captureId: session.captureId,
    url: session.url,
    capturedAt: session.capturedAt,
    title: titleForPicks(regions),
    adapterId: resolveSemanticAdapterId(session),
    method: "context-lens",
    scope: "selection",
    blocks,
  });
  // buildSelectionDocument validates structure + size; double-check size
  // after concatenation (single-region caps do not sum up to the limit).
  if (countDocumentCharacters(document) > MAX_DOCUMENT_CHARACTERS) {
    throw new Page2AgentError(Page2AgentErrorCode.CONTENT_TOO_LARGE);
  }
  return { document, regions: regionMeta };
}

function titleForPicks(regions: readonly LensRegion[]): string {
  for (const region of regions) {
    const label = regionLabel(region);
    if (label.length > 0) {
      return label.slice(0, 160);
    }
  }
  return "Selected sections";
}

function genericElementsToBlocks(elements: readonly Element[], sourceUrl: string): ContentBlock[] {
  if (elements.length === 0) {
    return [];
  }
  const container = elements[0].ownerDocument.createElement("div");
  for (const element of elements) {
    container.appendChild(element.cloneNode(true));
  }
  return domToBlocks(container, sourceUrl);
}
