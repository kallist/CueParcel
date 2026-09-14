/**
 * TaskSpec — Page2Agent's versioned structured task contract (V1.1).
 *
 * TaskSpec is the portable output of the Workbench: user-curated Sources +
 * one Recipe + generated instructions, expressed as versioned JSON that any
 * external consumer (ContextForge, CLI tools, agent harnesses) can read
 * without Page2Agent internals.
 *
 * Structural invariants (mirrored by isTaskSpec):
 * - SOURCE data (urls, titles, capturedAt, content, source-fact stats) is
 *   separated from GENERATED data (task kind, instructions, target,
 *   estimates, unknowns) at every level; no string blends both.
 * - `requirements.acceptanceCriteria` is null unless the source explicitly
 *   provided criteria — never inferred from Expected Behavior or anything
 *   else. A missing-value null can also surface as an `unknowns` entry.
 * - Key order in JSON output is deterministic (builder writes fixed order).
 */
import {
  hasOnlyAllowedKeys,
  isIsoDateTimeString,
  isMeaningfulText,
  isNonEmptyString,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isRecord,
} from "../validation/primitives";
import { isContextRole } from "./context-source";
import { isRecipeId, isTaskKind } from "./recipes";
import type { ContextRole } from "./context-source";
import type { RecipeId, TaskKind } from "./recipes";
import { TOKEN_ESTIMATE_METHOD } from "./token-estimate";

/** JSON-facing schema version of this contract (independent of doc schemas). */
export const TASK_SPEC_SCHEMA_VERSION = "1.0" as const;
/** Producer identity — static so output stays byte-deterministic. */
export const TASK_SPEC_PRODUCER = { name: "Page2Agent", version: "1.1.0" } as const;

export const TASK_SPEC_SOURCE_TYPES = [
  "web",
  "github_issue",
  "github_pull_request",
] as const;
export type TaskSpecSourceType = (typeof TASK_SPEC_SOURCE_TYPES)[number];

export const TASK_SPEC_SCOPES = ["full_page", "selected_sections", "text_selection"] as const;
export type TaskSpecSourceScope = (typeof TASK_SPEC_SCOPES)[number];

/**
 * How the source content was obtained. Orthogonal to the semantic adapter:
 * a GitHub Issue read in full and a GitHub Issue cropped with Context Lens both
 * keep `adapter: github-issue` and differ only here (Final QA M-01).
 */
export const TASK_SPEC_CAPTURE_METHODS = [
  "full_page",
  "context_lens",
  "text_selection",
] as const;
export type TaskSpecCaptureMethod = (typeof TASK_SPEC_CAPTURE_METHODS)[number];

/**
 * Specialized, adapter-verified source facts (Final QA M-02).
 *
 * A downstream consumer must not have to re-parse the URL to learn the issue
 * number, the repository, the labels or the PR branches: the adapter already
 * read those from the rendered page. Only facts the adapter actually resolved
 * are present — nothing is inferred, and every field is optional so an adapter
 * can never be forced to claim a fact the DOM did not provide.
 */
export interface TaskSpecSourceFacts {
  repository: { owner: string; name: string };
  /** GitHub Issue number, when the source is an issue. */
  issueNumber?: number;
  /** GitHub Pull Request number, when the source is a pull request. */
  pullRequestNumber?: number;
  /** Rendered state: open / closed / merged (never guessed). */
  state?: string;
  labels?: string[];
  /** Author display name as rendered on the page. */
  author?: string;
  /** Creation timestamp, ISO 8601, only when the page provided one. */
  publishedAt?: string;
  baseBranch?: string;
  headBranch?: string;
}

export interface TaskSpecSource {
  id: string;
  type: TaskSpecSourceType;
  url: string;
  title: string;
  role: ContextRole;
  isPrimary: boolean;
  /** JSON-scope naming: full_page / selected_sections / text_selection. */
  scope: TaskSpecSourceScope;
  /** JSON-method naming: full_page / context_lens / text_selection. */
  captureMethod?: TaskSpecCaptureMethod;
  adapter?: { id: string; name: string };
  /** Adapter-verified semantic facts about the page (never re-derived). */
  sourceFacts?: TaskSpecSourceFacts;
  /** What was picked on the page (regions/labels), for selected sources. */
  selection?: { regions: number; labels: string[] };
  capturedAt: string;
  provenance: { captureId: string };
  /** Deterministic source-faithful Markdown derived from the document. */
  contentMarkdown: string;
  /** Observable facts about the captured content. */
  stats: {
    characters: number;
    codeBlocks: number;
    tables: number;
    links: number;
  };
  tokenEstimate: { tokens: number; method: typeof TOKEN_ESTIMATE_METHOD };
}

export interface TaskSpecRequirements {
  /** null = the source did NOT explicitly provide acceptance criteria. */
  acceptanceCriteria: string[] | null;
}

export interface TaskSpecGenerated {
  instructions: string[];
}

