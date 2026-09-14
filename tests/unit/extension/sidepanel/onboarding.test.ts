/**
 * Pin-to-toolbar onboarding (V1.1).
 *
 * The extension cannot pin itself, so the only honest behaviours are: detect
 * the state, tell the user where the pin lives, and stay quiet when the state
 * is unknown. These tests pin that contract plus dismissal persistence.
 */
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_DISMISSED_KEY,
  PIN_HINT_TEXT,
  dismissOnboarding,
  readPinState,
  resolveOnboardingDecision,
} from "../../../../src/extension/sidepanel/onboarding";
import type { OnboardingStorage } from "../../../../src/extension/sidepanel/onboarding";

function makeStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const storage: OnboardingStorage & { data: Record<string, unknown> } = {
    data,
    async get(key) {
      return data[key];
    },
    async set(key, value) {
      data[key] = value;
    },
  };
  return storage;
}

describe("readPinState", () => {
  it("reports pinned when the toolbar button is present", async () => {
    expect(await readPinState({ getUserSettings: async () => ({ isOnToolbar: true }) })).toBe(
      "pinned",
    );
  });

  it("reports unpinned when the toolbar button is absent", async () => {
    expect(await readPinState({ getUserSettings: async () => ({ isOnToolbar: false }) })).toBe(
      "unpinned",
    );
  });

  it("reports unknown when the API is missing (older hosts)", async () => {
    expect(await readPinState(undefined)).toBe("unknown");
    expect(await readPinState({})).toBe("unknown");
  });

  it("reports unknown when the call rejects or returns nonsense", async () => {
    expect(
      await readPinState({
        getUserSettings: async () => {
          throw new Error("not supported");
        },
      }),
    ).toBe("unknown");
    expect(await readPinState({ getUserSettings: async () => ({}) })).toBe("unknown");
    expect(
      await readPinState({ getUserSettings: async () => null as unknown as { isOnToolbar?: boolean } }),
    ).toBe("unknown");
  });
});

describe("resolveOnboardingDecision", () => {
  it("shows nothing when the extension is already pinned", async () => {
    const decision = await resolveOnboardingDecision({
      action: { getUserSettings: async () => ({ isOnToolbar: true }) },
      storage: makeStorage(),
    });
    expect(decision).toEqual({ showOnboarding: false, showPinHint: false });
  });

  it("shows the onboarding card for a first unpinned visit", async () => {
    const decision = await resolveOnboardingDecision({
      action: { getUserSettings: async () => ({ isOnToolbar: false }) },
      storage: makeStorage(),
    });
    expect(decision).toEqual({ showOnboarding: true, showPinHint: false });
  });

  it("shows only the quiet hint after dismissal", async () => {
    const decision = await resolveOnboardingDecision({
      action: { getUserSettings: async () => ({ isOnToolbar: false }) },
      storage: makeStorage({ [ONBOARDING_DISMISSED_KEY]: true }),
    });
    expect(decision).toEqual({ showOnboarding: false, showPinHint: true });
  });

  it("shows nothing when the pin state is unknown — never guesses", async () => {
    for (const action of [undefined, {}, { getUserSettings: async () => ({}) }]) {
      const decision = await resolveOnboardingDecision({ action, storage: makeStorage() });
      expect(decision).toEqual({ showOnboarding: false, showPinHint: false });
    }
  });

  it("still guides the user when the preference cannot be read", async () => {
    const decision = await resolveOnboardingDecision({
      action: { getUserSettings: async () => ({ isOnToolbar: false }) },
      storage: {
        async get() {
          throw new Error("storage unavailable");
        },
        async set() {
          throw new Error("storage unavailable");
        },
      },
    });
    expect(decision.showOnboarding).toBe(true);
  });
});

describe("dismissOnboarding", () => {
  it("persists the dismissal so the card does not return", async () => {
    const storage = makeStorage();
    await dismissOnboarding(storage);
    expect(storage.data[ONBOARDING_DISMISSED_KEY]).toBe(true);

    const decision = await resolveOnboardingDecision({
      action: { getUserSettings: async () => ({ isOnToolbar: false }) },
      storage,
    });
    expect(decision.showOnboarding).toBe(false);
    expect(decision.showPinHint).toBe(true);
  });

  it("does not throw when the write fails", async () => {
    await expect(
      dismissOnboarding({
        async get() {
          return undefined;
        },
        async set() {
          throw new Error("quota");
        },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("onboarding copy is truthful about pinning", () => {
  it("tells the user the pin happens in Chrome, not automatically", () => {
    expect(PIN_HINT_TEXT).toMatch(/Extensions menu/);
    expect(PIN_HINT_TEXT).not.toMatch(/auto|we will pin|pins itself/i);
  });
});
