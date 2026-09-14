/**
 * Badge sync message contract (HQA-04).
 *
 * The panel builds the message and the Service Worker validates it, in two
 * different bundles. If the two sides ever disagree, the worker silently ignores
 * every report and the badge goes permanently blank — which is exactly how the
 * original badge defect hid (a rejection swallowed by a catch). These tests pin
 * the contract from both directions.
 */
import { describe, expect, it } from "vitest";
import {
  BADGE_SYNC_REQUEST,
  isBadgeSyncRequest,
} from "../../../../src/extension/messaging/runtime-messages";

/** The exact object the Side Panel sends (toolbar-deps.syncBadge). */
function panelMessage(windowId: number, count: number): unknown {
  return {
    type: BADGE_SYNC_REQUEST,
    windowId,
    count,
  };
}

describe("badge.sync.request contract", () => {
  it("accepts the message the panel actually sends", () => {
    expect(isBadgeSyncRequest(panelMessage(7, 0))).toBe(true);
    expect(isBadgeSyncRequest(panelMessage(7, 2))).toBe(true);
    expect(isBadgeSyncRequest(panelMessage(0, 99))).toBe(true);
  });

  it("uses the shared constant so the two bundles cannot drift", () => {
    expect(BADGE_SYNC_REQUEST).toBe("badge.sync.request");
    expect((panelMessage(1, 1) as { type: string }).type).toBe(BADGE_SYNC_REQUEST);
  });

  it("rejects malformed or unexpected payloads", () => {
    const invalid: unknown[] = [
      null,
      undefined,
      "badge.sync.request",
      [],
      {},
      { type: "badge.sync.request" },
      { type: BADGE_SYNC_REQUEST, windowId: 1 },
      { type: BADGE_SYNC_REQUEST, count: 1 },
      { type: BADGE_SYNC_REQUEST, windowId: 1, count: 1, extra: true },
      { type: "other.request", windowId: 1, count: 1 },
      { type: BADGE_SYNC_REQUEST, windowId: -1, count: 1 },
      { type: BADGE_SYNC_REQUEST, windowId: 1.5, count: 1 },
      { type: BADGE_SYNC_REQUEST, windowId: "1", count: 1 },
      { type: BADGE_SYNC_REQUEST, windowId: 1, count: -1 },
      { type: BADGE_SYNC_REQUEST, windowId: 1, count: Number.NaN },
      { type: BADGE_SYNC_REQUEST, windowId: 1, count: Number.POSITIVE_INFINITY },
    ];
    for (const value of invalid) {
      expect(isBadgeSyncRequest(value)).toBe(false);
    }
  });

  it("does not claim unrelated capture or lens messages", () => {
    expect(isBadgeSyncRequest({ type: "content.capture.request" })).toBe(false);
    expect(isBadgeSyncRequest({ type: "lens.enter.request" })).toBe(false);
    expect(isBadgeSyncRequest({ type: "harness.capture.request" })).toBe(false);
  });
});