export interface TaskSpecEstimates {
  sourceContentTokens: number;
  generatedTokens: number;
  metadataTokens: number;
  totalEstimatedTokens: number;
}

export interface TaskSpec {
  schemaVersion: typeof TASK_SPEC_SCHEMA_VERSION;
  producer: { name: string; version: string };
  recipe: RecipeId;
  task: {
    kind: TaskKind;
    title: string;
  };
  target: {
    /** Explicit target repository ("owner/repo"), or null when not explicit. */
    repository: string | null;
  };
  sources: TaskSpecSource[];
  requirements: TaskSpecRequirements;
  unknowns: string[];
  generated: TaskSpecGenerated;
  estimates: TaskSpecEstimates;
}

const PRODUCER_KEYS = ["name", "version"];
const TASK_KEYS = ["kind", "title"];
const TARGET_KEYS = ["repository"];
const SOURCE_KEYS = [
  "id",
  "type",
  "url",
  "title",
  "role",
  "isPrimary",
  "scope",
  "captureMethod",
  "adapter",
  "sourceFacts",
  "selection",
  "capturedAt",
  "provenance",
  "contentMarkdown",
  "stats",
  "tokenEstimate",
];
const ADAPTER_KEYS = ["id", "name"];
const SOURCE_FACTS_KEYS = [
  "repository",
  "issueNumber",
  "pullRequestNumber",
  "state",
  "labels",
  "author",
  "publishedAt",
  "baseBranch",
  "headBranch",
];
const REPOSITORY_KEYS = ["owner", "name"];
const SELECTION_KEYS = ["regions", "labels"];
const PROVENANCE_KEYS = ["captureId"];
const STATS_KEYS = ["characters", "codeBlocks", "tables", "links"];
const TOKEN_ESTIMATE_KEYS = ["tokens", "method"];
const REQUIREMENTS_KEYS = ["acceptanceCriteria"];
const GENERATED_KEYS = ["instructions"];
const ESTIMATES_KEYS = [
  "sourceContentTokens",
  "generatedTokens",
  "metadataTokens",
  "totalEstimatedTokens",
];
const TASK_SPEC_KEYS = [
  "schemaVersion",
  "producer",
  "recipe",
  "task",
  "target",
  "sources",
  "requirements",
  "unknowns",
  "generated",
  "estimates",
];

function isTaskSpecSourceType(value: unknown): value is TaskSpecSourceType {
  return typeof value === "string" && (TASK_SPEC_SOURCE_TYPES as readonly string[]).includes(value);
}

function isTaskSpecScope(value: unknown): value is TaskSpecSourceScope {
  return typeof value === "string" && (TASK_SPEC_SCOPES as readonly string[]).includes(value);
}

function isTaskSpecCaptureMethod(value: unknown): value is TaskSpecCaptureMethod {
  return (
    typeof value === "string" &&
    (TASK_SPEC_CAPTURE_METHODS as readonly string[]).includes(value)
  );
}

function isSmallStringArray(value: unknown, max: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((entry) => isMeaningfulText(entry))
  );
}

export function isTaskSpecSourceFacts(value: unknown): value is TaskSpecSourceFacts {
  if (
    !isRecord(value) ||
    !hasOnlyAllowedKeys(value, SOURCE_FACTS_KEYS) ||
    !isRecord(value.repository) ||
    !hasOnlyAllowedKeys(value.repository, REPOSITORY_KEYS) ||
    !isMeaningfulText(value.repository.owner) ||
    !isMeaningfulText(value.repository.name)
  ) {
    return false;
  }
  if (value.issueNumber !== undefined && !isPositiveSafeInteger(value.issueNumber)) {
    return false;
  }
  if (
    value.pullRequestNumber !== undefined &&
    !isPositiveSafeInteger(value.pullRequestNumber)
  ) {
    return false;
  }
  for (const key of ["state", "author", "baseBranch", "headBranch"] as const) {
    if (value[key] !== undefined && !isMeaningfulText(value[key])) {
      return false;
    }
  }
  if (value.labels !== undefined) {
    if (!Array.isArray(value.labels) || value.labels.length === 0) {
      return false;
    }
    if (!value.labels.every((label) => isMeaningfulText(label))) {
      return false;
    }
  }
  // publishedAt must be a real ISO 8601 timestamp, never a rendered phrase such
  // as "on Aug 28, 2026": a downstream consumer must be able to parse it.
  if (value.publishedAt !== undefined && !isIsoDateTimeString(value.publishedAt)) {
    return false;
  }
  return true;
}

