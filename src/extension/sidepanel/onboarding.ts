/**
 * Pin-to-toolbar onboarding (V1.1).
 *
 * Page2Agent's only entry point is the toolbar action, and a Chrome extension
 * cannot pin itself: pinning is an explicit user decision in the browser's
 * Extensions UI. So the honest product behaviour is to detect the unpinned
 * state and tell the user exactly where the pin lives — never to claim we can
 * do it for them.
 *
 * `chrome.action.getUserSettings()` is optional (older hosts lack it), so a
 * missing API degrades to "do not show onboarding" rather than guessing.
 */

export interface UserSettingsApi {
  getUserSettings?(): Promise<{ isOnToolbar?: boolean }>;
}

export type PinState = "pinned" | "unpinned" | "unknown";

/**
 * Read the real pinned state. `unknown` covers an absent API or a rejected
 * call, and callers must NOT show onboarding for it.
 */
export async function readPinState(action: UserSettingsApi | undefined): Promise<PinState> {
  if (action === undefined || typeof action.getUserSettings !== "function") {
    return "unknown";
  }
  try {
    const settings = await action.getUserSettings();
    if (settings === null || typeof settings !== "object") {
      return "unknown";
    }
    if (settings.isOnToolbar === true) {
      return "pinned";
    }
    if (settings.isOnToolbar === false) {
      return "unpinned";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Local preference key. A UI preference, never page content. */
export const ONBOARDING_DISMISSED_KEY = "page2agent.onboarding.pinDismissed.v1";

export interface OnboardingStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface OnboardingDecision {
  /** Show the first-run pin card? */
  showOnboarding: boolean;
  /** Show the small persistent hint instead? */
  showPinHint: boolean;
}

/**
 * Decide what to surface.
 * - pinned              → nothing at all.
 * - unpinned + not dismissed → the onboarding card.
 * - unpinned + dismissed     → a small, quiet hint (still truthful, still
 *                              dismissible-by-staying-dismissed).
 * - unknown                  → nothing (never guess).
 */
export async function resolveOnboardingDecision(input: {
  action: UserSettingsApi | undefined;
  storage: OnboardingStorage;
}): Promise<OnboardingDecision> {
  const pinState = await readPinState(input.action);
  if (pinState !== "unpinned") {
    return { showOnboarding: false, showPinHint: false };
  }
  let dismissed: boolean;
  try {
    dismissed = (await input.storage.get(ONBOARDING_DISMISSED_KEY)) === true;
  } catch {
    dismissed = false; // Unreadable preference must not hide the pin guidance.
  }
  return { showOnboarding: !dismissed, showPinHint: dismissed };
}

export async function dismissOnboarding(storage: OnboardingStorage): Promise<void> {
  try {
    await storage.set(ONBOARDING_DISMISSED_KEY, true);
  } catch {
    // A failed preference write only means the card may reappear.
  }
}

/** Truthful, static copy — the extension genuinely cannot pin itself. */
export const ONBOARDING_STEPS = [
  {
    title: "Pin Page2Agent",
    detail: "Open Chrome's Extensions menu (puzzle icon) and pin Page2Agent for one-click access.",
  },
  {
    title: "Pick Context",
    detail: "Capture a page, then select exactly the sections that matter with Context Lens.",
  },
  {
    title: "Send to Agent",
    detail: "Choose a recipe and copy a structured, source-grounded task.",
  },
] as const;

export const PIN_HINT_TEXT =
  "Pin Page2Agent from Chrome's Extensions menu for one-click access.";

/**
 * Keyboard shortcut hint; the manifest registers the real binding.
 *
 * Alt+Shift+Y, not Alt+Shift+P: Chrome reserves Alt+Shift+P for its own
 * "Pin tab" command, so a suggested_key of Alt+Shift+P is silently left
 * unassigned and the shortcut never works (HQA Test 22). Alt+Shift+Y assigns
 * cleanly. Keep this constant in sync with public/manifest.json — a test pins
 * the two together.
 */
export const SHORTCUT_HINT = "Keyboard: Alt+Shift+Y";
