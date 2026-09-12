/**
 * Toolbar badge (V1.1) — the Context Cart source count.
 *
 * Ownership: the badge belongs to ONE browser window, and the Side Panel of
 * that window is the only writer. It therefore passes its own windowId
 * explicitly and `chrome.action.setBadgeText({ windowId })` applies the text to
 * that window's toolbar button only, so window A's cart can never paint window
 * B's badge.
 *
 * The badge is a convenience signal, never a source of truth: if the Action API
 * is unavailable or a write fails, the panel keeps working and the cart state
 * stays authoritative in chrome.storage.session.
 */

export interface BadgeApi {
  setBadgeText(details: { text: string; windowId?: number }): Promise<void>;
  setBadgeBackgroundColor?(details: { color: string; windowId?: number }): Promise<void>;
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

export interface BadgeSyncDeps {
  action: BadgeApi | undefined;
  /** Reads the persisted Cart for one window (chrome.storage.session). */
  readCart(windowId: number): Promise<unknown>;
  /** Badge colour; themed to the accent ramp. */
  color?: string;
}

export interface BadgeSync {
  sync(windowId: number): Promise<void>;
  clear(windowId: number): Promise<void>;
}

export const BADGE_BACKGROUND_COLOR = "#2563eb";

export function createBadgeSync(deps: BadgeSyncDeps): BadgeSync {
  async function apply(windowId: number, text: string): Promise<void> {
    const action = deps.action;
    if (action === undefined) {
      return; // No Action API (tests, unsupported host): badge is optional.
    }
    try {
      if (text.length > 0 && action.setBadgeBackgroundColor !== undefined) {
        await action.setBadgeBackgroundColor({
          color: deps.color ?? BADGE_BACKGROUND_COLOR,
          windowId,
        });
      }
      await action.setBadgeText({ text, windowId });
    } catch {
      // A badge failure must never disturb capture or cart behaviour.
    }
  }

  return {
    async sync(windowId: number): Promise<void> {
      let cart: unknown;
      try {
        cart = await deps.readCart(windowId);
      } catch {
        cart = null;
      }
      await apply(windowId, badgeTextForCart(cart));
    },
    async clear(windowId: number): Promise<void> {
      await apply(windowId, "");
    },
  };
}
