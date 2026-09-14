/**
 * Toolbar badge (V1.1) — Context Cart source count.
 *
 * ============================ WHY THIS SUITE CHANGED ========================
 * The first V1.1 suite asserted `setBadgeText({ text, windowId })` and passed,
 * because it stubbed the Action API with a fake that accepted `windowId`.
 * Human QA (HQA-04) showed the real Chrome API rejects that property
 * ("Unexpected property: 'windowId'"), so the production badge never painted —
 * the test was pinning a contract the platform does not implement.
 *
 * These tests now pin the ACTUAL Chrome semantics: the badge is global, the
 * focused window owns the displayed value, and a non-focused window can never
 * paint. Deliberately, no test passes `windowId` to the Action API.
 * ===========================================================================
 */
import { describe, expect, it } from "vitest";
import {
  BADGE_BACKGROUND_COLOR,
  BADGE_MAX_COUNT,
  badgeTextForCart,
  badgeTextForCount,
  createBadgeSync,
  normalizeWindowId,
} from "../../../../src/extension/background/badge";

interface Call {
  text: string;
}

type ActionOptions = { fail?: boolean; rejectWindowId?: boolean };

/**
 * A fake modelled on real Chrome: it accepts ONLY the properties Chrome
 * declares, so reintroducing `windowId` fails loudly instead of silently.
 */
function makeAction(overrides: ActionOptions = {}) {
  const calls: Call[] = [];
  const colors: { color: string }[] = [];
  const assertAllowed = (details: Record<string, unknown>): void => {
    if (overrides.rejectWindowId === true && "windowId" in details) {
      throw new Error(
        "Error in invocation of action.setBadgeText(object details): Unexpected property: 'windowId'.",
      );
    }
    const allowed = new Set(["text", "color"]);
    for (const key of Object.keys(details)) {
      if (!allowed.has(key)) {
        throw new Error(`Unexpected property: '${key}'`);
      }
    }
  };
  return {
    calls,
    colors,
    action: {
      async setBadgeText(details: { text: string }): Promise<void> {
        assertAllowed(details as unknown as Record<string, unknown>);
        if (overrides.fail === true) {
          throw new Error("badge unavailable");
        }
        calls.push({ text: details.text });
      },
      async setBadgeBackgroundColor(details: { color: string }): Promise<void> {
        assertAllowed(details as unknown as Record<string, unknown>);
        if (overrides.fail === true) {
          throw new Error("badge unavailable");
        }
        colors.push({ color: details.color });
      },
    },
  };
}

