/**
 * Capture the Microsoft Edge Add-ons store imagery from the REAL product.
 *
 * WHY THIS EXISTS
 * The store needs a 300x300 logo, five 1280x800 screenshots and two promotional
 * tiles. Everything is produced from the extension's own compiled UI and from the
 * real pages it is pointed at: no mock-up, no generated interface, no redrawn
 * panel. The panel is loaded as `chrome-extension://<id>/sidepanel.html` from the
 * production `dist/` build, and page captures are triggered through the
 * extension's own `Alt+Shift+Y` command, so the production `activeTab` grant path
 * is what actually runs — the production manifest has no host permissions, and
 * this script refuses to run against a build that has any.
 *
 * TRUSTWORTHINESS RULES (the run fails rather than break one)
 *   1. The loaded build must have no host permissions.
 *   2. Every capture must resolve the adapter the screenshot claims to show. A
 *      "GitHub Issue" screenshot whose source card says "Web page" would be a
 *      false claim about the product.
 *   3. The Context Cart must really hold the number of sources the cart
 *      screenshot implies.
 *   4. The GitHub page is the real page. If github.com cannot be reached the run
 *      stops; a fixture is never presented as github.com.
 *
 * OUTPUT
 *   docs/store/edge/screenshots/01-context-lens.png     1280x800
 *   docs/store/edge/screenshots/02-context-cart.png     1280x800
 *   docs/store/edge/screenshots/03-github-issue-fix.png 1280x800
 *   docs/store/edge/screenshots/04-taskspec.png         1280x800
 *   docs/store/edge/screenshots/05-context-receipt.png  1280x800
 *   docs/store/edge/promo/logo-300.png                  300x300, transparent
 *   docs/store/edge/promo/promo-440x280.png             440x280
 *   docs/store/edge/promo/promo-1400x560.png            1400x560
 *
 * RUN
 *   npm run build
 *   node scripts/capture-store-assets.mjs
 *
 * Environment overrides (the adapter assertions still have to pass):
 *   CUEPARCEL_LENS_URL    default https://developer.mozilla.org/en-US/docs/Web/API/AbortController
 *   CUEPARCEL_DOCS_URL    default the same URL
 *   CUEPARCEL_ISSUE_URL   default https://github.com/HKUDS/RAG-Anything/issues/348
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "docs", "store", "edge", "screenshots");
const PROMO = join(ROOT, "docs", "store", "edge", "promo");

/** Composition geometry. Panel 512px = a real browser side-panel width. */
const SHOT_WIDTH = 1280;
const SHOT_HEIGHT = 800;
const PANEL_WIDTH = 512;
const PAGE_WIDTH = SHOT_WIDTH - PANEL_WIDTH;

/** Caption text on the composed canvas. Describes the feature; never sells. */
const CAPTIONS = {
  "01-context-lens": {
    title: "Context Lens",
    line: "Click the sections you mean on the page — only those go into the package.",
  },
  "02-context-cart": {
    title: "Context Cart",
    line: "Several sources in one package, each keeping its own title, URL and adapter.",
  },
  "03-github-issue-fix": {
    title: "Fix a reported issue",
    line: "A GitHub Issue and the documentation it refers to, with the Fix recipe selected.",
  },
  "04-taskspec": {
    title: "TaskSpec",
    line: "The same package as structured JSON: task, sources, verified source facts, recipe.",
  },
  "05-context-receipt": {
    title: "Context Receipt",
    line: "What is in the package, what is excluded, and the source-versus-generated split.",
  },
};

const LENS_URL =
  process.env.CUEPARCEL_LENS_URL ??
  "https://developer.mozilla.org/en-US/docs/Web/API/AbortController";
const DOCS_URL = process.env.CUEPARCEL_DOCS_URL ?? LENS_URL;
const ISSUE_URL =
  process.env.CUEPARCEL_ISSUE_URL ?? "https://github.com/HKUDS/RAG-Anything/issues/348";

const rel = (path) => path.slice(ROOT.length).replace(/^[\\/]/, "").replace(/\\/g, "/");
const log = (step, message) => console.log(`  ${step.padEnd(14)} ${message}`);
const dataUrl = (bytes) => `data:image/png;base64,${bytes.toString("base64")}`;

/**
 * What was on screen when each screenshot was taken. Written next to the images
 * as EVIDENCE.json so the captions can be checked rather than believed.
 */
const evidence = {};

/* --------------------------------------------------------------- browser ---- */

