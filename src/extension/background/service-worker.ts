/**
 * MV3 Service Worker — production action → exact-tab capture orchestration.
 *
 * The toolbar action is both the product trigger and the activeTab grant. The
 * tab supplied by chrome.action.onClicked is captured directly; the Side Panel
 * only restores session state and never guesses or requests another tab.
 */
import { createActionClickHandler } from "./action-capture";
import { captureExactTab, chromeCaptureRuntimeDeps } from "./capture";
import { handleLensRoutedRequest } from "./lens-route";
import { createBadgeSync, normalizeWindowId } from "./badge";
import { isHarnessCaptureRequest, isBadgeSyncRequest } from "../messaging/runtime-messages";
import { isLensRoutedRequest } from "../messaging/lens-messages";
import { chromeSessionStorage } from "../session/session-storage";
import { readCart } from "../session/cart-session";

const handleActionClick = createActionClickHandler({
  storage: chromeSessionStorage,
  openSidePanel: (windowId) => chrome.sidePanel.open({ windowId }),
  capture: (captureId, target) =>
    captureExactTab(captureId, target, chromeCaptureRuntimeDeps),
  createCaptureId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
});

function disableAutomaticPanelAction(): void {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => undefined);
}

/**
 * Toolbar badge ownership (HQA-04).
 *
 * Chrome has NO per-window action badge — `setBadgeText({ windowId })` is
 * rejected as an unknown property — so the badge can only ever show one count.
 * The window the user is actually looking at owns that value: when focus
 * changes, the focused window's Cart is read from session storage (the source
 * of truth for per-window Cart state) and painted. A window that is not focused
 * can never paint, so a stale count from another window is unreachable.
 */
const badgeSync = createBadgeSync({
  action: chrome.action,
});

async function syncBadgeForFocusedWindow(windowId: unknown): Promise<void> {
  const focused = normalizeWindowId(windowId);
  if (focused === null) {
    await badgeSync.clear();
    return;
  }
  let cart: unknown;
  try {
    cart = await readCart(chromeSessionStorage, focused);
  } catch {
    cart = null; // Unreadable cart clears the badge instead of guessing.
  }
  const items = (cart as { items?: unknown } | null)?.items;
  await badgeSync.setFocusedWindow(focused, Array.isArray(items) ? items.length : 0);
}

/**
 * The panel reports its own Cart count.
 *
 * Chrome has one global action badge, so exactly one window may own it, and
 * `chrome.windows.onFocusChanged` does NOT fire for the window that already has
 * focus when the extension starts — a cold start therefore has no known
 * focused window. Two facts shape this handler:
 *
 *  1. Rejecting every write until a focus event arrived would leave the badge
 *     permanently empty (measured: every panel sync was dropped). So the
 *     focused window is seeded from the reporting panel's own claim.
 *  2. That claim alone is not trusted. It is verified against Chrome
 *     (`chrome.windows.getLastFocused()`), and once a focused window is known,
 *     a report from a DIFFERENT window is dropped instead of repainting the
 *     badge. Otherwise a background window's queued update could overwrite the
 *     count the user is looking at.
 */
export async function handleBadgeSyncMessage(message: unknown): Promise<void> {
  if (!isBadgeSyncRequest(message)) {
    return;
  }
  const { windowId, count } = message;

  if (badgeSync.focusedWindow() !== null) {
    await badgeSync.sync(windowId, count);
    return;
  }

  let focused: number | null;
  try {
    focused = normalizeWindowId((await chrome.windows.getLastFocused()).id);
  } catch {
    focused = null;
  }
  // No window API (unexpected) or a genuinely unfocused browser: trust the
  // reporting panel so a cold start still shows its count.
  if (focused === null || focused === windowId) {
    await badgeSync.setFocusedWindow(windowId, count);
  }
}

chrome.windows.onFocusChanged.addListener((windowId) => {
  void syncBadgeForFocusedWindow(windowId);
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.windows
    .getLastFocused()
    .then((browserWindow) => syncBadgeForFocusedWindow(browserWindow.id))
    .catch(() => undefined);
});

chrome.action.onClicked.addListener((tab) => {
  // Do not await before createActionClickHandler invokes sidePanel.open(): the
  // call must remain directly inside Chrome's action user-gesture event path.
  void handleActionClick(tab);
});

/**
 * Playwright cannot reliably click Chrome toolbar UI to create an activeTab
 * grant. The E2E-only dist adds one localhost host permission and may emulate
 * the action tab through this gated message. Production dist has no host
 * permissions, so this test seam is fail-closed and unreachable there.
 */
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (isLensRoutedRequest(message)) {
    const fromExtensionPage = sender.url?.startsWith("chrome-extension://") === true;
    if (!fromExtensionPage) {
      return false;
    }
    void handleLensRoutedRequest(message, {
      sendMessageToTab: (tabId, lensMessage) => chrome.tabs.sendMessage(tabId, lensMessage),
    }).then(sendResponse);
    return true;
  }
  if (isBadgeSyncRequest(message)) {
    // Badge sync is accepted only from an extension page: page content must
    // never be able to paint the toolbar badge.
    const fromExtensionPage = sender.url?.startsWith("chrome-extension://") === true;
    if (!fromExtensionPage) {
      return false;
    }
    void handleBadgeSyncMessage(message).then(() => sendResponse(undefined));
    return true;
  }
  if (!isE2eHarnessBuild() || !isHarnessCaptureRequest(message)) {
    return false;
  }
  const fromExtensionPage = sender.url?.startsWith("chrome-extension://") === true;
  if (!fromExtensionPage) {
    return false;
  }
  void handleActionClick(message.tab).then(sendResponse);
  return true;
});

function isE2eHarnessBuild(): boolean {
  const hostPermissions = chrome.runtime.getManifest().host_permissions;
  return (
    Array.isArray(hostPermissions) &&
    hostPermissions.length === 1 &&
    hostPermissions[0] === "http://127.0.0.1/*"
  );
}

// setPanelBehavior is persisted by Chrome. Explicitly turn off the previous
// open-on-action behavior so existing unpacked installs dispatch onClicked.
disableAutomaticPanelAction();
chrome.runtime.onInstalled.addListener(disableAutomaticPanelAction);
