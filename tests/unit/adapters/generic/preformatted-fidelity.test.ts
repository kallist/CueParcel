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

  it("accepts assignment-keyed lines as structure", () => {
    // Indentation is not a signal: line text is trimmed before classification,
    // because HTML collapses leading whitespace anyway.
    expect(
      isPreformattedTextLines([
        "first line",
        "aligned_one=1",
        "aligned_two=2",
        "last line",
      ]),
    ).toBe(true);
  });

  it("rejects unindented prose lines with no keyed shape", () => {
    expect(
      isPreformattedTextLines([
        "first line of prose",
        "second line of prose",
        "third line of prose",
        "fourth line of prose",
      ]),
    ).toBe(false);
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

/**
 * HQA-02 — colon-keyed environment/config blocks.
 *
 * The literal markup of the "LightRAG Config Used" region of
 * github.com/HKUDS/RAG-Anything/issues/348: NINE `key: value` lines joined by
 * <br> in a single <p>, with no indentation and no `=`/`->` anywhere. The
 * detector had no signal for that shape, so the region was flattened into one
 * run-on prose line and the source's structure was destroyed.
 */
const COLON_KEYED_CONFIG_MARKUP = `<div>
<h3>LightRAG Config Used</h3>
<h1>Paste your config here</h1>
<p>lightrag-hku: 1.4.16<br>
python: 3.12<br>
OS: Debian (Docker, linux/amd64)<br>
LLM: gpt-4o-mini (extraction and vision)<br>
embeddings: text-embedding-3-small<br>
parser: mineru, parse_method=auto<br>
vision detail: low<br>
storage: Neo4j (graph)<br>
network: client hosted in Pakistan — see note below</p>
</div>`;

const COLON_KEYED_CONFIG_LINES = [
  "lightrag-hku: 1.4.16",
  "python: 3.12",
  "OS: Debian (Docker, linux/amd64)",
  "LLM: gpt-4o-mini (extraction and vision)",
  "embeddings: text-embedding-3-small",
  "parser: mineru, parse_method=auto",
  "vision detail: low",
  "storage: Neo4j (graph)",
  "network: client hosted in Pakistan — see note below",
];

describe("HQA-02 — colon-keyed config blocks keep their line structure", () => {
  it("detects a colon-keyed environment block as whitespace-significant", () => {
    const element = elementFrom(
      `<p>${COLON_KEYED_CONFIG_LINES.join("<br>")}</p>`,
    );
    expect(isPreformattedElement(element)).toBe(true);
    expect(isPreformattedTextLines(COLON_KEYED_CONFIG_LINES)).toBe(true);
  });

  it("keeps every config line on its own line in the emitted Markdown", () => {
    const blocks = blocksFrom(COLON_KEYED_CONFIG_MARKUP);
    const config = blocks.find((block) => block.type === "code");
    expect(config).toBeDefined();
    expect(config && config.type === "code" ? config.code.split("\n") : []).toEqual(
      COLON_KEYED_CONFIG_LINES,
    );

    const markdown = serializeContentBlocks(blocks);
    for (const line of COLON_KEYED_CONFIG_LINES) {
      expect(markdown.split("\n")).toContain(line);
    }
    // No run-on line may survive anywhere in the output.
    expect(markdown).not.toContain("1.4.16 python: 3.12");
  });

  it("preserves the heading around the block instead of absorbing it", () => {
    const blocks = blocksFrom(COLON_KEYED_CONFIG_MARKUP);
    expect(blocks[0]).toEqual({ type: "heading", level: 3, text: "LightRAG Config Used" });
  });

  // --- Boundary controls: prose must never be turned into code -------------
  it("still collapses a cosmetic <br> in ordinary prose", () => {
    expect(blocksFrom("<p>Hello<br>world</p>")).toEqual([
      { type: "paragraph", text: "Hello world" },
    ]);
  });

  it("still collapses an Observed:/Expected: prose pair", () => {
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

  it("rejects a prose paragraph that merely contains a couple of colons", () => {
    expect(
      isPreformattedTextLines([
        "Note: this paragraph is ordinary prose written by a person.",
        "It happens to contain a colon, and another one here.",
        "That is not structure, so it must stay a paragraph.",
        "Otherwise every README would become a code block.",
      ]),
    ).toBe(false);
  });

  it("rejects too few key/value lines to be a block", () => {
    expect(isPreformattedTextLines(["alpha: 1", "beta: 2", "gamma", "delta"])).toBe(false);
  });

  it("rejects key/value lines whose values are long prose", () => {
    const longValue = `value: ${"word ".repeat(50).trim()}`;
    expect(isPreformattedTextLines([longValue, longValue, longValue, longValue])).toBe(false);
  });
});

describe("HQA-02 — a colon-keyed block inside a numbered list", () => {
  const IN_LIST = `<div><ol>
<li><p>Configure the parser:<br>parser: mineru<br>mode: auto<br>lang: en<br>detail: low</p></li>
<li><p>Then run the ingest step.</p></li>
</ol></div>`;

  it("keeps the block's lines and never resets the numbering", () => {
    const blocks = blocksFrom(IN_LIST);
    const lists = blocks.filter((block) => block.type === "list");
    expect(lists).toHaveLength(1);

    const markdown = serializeContentBlocks(blocks);
    for (const line of ["parser: mineru", "mode: auto", "lang: en", "detail: low"]) {
      expect(markdown).toContain(line);
    }
    // One ordered list: step 1 keeps its continuation lines, step 2 stays "2.".
    expect(markdown).toMatch(/^1\. Configure the parser:$/m);
    expect(markdown).toMatch(/^2\. Then run the ingest step\.$/m);
  });
});

describe("HQA-02 — a colon-keyed block outside a list", () => {
  it("emits a code block directly after the heading", () => {
    const blocks = blocksFrom(
      `<div><h2>Environment</h2><p>node: 24.0.0<br>os: windows<br>ram: 32gb<br>disk: ssd</p></div>`,
    );
    expect(blocks[0]).toEqual({ type: "heading", level: 2, text: "Environment" });
    expect(blocks[1]).toEqual({
      type: "code",
      code: "node: 24.0.0\nos: windows\nram: 32gb\ndisk: ssd",
    });
  });
});
