/**
 * Toolbar badge (V1.1) — the Context Cart source count.
 *
 * ============================ WHY THIS LOOKS LIKE THIS ======================
 * The first V1.1 implementation scoped every Action call with
 * `chrome.action.setBadgeText({ text, windowId })`. Human QA (HQA-04) proved
 * that call never succeeds: Chrome rejects the property outright with
 * "Error at parameter 'details': Unexpected property: 'windowId'", and the
 * rejection was swallowed by the catch below, so NO badge was ever painted in
 * any window. MDN browser-compat-data records `details.windowId` for
 * chrome.action.setBadgeText as Chrome `version_added: false`.
 *
 * Chrome therefore has no per-window action badge, and faking one is
 * impossible. The badge is redesigned around what the API can actually do:
 *
 *  1. The badge is GLOBAL. Exactly one window can be focused at a time, so the
 *     only count a user can legitimately see belongs to the focused window.
 *     `focusChanged()` names that window; whichever cart value is applied
 *     afterwards is the focused window's, so a previously focused window's
 *     count can never linger.
 *  2. Writes are AUTHORED, not merged. Every value carries the window it came
 *     from and is dropped unless that window is the focused one, so a
 *     background window's Cart change cannot paint a count the user is not
 *     looking at.
 *  3. Per-window Cart STATE is untouched: the Cart still lives under one
 *     chrome.storage.session key per window (see cart-session.ts). Only the
 *     single badge is global.
 *  4. `focusChanged` does NOT read storage itself: reading is injected so the
 *     module stays pure, testable, and free of chrome.* dependencies.
 *  5. The badge is a convenience signal, never a source of truth. If the Action
 *     API is unavailable or a write fails, the panel keeps working and the Cart
 *     stays authoritative in storage.
 * ===========================================================================
 */

/** Minimal surface of chrome.action this module needs. */
export interface BadgeApi {
  setBadgeText(details: { text: string }): Promise<void>;
  setBadgeBackgroundColor?(details: { color: string }): Promise<void>;
}

/** Longest text the badge can render legibly; counts above this are capped. */
export const BADGE_MAX_COUNT = 99;

/** Cart count → badge text. Zero means "no badge", never a "0". */
export function badgeTextForCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return "";
  }
  const rounded = Math.floor(count);
  return rounded > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : String(rounded);
}

/**
 * Cart items → badge text. Defensive about the input because it is read from
 * storage, which is `unknown` until validated.
 */
export function badgeTextForCart(cart: unknown): string {
  if (typeof cart !== "object" || cart === null || Array.isArray(cart)) {
    return "";
  }
  const items = (cart as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return "";
  }
  return badgeTextForCount(items.length);
}

export const BADGE_BACKGROUND_COLOR = "#2563eb";

/**
 * Normalize a window id reported by Chrome.
 *
 * Chrome uses WINDOW_ID_NONE (-1) while no window is focused (for example while
 * another application is in front). That is normalized to `null` so "unknown
 * focus" never matches a real window id.
 */
export function normalizeWindowId(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
}

export interface BadgeSyncDeps {
  action: BadgeApi | undefined;
  /** Badge colour; themed to the accent ramp. */
  color?: string;
}

export interface BadgeSync {
  /**
   * A panel reports its own window's live Cart count.
   *
   * `count` comes from the panel's in-memory Cart, so the badge never races a
   * storage write. Ignored unless `windowId` is the focused window.
   */
  sync(windowId: number, count: number): Promise<void>;
  /** The focused window is now `windowId`; `count` is that window's Cart size. */
  setFocusedWindow(windowId: number, count: number): Promise<void>;
  /** No window is focused (or the id is unknown): clear the badge. */
  clear(): Promise<void>;
  /** The window currently considered focused, for callers that chain work. */
  focusedWindow(): number | null;
}

export function createBadgeSync(deps: BadgeSyncDeps): BadgeSync {
  let focusedWindowId: number | null = null;

  async function apply(text: string): Promise<void> {
    const action = deps.action;
    if (action === undefined) {
      return; // No Action API (tests, unsupported host): badge is optional.
    }
    try {
      if (text.length > 0 && action.setBadgeBackgroundColor !== undefined) {
        await action.setBadgeBackgroundColor({ color: deps.color ?? BADGE_BACKGROUND_COLOR });
      }
      await action.setBadgeText({ text });
    } catch {
      // A badge failure must never disturb capture or cart behaviour.
    }
  }

  return {
    async sync(windowId: number, count: number): Promise<void> {
      if (focusedWindowId !== windowId) {
        return; // A background window never paints the visible badge.
      }
      await apply(badgeTextForCount(count));
    },

    async setFocusedWindow(windowId: number, count: number): Promise<void> {
      focusedWindowId = windowId;
      await apply(badgeTextForCount(count));
    },

    async clear(): Promise<void> {
      focusedWindowId = null;
      await apply("");
    },

    focusedWindow(): number | null {
      return focusedWindowId;
    },
  };
}
