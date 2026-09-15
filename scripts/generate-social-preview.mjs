/**
 * CueParcel social preview generator (deterministic).
 *
 *   node scripts/generate-social-preview.mjs
 *
 * Emits docs/assets/cueparcel-social-preview.png (1280x640).
 *
 * WHY THIS IS RENDERED BY A BROWSER
 * The first version of this card drew its headline with a hand-rolled 5x7 bitmap
 * font, which produced exactly the pixel/terminal look the brand does not use,
 * and placed a large light product screenshot to the right of it. It failed human
 * QA on both counts: the headline collided with the screenshot and did not survive
 * social-card scaling.
 *
 * So the card is rendered as real HTML/CSS through Playwright's bundled Chromium,
 * which gives genuine font shaping and hinting at the right size. The screenshot
 * is still a REAL capture of the production build — nothing here fabricates UI.
 *
 * COMPOSITION
 *   Left  ~58%: mark + wordmark, headline, supporting line, trust line
 *   Right ~42%: ONE cropped real Side Panel view, dark theme, framed
 *   64px outer safe margin, nothing crossing the text/visual boundary
 *
 * INPUT
 *   page-qa/launch-raw/social/panel-dark-cart-fix.png (1440x3000 @3x)
 *   produced by page-qa/capture-social-panel.mjs, which drives the production
 *   build in its dark theme. If that file is absent the script fails loudly
 *   rather than substituting placeholder art.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const PANEL_SOURCE = join(root, "..", "page-qa", "launch-raw", "social", "panel-dark-cart-fix.png");
const OUT = join(root, "docs", "assets", "cueparcel-social-preview.png");

const WIDTH = 1280;
const HEIGHT = 640;
const SAFE = 64;

/* ------------------------------------------------------------- palette ----- */
/** Sampled from the approved brand board / product theme (see docs/BRAND.md). */
const GRAPHITE = "#121419"; // card background, matching the product's dark surfaces
const GRAPHITE_RAISED = "#1a1e26"; // the framed product view's own surface
const HAIRLINE = "#2a2f3a";
const INK = "#f2f3f5";
const MUTED = "#9aa3b2";
const CUE_BLUE = "#224AE6";

if (!existsSync(PANEL_SOURCE)) {
  console.error("Social preview refused: the real product capture is missing.");
  console.error(`  expected: ${PANEL_SOURCE}`);
  console.error("  run:      node page-qa/capture-social-panel.mjs");
  process.exit(1);
}

const panelBytes = await readFile(PANEL_SOURCE);
const panelDataUri = `data:image/png;base64,${panelBytes.toString("base64")}`;

/* -------------------------------------------------------------- markup ----- */
/**
 * The product view is cropped from the TOP of the real capture, which is where the
 * captured source card, the token count and the recipe row live — the parts that
 * explain the product. The crop is expressed as percentages so it is independent
 * of the capture's pixel size.
 */
const PANEL_CROP_TOP_PERCENT = 2;
const PANEL_ZOOM = 1.06;

/**
 * Type sizes are chosen so the card survives being shown small, which is how a
 * social preview is actually seen (platforms render it around 500-600px wide).
 * Measured after scaling, from the layout metadata this script emits:
 *
 *   640px wide -> headline 25.0px, support 14.0px, trust 8.5px
 *   480px wide -> headline 18.8px, support 10.5px, trust 6.4px
 *
 * The first attempt used 54/21/14 and left the supporting line at 7.9px at 480px,
 * right on the legibility floor, so the sizes were raised and the column given
 * more vertical room.
 */
