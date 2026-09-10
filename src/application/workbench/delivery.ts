/**
 * Workbench delivery serializers (V1.1) — deterministic multi-source text.
 *
 * Agent output (Copy for Agent) partitions generated task facts/instructions
 * from SOURCE content; Markdown output carries only the source partition.
 * Both derive from one validated TaskSpec — Markdown is a delivery format,
 * never a source of truth. Everything is byte-deterministic for a given spec.
 */
import { escapeMarkdownText } from "../../core/serialize";
import type { TaskSpec, TaskSpecSource } from "../../core";
import { sanitizeBaseName } from "../delivery/filename";

export const SOURCE_TYPE_LABELS: Record<TaskSpecSource["type"], string> = {
  web: "Web Page",
  github_issue: "GitHub Issue",
  github_pull_request: "GitHub Pull Request",
};

export const ROLE_LABELS: Record<TaskSpecSource["role"], string> = {
  task: "Task",
  reference: "Reference",
  evidence: "Evidence",
  example: "Example",
  selection: "Selection",
};

export const SCOPE_LABELS: Record<TaskSpecSource["scope"], string> = {
  full_page: "Full page",
  selected_sections: "Selected sections",
  text_selection: "Text selection",
};

/** Capture-method labels (orthogonal to the semantic adapter — M-01). */
export const CAPTURE_METHOD_LABELS: Record<
  NonNullable<TaskSpecSource["captureMethod"]>,
  string
> = {
  full_page: "Full page",
  context_lens: "Context Lens",
  text_selection: "Text selection",
};

export function serializeAgentContext(spec: TaskSpec): string {
  const sections: string[] = [];

  sections.push("# Page2Agent Task");
  sections.push(serializeTaskBlock(spec));

  sections.push("## Task Instructions");
  sections.push(serializeInstructions(spec));

  sections.push(`## Sources`);
  sections.push(
    spec.sources.map((source, index) => serializeSourceBlock(source, index)).join("\n\n"),
  );

  return sections.join("\n\n") + "\n";
}

/** Source-only partition (used for the Markdown preview and downloads). */
export function serializeSourcesMarkdown(spec: TaskSpec): string {
  return spec.sources.map((source, index) => serializeSourceBlock(source, index)).join("\n\n") + "\n";
}

function serializeTaskBlock(spec: TaskSpec): string {
  const lines: string[] = [];
  lines.push(`Recipe: ${titleCase(spec.recipe)}`);
  lines.push(`Task kind: ${spec.task.kind}`);
  lines.push(`Title: ${escapeMarkdownText(spec.task.title)}`);
  if (spec.target.repository !== null) {
    lines.push(`Target repository: ${spec.target.repository}`);
  }
  lines.push(
    `Sources: ${spec.sources.length} · ~${spec.estimates.totalEstimatedTokens.toLocaleString("en-US")} estimated tokens`,
  );
  if (spec.unknowns.length > 0) {
    lines.push("");
    lines.push("Unknowns:");
    for (const unknown of spec.unknowns) {
      lines.push(`- ${escapeMarkdownText(unknown)}`);
    }
  }
  return lines.join("\n");
}

function serializeInstructions(spec: TaskSpec): string {
  const bullets = spec.generated.instructions.map((instruction) => `- ${instruction}`);
  return bullets.join("\n");
}

function serializeSourceBlock(source: TaskSpecSource, index: number): string {
  const heading = `### Source ${index + 1} — ${escapeMarkdownText(source.title)}`;

  const meta: string[] = [];
  meta.push(`Role: ${ROLE_LABELS[source.role]}${source.isPrimary ? " · Primary" : ""}`);
  meta.push(`Type: ${SOURCE_TYPE_LABELS[source.type]}`);
  if (source.adapter !== undefined) {
    meta.push(`Adapter: ${source.adapter.name}`);
  }
  // Type = what the source is, Capture = how it was obtained, Scope = how much.
  // Three separate lines so the dimensions can never be conflated (M-01).
  if (source.captureMethod !== undefined) {
    meta.push(`Capture: ${CAPTURE_METHOD_LABELS[source.captureMethod]}`);
  }
  meta.push(`URL: ${source.url}`);
  meta.push(`Captured At: ${source.capturedAt}`);
  meta.push(`Scope: ${SCOPE_LABELS[source.scope]}`);
  if (source.selection !== undefined && source.selection.labels.length > 0) {
    meta.push(`Selection: ${source.selection.labels.join(" · ")}`);
  }
  const facts = serializeSourceFacts(source);
  if (facts.length > 0) {
    meta.push("");
    meta.push("Source facts:");
    for (const fact of facts) {
      meta.push(`- ${fact}`);
    }
  }
  meta.push(`~${source.tokenEstimate.tokens.toLocaleString("en-US")} estimated tokens`);

  const content = source.contentMarkdown.replace(/\s+$/, "");
  return `${heading}\n\n${meta.join("\n")}\n\n${content}`;
}

/**
 * Human-readable adapter-verified facts. Deterministic order; only facts the
 * adapter actually resolved are listed (Final QA M-02).
 */
function serializeSourceFacts(source: TaskSpecSource): string[] {
  const facts = source.sourceFacts;
  if (facts === undefined) {
    return [];
  }
  const lines: string[] = [`Repository: ${facts.repository.owner}/${facts.repository.name}`];
  if (facts.issueNumber !== undefined) {
    lines.push(`Issue: #${facts.issueNumber}`);
  }
  if (facts.pullRequestNumber !== undefined) {
    lines.push(`Pull request: #${facts.pullRequestNumber}`);
  }
  if (facts.state !== undefined) {
    lines.push(`State: ${facts.state}`);
  }
  if (facts.baseBranch !== undefined) {
    lines.push(`Base branch: ${facts.baseBranch}`);
  }
  if (facts.headBranch !== undefined) {
    lines.push(`Head branch: ${facts.headBranch}`);
  }
  if (facts.author !== undefined) {
    lines.push(`Author: ${facts.author}`);
  }
  if (facts.publishedAt !== undefined) {
    lines.push(`Published: ${facts.publishedAt}`);
  }
  if (facts.labels !== undefined) {
    lines.push(`Labels: ${facts.labels.join(", ")}`);
  }
  return lines;
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

/** Deterministic download filename for the TaskSpec JSON. */
export function buildTaskSpecFilename(spec: TaskSpec): string {
  const base = sanitizeBaseName(spec.task.title) || "page2agent-task";
  return `${base}-taskspec.json`;
}
