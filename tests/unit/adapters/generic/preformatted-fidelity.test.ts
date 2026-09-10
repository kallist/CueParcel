// @vitest-environment jsdom
/**
 * Whitespace-significance regression tests (Final QA M-03).
 *
 * Real-world case: github.com/HKUDS/RAG-Anything/issues/348 carries an LLM
 * config block as a single <p> with 10 <br> breaks and column-aligned
 * indentation, inside an <ol><li>. Collapsing it to one prose line destroyed
 * the structure. These tests pin both the preservation AND the conservative
 * boundary, so ordinary prose is never turned into a code block.
 */
import { describe, expect, it } from "vitest";
import { domToBlocks } from "../../../../src/shared/dom/blocks";
import {
  countBreaks,
  isPreformattedElement,
  isPreformattedTextLines,
} from "../../../../src/shared/dom/preformatted";
import { getPreformattedText } from "../../../../src/shared/dom/text";
import { serializeContentBlocks } from "../../../../src/core/serialize";
import type { ContentBlock } from "../../../../src/core";
import { FIXTURE_BASE_URL, loadHtml } from "../../../helpers/load-html-fixture";

function blocksFrom(bodyHtml: string): ContentBlock[] {
  return domToBlocks(
    loadHtml(`<!doctype html><html><body>${bodyHtml}</body></html>`).body,
    FIXTURE_BASE_URL,
  );
}

function elementFrom(bodyHtml: string): Element {
  const element = loadHtml(
    `<!doctype html><html><body>${bodyHtml}</body></html>`,
  ).body.firstElementChild;
  if (element === null) {
    throw new Error("fixture has no element");
  }
  return element;
}

/**
 * The literal markup of the real config block (line breaks and the explicit
 * alignment spacing are the source's own content).
 */
const REAL_CONFIG_MARKUP = `<div><ol>
<li><p>Configure RAGAnything with:<br>
enable_image_processing=True<br>
parser=mineru, parse_method=auto<br>
and LightRAG with:<br>
llm_model_func      -&gt; gpt-4o-mini<br>
vision_model_func   -&gt; gpt-4o-mini, detail="low"<br>
embedding_func      -&gt; text-embedding-3-small<br>
entity_extract_max_gleaning=0<br>
llm_model_max_async=16<br>
max_parallel_insert=12<br>
chunk_token_size=1200</p></li>
<li><p>Build a content_list for a typical product page.</p></li>
</ol></div>`;

describe("preformatted detection — conservative boundaries", () => {
  it("does not treat a decorative single break as preformatted", () => {
    expect(isPreformattedElement(elementFrom("<p>Hello<br>world</p>"))).toBe(false);
    expect(blocksFrom("<p>Hello<br>world</p>")).toEqual([
      { type: "paragraph", text: "Hello world" },
    ]);
  });

  it("does not treat a prose paragraph with meaningful breaks as preformatted", () => {
    const html = `<p>Observed: ~330 calls / ~124s with images, ~11 calls / ~5s without.<br>
Expected: image count should add roughly one vision call each, not multiply total count.</p>`;
    expect(isPreformattedElement(elementFrom(html))).toBe(false);
    expect(blocksFrom(html)).toEqual([
      {
        type: "paragraph",
        text: "Observed: ~330 calls / ~124s with images, ~11 calls / ~5s without. Expected: image count should add roughly one vision call each, not multiply total count.",
      },
    ]);
  });

  it("rejects long wrapped sentences even when they contain breaks", () => {
    const sentence = "This is an ordinary wrapped sentence with no data structure at all, ".repeat(4).trim();
    expect(
      isPreformattedTextLines([sentence, sentence, sentence, sentence]),
    ).toBe(false);
  });

  it("rejects short break runs without structured lines", () => {
    expect(isPreformattedTextLines(["alpha", "beta", "gamma"])).toBe(false);
  });

  it("requires at least two structured lines", () => {
    expect(isPreformattedTextLines(["a=1", "beta", "gamma", "delta"])).toBe(false);
    expect(isPreformattedTextLines(["a=1", "b=2", "gamma", "delta"])).toBe(true);
  });

  it("accepts indentation-based alignment as structure", () => {
    expect(
      isPreformattedTextLines([
        "first line",
        "  aligned_one",
        "  aligned_two",
        "last line",
      ]),
    ).toBe(true);
  });

  it("counts breaks in the subtree but ignores skipped subtrees", () => {
    expect(countBreaks(elementFrom("<p>a<br>b<br>c<br>d</p>"))).toBe(3);
    expect(countBreaks(elementFrom("<p>a<script>x<br>y</script></p>"))).toBe(0);
  });
});

