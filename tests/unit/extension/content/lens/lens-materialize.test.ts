// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { materializeLensRegions } from "../../../../../src/extension/content/lens/lens-materialize";
import { resolveRegionUnder } from "../../../../../src/extension/content/lens/semantic-region";
import { isNormalizedDocument } from "../../../../../src/core";

const GENERIC_URL = "https://example.com/article";
const ISSUE_URL = "https://github.com/acme/page2agent-demo/issues/42";

function makeDoc(bodyHtml: string, url: string): Document {
  return new JSDOM(`<!doctype html><html><body>${bodyHtml}</body></html>`, {
    url,
  }).window.document;
}

function sessionFor(url: string) {
  return { captureId: "capture-lens-1", url, capturedAt: "2026-09-01T00:00:00.000Z" };
}

describe("materializeLensRegions — semantic adapter resolution (M-01)", () => {
  it("keeps the GitHub Issue adapter for a pick inside an issue body", () => {
    const doc = makeDoc(
      `<main><div class="js-comment-body"><h2 id="a">Describe the bug</h2><p>It breaks.</p><p>More detail.</p></div></main>`,
      ISSUE_URL,
    );
    const region = resolveRegionUnder(doc.getElementById("a")!)!;
    const result = materializeLensRegions({
      session: { ...sessionFor(ISSUE_URL), document: doc },
      regions: [region],
    });
    expect(result!.document.capture?.adapter.id).toBe("github-issue");
    expect(result!.document.capture?.method).toBe("context-lens");
  });

  it("classifies a docs-shaped page as technical documentation, not generic", () => {
    // Real docs fixture the docs adapter is already known to classify.
    const docsUrl = "https://docs.example.com/api/streaming/reference";
    const html = readFileSync(resolve("fixtures", "docs", "api-reference.html"), "utf8");
    const doc = new JSDOM(html, { url: docsUrl }).window.document;
    const pickTarget =
      doc.querySelector("h2") ?? doc.querySelector("p") ?? doc.body.firstElementChild;
    if (pickTarget === null) {
      throw new Error("docs fixture has no pickable region");
    }
    const region = resolveRegionUnder(pickTarget as Element)!;
    const result = materializeLensRegions({
      session: {
        captureId: "capture-lens-1",
        url: docsUrl,
        capturedAt: "2026-09-01T00:00:00.000Z",
        document: doc,
      },
      regions: [region],
    });
    // The docs adapter decides for itself; a pick must never silently become a
    // Generic Article just because the classifier was not given the document.
    expect(result!.document.capture?.adapter.id).toBe("technical-docs");
    expect(result!.document.capture?.method).toBe("context-lens");
    expect(result!.document.capture?.scope).toBe("selection");
  });

  it("degrades to the generic adapter when no document is supplied", () => {
    const doc = makeDoc(`<main><h2 id="a">Section</h2><p>Text.</p></main>`, GENERIC_URL);
    const region = resolveRegionUnder(doc.getElementById("a")!)!;
    const result = materializeLensRegions({
      session: sessionFor(GENERIC_URL),
      regions: [region],
    });
    expect(result!.document.capture?.adapter.id).toBe("generic-article");
  });
});

describe("materializeLensRegions", () => {
  it("returns null when nothing is picked", () => {
    expect(materializeLensRegions({ session: sessionFor(GENERIC_URL), regions: [] })).toBeNull();
  });

  it("builds a validated selection document from generic picks", () => {
    const doc = makeDoc(
      `<main><h2 id="a">Authentication</h2><p>Use bearer tokens.</p><p>Refresh flow.</p>
       <h2 id="s">Streaming</h2><p>SSE chunks arrive here.</p></main>`,
      GENERIC_URL,
    );
    const sectionRegion = resolveRegionUnder(doc.getElementById("s")!)!;
    const result = materializeLensRegions({
      session: sessionFor(GENERIC_URL),
      regions: [sectionRegion],
    });
    expect(result).not.toBeNull();
    const { document: fragment, regions } = result!;
    expect(isNormalizedDocument(fragment)).toBe(true);
    expect(fragment.source.kind).toBe("web");
    expect(fragment.capture).toEqual({
      // M-01: the page's semantic adapter survives; the Lens is the method.
      adapter: { id: "generic-article", name: "Generic Article" },
      method: "context-lens",
      scope: "selection",
    });
    expect(fragment.blocks.length).toBeGreaterThan(1);
    expect(regions).toHaveLength(1);
    expect(regions[0].label).toBe("Streaming");
    expect(regions[0].tokens).toBeGreaterThan(0);
    expect(fragment.metadata.title).toBe("Streaming");
    const text = fragment.blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => (block.type === "paragraph" ? block.text : ""))
      .join(" ");
    expect(text).toContain("SSE chunks arrive here.");
    expect(text).not.toContain("bearer");
  });

  it("routes issue-body picks through the GitHub converter (task markers)", () => {
    const html = readFileSync(resolve("fixtures", "github", "issue-task-list.html"), "utf8");
    const doc = new JSDOM(html, { url: ISSUE_URL }).window.document;
    // Pick the paragraph inside the body, then a following list region.
    const bodyParagraph = doc.querySelector(".js-comment-body p")!;
    const paragraphRegion = resolveRegionUnder(bodyParagraph)!;
    const result = materializeLensRegions({
      session: sessionFor(ISSUE_URL),
      regions: [paragraphRegion],
    });
    const fragment = result!.document;
    expect(fragment.capture?.adapter.id).toBe("github-issue");
    expect(fragment.source.kind).toBe("github_issue");
  });

  it("labels every pick region and keeps order", () => {
    const doc = makeDoc(
      `<main><h2 id="x">Section X</h2><p>Alpha text here.</p><h2 id="y">Section Y</h2><p>Beta text.</p></main>`,
      GENERIC_URL,
    );
    const regionY = resolveRegionUnder(doc.getElementById("y")!)!;
    const regionX = resolveRegionUnder(doc.getElementById("x")!)!;
    const result = materializeLensRegions({
      session: sessionFor(GENERIC_URL),
      regions: [regionX, regionY],
    });
    expect(result?.regions.map((region) => region.label)).toEqual(["Section X", "Section Y"]);
    // document title is the first pick's label
    expect(result?.document.metadata.title).toBe("Section X");
  });
});
