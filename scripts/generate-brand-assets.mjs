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
 * ============================ GEOMETRY PROVENANCE ==========================
 * Every constant below is MEASURED from the approved brand board
 * (tests/0af5cf3a-1c2d-4bf8-99a4-e210e9b712aa.png), not invented. The large
 * primary mark was isolated and measured directly:
 *
 *   blue dot    : bbox x 784-846, y 278-343  -> diameter 64.5px, centre (815.0, 310.5)
 *   C           : RANSAC circle fit over 591/591 outer-boundary points
 *                 -> centre (732.5, 310.4), outer radius 106.3px
 *   stroke      : radial profiles at 140/160/180/200/220 deg -> 24.6px mean
 *   opening     : 80 deg of the arc missing, centred on 0 deg (+x axis)
 *
 * Normalised so the C's outer diameter is 32 units (1 unit = 6.64 reference px),
 * with the C centred on the origin:
 *
 *   outer radius      16.00 units
 *   stroke             3.70 units   (11.6% of the C's height)
 *   inner radius      12.30 units
 *   opening           80 deg, centred on +x
 *   dot radius         4.85 units   (30.3% of the C's height)
 *   dot centre        12.41 units from the C centre, on the +x axis
 *   dot clearance      1.26 units of negative space between dot and C
 *
 * The dot therefore sits BESIDE the C's open mouth, not inside its cavity — that
 * offset is the whole point of the mark and is why it reads as "a cue entering
 * the C" rather than a ringed dot.
 * ===========================================================================
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

/** Round to 3 decimals so every emitted attribute is legible and stable. */
const round = (n) => Number(n.toFixed(3));

// -------------------------------------------------- measured geometry ------
/**
 * Everything below derives from the reference measurements, expressed as ratios
 * of the C's outer radius so the artwork cannot drift if the viewBox changes.
 * Measured from the brand board (see the header comment):
 *
 *   stroke / outerRadius        = 25.00  / 107.59 = 0.2324
 *   dotRadius / outerRadius     = 32.25  / 107.59 = 0.2998
 *   dotDistance / outerRadius   = 82.98  / 107.59 = 0.7712
 */
const STROKE_RATIO = 0.2324;
const DOT_RATIO = 0.2998;
const DOT_DISTANCE_RATIO = 0.7712;
const GAP_HALF_DEG = 40; // 80 deg opening, centred on +x

/**
 * Fit the drawn bounds into the master viewBox.
 *
 * The lockup spans: left edge of the C at -outerR, right edge of the dot at
 * +(dotDistance + dotR), and -outerR..+outerR vertically. So it is 2.142 outerR
 * wide and 2 outerR tall — almost square, and it fits without downscaling.
 *
 * CENTRE_X places the C's centre so the drawn span is centred in the viewBox.
 */
const VIEW = 32;
const MARGIN = 0.6;
const LEFT_EXTENT = 1; // outerR, measured left of the C centre
const RIGHT_EXTENT = DOT_DISTANCE_RATIO + DOT_RATIO; // outerR, measured right of it
const FIT_SPAN_RATIO = LEFT_EXTENT + RIGHT_EXTENT; // 2.142
/** Vertical fit only: the C is exactly 2 outerR tall. */
const OUTER_R = VIEW / 2 - MARGIN;
const STROKE = OUTER_R * STROKE_RATIO;
const INNER_R = OUTER_R - STROKE;
/** Rounded to 3 decimals so every emitted attribute is legible and stable. */
const DOT_R = round(OUTER_R * DOT_RATIO);
/** Absolute dot-centre offset from the C centre (what the SVG needs). */
const DOT_DISTANCE = round(OUTER_R * DOT_DISTANCE_RATIO);

/** Centre the drawn span horizontally; the C is vertically centred by definition. */
const DRAWN_WIDTH = OUTER_R * FIT_SPAN_RATIO;
const CENTRE_X = (VIEW - DRAWN_WIDTH) / 2 + OUTER_R;
const CENTRE_Y = VIEW / 2;

const DOT_CX = round(CENTRE_X + DOT_DISTANCE);
const DOT_CY = CENTRE_Y;

const rad = (deg) => (deg * Math.PI) / 180;

/** Point on a circle: angle from +x axis, y flipped for SVG. */
function polar(radius, deg) {
  return {
    x: round(CENTRE_X + radius * Math.cos(rad(deg))),
    y: round(CENTRE_Y - radius * Math.sin(rad(deg))),
  };
}

const openUpper = polar(OUTER_R, GAP_HALF_DEG);
const openLower = polar(OUTER_R, -GAP_HALF_DEG);
const innerUpper = polar(INNER_R, GAP_HALF_DEG);
const innerLower = polar(INNER_R, -GAP_HALF_DEG);

/** Open C as one filled path: outer arc, then back along the inner arc. */
const C_PATH = [
  `M ${openUpper.x} ${openUpper.y}`,
  `A ${round(OUTER_R)} ${round(OUTER_R)} 0 1 1 ${openLower.x} ${openLower.y}`,
  `L ${innerLower.x} ${innerLower.y}`,
  `A ${round(INNER_R)} ${round(INNER_R)} 0 1 0 ${innerUpper.x} ${innerUpper.y}`,
  "Z",
].join(" ");

/** Negative space between the dot's edge and the opening's inner ENDPOINT (mouth corner). */
function clearanceToOpeningCorner() {
  const innerEndX = CENTRE_X + INNER_R * Math.cos(rad(GAP_HALF_DEG));
  const innerEndY = CENTRE_Y - INNER_R * Math.sin(rad(GAP_HALF_DEG));
  return Math.hypot(DOT_CX - innerEndX, DOT_CY - innerEndY) - DOT_R;
}

/** Derived clearances, asserted below so the geometry cannot silently degrade. */
const GEOMETRY_REPORT = {
  viewBox: `${VIEW}x${VIEW}`,
  outerRadius: round(OUTER_R),
  outerDiameter: round(OUTER_R * 2),
  stroke: round(STROKE),
  strokeOverHeightPercent: round((STROKE / (OUTER_R * 2)) * 100),
  innerRadius: round(INNER_R),
  openingDeg: GAP_HALF_DEG * 2,
  dotRadius: round(DOT_R),
  dotDiameter: round(DOT_R * 2),
  dotDistanceFromCentre: round(DOT_DISTANCE),
  dotDiameterOverCHeightPercent: round((DOT_R / OUTER_R) * 100),
  /** Negative space between the dot and the opening's inner corner (reference ~5.4). */
  clearanceToOpeningCorner: round(clearanceToOpeningCorner()),
  /** How far the dot reaches past the C's outer edge (reference ~1.14). */
  dotExtendsPastOuterEdge: round(DOT_DISTANCE + DOT_R - OUTER_R),
  cPath: C_PATH,
  dot: { cx: round(DOT_CX), cy: round(DOT_CY), r: round(DOT_R) },
};

// --------------------------------------------------------------- SVGs ------
function markSvg({ ink, tile = null, size = VIEW }) {
  const tileRect =
    tile === null
      ? ""
      : `  <rect x="0" y="0" width="${VIEW}" height="${VIEW}" rx="${round(VIEW * (7 / 32))}" fill="${tile}"/>\n`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${size}" height="${size}" role="img" aria-hidden="true" focusable="false">
${tileRect}  <path d="${C_PATH}" fill="${ink}"/>
  <circle cx="${round(DOT_CX)}" cy="${round(DOT_CY)}" r="${DOT_R}" fill="${CUE_BLUE}"/>
</svg>
`;
}

/**
 * Wordmark. Deliberately font-free: the "CueParcel" text is NOT converted to
 * paths (that would mean redistributing a font's outlines) and no font file is
 * committed. Product UI uses real text with the app font.
 */
function wordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 232 48" width="232" height="48" role="img" aria-label="CueParcel">
  <g transform="translate(1 6) scale(1.125)">
    <path d="${C_PATH}" fill="${INK}"/>
    <circle cx="${round(DOT_CX)}" cy="${round(DOT_CY)}" r="${DOT_R}" fill="${CUE_BLUE}"/>
  </g>
  <text x="55" y="32" font-family="Inter, 'Segoe UI', system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" letter-spacing="-0.4" fill="${INK}">CueParcel</text>
</svg>
`;
}

const FILES = {
  "cueparcel-mark.svg": markSvg({ ink: MARK_LIGHT }),
  "cueparcel-mark-dark.svg": markSvg({ ink: MARK_DARK }),
  "cueparcel-wordmark.svg": wordmarkSvg(),
};

// --------------------------------------------------------------- PNGs ------
/**
 * Icon tile: a rounded square with the mark inset, so contrast stays predictable
 * on both light and dark browser chrome.
 *
 * The inset is sized so the DOT still has breathing room: the mark's right edge
 * is the dot's edge, so without enough padding the cue dot would be cropped.
 * The drawn width is FIT_SPAN_RATIO outerR = 30 units of the 32-unit viewBox, so
 * the icon pads a further 1 viewBox unit on each side.
 */
const ICON_RADIUS_RATIO = 7 / 32;
const ICON_PADDING_UNITS = 1;

function iconHtml(size) {
  const inset = round((size * ICON_PADDING_UNITS) / VIEW);
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
    <circle cx="${round(DOT_CX)}" cy="${round(DOT_CY)}" r="${DOT_R}" fill="${CUE_BLUE}"/>
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

// Fail loudly if the geometry drifts out of the approved envelope.
//
// The reference is subtle: the dot does NOT sit fully outside the C's outer
// edge. Its LEFT edge clears the C's cavity (so it is inside the open mouth),
// while its RIGHT edge extends past the C's outer edge (so it also reads as
// sitting beside the mark). Both properties are what make the lockup distinct,
// and both are asserted here.
const problems = [];
/**
 * The dot sits in the OPENING, so "cavity clearance" is the wrong test: along
 * +x there is no arc material to collide with, and in the reference the dot's
 * left edge actually overlaps the cavity's radial band. What must hold is that
 * the dot clears the arc's inner ENDPOINT (the corner of the open mouth) and
 * that it reaches past the C's outer edge so it reads as sitting beside the
 * mark. In the reference that endpoint gap is ~5.4 units.
 */
const innerEndX = CENTRE_X + INNER_R * Math.cos(rad(GAP_HALF_DEG));
const innerEndY = CENTRE_Y - INNER_R * Math.sin(rad(GAP_HALF_DEG));
const dotToEndpoint = Math.hypot(DOT_CX - innerEndX, DOT_CY - innerEndY) - DOT_R;
const extendsPastOuter = DOT_DISTANCE + DOT_R - OUTER_R;
if (dotToEndpoint < 3) {
  problems.push(`dot sits too close to the opening's inner corner (${round(dotToEndpoint)} units)`);
}
if (extendsPastOuter < 0.5) {
  problems.push(`dot does not extend past the C's outer edge (${round(extendsPastOuter)} units)`);
}
const dotPercent = (DOT_R / OUTER_R) * 100;
if (dotPercent < 28 || dotPercent > 32) {
  problems.push(`dot diameter is ${round(dotPercent)}% of the C height, approved range is 28-32%`);
}
if (GAP_HALF_DEG * 2 < 76 || GAP_HALF_DEG * 2 > 84) {
  problems.push(`opening is ${GAP_HALF_DEG * 2} deg, approved is ~80 deg`);
}
if (problems.length > 0) {
  console.error("\nBrand geometry violation:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("\nGeometry (measured from the approved brand board):");
console.log(JSON.stringify(GEOMETRY_REPORT, null, 2));
console.log("\nRasterising icons with Playwright's bundled Chromium...");
await renderIcons();
console.log("\nBrand assets generated.");