describe("badgeTextForCount", () => {
  it("shows nothing for zero so no misleading '0' badge appears", () => {
    expect(badgeTextForCount(0)).toBe("");
    expect(badgeTextForCount(-3)).toBe("");
  });

  it("shows the real count up to the readable maximum", () => {
    expect(badgeTextForCount(1)).toBe("1");
    expect(badgeTextForCount(2)).toBe("2");
    expect(badgeTextForCount(3)).toBe("3");
    expect(badgeTextForCount(12)).toBe("12");
    expect(badgeTextForCount(BADGE_MAX_COUNT)).toBe("99");
  });

  it("caps larger counts instead of overflowing the badge", () => {
    expect(badgeTextForCount(BADGE_MAX_COUNT + 1)).toBe("99+");
    expect(badgeTextForCount(5000)).toBe("99+");
  });

  it("tolerates non-finite input", () => {
    expect(badgeTextForCount(Number.NaN)).toBe("");
    expect(badgeTextForCount(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("badgeTextForCart", () => {
  it("reads the item count from a stored cart record", () => {
    expect(badgeTextForCart({ schemaVersion: 1, items: [{}, {}] })).toBe("2");
  });

  it("degrades to no badge for missing or malformed records", () => {
    expect(badgeTextForCart(null)).toBe("");
    expect(badgeTextForCart(undefined)).toBe("");
    expect(badgeTextForCart("nope")).toBe("");
    expect(badgeTextForCart([])).toBe("");
    expect(badgeTextForCart({ items: "nope" })).toBe("");
    expect(badgeTextForCart({ schemaVersion: 1 })).toBe("");
  });
});

describe("normalizeWindowId", () => {
  it("accepts real window ids and rejects the no-window sentinel", () => {
    expect(normalizeWindowId(7)).toBe(7);
    expect(normalizeWindowId(0)).toBe(0);
    // Chrome reports WINDOW_ID_NONE (-1) while nothing is focused.
    expect(normalizeWindowId(-1)).toBeNull();
    expect(normalizeWindowId(undefined)).toBeNull();
    expect(normalizeWindowId("7")).toBeNull();
    expect(normalizeWindowId(1.5)).toBeNull();
  });
});

describe("createBadgeSync — real Chrome Action API semantics", () => {
  it("never passes windowId to the Action API (the HQA-04 regression)", async () => {
    // rejectWindowId models real Chrome: if the implementation ever goes back
    // to a window-scoped call, this test fails instead of silently painting
    // nothing, which is exactly how HQA-04 hid.
    const { action, calls } = makeAction({ rejectWindowId: true });
    const sync = createBadgeSync({ action });

    await sync.setFocusedWindow(7, 2);
    expect(calls).toEqual([{ text: "2" }]);
  });

  it("paints the focused window's count and refuses a background window's", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action });

    await sync.setFocusedWindow(1, 2);
    expect(calls).toEqual([{ text: "2" }]);

    // Window 2 is not focused: its write must be dropped, not displayed,
    // however many times it reports.
    await sync.sync(2, 0);
    await sync.sync(2, 99);
    expect(calls).toEqual([{ text: "2" }]);

    // The focused window's own updates apply.
    await sync.sync(1, 3);
    expect(calls).toEqual([{ text: "2" }, { text: "3" }]);
  });

  it("ignores every write until a focused window is known", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action });

    // Before any focus event nothing may be painted: an unowned count could
    // belong to another window.
    await sync.sync(1, 2);
    await sync.sync(2, 5);
    expect(calls).toEqual([]);
    expect(sync.focusedWindow()).toBeNull();
  });

  it("replaces the badge on focus change so no stale count survives", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action });

    await sync.setFocusedWindow(1, 2);
    // Focus moves to window 2, whose cart is empty.
    await sync.setFocusedWindow(2, 0);

    expect(calls).toEqual([{ text: "2" }, { text: "" }]);
    expect(sync.focusedWindow()).toBe(2);
  });

  it("clears the badge when no window is focused", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action });

    await sync.setFocusedWindow(1, 4);
    await sync.clear();

    expect(calls).toEqual([{ text: "4" }, { text: "" }]);
    expect(sync.focusedWindow()).toBeNull();
  });

  it("clears the badge when the cart becomes empty", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action });

    await sync.setFocusedWindow(4, 2);
    await sync.sync(4, 0);

    expect(calls).toEqual([{ text: "2" }, { text: "" }]);
  });

  it("drops a stale update that arrives after a focus change", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action });

    // Window 1 is focused with 2 sources.
    await sync.setFocusedWindow(1, 2);
    // Focus moves to window 2 (empty).
    await sync.setFocusedWindow(2, 0);
    // Window 1's Side Panel finally delivers its queued update.
    await sync.sync(1, 2);

    expect(calls).toEqual([{ text: "2" }, { text: "" }]);
    expect(sync.focusedWindow()).toBe(2);
  });

  it("keeps working when the Action API is unavailable", async () => {
    const sync = createBadgeSync({ action: undefined });
    await expect(sync.setFocusedWindow(1, 1)).resolves.toBeUndefined();
    await expect(sync.sync(1, 1)).resolves.toBeUndefined();
    await expect(sync.clear()).resolves.toBeUndefined();
  });

  it("swallows Action write failures so the cart is never affected", async () => {
    const { action } = makeAction({ fail: true });
    const sync = createBadgeSync({ action });
    await expect(sync.setFocusedWindow(1, 1)).resolves.toBeUndefined();
    await expect(sync.sync(1, 2)).resolves.toBeUndefined();
  });

  it("uses the accent colour only when there is text to show", async () => {
    const { action, calls, colors } = makeAction();
    const sync = createBadgeSync({ action });

    await sync.setFocusedWindow(3, 2);
    await sync.sync(3, 0);

    expect(colors).toEqual([{ color: BADGE_BACKGROUND_COLOR }]);
    expect(calls).toEqual([{ text: "2" }, { text: "" }]);
  });
});