export function isTaskSpecSource(value: unknown): value is TaskSpecSource {
  if (
    !isRecord(value) ||
    !hasOnlyAllowedKeys(value, SOURCE_KEYS) ||
    !isNonEmptyString(value.id) ||
    !isTaskSpecSourceType(value.type) ||
    !isMeaningfulText(value.url) ||
    !isMeaningfulText(value.title) ||
    !isContextRole(value.role) ||
    typeof value.isPrimary !== "boolean" ||
    !isTaskSpecScope(value.scope) ||
    !isMeaningfulText(value.capturedAt) ||
    !isRecord(value.provenance) ||
    !hasOnlyAllowedKeys(value.provenance, PROVENANCE_KEYS) ||
    !isNonEmptyString(value.provenance.captureId) ||
    !isRecord(value.stats) ||
    !hasOnlyAllowedKeys(value.stats, STATS_KEYS) ||
    !isNonNegativeSafeInteger(value.stats.characters) ||
    !isNonNegativeSafeInteger(value.stats.codeBlocks) ||
    !isNonNegativeSafeInteger(value.stats.tables) ||
    !isNonNegativeSafeInteger(value.stats.links) ||
    !isRecord(value.tokenEstimate) ||
    !hasOnlyAllowedKeys(value.tokenEstimate, TOKEN_ESTIMATE_KEYS) ||
    typeof value.tokenEstimate.tokens !== "number" ||
    !Number.isSafeInteger(value.tokenEstimate.tokens) ||
    value.tokenEstimate.tokens < 0 ||
    value.tokenEstimate.method !== TOKEN_ESTIMATE_METHOD ||
    typeof value.contentMarkdown !== "string"
  ) {
    return false;
  }
  if (value.scope !== "full_page" && value.selection === undefined) {
    return false;
  }
  if (
    value.captureMethod !== undefined &&
    !isTaskSpecCaptureMethod(value.captureMethod)
  ) {
    return false;
  }
  if (
    value.adapter !== undefined &&
    (!isRecord(value.adapter) ||
      !hasOnlyAllowedKeys(value.adapter, ADAPTER_KEYS) ||
      !isMeaningfulText(value.adapter.id) ||
      !isMeaningfulText(value.adapter.name))
  ) {
    return false;
  }
  if (value.sourceFacts !== undefined && !isTaskSpecSourceFacts(value.sourceFacts)) {
    return false;
  }
  if (value.selection !== undefined) {
    return (
      isRecord(value.selection) &&
      hasOnlyAllowedKeys(value.selection, SELECTION_KEYS) &&
      isNonNegativeSafeInteger(value.selection.regions) &&
      value.selection.regions >= 1 &&
      isSmallStringArray(value.selection.labels, 64)
    );
  }
  return true;
}

export function isTaskSpec(value: unknown): value is TaskSpec {
  if (
    !isRecord(value) ||
    !hasOnlyAllowedKeys(value, TASK_SPEC_KEYS) ||
    value.schemaVersion !== TASK_SPEC_SCHEMA_VERSION ||
    !isRecord(value.producer) ||
    !hasOnlyAllowedKeys(value.producer, PRODUCER_KEYS) ||
    !isMeaningfulText(value.producer.name) ||
    !isMeaningfulText(value.producer.version) ||
    !isRecipeId(value.recipe) ||
    !isRecord(value.task) ||
    !hasOnlyAllowedKeys(value.task, TASK_KEYS) ||
    !isTaskKind(value.task.kind) ||
    !isMeaningfulText(value.task.title) ||
    !isRecord(value.target) ||
    !hasOnlyAllowedKeys(value.target, TARGET_KEYS) ||
    (value.target.repository !== null &&
      (typeof value.target.repository !== "string" ||
        !isRepositoryName(value.target.repository))) ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    !value.sources.every(isTaskSpecSource) ||
    !isRecord(value.requirements) ||
    !hasOnlyAllowedKeys(value.requirements, REQUIREMENTS_KEYS) ||
    (value.requirements.acceptanceCriteria !== null &&
      (!Array.isArray(value.requirements.acceptanceCriteria) ||
        value.requirements.acceptanceCriteria.length < 1 ||
        !isSmallStringArray(value.requirements.acceptanceCriteria, 200))) ||
    !isSmallStringArray(value.unknowns, 50) ||
    !isRecord(value.generated) ||
    !hasOnlyAllowedKeys(value.generated, GENERATED_KEYS) ||
    !isSmallStringArray(value.generated.instructions, 100) ||
    !isRecord(value.estimates) ||
    !hasOnlyAllowedKeys(value.estimates, ESTIMATES_KEYS) ||
    !isNonNegativeSafeInteger(value.estimates.sourceContentTokens) ||
    !isNonNegativeSafeInteger(value.estimates.generatedTokens) ||
    !isNonNegativeSafeInteger(value.estimates.metadataTokens) ||
    !isNonNegativeSafeInteger(value.estimates.totalEstimatedTokens)
  ) {
    return false;
  }
  const primaries = value.sources.filter((source: TaskSpecSource) => source.isPrimary);
  return primaries.length <= 1; // at most one primary source in a TaskSpec
}

function isRepositoryName(value: string): boolean {
  const parts = value.split("/");
  if (parts.length !== 2) {
    return false;
  }
  const segment = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
  return (
    segment.test(parts[0]) &&
    segment.test(parts[1]) &&
    parts[0].length + parts[1].length <= 200
  );
}