async function launch() {
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    viewport: { width: PAGE_WIDTH, height: SHOT_HEIGHT },
    deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;

  // Rule 1.
  const hostPermissions = await worker.evaluate(
    () => chrome.runtime.getManifest().host_permissions ?? null,
  );
  if (hostPermissions !== null) {
    throw new Error(
      `The loaded build declares host_permissions (${JSON.stringify(hostPermissions)}). ` +
        "Store imagery must come from the production build, which has none.",
    );
  }

  const panel = await context.newPage();
  await panel.setViewportSize({ width: PANEL_WIDTH, height: SHOT_HEIGHT });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.getByRole("heading", { level: 1, name: "CueParcel", exact: true }).waitFor();

  /**
   * The unpacked build is never pinned in this throwaway profile, so the product
   * correctly shows its first-run pin card. Dismiss it the way a user would —
   * through the product's own button — so the store screenshots show the
   * workbench rather than the onboarding.
   */
  const gotIt = panel.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await panel.waitForTimeout(400);
    log("panel", "first-run pin card dismissed via the product's own button");
  }

  log("browser", `dist loaded, extension ${extensionId}, no host permissions`);

  return { context, panel, extensionId };
}

/** Open a web page as the active tab of the same window. */
async function openTarget(context, url, { required = false } = {}) {
  const page = await context.newPage();
  await page.setViewportSize({ width: PAGE_WIDTH, height: SHOT_HEIGHT });
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (required && (response === null || !response.ok())) {
      throw new Error(`HTTP ${response?.status() ?? "no response"}`);
    }
  } catch (error) {
    if (required) {
      throw new Error(
        `Required page could not be loaded: ${url}\n  ${String(error).split("\n")[0]}\n` +
          "The run stops here on purpose: a local fixture is never presented as a real site.",
        { cause: error },
      );
    }
    log("page", `unavailable (${url}): continuing with the fixture fallback`);
    await page.goto("about:blank");
  }
  await page.bringToFront();
  await page.waitForTimeout(1200);
  await dismissConsent(page);
  return page;
}

/** Close third-party consent overlays so the page content is what is visible. */
async function dismissConsent(page) {
  for (const label of [/^accept all/i, /^accept/i, /^i agree/i, /^got it/i]) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      return;
    }
  }
}

/**
 * Trigger CueParcel's own capture command with a REAL key event.
 *
 * Playwright cannot click browser toolbar chrome, but `Alt+Shift+Y` is the
 * extension's declared `_execute_action` command and a CDP key event is a genuine
 * user gesture — so the production path runs, including the `activeTab` grant,
 * instead of a test seam.
 */
async function triggerCaptureShortcut(context, page) {
  const cdp = await context.newCDPSession(page);
  const base = {
    modifiers: 1 | 8, // Alt | Shift
    windowsVirtualKeyCode: 89, // Y
    nativeVirtualKeyCode: 89,
    key: "Y",
    code: "KeyY",
  };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  await cdp.detach();
}

/** Capture the active page and assert CueParcel resolved the expected adapter. */
async function captureSource(panel, context, page, expected) {
  await page.bringToFront();
  await triggerCaptureShortcut(context, page);
  await panel
    .getByRole("button", { name: "+ Add to Context" })
    .waitFor({ state: "visible", timeout: 25_000 });

  const title = (await panel.locator("h2.source-title").innerText()).trim();
  const url = (await panel.locator("p.source-url").innerText()).trim();
  const badges = (await panel.locator(".source-card .badge").allInnerTexts()).map((t) => t.trim());

  // Rule 2.
  if (!badges.some((badge) => badge.toLowerCase().includes(expected.toLowerCase()))) {
    throw new Error(
      `Adapter assertion failed for ${url}\n  expected a badge containing: ${expected}\n  actual: ${badges.join(" | ") || "(none)"}`,
    );
  }
  log("captured", `${badges.join(" / ")} — ${title}`);
  return { title, url, badges };
}

/**
 * Pick lens regions the way a person does.
 *
 * Context Lens deliberately does not annotate the page: there are no `data-*`
 * attributes to query, because the engine resolves the region under the pointer
 * by hit-testing semantic elements. So this reproduces the real interaction —
 * Playwright's own `locator.click()` on visible semantic blocks, which is the
 * same mechanism the repository's E2E suite uses — and then verifies that the
 * product registered the picks by reading the lens dock.
 */
