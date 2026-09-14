/**
 * CueParcel brand asset generator (deterministic).
 *
 * Emits the brand SVG masters and the committed extension PNG icons.
 *
 *   SVG  -> public/brand/*.svg          (authored by this script)
 *   PNG  -> public/icons/icon{16,32,48,128}.png
 *
 * The PNGs are rasterised with Playwright's bundled Chromium, which is already
 * a DEV dependency of this repository (`@playwright/test`). Nothing here is a
 * runtime dependency: the built extension only ships the finished PNGs.
 *
 * Determinism:
 *  - the mark is plain geometry (two arcs + one circle) inside a fixed 32x32
 *    viewBox, so every path coordinate is computed, never eyeballed;
 *  - each PNG is a fixed-size viewport screenshot of an SVG scaled to a known
 *    factor with `image-rendering: auto` and no animation;
 *  - the same input always produces the same geometry.
 *
 * Mark concept (locked by the brand decision):
 *   open "C"  = collect / contain / context / Cue
 *   blue dot  = the selected cue, sitting in the C's opening
 *
 * Usage: node scripts/generate-brand-assets.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = join(root, "public", "brand");
const ICON_DIR = join(root, "public", "icons");

// ---------------------------------------------------------------- palette ---
const INK = "#111318";
const CUE_BLUE = "#3157FF";
const PAPER = "#F7F7F4";
const MARK_LIGHT = INK; // mark on light backgrounds
const MARK_DARK = "#F2F3F5"; // mark on dark backgrounds
const TILE = PAPER; // extension icon tile

// ------------------------------------------------------------- geometry ----
/**
 * Everything below is expressed in a 32x32 viewBox centred on (16,16).
 *
 * OUTER_R / INNER_R give a uniform 5.6 stroke. The gap is centred on 0deg
 * (pointing right) and spans GAP_HALF_DEG either side, which leaves a vertical
 * opening of 2 * INNER_R * sin(GAP_HALF) = ~11.8 units for the cue dot.
 *
 * The dot radius is bounded by two clearances so it can never touch the arc:
 *   opening clearance : INNER_R * sin(GAP_HALF) - DOT_R
 *   radial clearance  : (INNER_R - DOT_R) - DOT_R
 */
const VIEW = 32;
const CENTRE = VIEW / 2;
const OUTER_R = 15;
const STROKE = 5.6;
const INNER_R = OUTER_R - STROKE; // 9.4
const GAP_HALF_DEG = 39;
const DOT_R = 2.85;
const DOT_CX = CENTRE + 5; // sits inside the opening

const rad = (deg) => (deg * Math.PI) / 180;
const round = (n) => Number(n.toFixed(3));

/** Point on a circle: angle measured from +x axis, y flipped for SVG. */
function polar(radius, deg) {
  return {
    x: round(CENTRE + radius * Math.cos(rad(deg))),
    y: round(CENTRE - radius * Math.sin(rad(deg))),
  };
}

const openUpper = polar(OUTER_R, GAP_HALF_DEG);
const openLower = polar(OUTER_R, -GAP_HALF_DEG);
const innerUpper = polar(INNER_R, GAP_HALF_DEG);
const innerLower = polar(INNER_R, -GAP_HALF_DEG);

/** Open C traced as one filled path: outer arc, then back along the inner arc. */
const C_PATH = [
  `M ${openUpper.x} ${openUpper.y}`,
  `A ${OUTER_R} ${OUTER_R} 0 1 1 ${openLower.x} ${openLower.y}`,
  `L ${innerLower.x} ${innerLower.y}`,
  `A ${INNER_R} ${INNER_R} 0 1 0 ${innerUpper.x} ${innerUpper.y}`,
  "Z",
].join(" ");

/** Derived clearances, asserted below so the geometry cannot silently degrade. */
const GEOMETRY_REPORT = {
  viewBox: `${VIEW}x${VIEW}`,
  stroke: STROKE,
  outerDiameter: OUTER_R * 2,
  innerDiameter: INNER_R * 2,
  gapHalfDeg: GAP_HALF_DEG,
  gapClearHeight: round(2 * INNER_R * Math.sin(rad(GAP_HALF_DEG))),
  dotDiameter: DOT_R * 2,
  openingClearanceEachSide: round(INNER_R * Math.sin(rad(GAP_HALF_DEG)) - DOT_R),
  radialClearance: round(INNER_R - 2 * DOT_R),
  cPath: C_PATH,
  upperOuter: openUpper,
  lowerOuter: openLower,
  innerUpper,
  innerLower,
  dot: { cx: DOT_CX, cy: CENTRE, r: DOT_R },
};

