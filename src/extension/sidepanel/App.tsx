/**
 * CueParcel Side Panel — V1.1 Visual Context Workbench.
 *
 * Layout (top to bottom):
 *   header → capture state (idle/capturing/error) OR captured workbench:
 *   source card (adapter/scope/buttons) → Context Lens strip → text-selection
 *   CTA → recipe chooser → Context Cart → Agent|Markdown|TaskSpec tabs →
 *   Context Receipt + nutrition label → Copy/Download actions → feedback.
 *
 * Rendering rule: webpage content reaches the panel ONLY as structured,
 * validated data (NormalizedDocument blocks / serialized text) — never raw
 * HTML. All strings shown come from pure serializers.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useCaptureSession } from "./capture-session";
import { createProductionSessionDeps } from "./capture-session";
import type { CaptureSessionDeps } from "./capture-session";
import { useWorkbench } from "./use-workbench";
import type {
  LensUiState,
  WorkbenchController,
  WorkbenchDeps,
  WorkbenchFeedback,
} from "./use-workbench";
import type { WorkbenchOutputs } from "./workbench/workbench-model";
import { createProductionWorkbenchDeps } from "./workbench-ui/production-deps";
import { createPreview, PREVIEW_TRUNCATED_MESSAGE } from "./preview";
import { copyTextToClipboard } from "./clipboard";
import { downloadJson, downloadMarkdown } from "./download";
import { buildTaskSpecFilename } from "../../application/workbench/delivery";
import { sanitizeBaseName } from "../../application/delivery/filename";
import { computeCartTotals, estimateBlocksTokens } from "../../core";
import { getRecipeDefinition, RECIPE_IDS } from "../../core";
import type { ContextRole, ContextSourceItem, RecipeId, TaskSpec } from "../../core";
import {
  ITEM_SCOPE_LABELS,
  RECIPE_TITLES,
  ROLE_TITLES,
  SOURCE_KIND_LABELS,
  adapterLabel,
  describeSourceLine,
  formatCapturedAt,
  formatTokenStage,
  statusLabel,
} from "./workbench-ui/format";
import { Aurora, ParticleAtmosphere, RecipeIcon, RoleIcon } from "./workbench-ui/atmosphere";
import {
  createNullToolbarDeps,
  createProductionToolbarDeps,
} from "./workbench-ui/toolbar-deps";
import type { ToolbarDeps } from "./workbench-ui/toolbar-deps";
import { BRAND_TAGLINE, ONBOARDING_STEPS, PIN_HINT_TEXT, SHORTCUT_HINT } from "./onboarding";
import type { OnboardingDecision } from "./onboarding";
import type { CaptureResult } from "../capture/capture-result";

const ROLES: readonly ContextRole[] = ["task", "reference", "evidence", "example", "selection"];

type FeedbackKindClass = "feedback-info" | "feedback-success" | "feedback-error";

function feedbackClass(kind: WorkbenchFeedback["kind"]): FeedbackKindClass {
  return kind === "success"
    ? "feedback-success"
    : kind === "error"
      ? "feedback-error"
      : "feedback-info";
}

export default function App({
  deps,
  workbench,
  toolbar,
}: {
  deps?: CaptureSessionDeps;
  workbench?: WorkbenchDeps;
  toolbar?: ToolbarDeps;
}) {
  const sessionDeps = useMemo(() => deps ?? createProductionSessionDeps(), [deps]);
  const workbenchDeps = useMemo(
    () => workbench ?? createProductionWorkbenchDeps(),
    [workbench],
  );
  const toolbarDeps = useMemo(
    () => toolbar ?? (deps === undefined && workbench === undefined
      ? createProductionToolbarDeps()
      : createNullToolbarDeps()),
    [toolbar, deps, workbench],
  );
  const { view } = useCaptureSession(sessionDeps);

  return (
    <main className="panel">
      <header className="panel-header">
        <Aurora />
        <div className="brand-lockup">
          <BrandMark />
          <h1>CueParcel</h1>
        </div>
        <span className="panel-version">Visual Context Workbench</span>
      </header>

      <PinOnboarding toolbar={toolbarDeps} />

      {view.status === "idle" && <IdleView />}
      {view.status === "capturing" && <CapturingView />}
      {view.status === "error" && <ErrorView message={view.error.message} />}
      {view.status === "captured" && (
        <WorkbenchView
          result={view.result}
          workbenchDeps={workbenchDeps}
          toolbar={toolbarDeps}
        />
      )}
    </main>
  );
}

/**
 * CueParcel brand mark — the open "C" with the Cue Blue cue dot.
 *
 * Inline vector rather than an <img>: the mark is two shapes of pure geometry,
 * so inlining keeps it crisp at any size, lets the C follow the theme through
 * `currentColor`, and keeps the Cue Blue dot the single accent.
 *
 * The geometry mirrors public/brand/cueparcel-mark.svg exactly (32x32 viewBox,
 * 3.456 stroke, 80 degree opening, cue dot in the open mouth). Those numbers are
 * MEASURED from the approved brand board rather than invented: the dot is ~30% of
 * the C's height and its centre sits 0.77 of the C's outer radius to the right, so
 * it reads as a distinct cue beside the opening instead of a small dot lost inside
 * the cavity. A unit test pins this markup to the committed master, so the header
 * can never drift from the exported asset.
 *
 * The C's body is TWO arc commands on purpose: an SVG arc cannot span more than
 * 180 degrees, and a single large-arc command silently renders the 80 degree
 * COMPLEMENT, which collapses the C into two stub ends. Keep the split.
 *
 * Accessibility: the adjacent visible "CueParcel" heading is the accessible
 * name, so this is aria-hidden and must never add a second label.
 */