async function pickLensRegions(page, wanted) {
  await page.waitForSelector(".p2a-dock", { timeout: 15_000 });
  await page.waitForTimeout(600);

  const blocks = page.locator("article h2, article p, main h2, main p, main pre");
  const total = await blocks.count();
  if (total === 0) {
    throw new Error("No pickable semantic block was present; lens shot aborted.");
  }

  let selected = 0;
  const usedY = [];
  for (let index = 0; index < total && selected < wanted; index += 1) {
    const block = blocks.nth(index);
    if (!(await block.isVisible().catch(() => false))) continue;
    const box = await block.boundingBox();
    if (box === null || box.width < 240 || box.height < 24) continue;
    if (box.y < 4 || box.y + box.height > SHOT_HEIGHT - 4) continue;
    if (usedY.some((y) => Math.abs(y - box.y) < box.height)) continue;

    await block.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    usedY.push(box.y);
    selected += 1;
  }

  // rAF does not run in a backgrounded tab, so the highlight layer is only drawn
  // once this page is the active one.
  await page.bringToFront();
  await page.waitForTimeout(600);

  const dockText = (await page.locator(".p2a-dock").innerText().catch(() => "")).replace(/\n/g, " ");
  const markers = await page.locator(".p2a-highlight").count();
  if (selected === 0 || /No context selected yet/.test(dockText)) {
    throw new Error(
      `Lens did not register a selection (tried ${selected} block(s)). Dock said: ${dockText.slice(0, 120)}`,
    );
  }
  log("lens", `${selected} block(s) clicked, dock: ${dockText.slice(0, 90)}`);
  return { selected, markers };
}

/* -------------------------------------------------------------- composing --- */

const CANVAS_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${SHOT_WIDTH}px; height: ${SHOT_HEIGHT}px; overflow: hidden;
    background: #121419; color: #f2f3f5;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    display: grid; grid-template-columns: ${PANEL_WIDTH}px 1fr; grid-template-rows: 1fr 46px;
  }
  .panel { grid-row: 1; grid-column: 1; border-right: 1px solid #2a2f3a; overflow: hidden; }
  .page  { grid-row: 1; grid-column: 2; border-left: 1px solid #2a2f3a; overflow: hidden; }
  .panel img, .page img { display: block; width: 100%; }
  .bar {
    grid-row: 2; grid-column: 1 / -1; display: flex; align-items: center; gap: 14px;
    padding: 0 22px; border-top: 1px solid #2a2f3a; background: #171b22;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #224ae6; flex: none; }
  .title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  .line { font-size: 13.5px; color: #b6bdc9; }
  .brand { margin-left: auto; font-size: 12.5px; color: #a6aebc; }
`;

/** Compose a real panel capture and a real page capture onto the store canvas. */
async function compose(context, { panelPng, pagePng, captionKey, panelText, pageText, highlightedText }) {
  const { title, line } = CAPTIONS[captionKey];
  const page = await context.newPage();
  await page.setViewportSize({ width: SHOT_WIDTH, height: SHOT_HEIGHT });
  await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>${CANVAS_CSS}</style></head><body>
  <div class="panel"><img src="${dataUrl(panelPng)}" alt=""></div>
  <div class="page"><img src="${dataUrl(pagePng)}" alt=""></div>
  <div class="bar">
    <span class="dot"></span>
    <span class="title">${title}</span>
    <span class="line">${line}</span>
    <span class="brand">CueParcel</span>
  </div>
</body></html>`);
  // Let the two data-URL images decode before the shot, or the canvas can capture
  // half-painted frames.
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))));
  const png = await page.screenshot({ type: "png" });
  await page.setViewportSize({ width: SHOT_WIDTH, height: SHOT_HEIGHT });
  await page.close();

  const out = join(SHOTS, `${captionKey}.png`);
  await writeFile(out, png);

  /**
   * Evidence log. Nobody should have to trust a caption: this records the text
   * that was actually on screen in each half at the moment of capture, so the
   * screenshot can be checked against the interface instead of against prose.
   */
  evidence[captionKey] = {
    file: rel(out),
    size: `${SHOT_WIDTH}x${SHOT_HEIGHT}`,
    panelText: collapse(panelText),
    pageText: collapse(pageText),
    ...(highlightedText === undefined ? {} : { highlightedText: collapse(highlightedText, 1200) }),
  };

  log("composed", `${rel(out)} (${SHOT_WIDTH}x${SHOT_HEIGHT})`);
  return out;
}

