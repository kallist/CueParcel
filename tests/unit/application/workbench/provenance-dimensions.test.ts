/**
 * Provenance dimensions (Final QA M-01).
 *
 * "What is this source?", "how was it captured?" and "how much was captured?"
 * are three independent facts. Before this fix the Context Lens wrote itself
 * into the semantic adapter slot, so a cropped GitHub Issue reported
 * `adapter: context-lens` and its page identity was lost downstream.
 */
import { describe, expect, it } from "vitest";
import { buildTaskSpec } from "../../../../src/application/workbench/task-spec-builder";
import {
  CAPTURE_METHOD_LABELS,
  serializeAgentContext,
  serializeSourcesMarkdown,
} from "../../../../src/application/workbench/delivery";
import { serializeTaskSpecJson } from "../../../../src/application/workbench/task-spec-json";
import { addContextSource, createEmptyCart } from "../../../../src/core/workbench/context-cart";
import {
  isTaskSpec,
  isTaskSpecSource,
  TASK_SPEC_CAPTURE_METHODS,
} from "../../../../src/core/workbench/task-spec";
import type { ContextCart } from "../../../../src/core/workbench/context-cart";
import type { ContextSourceItem } from "../../../../src/core/workbench/context-source";
import type { NormalizedDocument } from "../../../../src/core";
import { makeGitHubIssueDocument } from "../../../helpers/workbench-fixtures";

/** A Lens fragment of a GitHub Issue: semantic adapter + capture method. */
function lensFragmentOfIssue(): NormalizedDocument {
  const base = makeGitHubIssueDocument();
  return {
    ...base,
    metadata: { title: "Expected Behavior", capturedAt: "2026-02-01T00:00:00.000Z" },
    blocks: [{ type: "paragraph", text: "Ingestion should scale linearly." }],
    capture: {
      adapter: { id: "github-issue", name: "GitHub Issue" },
      method: "context-lens",
      scope: "selection",
    },
  };
}

function itemFrom(document: NormalizedDocument): ContextSourceItem {
  return {
    id: "item-1",
    captureId: "capture-1",
    url: document.source.url,
    capturedAt: document.metadata.capturedAt,
    title: document.metadata.title,
    sourceKind: document.source.kind,
    adapter: document.capture?.adapter,
    method: document.capture?.method,
    scope: document.capture?.scope ?? "full-page",
    selection:
      document.capture?.scope === "selection"
        ? { regions: 1, labels: [document.metadata.title] }
        : undefined,
    role: "task",
    primary: true,
    document,
  };
}

function build(document: NormalizedDocument, recipe: "fix" | "learn" = "fix") {
  const cart: ContextCart = addContextSource(createEmptyCart(), itemFrom(document)).cart;
  const built = buildTaskSpec(cart, recipe);
  if (built.status !== "ok") {
    throw new Error(`expected ok, got ${built.status}`);
  }
  return built.spec;
}

describe("M-01 — semantic adapter vs capture method vs scope", () => {
  it("keeps the page's semantic adapter when the content was cropped", () => {
    const spec = build(lensFragmentOfIssue());
    const source = spec.sources[0];
    expect(source.adapter).toEqual({ id: "github-issue", name: "GitHub Issue" });
    expect(source.type).toBe("github_issue");
    expect(source.captureMethod).toBe("context_lens");
    expect(source.scope).toBe("selected_sections");
  });

  it("never reports a capture method as the adapter", () => {
    const source = build(lensFragmentOfIssue()).sources[0];
    expect(source.adapter?.id).not.toBe("context-lens");
    expect(JSON.stringify(source)).not.toContain("context-lens");
  });

  it("records a full-page capture as full_page", () => {
    const source = build(makeGitHubIssueDocument()).sources[0];
    expect(source.adapter?.id).toBe("github-issue");
    expect(source.captureMethod).toBe("full_page");
    expect(source.scope).toBe("full_page");
  });

  it("keeps the three dimensions separate in agent output", () => {
    const agent = serializeAgentContext(build(lensFragmentOfIssue()));
    expect(agent).toContain("Type: GitHub Issue");
    expect(agent).toContain("Adapter: GitHub Issue");
    expect(agent).toContain("Capture: Context Lens");
    expect(agent).toContain("Scope: Selected sections");
  });

  it("keeps them separate in the source Markdown partition too", () => {
    const markdown = serializeSourcesMarkdown(build(lensFragmentOfIssue()));
    expect(markdown).toContain("Capture: Context Lens");
    expect(markdown).toContain("Scope: Selected sections");
    expect(markdown).not.toContain("Task Instructions");
  });

  it("carries captureMethod in the JSON contract", () => {
    const json = JSON.parse(serializeTaskSpecJson(build(lensFragmentOfIssue())));
    expect(json.sources[0].captureMethod).toBe("context_lens");
    expect(json.sources[0].adapter.id).toBe("github-issue");
    expect(json.sources[0].scope).toBe("selected_sections");
  });

  it("keeps existing sourceFacts alongside the method", () => {
    const source = build(lensFragmentOfIssue()).sources[0];
    expect(source.sourceFacts?.issueNumber).toBe(12);
    expect(source.captureMethod).toBe("context_lens");
  });

  it("validates the capture method vocabulary strictly", () => {
    expect([...TASK_SPEC_CAPTURE_METHODS]).toEqual([
      "full_page",
      "context_lens",
      "text_selection",
    ]);
    const good = build(lensFragmentOfIssue()).sources[0];
    expect(isTaskSpecSource(good)).toBe(true);
    expect(isTaskSpecSource({ ...good, captureMethod: "lens" })).toBe(false);
    expect(isTaskSpecSource({ ...good, captureMethod: "context-lens" })).toBe(false);
    expect(isTaskSpec(build(lensFragmentOfIssue()))).toBe(true);
  });

  it("renders every capture method label", () => {
    expect(CAPTURE_METHOD_LABELS).toEqual({
      full_page: "Full page",
      context_lens: "Context Lens",
      text_selection: "Text selection",
    });
  });

  it("omits captureMethod and adapter for legacy items without provenance", () => {
    const document = makeGitHubIssueDocument();
    const legacyDocument: NormalizedDocument = { ...document };
    delete (legacyDocument as { capture?: unknown }).capture;
    const legacy = itemFrom(document) as {
      method?: unknown;
      adapter?: unknown;
      document: NormalizedDocument;
    };
    delete legacy.method;
    delete legacy.adapter;
    legacy.document = legacyDocument;
    const cart: ContextCart = addContextSource(createEmptyCart(), legacy as ContextSourceItem).cart;
    const built = buildTaskSpec(cart, "learn");
    if (built.status !== "ok") throw new Error("expected ok");
    // Nothing is guessed from the source kind or the URL.
    expect(built.spec.sources[0]).not.toHaveProperty("captureMethod");
    expect(built.spec.sources[0]).not.toHaveProperty("adapter");
    expect(built.spec.sources[0].type).toBe("github_issue");
  });
});
