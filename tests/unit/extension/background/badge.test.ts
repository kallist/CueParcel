/**
 * Toolbar badge (V1.1).
 *
 * The badge shows the Context Cart source count for the window whose Side Panel
 * wrote it, so per-window ownership is structural: the caller passes its own
 * windowId and every Action call is scoped to it. These tests pin that contract
 * plus the "no badge at zero" and failure-tolerance rules.
 */
import { describe, expect, it } from "vitest";
import {
  BADGE_BACKGROUND_COLOR,
  BADGE_MAX_COUNT,
  badgeTextForCart,
  badgeTextForCount,
  createBadgeSync,
} from "../../../../src/extension/background/badge";

interface Call {
  text: string;
  windowId?: number;
}

function makeAction(overrides: { fail?: boolean } = {}) {
  const calls: Call[] = [];
  const colors: { color: string; windowId?: number }[] = [];
  return {
    calls,
    colors,
    action: {
      async setBadgeText(details: { text: string; windowId?: number }): Promise<void> {
        if (overrides.fail === true) {
          throw new Error("badge unavailable");
        }
        calls.push(details);
      },
      async setBadgeBackgroundColor(details: { color: string; windowId?: number }): Promise<void> {
        if (overrides.fail === true) {
          throw new Error("badge unavailable");
        }
        colors.push(details);
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

describe("createBadgeSync", () => {
  it("scopes every Action call to the caller's window (per-window ownership)", async () => {
    const { action, calls, colors } = makeAction();
    const sync = createBadgeSync({
      action,
      readCart: async () => ({ items: [{}, {}, {}] }),
    });

    await sync.sync(7);
    expect(calls).toEqual([{ text: "3", windowId: 7 }]);
    expect(colors).toEqual([{ color: BADGE_BACKGROUND_COLOR, windowId: 7 }]);
  });

  it("never paints another window's badge", async () => {
    const { action, calls } = makeAction();
    const carts: Record<number, unknown> = {
      1: { items: [{}, {}] },
      2: { items: [] },
    };
    const sync = createBadgeSync({ action, readCart: async (windowId) => carts[windowId] });

    await sync.sync(1);
    await sync.sync(2);

    expect(calls).toEqual([
      { text: "2", windowId: 1 },
      { text: "", windowId: 2 },
    ]);
    // Window 1 keeps its own count; window 2 is cleared, not overwritten to 2.
    expect(calls.filter((call) => call.windowId === 1)).toEqual([{ text: "2", windowId: 1 }]);
  });

  it("clears the badge when the cart becomes empty", async () => {
    const { action, calls } = makeAction();
    let items: unknown[] = [{}, {}];
    const sync = createBadgeSync({ action, readCart: async () => ({ items }) });

    await sync.sync(4);
    items = [];
    await sync.sync(4);

    expect(calls).toEqual([
      { text: "2", windowId: 4 },
      { text: "", windowId: 4 },
    ]);
  });

  it("keeps working when the Action API is unavailable", async () => {
    const sync = createBadgeSync({ action: undefined, readCart: async () => ({ items: [{}] }) });
    await expect(sync.sync(1)).resolves.toBeUndefined();
    await expect(sync.clear(1)).resolves.toBeUndefined();
  });

  it("swallows Action failures so the cart is never affected", async () => {
    const { action } = makeAction({ fail: true });
    const sync = createBadgeSync({ action, readCart: async () => ({ items: [{}] }) });
    await expect(sync.sync(1)).resolves.toBeUndefined();
  });

  it("swallows storage read failures and clears rather than guessing", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({
      action,
      readCart: async () => {
        throw new Error("session unavailable");
      },
    });
    await sync.sync(9);
    expect(calls).toEqual([{ text: "", windowId: 9 }]);
  });

  it("clears explicitly on request", async () => {
    const { action, calls } = makeAction();
    const sync = createBadgeSync({ action, readCart: async () => ({ items: [{}] }) });
    await sync.clear(3);
    expect(calls).toEqual([{ text: "", windowId: 3 }]);
  });
});