/** Whitespace-collapsed, length-capped text for the evidence log. */
function collapse(text, limit = 2600) {
  const flat = String(text)
    // Control characters would have to be escaped in JSON and make the log hard
    // to diff; the point of the log is readable on-screen text. `\p{Cc}` is used
    // rather than an explicit \x00-\x1f range because that range in a pattern is
    // a lint error, and the Unicode category says the same thing more clearly.
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

/** Text currently visible in a page or panel, for the evidence log. */
async function visibleText(page) {
  return page
    .evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      if (!visible(document.body)) {
        return "";
      }
      return document.body.innerText ?? "";
    })
    .catch(() => "");
}

/* ------------------------------------------------------------------ promo --- */

function tileHtml({ width, height, markSvg, panelPng }) {
  const mark = Math.round(height * 0.34);
  const gap = Math.round(width * 0.026);
  const pad = Math.round(width * 0.045);
  const shotWidth = Math.round(width * (width > 800 ? 0.30 : 0.27));
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: transparent; }
  .card {
    width: 100%; height: 100%; background: #121419; color: #f2f3f5; border: 1px solid #2a2f3a;
    display: flex; align-items: center; gap: ${gap}px; padding: 0 ${pad}px;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }
  .mark { width: ${mark}px; height: ${mark}px; flex: none; }
  .mark svg { width: 100%; height: 100%; display: block; }
  .text { display: flex; flex-direction: column; gap: ${Math.round(height * 0.04)}px; }
  .name { font-size: ${Math.round(height * 0.17)}px; font-weight: 700; letter-spacing: -0.02em; }
  .tag { font-size: ${Math.round(height * 0.082)}px; color: #c3c9d4; }
  .trust { font-size: ${Math.round(height * 0.066)}px; color: #a6aebc; }
  .shot {
    margin-left: auto; width: ${shotWidth}px; height: 100%; overflow: hidden;
    border-left: 1px solid #2a2f3a;
  }
  .shot img { display: block; width: 100%; }
</style></head><body>
  <div class="card">
    <div class="mark">${markSvg}</div>
    <div class="text">
      <span class="name">CueParcel</span>
      <span class="tag">Pick what matters. Pack it for AI.</span>
      <span class="trust">No backend · No telemetry · No API key</span>
    </div>
    <div class="shot"><img src="${dataUrl(panelPng)}" alt=""></div>
  </div>
</body></html>`;
}

async function buildPromoAndLogo(context, markSvg, panelPng) {
  const logo = await context.newPage();
  await logo.setViewportSize({ width: 300, height: 300 });
  await logo.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 300px; height: 300px; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; }
  svg { width: 214px; height: 214px; display: block; }
</style></head><body>${markSvg}</body></html>`);
  await writeFile(join(PROMO, "logo-300.png"), await logo.screenshot({ type: "png", omitBackground: true }));
  await logo.close();
  log("logo", `${rel(join(PROMO, "logo-300.png"))} (300x300, transparent)`);

  for (const [name, width, height] of [
    ["promo-440x280.png", 440, 280],
    ["promo-1400x560.png", 1400, 560],
  ]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(tileHtml({ width, height, markSvg, panelPng }));
    await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))));
    await writeFile(join(PROMO, name), await page.screenshot({ type: "png" }));
    await page.close();
    log("promo", `${rel(join(PROMO, name))} (${width}x${height})`);
  }
}

/* ------------------------------------------------------------------- main --- */

