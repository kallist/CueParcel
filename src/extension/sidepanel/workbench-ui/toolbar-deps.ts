/**
 * Toolbar + onboarding chrome bindings for the Side Panel.
 *
 * Kept in one module so App stays testable with fakes: the panel never touches
 * `chrome.*` directly for these features.
 *
 * Badge ownership (HQA-04): Chrome has no per-window action badge, so the
 * panel cannot paint "its own" badge. It reports its authoritative Cart count
 * to the Service Worker, which decides whether this panel's window is the
 * focused one and therefore whether the count may be displayed. The panel keeps
 * owning the Cart; the worker owns the single global badge.
 */
import { BADGE_SYNC_REQUEST } from "../../messaging/runtime-messages";
import {
  dismissOnboarding,
  resolveOnboardingDecision,
} from "../onboarding";
import type { OnboardingDecision } from "../onboarding";

/** chrome.storage.local adapter for the single onboarding preference. */
const chromeLocalStorage = {
  async get(key: string): Promise<unknown> {
    const data = await chrome.storage.local.get(key);
    return data[key];
  },
  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
};

export interface ToolbarDeps {
  /**
   * Report this window's authoritative Context Cart count.
   *
   * The count is the panel's live in-memory Cart length, so the badge never
   * races a storage write. `windowId` identifies the author so the worker can
   * reject a count belonging to a window the user is not looking at.
   */
  syncBadge(windowId: number, count: number): Promise<void>;
  /** Should the pin onboarding be shown for this window? */
  onboardingDecision(): Promise<OnboardingDecision>;
  dismissOnboarding(): Promise<void>;
  /** Positional safety net: re-sync on first paint if the window is known. */
  currentWindowId(): Promise<number | null>;
}

export function createProductionToolbarDeps(): ToolbarDeps {
  async function currentWindowId(): Promise<number | null> {
    try {
      const browserWindow = await chrome.windows.getCurrent();
      const windowId = browserWindow.id;
      return typeof windowId === "number" && Number.isSafeInteger(windowId) && windowId >= 0
        ? windowId
        : null;
    } catch {
      return null;
    }
  }

  return {
    async syncBadge(windowId, count): Promise<void> {
      try {
        await chrome.runtime.sendMessage({
          type: BADGE_SYNC_REQUEST,
          windowId,
          count,
        });
      } catch {
        // The badge is a convenience signal: a messaging failure must never
        // disturb the Cart or the panel.
      }
    },
    onboardingDecision: () =>
      resolveOnboardingDecision({
        action: typeof chrome !== "undefined" ? chrome.action : undefined,
        storage: chromeLocalStorage,
      }),
    dismissOnboarding: () => dismissOnboarding(chromeLocalStorage),
    currentWindowId,
  };
}

/** No-op bindings for tests and non-extension hosts. */
export function createNullToolbarDeps(): ToolbarDeps {
  return {
    syncBadge: async () => undefined,
    onboardingDecision: async () => ({ showOnboarding: false, showPinHint: false }),
    dismissOnboarding: async () => undefined,
    currentWindowId: async () => null,
  };
}