describe("preformatted extraction — line structure", () => {
  it("keeps breaks as real lines and preserves internal alignment", () => {
    const element = elementFrom(
      `<p>top<br>llm_model_func      -&gt; gpt-4o-mini<br>other=1<br>third=2</p>`,
    );
    const text = getPreformattedText(element);
    expect(text.split("\n")).toEqual([
      "top",
      "llm_model_func      -> gpt-4o-mini",
      "other=1",
      "third=2",
    ]);
  });

  it("collapses leading and internal whitespace runs exactly as HTML renders them", () => {
    // Leading whitespace on a line is collapsed by HTML rendering, so it is not
    // author intent; internal spacing (column alignment) survives.
    const element = elementFrom(`<p>   a=1<br>     b=2<br>   c=3<br>   d=4</p>`);
    expect(getPreformattedText(element).split("\n")).toEqual(["a=1", "b=2", "c=3", "d=4"]);
  });

  it("preserves multi-space alignment inside a line", () => {
    const element = elementFrom(
      `<p>head<br>alpha      = 1<br>beta       = 2<br>gamma      = 3</p>`,
    );
    expect(getPreformattedText(element).split("\n")[1]).toBe("alpha      = 1");
  });

  it("collapses blank lines and trailing whitespace", () => {
    const element = elementFrom(`<p>a=1<br><br>b=2   <br>c=3<br>d=4</p>`);
    expect(getPreformattedText(element)).toBe("a=1\nb=2\nc=3\nd=4");
  });
});

describe("M-03 — config block inside a numbered step keeps its structure", () => {
  it("preserves every config line as its own list continuation line", () => {
    const blocks = blocksFrom(REAL_CONFIG_MARKUP);
    const markdown = serializeContentBlocks(blocks);

    // Every original line after the first survives as its own rendered
    // continuation line (the first line legitimately carries the "1. " marker).
    const renderedLines = markdown.split("\n").map((line) => line.replace(/^ {3}/, ""));
    for (const line of [
      "enable_image_processing=True",
      "parser=mineru, parse_method=auto",
      "and LightRAG with:",
      "llm_model_func      -> gpt-4o-mini",
      'vision_model_func   -> gpt-4o-mini, detail="low"',
      "embedding_func      -> text-embedding-3-small",
      "entity_extract_max_gleaning=0",
      "llm_model_max_async=16",
      "max_parallel_insert=12",
      "chunk_token_size=1200",
    ]) {
      expect(renderedLines).toContain(line);
    }

    // The line that used to be swallowed must appear on its own rendered line.
    expect(markdown).toMatch(/^ {3}chunk_token_size=1200$/m);
    expect(markdown).toMatch(/^ {3}enable_image_processing=True$/m);
    expect(markdown).toMatch(/^1\. Configure RAGAnything with:$/m);

    // List numbering is never reset: both steps stay in ONE ordered list.
    const lists = blocks.filter((block) => block.type === "list");
    expect(lists).toHaveLength(1);
    expect(markdown).toMatch(/^1\. Configure RAGAnything with:$/m);
    expect(markdown).toMatch(/^2\. Build a content_list for a typical product page\.$/m);
  });

  it("keeps the second step as a plain single-line item", () => {
    const blocks = blocksFrom(REAL_CONFIG_MARKUP);
    const list = blocks.find((block) => block.type === "list");
    expect(list && list.type === "list" ? list.items[1] : null).toBe(
      "Build a content_list for a typical product page.",
    );
  });
});

describe("M-03 — preformatted paragraph becomes a code block", () => {
  it("emits a fenced code block so the breaks stay visible", () => {
    const blocks = blocksFrom(
      `<div><p>Environment:<br>python=3.11<br>os=windows<br>ram=32gb</p></div>`,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("code");
    const markdown = serializeContentBlocks(blocks);
    expect(markdown).toContain("```\nEnvironment:\npython=3.11\nos=windows\nram=32gb\n```");
  });

  it("stays a paragraph when only ordinary prose wraps across breaks", () => {
    const blocks = blocksFrom(
      `<div><p>One ordinary sentence.<br>Another ordinary sentence.<br>And a third one here.</p></div>`,
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        text: "One ordinary sentence. Another ordinary sentence. And a third one here.",
      },
    ]);
  });
});