const HEADLINE_PX = 50;
const SUPPORT_PX = 28;
const TRUST_PX = 17;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    background: ${GRAPHITE};
    color: ${INK};
    font-family: Inter, "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex;
    align-items: center;
  }
  .card { display: flex; align-items: center; width: 100%; padding: 0 ${SAFE}px; gap: 40px; }

  /* ---- left: the message ---- */
  .copy { flex: 0 0 58%; max-width: 58%; }
  .lockup { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
  .lockup svg { display: block; flex: none; }
  .wordmark { font-size: 27px; font-weight: 600; letter-spacing: -0.4px; color: ${INK}; }

  h1 {
    font-size: ${HEADLINE_PX}px;
    line-height: 1.14;
    font-weight: 600;
    letter-spacing: -1.3px;
    color: ${INK};
    margin-bottom: 18px;
  }
  .support { font-size: ${SUPPORT_PX}px; line-height: 1.4; color: ${MUTED}; margin-bottom: 20px; }
  .trust {
    font-size: ${TRUST_PX}px;
    line-height: 1.4;
    color: ${MUTED};
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .trust .dot { width: 6px; height: 6px; border-radius: 50%; background: ${CUE_BLUE}; flex: none; }

  /* ---- right: one real product view ---- */
  .product {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .frame {
    position: relative;
    width: 100%;
    height: 480px;
    background: ${GRAPHITE_RAISED};
    border: 1px solid ${HAIRLINE};
    border-radius: 14px;
    overflow: hidden;
  }
  .frame img {
    position: absolute;
    top: -${PANEL_CROP_TOP_PERCENT}%;
    left: 0;
    width: ${PANEL_ZOOM * 100}%;
    display: block;
  }
  /* A soft fade at the bottom edge so the crop reads as a framed view rather than
     a cut-off screenshot. */
  .frame::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 96px;
    background: linear-gradient(to bottom, rgba(18,20,25,0) 0%, rgba(18,20,25,0.92) 78%, ${GRAPHITE_RAISED} 100%);
  }
</style></head>
<body>
  <div class="card">
    <div class="copy">
      <div class="lockup">
        <svg width="46" height="46" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M 26.865 6.44 A 14.872 14.872 0 0 0 0.6 16 A 14.872 14.872 0 0 0 26.865 25.56 L 24.217 23.338 A 11.416 11.416 0 0 1 4.056 16 A 11.416 11.416 0 0 1 24.217 8.662 Z" fill="${INK}"/>
          <circle cx="26.941" cy="16" r="4.459" fill="${CUE_BLUE}"/>
        </svg>
        <span class="wordmark">CueParcel</span>
      </div>
      <h1>Pick what matters.<br>Pack it for AI.</h1>
      <p class="support">Source-grounded context for AI.</p>
      <p class="trust"><span class="dot"></span>Local-first &middot; No telemetry &middot; No API key</p>
    </div>
    <div class="product">
      <div class="frame"><img src="${panelDataUri}" alt=""></div>
    </div>
  </div>
</body></html>`;

/* -------------------------------------------------------------- render ----- */
const browser = await chromium.launch();
try {
  /**
   * Rendered at deviceScaleFactor 1 so the PNG is EXACTLY 1280x640.
   *
   * The card is a fixed-size metadata image whose dimensions are part of its
   * contract, so it must not be emitted at a scaled size. (An earlier run with
   * deviceScaleFactor 2 produced 2560x1280 — double the specified canvas.)
   * Text is still shaped by real font rasterisation, which was the point of
   * rendering through the browser at all.
   */
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  // Wait for the product image to decode, so the crop is never a blank frame.
  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
    null,
    { timeout: 20000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  // Assert the layout BEFORE writing anything: text must fit its column and the
  // headline must never reach the product view.
  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (el === null) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const copy = rect(".copy");
    const frame = rect(".frame");
    return {
      copy,
      frame,
      headline: rect("h1"),
      lockup: rect(".lockup"),
      support: rect(".support"),
      trust: rect(".trust"),
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      fontFamily: getComputedStyle(document.querySelector("h1")).fontFamily,
      headlineSize: getComputedStyle(document.querySelector("h1")).fontSize,
      supportSize: getComputedStyle(document.querySelector(".support")).fontSize,
      trustSize: getComputedStyle(document.querySelector(".trust")).fontSize,
    };
  });

  const problems = [];
  const { copy, frame, headline, lockup, support, trust } = layout;
  if (copy === null || frame === null) problems.push("copy or product frame is missing");
  if (layout.scrollWidth > 1280 || layout.scrollHeight > 640) {
    problems.push(`content overflows the canvas (${layout.scrollWidth}x${layout.scrollHeight})`);
  }
  // Nothing in the copy column may cross into the product view.
  for (const [name, box] of [["headline", headline], ["lockup", lockup], ["support", support], ["trust", trust]]) {
    if (box === null) {
      problems.push(`${name} is missing`);
      continue;
    }
    if (box.right > frame.left - 16) {
      problems.push(`${name} (right ${box.right.toFixed(1)}) reaches the product view (left ${frame.left.toFixed(1)})`);
    }
    if (box.right > 1280 - SAFE) {
      problems.push(`${name} breaks the ${SAFE}px safe margin (right ${box.right.toFixed(1)})`);
    }
    if (box.left < SAFE - 1) problems.push(`${name} breaks the left safe margin (left ${box.left.toFixed(1)})`);
  }
  if (frame.right > 1280 - SAFE + 1) problems.push(`product view breaks the right safe margin (${frame.right.toFixed(1)})`);
  if (frame.top < SAFE - 1 || frame.bottom > 640 - SAFE + 1) {
    problems.push(`product view breaks the vertical safe margin (${frame.top.toFixed(1)}..${frame.bottom.toFixed(1)})`);
  }
  // The product view must stay subordinate to the message.
  if (frame.width > 1280 * 0.45) problems.push(`product view is ${((frame.width / 1280) * 100).toFixed(1)}% of the width, expected <= 45%`);
  // A sans-serif face, never a monospace/bitmap look.
  if (/mono|courier|consolas/i.test(layout.fontFamily)) problems.push(`headline font looks monospaced: ${layout.fontFamily}`);

  if (problems.length > 0) {
    console.error("\nSocial preview refused — composition violations:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });

  // The canvas size is part of the asset's contract; assert it on the real bytes.
  const written = await readFile(OUT);
  const pngWidth = written.readUInt32BE(16);
  const pngHeight = written.readUInt32BE(20);
  if (pngWidth !== WIDTH || pngHeight !== HEIGHT) {
    console.error(`Social preview refused: emitted ${pngWidth}x${pngHeight}, expected ${WIDTH}x${HEIGHT}`);
    process.exit(1);
  }

  console.log("Composition (measured, not assumed):");
  console.log(`  canvas          : ${pngWidth}x${pngHeight} (verified from the PNG header)`);
  console.log(`  safe margin     : ${SAFE}px`);
  console.log(`  copy column     : ${copy.width.toFixed(0)}px wide, right edge ${copy.right.toFixed(0)}`);
  console.log(`  product view    : ${frame.width.toFixed(0)}x${frame.height.toFixed(0)} (${((frame.width / WIDTH) * 100).toFixed(1)}% of width), left edge ${frame.left.toFixed(0)}`);
  console.log(`  headline        : ${headline.width.toFixed(0)}x${headline.height.toFixed(0)}, right edge ${headline.right.toFixed(0)} (gap to product ${(frame.left - headline.right).toFixed(0)}px)`);
  console.log(`  headline font   : ${layout.fontFamily.split(",")[0]} at ${layout.headlineSize}`);
  console.log(`  supporting line : right edge ${support.right.toFixed(0)}`);
  console.log(`  trust line      : right edge ${trust.right.toFixed(0)}`);

  /**
   * Emit the MEASURED layout next to the asset.
   *
   * The scaled-legibility check needs to know where each text band really is and
   * what its font size really is. Hard-coding those numbers in the verifier meant
   * it inspected stale coordinates and reported a blank band that was not blank —
   * a false failure caused entirely by duplicated constants. The measurement is
   * therefore published once, here, and consumed by the verifier.
   */
  const layoutFile = join(root, "docs", "assets", "cueparcel-social-preview.layout.json");
  await writeFile(
    layoutFile,
    `${JSON.stringify(
      {
        canvas: { width: pngWidth, height: pngHeight },
        safeMargin: SAFE,
        generatedFrom: "page-qa/launch-raw/social/panel-dark-cart-fix.png",
        bands: [
          { name: "lockup", ...layout.lockup, fontSize: 27 },
          { name: "headline", ...layout.headline, fontSize: Number.parseFloat(layout.headlineSize) },
          { name: "support", ...layout.support, fontSize: Number.parseFloat(layout.supportSize) },
          { name: "trust", ...layout.trust, fontSize: Number.parseFloat(layout.trustSize) },
        ],
        product: layout.frame,
        copyColumn: layout.copy,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`  layout metadata : docs/assets/cueparcel-social-preview.layout.json`);
  console.log(`\nwrote docs/assets/cueparcel-social-preview.png (${written.length} bytes)`);
} finally {
  await browser.close();
}
