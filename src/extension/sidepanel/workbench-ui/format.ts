/**
 * Side Panel V1.1 — display vocabulary (pure UI helpers).
 * Labels/icons stay consistent with domain role/scope semantics.
 */
import type { ContextRole, RecipeId } from "../../../core";

export const RECIPE_TITLES: Record<RecipeId, string> = {
  learn: "Learn",
  compare: "Compare",
  verify: "Verify",
  build: "Build",
  fix: "Fix",
};

export const ROLE_TITLES: Record<ContextRole, string> = {
  task: "Task",
  reference: "Reference",
  evidence: "Evidence",
  example: "Example",
  selection: "Selection",
};

export const SOURCE_KIND_LABELS: Record<string, string> = {
  web: "Web Page",
  github_issue: "GitHub Issue",
  github_pull_request: "GitHub Pull Request",
};

export const ITEM_SCOPE_LABELS: Record<string, string> = {
  "full-page": "Full page",
  selection: "Selected sections",
  "text-selection": "Text selection",
};

export const CAPTURE_METHOD_LABELS: Record<string, string> = {
  "full-page": "Full page",
  "context-lens": "Context Lens",
  "text-selection": "Text selection",
};

export function adapterLabel(adapter: { id: string; name: string } | undefined): string {
  return adapter?.name ?? "Unknown";
}

/**
 * Describe a source on one compact line: what it is, which adapter normalized
 * it, how it was captured, and how much was captured.
 *
 * Duplicates are dropped (Final QA UX-06): a GitHub Issue captured in full read
 * "GitHub Issue · GitHub Issue · Selected sections", which wastes the only line
 * a narrow side panel has. `Full page` is also redundant when the kind label
 * already implies a whole-page capture and no cropping method is recorded.
 */
export function describeSourceLine(input: {
  sourceKind: string;
  adapter?: { id: string; name: string };
  method?: string;
  scope?: string;
}): string {
  const parts: string[] = [];
  const push = (value: string | undefined): void => {
    if (value === undefined || value.length === 0) {
      return;
    }
    if (parts.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      return;
    }
    parts.push(value);
  };

  push(SOURCE_KIND_LABELS[input.sourceKind] ?? input.sourceKind);
  if (input.adapter !== undefined && input.adapter.id !== input.sourceKind) {
    push(input.adapter.name);
  }
  if (input.method !== undefined && input.method !== "full-page") {
    push(CAPTURE_METHOD_LABELS[input.method]);
  }
  if (input.scope !== undefined && input.scope !== "full-page") {
    push(ITEM_SCOPE_LABELS[input.scope]);
  }
  return parts.join(" · ");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Token stages (Final QA UX-05).
 *
 * One source is measured at three different points and the numbers legitimately
 * differ, which was confusing when every surface just said "estimated tokens":
 *
 *   selected  — content the user picked on the page (Context Lens / selection)
 *   packaged  — that content once wrapped as a Context source, with its
 *               Markdown structure
 *   total     — the whole context the agent receives: all sources + generated
 *               instructions + metadata
 *
 * Every label stays explicitly "estimated": no model tokenizer is implied.
 */
export const TOKEN_STAGE_LABELS = {
  selected: "selected-content tokens",
  packaged: "packaged-source tokens",
  total: "total-context tokens",
} as const;

export type TokenStage = keyof typeof TOKEN_STAGE_LABELS;

export function formatTokenStage(tokens: number, stage: TokenStage): string {
  return `~${formatNumber(tokens)} ${TOKEN_STAGE_LABELS[stage]}`;
}

/** Generic fallback for surfaces that show a bare estimate. */
export function formatEstimate(tokens: number): string {
  return `~${formatNumber(tokens)} estimated tokens`;
}

export function formatCapturedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function statusLabel(
  status: "clean" | "has-unknowns" | "has-warnings",
): string {
  switch (status) {
    case "clean":
      return "Clean";
    case "has-unknowns":
      return "Unknowns";
    case "has-warnings":
      return "Warnings";
    default:
      return status;
  }
}