function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 26.865 6.44 A 14.872 14.872 0 0 0 0.6 16 A 14.872 14.872 0 0 0 26.865 25.56 L 24.217 23.338 A 11.416 11.416 0 0 1 4.056 16 A 11.416 11.416 0 0 1 24.217 8.662 Z"
        fill="currentColor"
      />
      <circle cx="26.941" cy="16" r="4.459" fill="#224AE6" />
    </svg>
  );
}

/**
 * First-run pin guidance. Shown only when the Action API positively reports the
 * extension is NOT pinned and the user has not dismissed it (see onboarding.ts).
 * The copy is deliberately honest: Chrome requires the user to pin it.
 */
function PinOnboarding({ toolbar }: { toolbar: ToolbarDeps }) {
  const [decision, setDecision] = useState<OnboardingDecision>({
    showOnboarding: false,
    showPinHint: false,
  });

  useEffect(() => {
    let cancelled = false;
    void toolbar.onboardingDecision().then((next) => {
      if (!cancelled) {
        setDecision(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [toolbar]);

  if (!decision.showOnboarding && !decision.showPinHint) {
    return null;
  }

  if (decision.showPinHint) {
    return (
      // No decorative glyph here: a "✦" sparkle sat in front of this hint and
      // read as a tiny particle mark next to the brand, which the approved logo
      // deliberately does not have.
      <p className="pin-hint" role="note">
        {PIN_HINT_TEXT}
      </p>
    );
  }

  async function dismiss(): Promise<void> {
    await toolbar.dismissOnboarding();
    setDecision({ showOnboarding: false, showPinHint: true });
  }

  return (
    <section className="onboarding" aria-label="Getting started">
      <ParticleAtmosphere />
      <div className="onboarding-brand">
        <BrandMark />
        <h2>CueParcel</h2>
      </div>
      <p className="onboarding-lead">{BRAND_TAGLINE}</p>
      <p className="onboarding-sub">
        Capture a page, pick what matters, combine sources, and prepare structured
        context for AI.
      </p>
      <ol className="onboarding-steps">
        {ONBOARDING_STEPS.map((step) => (
          <li key={step.title}>
            <strong>{step.title}</strong>
            <span>{step.detail}</span>
          </li>
        ))}
      </ol>
      <div className="onboarding-actions">
        <span className="muted">{SHORTCUT_HINT}</span>
        <button type="button" className="button button-primary" onClick={() => void dismiss()}>
          Got it
        </button>
      </div>
    </section>
  );
}

function IdleView() {
  return (
    <section className="status-panel" aria-label="Extension status">
      <ParticleAtmosphere />
      <div className="status-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M4 7.5l8-4 8 4-8 4z" />
          <path d="M4 12.5l8 4 8-4" />
          <path d="M4 17l8 4 8-4" />
        </svg>
      </div>
      <h2>No page captured yet</h2>
      <p>Click the CueParcel toolbar icon on the page you want to understand.</p>
      <ol className="steps">
        <li><strong>Capture</strong> — CueParcel identifies the page type</li>
        <li><strong>Pick</strong> — choose sections with Context Lens</li>
        <li><strong>Combine</strong> — add pages to the Context Cart</li>
        <li><strong>Task</strong> — pick what your agent should do</li>
        <li><strong>Inspect &amp; copy</strong> — see exactly what the agent gets</li>
      </ol>
    </section>
  );
}

function CapturingView() {
  return (
    <section className="status-panel" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>Capturing current page…</p>
    </section>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <section className="status-panel" aria-live="polite">
      <div className="status-mark status-mark-error" aria-hidden="true">!</div>
      <p className="error-text">{message}</p>
      <p className="muted">Click the CueParcel toolbar icon to try again.</p>
    </section>
  );
}

function WorkbenchView({
  result,
  workbenchDeps,
  toolbar,
}: {
  result: CaptureResult;
  workbenchDeps: WorkbenchDeps;
  toolbar: ToolbarDeps;
}) {
  const workbench = useWorkbench(workbenchDeps, result);
  const [activeTab, setActiveTab] = useState<"agent" | "markdown" | "taskspec">("agent");
  const [copied, setCopied] = useState<string | null>(null);

  /**
   * Keep this window's Cart count visible on the single global toolbar badge.
   *
   * Ownership (HQA-04): the panel resolves its OWN window id, reports its live
   * in-memory Cart length, and the worker displays it only while this window is
   * the focused one — Chrome has no per-window action badge, so a background
   * window must never paint the count the user is looking at. The count is
   * derived from the live Cart, so add / remove / undo / clear / restore all
   * converge on the same value.
   */
  const cartCount = workbench.cart.items.length;
  useEffect(() => {
    let cancelled = false;
    void toolbar.currentWindowId().then((windowId) => {
      if (cancelled || windowId === null) {
        return;
      }
      void toolbar.syncBadge(windowId, cartCount);
    });
    return () => {
      cancelled = true;
    };
  }, [toolbar, cartCount]);

  return (
    <div className="workbench">
      <SourceCard workbench={workbench} result={result} sessionTitle={result.title} />

      {workbench.lens.phase !== "idle" && (
        <LensStrip lens={workbench.lens} workbench={workbench} />
      )}

      {workbench.lens.phase === "ready" && (
        <SelectionAction
          workbench={workbench}
          label={
            workbench.lens.selectedCount === 1
              ? "Use the picked area as a Context source"
              : `Use ${workbench.lens.selectedCount} picked areas as one Context source`
          }
        />
      )}

      {workbench.selectionAvailable === true && workbench.lens.phase === "idle" && (
        <div className="hint-row">
          <span>Text is selected on the page.</span>
          <button type="button" className="button button-secondary" onClick={() => void workbench.addTextSelection()}>
            + Add selection to Context
          </button>
        </div>
      )}

      {workbench.candidate !== null && <RecipeChooser workbench={workbench} />}

      <CartSection workbench={workbench} />

      {workbench.outputs !== null && workbench.outputs.recipeGate === null && (
        <PreviewTabs
          workbench={workbench}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          copied={copied}
          onCopied={setCopied}
          filenameBase={sanitizeBaseName(result.title)}
        />
      )}

      {workbench.outputs?.recipeGate !== null && workbench.outputs?.recipeGate !== undefined && (
        <p className="recipe-gate-note" role="status">
          {getRecipeDefinition(workbench.outputs.recipeGate.recipe).title} needs at least{" "}
          {workbench.outputs.recipeGate.required} sources in the Context.
        </p>
      )}

      {workbench.outputs !== null && workbench.outputs.recipeGate === null && (
        <ReceiptSection workbench={workbench} />
      )}

      <FeedbackList feedback={workbench.feedback} onDismiss={workbench.dismissFeedback} />
    </div>
  );
}

function SourceCard({
  workbench,
  result,
  sessionTitle,
}: {
  workbench: WorkbenchController;
  result: CaptureResult;
  sessionTitle: string;
}) {
  const candidate = workbench.candidate;
  const sourceLabel = SOURCE_KIND_LABELS[result.sourceKind] ?? "Web Page";
  const tokens = candidate === null ? null : candidateTokens(candidate);
  const docMissing = workbench.ready && candidate === null;

  return (
    <section className="source-card" aria-label="Captured source">
      <div className="badge-row">
        <span className="badge badge-source">{sourceLabel}</span>
        {candidate?.adapter !== undefined && (
          <span className="badge badge-adapter">{adapterLabel(candidate.adapter)}</span>
        )}
        {candidate?.scope !== undefined && candidate.scope !== "full-page" && (
          <span className="badge badge-scope">{ITEM_SCOPE_LABELS[candidate.scope] ?? candidate.scope}</span>
        )}
      </div>
      <h2 className="source-title" title={result.title}>
        {result.title || sessionTitle}
      </h2>
      <p className="source-url" title={result.url}>
        {result.url}
      </p>
      <p className="source-meta">
        {formatCapturedAt(result.capturedAt)}
        {tokens !== null && (
          <span className="dot-sep">{formatTokenStage(tokens, "packaged")}</span>
        )}
      </p>

      {docMissing && (
        <p className="warn-note">
          This capture&apos;s structured document is unavailable (browser restart or
          navigation). Click the toolbar icon to capture again.
        </p>
      )}

      <div className="action-row">
        <button
          type="button"
          className="button button-primary"
          disabled={workbench.candidate === null || workbench.lens.phase === "entering" || workbench.lens.phase === "active"}
          onClick={() => void workbench.pickOnPage()}
        >
          Pick Context
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={workbench.candidate === null}
          onClick={() => void workbench.addCaptureToCart()}
        >
          + Add to Context
        </button>
      </div>
    </section>
  );
}

function LensStrip({
  lens,
  workbench,
}: {
  lens: LensUiState;
  workbench: WorkbenchController;
}) {
  const live = lens.active;
  return (
    <section className="lens-strip" aria-live="polite">
      <div className="lens-copy">
        {live ? (
          <span>Context Lens is on the page — click areas to include, then Done in the dock.</span>
        ) : (
          <span>
            {lens.selectedCount} area{lens.selectedCount === 1 ? "" : "s"} picked ·{" "}
            {formatTokenStage(lens.estimatedTokens, "selected")}
          </span>
        )}
      </div>
      <button
        type="button"
        className="button button-ghost"
        disabled={lens.phase === "entering" || lens.phase === "adding"}
        onClick={() => void workbench.discardPickedSections()}
      >
        Cancel
      </button>
    </section>
  );
}

function SelectionAction({
  workbench,
  label,
}: {
  workbench: WorkbenchController;
  label: string;
}) {
  return (
    <div className="selection-action">
      <span className="selection-summary">
        {label} · {formatTokenStage(workbench.lens.estimatedTokens, "selected")}
      </span>
      <button
        type="button"
        className="button button-primary"
        disabled={workbench.lens.phase === "adding"}
        onClick={() => void workbench.addPickedSections()}
      >
        Add to Context
      </button>
    </div>
  );
}

function RecipeChooser({ workbench }: { workbench: WorkbenchController }) {
  const outputs = workbench.outputs;
  const recommended = outputs?.recipeState.recommended;
  const effective = outputs?.recipeState.effective;
  const sourceCount = outputs?.basis.items.length ?? 0;

  return (
    <section className="section" aria-label="What do you want to do">
      <h3 className="section-title">What do you want to do?</h3>
      <div className="recipe-grid" role="radiogroup" aria-label="Recipe">
        {RECIPE_IDS.map((recipe: RecipeId) => {
          const definition = getRecipeDefinition(recipe);
          const insufficient = sourceCount < definition.minSources;
          const selected = effective === recipe;
          return (
            <button
              key={recipe}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={insufficient}
              className={[
                "recipe-button",
                selected ? "recipe-button-selected" : "",
                recommended === recipe ? "recipe-recommended" : "",
                insufficient ? "recipe-disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={insufficient ? `${definition.title} needs ${definition.minSources} sources.` : definition.description}
              onClick={() => workbench.setRecipe(recipe)}
            >
              <span className="recipe-icon" aria-hidden="true">
                <RecipeIcon recipe={recipe} />
              </span>
              <span className="recipe-name">{RECIPE_TITLES[recipe]}</span>
              {recommended === recipe && <span className="recipe-chip">Recommended</span>}
            </button>
          );
        })}
      </div>
      {sourceCount < 2 && (
        <p className="muted">Compare needs at least two sources in the Context.</p>
      )}
    </section>
  );
}

function CartSection({ workbench }: { workbench: WorkbenchController }) {
  const { cart } = workbench;
  const totals = useMemo(() => computeCartTotals(cart), [cart]);
  const hasItems = cart.items.length > 0;

  return (
    <section className="section" aria-label="Context Cart">
      <div className="section-head">
        <h3 className="section-title">
          Context Cart
          {hasItems && <span className="count-badge">{cart.items.length}</span>}
        </h3>
        <div className="section-actions">
          {cart.undo !== undefined && hasItems === false && (
            <button type="button" className="button button-ghost" onClick={() => workbench.cartUndo()}>
              Undo
            </button>
          )}
          {cart.undo !== undefined && hasItems && (
            <button type="button" className="button button-ghost" onClick={() => workbench.cartUndo()}>
              Undo
            </button>
          )}
          {hasItems && (
            <button type="button" className="button button-ghost" onClick={() => workbench.cartClear()}>
              Clear
            </button>
          )}
        </div>
      </div>

      {!hasItems ? (
        <p className="muted cart-empty">
          Your cart is empty. Add the current page or picked sections — several sources
          become one agent context.
        </p>
      ) : (
        <>
          <ul className="cart-list">
            {cart.items.map((item, index) => (
              <CartItemRow
                key={item.id}
                item={item}
                index={index}
                count={cart.items.length}
                workbench={workbench}
              />
            ))}
          </ul>
          <p className="cart-total">
            {totals.count} source{totals.count === 1 ? "" : "s"} ·{" "}
            {formatTokenStage(totals.tokenEstimate, "packaged")}
          </p>
        </>
      )}
    </section>
  );
}

function CartItemRow({
  item,
  index,
  count,
  workbench,
}: {
  item: ContextSourceItem;
  index: number;
  count: number;
  workbench: WorkbenchController;
}) {
  const tokens = candidateTokens(item);
  return (
    <li className="cart-item">
      <div className="cart-item-main">
        <span className="cart-grip" aria-hidden="true">⋮⋮</span>
        <div className="cart-item-text">
          <div className="cart-item-title-row">
            {/* Unified line icon for the role, with the title as the accessible
                name so the glyph never becomes the only signal. */}
            <span className="cart-item-role" title={ROLE_TITLES[item.role]}>
              <RoleIcon role={item.role} />
              <span className="sr-only">{ROLE_TITLES[item.role]} role</span>
            </span>
            <span className="cart-item-title" title={item.title}>
              {item.title}
            </span>
            {item.primary && <span className="badge badge-primary">Primary</span>}
          </div>
          <p className="cart-item-sub" title={item.url}>
            {describeSourceLine({
              sourceKind: item.sourceKind,
              adapter: item.adapter,
              method: item.method,
              scope: item.scope,
            })}
          </p>
          <p className="cart-item-meta">{formatTokenStage(tokens, "packaged")}</p>
        </div>
      </div>
      <div className="cart-item-controls">
        <div className="cart-move">
          <button
            type="button"
            className="icon-button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => workbench.cartMove(item.id, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Move down"
            disabled={index === count - 1}
            onClick={() => workbench.cartMove(item.id, 1)}
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={item.primary ? "Clear primary" : "Set as primary"}
          aria-pressed={item.primary}
          title="Set as primary"
          onClick={() => {
            if (!item.primary) {
              workbench.cartSetPrimary(item.id);
            }
          }}
        >
          ★
        </button>
        <label className="role-select">
          <span className="sr-only">Role for {item.title}</span>
          <select
            value={item.role}
            aria-label={`Role for ${item.title}`}
            onChange={(event) => {
              const role = event.target.value as ContextRole;
              if (ROLES.includes(role)) {
                workbench.cartSetRole(item.id, role);
              }
            }}
          >
            {/* Native <option> cannot hold SVG, so options stay plain text and
                the unified icon set is used everywhere it can render. */}
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_TITLES[role]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-button icon-danger"
          aria-label={`Remove ${item.title}`}
          title="Remove"
          onClick={() => workbench.cartRemove(item.id)}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

type TabId = "agent" | "markdown" | "taskspec";

function PreviewTabs({
  workbench,
  activeTab,
  onTabChange,
  copied,
  onCopied,
  filenameBase,
}: {
  workbench: WorkbenchController;
  activeTab: TabId;
  onTabChange(tab: TabId): void;
  copied: string | null;
  onCopied(kind: string | null): void;
  filenameBase: string;
}) {
  const outputs = workbench.outputs!;
  const content =
    activeTab === "agent"
      ? outputs.agentContext
      : activeTab === "markdown"
        ? outputs.sourceMarkdown
        : outputs.taskSpecJson;
  const preview = useMemo(
    () => createPreview(content ?? ""),
    [content],
  );

  async function copyActive(): Promise<void> {
    if (content === null) {
      return;
    }
    try {
      await copyTextToClipboard(content);
      onCopied(activeTab);
    } catch {
      onCopied("error");
    }
  }

  function downloadActive(): void {
    if (content === null) {
      return;
    }
    const slug = filenameBase || "cueparcel";
    if (activeTab === "taskspec") {
      const spec = JSON.parse(outputs.taskSpecJson!) as TaskSpec;
      downloadJson(buildTaskSpecFilename(spec), content);
    } else {
      downloadMarkdown(`${slug}-context.md`, content);
    }
  }

  return (
    <section className="section" aria-label="Agent output">
      <div className="tabs" role="tablist" aria-label="Preview type">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "agent"}
          className={activeTab === "agent" ? "tab active" : "tab"}
          onClick={() => onTabChange("agent")}
        >
          Agent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "markdown"}
          className={activeTab === "markdown" ? "tab active" : "tab"}
          onClick={() => onTabChange("markdown")}
        >
          Markdown
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "taskspec"}
          className={activeTab === "taskspec" ? "tab active" : "tab"}
          onClick={() => onTabChange("taskspec")}
        >
          TaskSpec
        </button>
      </div>

      <div
        role="tabpanel"
        className="preview-body"
        aria-label={`${activeTab} preview`}
      >
        <pre>{preview.text}</pre>
        {preview.truncated && <p className="preview-note">{PREVIEW_TRUNCATED_MESSAGE}</p>}
      </div>

      <div className="action-row action-row-end">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void copyActive()}
        >
          {activeTab === "taskspec" ? "Copy JSON" : "Copy"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={downloadActive}
        >
          {activeTab === "taskspec" ? "Download JSON" : "Download"}
        </button>
      </div>

      <p className="feedback-line" role="status" aria-live="polite">
        {copied === "error" && "Could not copy to the clipboard. Please try again."}
        {copied !== null && copied !== "error" && "Copied."}
      </p>
    </section>
  );
}

function ReceiptSection({ workbench }: { workbench: WorkbenchController }) {
  const outputs = workbench.outputs!;
  const receipt = outputs.receipt!;
  const nutrition = outputs.nutrition!;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const selectedLabel =
    workbench.selectedRecipe !== null
      ? RECIPE_TITLES[workbench.selectedRecipe]
      : undefined;
  const facts = [
    { label: "Source", percent: nutrition.sourceContentPercent },
    { label: "Generated", percent: nutrition.generatedPercent },
    { label: "Metadata", percent: nutrition.metadataPercent },
  ];

  return (
    <section className="section receipt" aria-label="Context Receipt">
      <div className="section-head">
        <h3 className="section-title">Context Receipt</h3>
        <span className={`status-pill pill-${nutrition.status}`}>
          {statusLabel(nutrition.status)}
        </span>
      </div>

      {/* Compact default: the answer to "what will my agent receive?" without
          pushing Copy/Download out of reach (Final QA UX-03). */}
      <p className="receipt-total">
        <strong>{formatTokenStage(nutrition.estimatedTokens, "total")}</strong>
        {selectedLabel !== undefined && (
          <span className="dot-sep">Recipe: {selectedLabel}</span>
        )}
      </p>

      <dl className="receipt-split">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.percent}%</dd>
          </div>
        ))}
      </dl>

      <p className="receipt-summary muted">
        {nutrition.counts.sources} source{nutrition.counts.sources === 1 ? "" : "s"} ·{" "}
        {nutrition.counts.headings} heading{nutrition.counts.headings === 1 ? "" : "s"} ·{" "}
        {nutrition.counts.codeBlocks} code · {nutrition.counts.tables} table
        {nutrition.counts.tables === 1 ? "" : "s"} · {nutrition.counts.links} link
        {nutrition.counts.links === 1 ? "" : "s"}
        {receipt.unknowns.length > 0 && (
          <>
            {" · "}
            {receipt.unknowns.length} unknown
            {receipt.unknowns.length === 1 ? "" : "s"}
          </>
        )}
      </p>

      <button
        type="button"
        className="button button-ghost receipt-disclosure"
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        <span className={`disclosure-caret${detailsOpen ? " disclosure-caret-open" : ""}`} aria-hidden="true">
          ▸
        </span>
        {detailsOpen ? "Hide details" : "View details"}
      </button>

      <div id={detailsId} className="receipt-details" hidden={!detailsOpen}>
        <ul className="receipt-rows">
          {receipt.sources.map((source) => (
            <li key={source.id} className="receipt-source">
              <div className="receipt-source-head">
                <span className="receipt-source-title" title={source.title}>
                  {source.title}
                </span>
                {source.adapter !== undefined && (
                  <span className="muted">{source.adapter.name}</span>
                )}
              </div>
              <CheckList label="Included" items={source.included} marker="✓" />
              <CheckList label="Excluded" items={source.excluded} marker="×" muted />
            </li>
          ))}
        </ul>

        {receipt.generated.length > 0 && (
          <ListBlock title="Generated" items={receipt.generated.map((entry) => entry)} />
        )}
        {receipt.unknowns.length > 0 && (
          <ListBlock title="Unknown" items={receipt.unknowns} />
        )}
        {receipt.warnings.length > 0 && (
          <ListBlock title="Warnings" items={receipt.warnings} />
        )}

        <NutritionFacts nutrition={nutrition} />
      </div>
    </section>
  );
}

function CheckList({
  label,
  items,
  marker,
  muted = false,
}: {
  label: string;
  items: string[];
  marker: string;
  muted?: boolean;
}) {
  return (
    <div className="receipt-list">
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item} className={muted ? "muted" : undefined}>
              <span className="marker" aria-hidden="true">
                {marker}
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="receipt-list">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NutritionFacts({ nutrition }: { nutrition: NonNullable<WorkbenchOutputs["nutrition"]> }) {
  const rows = [
    { label: "Source content", percent: nutrition.sourceContentPercent },
    { label: "Generated instructions", percent: nutrition.generatedPercent },
    { label: "Metadata", percent: nutrition.metadataPercent },
  ];
  return (
    <div className="nutrition">
      <h4>Context facts</h4>
      <p className="nutrition-tokens">{formatTokenStage(nutrition.estimatedTokens, "total")}</p>
      <div className="nutrition-bars">
        {rows.map((row) => (
          <div key={row.label} className="nutrition-row">
            <span className="nutrition-label">{row.label}</span>
            <div className="bar-track" role="img" aria-label={`${row.label} ${row.percent}%`}>
              <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }} />
            </div>
            <span className="nutrition-percent">{row.percent}%</span>
          </div>
        ))}
      </div>
      <dl className="nutrition-facts">
        <div>
          <dt>Sources</dt>
          <dd>{nutrition.counts.sources}</dd>
        </div>
        <div>
          <dt>Code blocks</dt>
          <dd>{nutrition.counts.codeBlocks}</dd>
        </div>
        <div>
          <dt>Tables</dt>
          <dd>{nutrition.counts.tables}</dd>
        </div>
        <div>
          <dt>Links</dt>
          <dd>{nutrition.counts.links}</dd>
        </div>
      </dl>
      <dl className="nutrition-flags">
        <div>
          <dt>Explicit acceptance criteria</dt>
          <dd>
            {nutrition.explicitAcceptanceCriteria === null
              ? "—"
              : nutrition.explicitAcceptanceCriteria
                ? "✓"
                : "✗"}
          </dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>{nutrition.provenanceComplete ? "✓" : "✗"}</dd>
        </div>
      </dl>
    </div>
  );
}

function FeedbackList({
  feedback,
  onDismiss,
}: {
  feedback: WorkbenchFeedback[];
  onDismiss(id: number): void;
}) {
  return (
    <div className="feedback-list" aria-live="polite">
      {feedback.map((entry) => (
        <div key={entry.id} className={`feedback ${feedbackClass(entry.kind)}`} role="status">
          <span>{entry.message}</span>
          <button
            type="button"
            className="feedback-dismiss"
            aria-label="Dismiss"
            onClick={() => onDismiss(entry.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function candidateTokens(item: ContextSourceItem): number {
  return estimateBlocksTokens(item.document.blocks);
}