async function main() {
  await mkdir(SHOTS, { recursive: true });
  await mkdir(PROMO, { recursive: true });

  const manifestRaw = await readFile(join(DIST, "manifest.json"), "utf8").catch(() => null);
  if (manifestRaw === null) {
    throw new Error("dist/manifest.json is missing — run `npm run build` first.");
  }
  const version = JSON.parse(manifestRaw).version;
  log("build", `dist/ manifest version ${version}`);

  const markSvg = await readFile(join(ROOT, "public", "brand", "cueparcel-mark.svg"), "utf8");
  const { context, panel } = await launch();

  try {
    /* ---- 01 Context Lens on a real documentation page ---- */
    const lensPage = await openTarget(context, LENS_URL, { required: true });
    await captureSource(panel, context, lensPage, "documentation");
    await panel.getByRole("button", { name: "Pick Context" }).click();
    await lensPage.bringToFront();
    await lensPage.waitForTimeout(900);
    await pickLensRegions(lensPage, 3);
    await lensPage.waitForTimeout(400);

    // Both halves are captured from the same moment in the flow. The page half
    // is read while that tab is foregrounded (rAF-driven overlays only draw
    // then); the panel half is read once the panel is foregrounded again.
    const lensPagePng = await lensPage.screenshot({ type: "png" });
    const lensPageText = await visibleText(lensPage);
    const lensDockText = await lensPage.locator(".p2a-dock").innerText().catch(() => "");

    await panel.bringToFront();
    await panel.waitForTimeout(600);
    const lensPanelPng = await panel.screenshot({ type: "png" });
    const lensPanelText = await visibleText(panel);
    if (!/\barea(s)? picked\b|\barea(s)? selected\b/i.test(`${lensPanelText} ${lensDockText}`)) {
      throw new Error(
        "Context Lens screenshot would not show an active lens selection; aborting instead of shipping it.",
      );
    }
    await compose(context, {
      panelPng: lensPanelPng,
      pagePng: lensPagePng,
      captionKey: "01-context-lens",
      panelText: lensPanelText,
      pageText: `${lensDockText} || ${lensPageText}`,
    });

    // Finish the pick so the picked sections can enter the cart.
    await lensPage.bringToFront();
    await lensPage.locator(".p2a-dock button").last().click({ timeout: 10_000 });
    await panel.bringToFront();
    await panel.getByRole("button", { name: "Add to Context", exact: true }).click({ timeout: 15_000 });
    await panel.waitForTimeout(600);
    log("cart", "lens-picked sections added");

    /* ---- 02 Context Cart with several sources ---- */
    const docsPage = await openTarget(context, DOCS_URL, { required: true });
    await captureSource(panel, context, docsPage, "documentation");
    await panel.getByRole("button", { name: "+ Add to Context" }).click();
    await panel.waitForTimeout(600);

    const issuePage = await openTarget(context, ISSUE_URL, { required: true });
    await captureSource(panel, context, issuePage, "issue");
    await panel.getByRole("button", { name: "+ Add to Context" }).click();
    await panel.waitForTimeout(700);

    // Rule 3.
    const cartCount = await panel.locator(".cart-item").count();
    if (cartCount < 2) {
      throw new Error(
        `The Context Cart holds ${cartCount} source(s); a cart screenshot needs at least two.`,
      );
    }
    log("cart", `${cartCount} source card(s) in the Context Cart`);

    /**
     * Mark the GitHub Issue as the primary source, the way a user would.
     *
     * Without this the first item added (the lens-picked text block) stays
     * primary, and the generated task then reads "Title: Text block" — a real
     * product behaviour, but a misleading thing to put on a store screenshot.
     * The screenshots must show a package whose task is the issue.
     */
    const issueRow = panel.locator(".cart-item").filter({ hasText: "GitHub Issue" }).first();
    await issueRow.getByRole("button", { name: "Set as primary" }).click();
    await panel.waitForTimeout(800);
    const primaryText = await panel.locator(".cart-item .badge-primary").first().innerText();
    log("cart", `primary source marked (${primaryText.trim()})`);

    const agentText = (await panel.locator('[role="tabpanel"]').first().innerText()).replace(/\s+/g, " ");
    if (!/Target repository:\s*HKUDS\/RAG-Anything/i.test(agentText)) {
      throw new Error(
        "The generated task does not target the GitHub Issue repository; the screenshots would misrepresent the package.",
      );
    }
    log("output", "task output targets HKUDS/RAG-Anything, as the screenshots claim");

    const issuePagePng = await issuePage.screenshot({ type: "png" });
    const issuePageText = await visibleText(issuePage);
    await panel.bringToFront();
    await panel.waitForTimeout(400);
    const cartPanelPng = await panel.screenshot({ type: "png" });
    const cartPanelText = await visibleText(panel);
    await compose(context, {
      panelPng: cartPanelPng,
      pagePng: issuePagePng,
      captionKey: "02-context-cart",
      panelText: cartPanelText,
      pageText: issuePageText,
    });

    /* ---- 03 Fix recipe on the GitHub Issue ---- */
    const fixRecipe = panel.getByRole("radio", { name: /^Fix/ });
    if (await fixRecipe.count()) {
      await fixRecipe.click();
    } else {
      await panel.getByRole("button", { name: /^Fix/ }).first().click();
    }
    await panel.waitForTimeout(900);
    const effective = await panel
      .locator('[role="radio"][aria-checked="true"]')
      .innerText()
      .catch(() => "");
    log("recipe", `selected: ${effective.trim().split("\n")[0] || "Fix"}`);
    if (!/fix/i.test(effective)) {
      throw new Error(`The Fix recipe did not become selected (saw: ${effective.slice(0, 60)}).`);
    }

    const fixPanelPng = await panel.screenshot({ type: "png" });
    const fixPanelText = await visibleText(panel);
    if (!/Fix/i.test(fixPanelText)) {
      throw new Error("The Fix recipe is not visible in the panel text; aborting the Fix screenshot.");
    }
    await compose(context, {
      panelPng: fixPanelPng,
      pagePng: issuePagePng,
      captionKey: "03-github-issue-fix",
      panelText: fixPanelText,
      pageText: issuePageText,
    });

    /* ---- 04 TaskSpec view ---- */
    await panel.getByRole("tab", { name: "TaskSpec" }).click();
    await panel
      .getByRole("tabpanel", { name: "TaskSpec preview" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await panel.waitForTimeout(500);
    const taskSpecPanelPng = await panel.screenshot({ type: "png" });
    const taskSpecPanelText = await visibleText(panel);
    if (!/"schemaVersion"/.test(taskSpecPanelText) && !/specVersion|producer/.test(taskSpecPanelText)) {
      throw new Error("The TaskSpec preview does not contain a TaskSpec document; aborting that screenshot.");
    }
    await compose(context, {
      panelPng: taskSpecPanelPng,
      pagePng: issuePagePng,
      captionKey: "04-taskspec",
      panelText: taskSpecPanelText,
      pageText: issuePageText,
    });

    /* ---- 05 Context Receipt, details expanded ---- */
    const viewDetails = panel.getByRole("button", { name: "View details" });
    if (await viewDetails.isVisible().catch(() => false)) {
      await viewDetails.click();
      await panel.waitForTimeout(600);
      log("receipt", "details expanded");
    }
    const receiptBody = panel.locator("section.receipt .receipt-details");
    const receiptBodyText = (await receiptBody.innerText().catch(() => "")).replace(/\s+/g, " ");
    if (!/included/i.test(receiptBodyText) || !/excluded/i.test(receiptBodyText)) {
      log("receipt", `details text was: ${collapse(receiptBodyText, 300)}`);
      throw new Error(
        "The Context Receipt has no included/excluded detail to show; aborting that screenshot.",
      );
    }
    log("receipt", `details hold ${receiptBodyText.length} characters of included/excluded rows`);

    // The receipt is the last section of a longer panel, so it is scrolled into
    // view. Whether every row fits above the fold depends on the package size;
    // the EVIDENCE.json entry records exactly what the viewport held.
    await panel.locator("section.receipt").scrollIntoViewIfNeeded();
    await panel.waitForTimeout(400);
    const receiptPanelPng = await panel.screenshot({ type: "png" });
    const receiptPanelText = await visibleText(panel);
    await compose(context, {
      panelPng: receiptPanelPng,
      pagePng: issuePagePng,
      captionKey: "05-context-receipt",
      panelText: receiptPanelText,
      pageText: issuePageText,
      // The receipt is the scrolled-to section, so its rows are recorded
      // explicitly: they are the content this screenshot exists to show.
      highlightedText: `receipt details: ${receiptBodyText}`,
    });

    /* ---- logo + promotional tiles ---- */
    // The promo panel shot comes from the completed workbench, not a mock-up.
    await panel.evaluate(() => window.scrollTo(0, 0));
    await panel.waitForTimeout(400);
    const promoPanelPng = await panel.screenshot({ type: "png" });
    await buildPromoAndLogo(context, markSvg, promoPanelPng);
    evidence.promo = {
      files: ["docs/store/edge/promo/logo-300.png", "docs/store/edge/promo/promo-440x280.png", "docs/store/edge/promo/promo-1400x560.png"],
      note: "Logo is the approved mark rasterised from public/brand/cueparcel-mark.svg. Each tile pairs that mark with the tagline and a capture of the real Side Panel.",
      panelText: collapse(await visibleText(panel), 1600),
    };

    await writeFile(
      join(SHOTS, "EVIDENCE.json"),
      `${JSON.stringify(
        {
          generatedBy: "scripts/capture-store-assets.mjs",
          product: "CueParcel",
          extensionBuild: `dist/ manifest ${version}`,
          hostPermissions: "none (asserted at runtime)",
          pages: { lens: LENS_URL, docs: DOCS_URL, issue: ISSUE_URL },
          screenshots: evidence,
        },
        null,
        2,
      )}\n`,
    );
    log("evidence", `docs/store/edge/screenshots/EVIDENCE.json`);
  } finally {
    await context.close();
  }

  console.log("\nStore imagery written from the real product UI.");
}

await main();
