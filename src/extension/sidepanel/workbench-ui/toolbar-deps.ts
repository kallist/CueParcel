/**
 * Toolbar + onboarding chrome bindings for the Side Panel.
 *
 * Kept in one module so App stays testable with fakes: the panel never touches
 * `chrome.*` directly for these features.
 */
import { createBadgeSync } from "../../background/badge";
import type { BadgeSync } from "../../background/badge";
import { readCart } from "../workbench/cart-session";
import { chromeSessionStorage } from "../../session/session-storage";
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
  /** Mirror the Cart count onto this window's toolbar badge. */
  syncBadge(windowId: number): Promise<void>;
  /** Should the pin onboarding be shown for this window? */
  onboardingDecision(): Promise<OnboardingDecision>;
  dismissOnboarding(): Promise<void>;
  /** Positional safety net: re-sync on first paint if the window is known. */
  currentWindowId(): Promise<number | null>;
}

export function createProductionToolbarDeps(): ToolbarDeps {
  const badge: BadgeSync = createBadgeSync({
    action: typeof chrome !== "undefined" ? chrome.action : undefined,
    readCart: (windowId) => readCart(chromeSessionStorage, windowId),
  });

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
    syncBadge: (windowId) => badge.sync(windowId),
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
