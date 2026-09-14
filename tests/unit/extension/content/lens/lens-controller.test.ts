// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { createLensController } from "../../../../../src/extension/content/lens/lens-controller";
import { LENS_HOST_ID } from "../../../../../src/extension/content/lens/lens-engine";
import {
  LENS_ENTER_RESPONSE,
  LENS_MATERIALIZE_RESPONSE,
  LENS_STATE_EVENT,
} from "../../../../../src/extension/messaging/lens-messages";
import type {
  LensEnterResponse,
  LensMaterializeResponse,
  LensSessionRef,
} from "../../../../../src/extension/messaging/lens-messages";
import { isNormalizedDocument } from "../../../../../src/core";

const SESSION: LensSessionRef = {
  captureId: "capture-lens-1",
  url: "https://example.com/article",
  title: "Article",
  capturedAt: "2026-09-01T00:00:00.000Z",
};

type JsdomWindow = Window & { MouseEvent: typeof MouseEvent };

function makeDeps(broadcasts: unknown[] = []) {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <main>
        <h2 id="h">Section A</h2>
        <p id="p1">First paragraph with several words.</p>
        <p id="p2">Second paragraph content.</p>
      </main>
    </body></html>`,
    { url: SESSION.url },
  );
  const { document } = dom.window;
  const window = dom.window as unknown as JsdomWindow;
  const controller = createLensController({
    locationHref: () => window.location.href,
    document,
    window,
    broadcast: (message) => broadcasts.push(message),
  });
  return { controller, document, window, broadcasts };
}

/** Events must come from the SAME jsdom window as the target document. */
function clickOn(window: JsdomWindow, target: Element): void {
  const event = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  target.dispatchEvent(event);
}

async function handleEnter(controller: ReturnType<typeof createLensController>) {
  const response = (await controller.handle({
    type: "lens.enter.request",
    tabId: 7,
    session: SESSION,
  })) as LensEnterResponse;
  return response;
}

async function handleMaterialize(controller: ReturnType<typeof createLensController>) {
  const response = (await controller.handle({
    type: "lens.materialize.request",
    tabId: 7,
    session: SESSION,
  })) as LensMaterializeResponse;
  return response;
}

describe("lens controller — content script side", () => {
  it("enters lens mode for the captured page and broadcasts state", async () => {
    const { controller, document, window, broadcasts } = makeDeps();
    const response = await handleEnter(controller);
    expect(response).toMatchObject({ type: LENS_ENTER_RESPONSE, ok: true, captureId: SESSION.captureId });
    expect(response.snapshot).toEqual({ active: true, selectedCount: 0, estimatedTokens: 0 });

    // Clicking content picks a region and broadcasts a live state event.
    clickOn(window, document.getElementById("p1")!);
    expect(broadcasts.some((message: unknown) =>
      (message as { type: string }).type === LENS_STATE_EVENT &&
      (message as { snapshot?: { selectedCount?: number } }).snapshot?.selectedCount === 1,
    )).toBe(true);
  });

  it("refuses to enter when the page navigated away from the capture", async () => {
    const { controller } = makeDeps();
    const response = (await controller.handle({
      type: "lens.enter.request",
      tabId: 7,
      session: { ...SESSION, url: "https://example.com/other-page" },
    })) as LensEnterResponse;
    expect(response).toMatchObject({ ok: false, error: { code: "PAGE_NAVIGATED" } });
  });

  it("materializes picks into a validated fragment document", async () => {
    const { controller, document, window } = makeDeps();
    await handleEnter(controller);
    clickOn(window, document.getElementById("h")!);
    const response = await handleMaterialize(controller);
    expect(response.type).toBe(LENS_MATERIALIZE_RESPONSE);
    expect(response.ok).toBe(true);
    const materialization = response.materialization;
    expect(materialization).not.toBeNull();
    expect(materialization?.document).toBeDefined();
    expect(isNormalizedDocument(materialization!.document)).toBe(true);
    expect(materialization!.document.source.kind).toBe("web");
    expect(materialization!.document.capture).toEqual({
      // M-01: semantic adapter preserved, capture method recorded separately.
      adapter: { id: "generic-article", name: "Generic Article" },
      method: "context-lens",
      scope: "selection",
    });
    expect(materialization!.regions[0].label).toBe("Section A");
  });

  it("answers materialize with an empty ok when nothing is picked", async () => {
    const { controller } = makeDeps();
    await handleEnter(controller);
    const response = await handleMaterialize(controller);
    expect(response).toMatchObject({ ok: true });
    expect(response.materialization).toBeUndefined();
  });

  it("ignores unknown messages", async () => {
    const { controller } = makeDeps();
    expect(await controller.handle({ type: "something.else" })).toBeNull();
  });

  it("clears retained picks after a successful hand-off", async () => {
    const { controller, document, window } = makeDeps();
    await handleEnter(controller);
    clickOn(window, document.getElementById("p1")!);
    const clear = (await controller.handle({
      type: "lens.clear.request",
      tabId: 7,
      captureId: SESSION.captureId,
    })) as { ok: boolean };
    expect(clear.ok).toBe(true);
    const response = await handleMaterialize(controller);
    expect(response.materialization).toBeUndefined();
  });

  /**
   * HQA-03 regression.
   *
   * The panel's Lens-Strip Cancel used to call lens.clear, which only dropped
   * the picked regions. The engine stayed ACTIVE, so the overlay host, the dock
   * and the capture-phase click listener remained on the page: cancelling from
   * the panel left the user in a picking session they had just cancelled, and
   * the panel and the page disagreed about whether the lens was on. These tests
   * fail without the controller ending the session.
   */
  describe("HQA-03 — panel cancel ends the session like the dock cancel", () => {
    function lensHost(document: Document): Element | null {
      return document.getElementById(LENS_HOST_ID);
    }

    async function clearPicks(
      controller: ReturnType<typeof createLensController>,
      captureId = SESSION.captureId,
    ) {
      return (await controller.handle({
        type: "lens.clear.request",
        tabId: 7,
        captureId,
      })) as { ok: boolean };
    }

    it("removes the overlay host and stops picking when cancelled mid-session", async () => {
      const { controller, document, window } = makeDeps();
      await handleEnter(controller);
      expect(lensHost(document)).not.toBeNull();

      clickOn(window, document.getElementById("p1")!);
      expect(await clearPicks(controller)).toEqual({ ok: true, type: "lens.clear.response", captureId: SESSION.captureId });

      // The live intercepting overlay must be gone, not merely emptied.
      expect(lensHost(document)).toBeNull();
    });

    it("stops intercepting page clicks after a panel cancel", async () => {
      const { controller, document, window } = makeDeps();
      await handleEnter(controller);
      clickOn(window, document.getElementById("p1")!);
      await clearPicks(controller);

      // A click on content must now reach the page untouched: while the lens is
      // active the engine calls preventDefault() to turn clicks into picks.
      const target = document.getElementById("p2")!;
      const event = new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);

      // And nothing new is selected.
      const response = await handleMaterialize(controller);
      expect(response.materialization).toBeUndefined();
    });

    it("still drops retained picks when the session already finished with Done", async () => {
      const { controller, document, window } = makeDeps();
      await handleEnter(controller);
      clickOn(window, document.getElementById("p1")!);

      // Done: the engine deactivates but RETAINS picks for materialization.
      document
        .getElementById(LENS_HOST_ID)!
        .shadowRoot!.querySelectorAll(".p2a-button")
        .forEach((button) => {
          if (button.textContent === "Done") {
            (button as HTMLElement).click();
          }
        });
      expect(lensHost(document)).toBeNull();

      // The panel discards them after a successful hand-off.
      await clearPicks(controller);
      const response = await handleMaterialize(controller);
      expect(response.materialization).toBeUndefined();
    });
  });

  it("probes the page for an existing user text selection", async () => {
    const { controller } = makeDeps();
    const probe = (await controller.handle({
      type: "lens.selection.probe.request",
      tabId: 7,
      session: SESSION,
    })) as { ok: boolean; hasSelection: boolean };
    expect(probe.ok).toBe(true);
    expect(probe.hasSelection).toBe(false);
  });

  it("fails the text-selection capture cleanly when nothing is selected", async () => {
    const { controller } = makeDeps();
    const capture = (await controller.handle({
      type: "lens.selection.capture.request",
      tabId: 7,
      session: SESSION,
    })) as { ok: boolean; error?: { code: string } };
    expect(capture.ok).toBe(false);
    expect(capture.error?.code).toBe("NO_CONTENT_FOUND");
  });
});