// --------------------------------------------------------------- SVGs ------
/** Mark only: no tile, so it works on any background. */
function markSvg({ ink, tile = null, size = VIEW }) {
  const tileRect =
    tile === null
      ? ""
      : `  <rect x="0" y="0" width="${VIEW}" height="${VIEW}" rx="7" fill="${tile}"/>\n`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${size}" height="${size}" role="img" aria-hidden="true" focusable="false">
${tileRect}  <path d="${C_PATH}" fill="${ink}"/>
  <circle cx="${DOT_CX}" cy="${CENTRE}" r="${DOT_R}" fill="${CUE_BLUE}"/>
</svg>
`;
}

/**
 * Wordmark. Deliberately font-free: the "CueParcel" text is NOT converted to
 * paths here (that would mean redistributing a font's outlines), and no font
 * file is committed. The SVG references a generic sans-serif stack so it renders
 * with the viewer's system font; product UI uses real text with the app font.
 */
function wordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 48" width="220" height="48" role="img" aria-label="CueParcel">
  <g transform="translate(4 8) scale(1)">
    <path d="${C_PATH}" fill="${INK}"/>
    <circle cx="${DOT_CX}" cy="${CENTRE}" r="${DOT_R}" fill="${CUE_BLUE}"/>
  </g>
  <text x="52" y="32" font-family="Inter, 'Segoe UI', system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" letter-spacing="-0.4" fill="${INK}">CueParcel</text>
</svg>
`;
}

const FILES = {
  "cueparcel-mark.svg": markSvg({ ink: MARK_LIGHT }),
  "cueparcel-mark-dark.svg": markSvg({ ink: MARK_DARK }),
  "cueparcel-wordmark.svg": wordmarkSvg(),
};

// --------------------------------------------------------------- PNGs ------
/** Icon tile geometry: mark inset inside a rounded square, at a fixed ratio. */
const ICON_INSET_RATIO = 1.5 / 32; // 3% padding each side
const ICON_RADIUS_RATIO = 7 / 32;

function iconHtml(size) {
  const inset = round(size * ICON_INSET_RATIO);
  const inner = size - inset * 2;
  const scale = round(inner / VIEW);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}
    svg{display:block;image-rendering:auto}
  </style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${round(size * ICON_RADIUS_RATIO)}" fill="${TILE}"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <path d="${C_PATH}" fill="${MARK_LIGHT}"/>
    <circle cx="${DOT_CX}" cy="${CENTRE}" r="${DOT_R}" fill="${CUE_BLUE}"/>
  </g>
</svg>
</body></html>`;
}

const ICON_SIZES = [16, 32, 48, 128];

async function renderIcons() {
  const browser = await chromium.launch();
  try {
    for (const size of ICON_SIZES) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      await page.setContent(iconHtml(size), { waitUntil: "load" });
      const buffer = await page.screenshot({
        omitBackground: false,
        clip: { x: 0, y: 0, width: size, height: size },
      });
      await page.close();
      await writeFile(join(ICON_DIR, `icon${size}.png`), buffer);
      console.log(`  wrote public/icons/icon${size}.png (${buffer.length} bytes, ${size}x${size})`);
    }
  } finally {
    await browser.close();
  }
}

// --------------------------------------------------------------- main ------
await mkdir(BRAND_DIR, { recursive: true });
await mkdir(ICON_DIR, { recursive: true });

for (const [name, contents] of Object.entries(FILES)) {
  await writeFile(join(BRAND_DIR, name), contents, "utf8");
  console.log(`  wrote public/brand/${name}`);
}

// Fail loudly if the computed geometry drifts out of the approved envelope.
const problems = [];
if (GEOMETRY_REPORT.openingClearanceEachSide < 1.3) {
  problems.push(`cue dot sits too close to the C opening (${GEOMETRY_REPORT.openingClearanceEachSide})`);
}
if (GEOMETRY_REPORT.radialClearance <= 0) {
  problems.push(`cue dot would touch the inner arc (${GEOMETRY_REPORT.radialClearance})`);
}
if (GEOMETRY_REPORT.gapClearHeight <= GEOMETRY_REPORT.dotDiameter) {
  problems.push("the C opening is narrower than the cue dot");
}
if (problems.length > 0) {
  console.error("\nBrand geometry violation:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("\nGeometry:");
console.log(JSON.stringify(GEOMETRY_REPORT, null, 2));
console.log("\nRasterising icons with Playwright's bundled Chromium...");
await renderIcons();
console.log("\nBrand assets generated.");
