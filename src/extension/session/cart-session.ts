/**
 * Context Cart session persistence (V1.1).
 *
 * The Cart is a pure domain model; this module adapts it to
 * chrome.storage.session under one key per browser window (session-only,
 * local-first, cleared on browser shutdown). Invalid or missing records
 * degrade to an empty cart — never a crash, never a guessed cart.
 *
 * Lives in the SESSION layer, not under sidepanel/: the Side Panel is the only
 * writer, but the Service Worker legitimately needs to READ a window's Cart to
 * keep the single global toolbar badge truthful when focus changes (HQA-04).
 * Putting it here keeps that direction clean instead of making the background
 * depend on Side Panel UI code.
 */
import { createEmptyCart, isContextCart } from "../../core";
import type { ContextCart } from "../../core";
import type { SessionStorage } from "./session-storage";

export const WORKBENCH_CART_SCHEMA_VERSION = 1 as const;
export const WORKBENCH_CART_KEY_PREFIX = "page2agent.workbench.cart.v1.";

export function workbenchCartKey(windowId: number): string {
  return `${WORKBENCH_CART_KEY_PREFIX}${windowId}`;
}

export async function readCart(
  storage: SessionStorage,
  windowId: number,
): Promise<ContextCart> {
  const raw = await storage.get(workbenchCartKey(windowId));
  return isContextCart(raw) ? raw : createEmptyCart();
}

export async function saveCart(
  storage: SessionStorage,
  windowId: number,
  cart: ContextCart,
): Promise<void> {
  await storage.set(workbenchCartKey(windowId), {
    schemaVersion: WORKBENCH_CART_SCHEMA_VERSION,
    items: cart.items,
    ...(cart.undo !== undefined ? { undo: cart.undo } : {}),
  });
}

export async function clearCartRecord(
  storage: SessionStorage,
  windowId: number,
): Promise<void> {
  await storage.remove(workbenchCartKey(windowId));
}
