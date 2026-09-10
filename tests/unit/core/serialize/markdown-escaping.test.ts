import { describe, expect, it } from "vitest";
import {
  escapeMarkdownTableCell,
  escapeMarkdownText,
  escapeMarkdownTitle,
  escapeMarkdownUrl,
} from "../../../../src/core/serialize";

describe("escapeMarkdownText", () => {
  it("escapes backslashes, backticks and emphasis on word boundaries", () => {
    expect(escapeMarkdownText("a\\b")).toBe("a\\\\b");
    expect(escapeMarkdownText("*bold*")).toBe("\\*bold\\*");
    expect(escapeMarkdownText("_under_")).toBe("\\_under\\_");
    expect(escapeMarkdownText("`code`")).toBe("\\`code\\`");
  });

  it("escapes only the bracket that can open a link", () => {
    expect(escapeMarkdownText("[docs]")).toBe("\\[docs]");
  });

  it("never breaks Windows paths", () => {
    expect(escapeMarkdownText("C:\\Users\\Alice\\Page2Agent")).toBe(
      "C:\\\\Users\\\\Alice\\\\Page2Agent",
    );
  });

  it("preserves Unicode completely", () => {
    expect(escapeMarkdownText("中文内容 🐳 café naïve")).toBe("中文内容 🐳 café naïve");
  });

  it("does not over-escape ordinary text", () => {
    expect(escapeMarkdownText("Hello, world! Page2Agent v0.1")).toBe(
      "Hello, world! Page2Agent v0.1",
    );
  });

  it("protects block-level prefixes at line starts", () => {
    expect(escapeMarkdownText("# Heading")).toBe("\\# Heading");
    expect(escapeMarkdownText("## Sub")).toBe("\\## Sub");
    expect(escapeMarkdownText("> quoted")).toBe("\\> quoted");
    expect(escapeMarkdownText("- item")).toBe("\\- item");
    expect(escapeMarkdownText("+ item")).toBe("\\+ item");
    expect(escapeMarkdownText("* item")).toBe("\\* item");
    expect(escapeMarkdownText("1. first")).toBe("1\\. first");
  });

  it("leaves mid-line markers untouched", () => {
    expect(escapeMarkdownText("a - b # c")).toBe("a - b # c");
    expect(escapeMarkdownText("value [1] x")).toBe("value \\[1] x");
  });
});

// Final QA L-01 / L-02 / L-03: escaping must not damage ordinary prose or
// human-facing text.
describe("escapeMarkdownText — prose fidelity (Final QA L-01/L-02/L-03)", () => {
  it("never escapes parentheses in ordinary text", () => {
    // Was: "…cleanup\\)" — an unmatched escape that looked broken in output.
    const source = "least privilege (single shadow-root host; cleanup)";
    expect(escapeMarkdownText(source)).toBe(source);
    expect(escapeMarkdownText(source)).not.toContain("\\");
  });

  it("keeps identifier underscores readable inside a word", () => {
    // Was: "insert\\_content\\_list", "llm\\_model\\_max\\_async".
    const source = "insert_content_list and llm_model_max_async=16 and max_parallel_insert=12";
    expect(escapeMarkdownText(source)).toBe(source);
  });

  it("keeps intraword asterisks readable", () => {
    expect(escapeMarkdownText("glob *.md and a*b")).toBe("glob \\*.md and a*b");
  });

  it("still escapes real emphasis at word boundaries", () => {
    expect(escapeMarkdownText("this is _emphasised_ text")).toBe(
      "this is \\_emphasised\\_ text",
    );
    expect(escapeMarkdownText("this is *emphasised* text")).toBe(
      "this is \\*emphasised\\* text",
    );
  });

  it("does not escape human-facing titles into unreadable text", () => {
    // Was: "This \\[Bug\\]:Image-heavy pages …"
    expect(escapeMarkdownText("This [Bug]:Image-heavy pages take 100s+ to ingest")).toBe(
      "This \\[Bug]:Image-heavy pages take 100s+ to ingest",
    );
  });

  it("preserves a Markdown-unambiguous version string", () => {
    const source = "RAGAnything + lightrag-hku 1.4.16, gpt-4o-mini (vision)";
    expect(escapeMarkdownText(source)).toBe(source);
  });

  it("keeps multi-line text line-structured while escaping", () => {
    expect(escapeMarkdownText("a=1\nb=2\n- not a list")).toBe("a=1\nb=2\n\\- not a list");
  });
});

describe("escapeMarkdownUrl", () => {
  it("escapes parentheses but preserves the URL", () => {
    expect(escapeMarkdownUrl("https://example.com/a(b)?q=1#frag")).toBe(
      "https://example.com/a\\(b\\)?q=1#frag",
    );
    expect(escapeMarkdownUrl("https://example.com/plain")).toBe("https://example.com/plain");
  });
});

describe("escapeMarkdownTitle", () => {
  it("escapes quotes and backslashes", () => {
    expect(escapeMarkdownTitle('say "hi"')).toBe('say \\"hi\\"');
  });
});

describe("escapeMarkdownTableCell", () => {
  it("escapes pipes and converts newlines to <br>", () => {
    expect(escapeMarkdownTableCell("A | B")).toBe("A \\| B");
    expect(escapeMarkdownTableCell("line1\nline2")).toBe("line1<br>line2");
  });
});
