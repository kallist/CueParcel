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
 * with the C centred on the origin, the ratios are:
 *
 *   outer radius      16.00 units
 *   stroke             3.70 units   (11.6% of the C's height)
 *   inner radius      12.30 units
 *   opening           80 deg, centred on +x
 *   dot radius         4.85 units   (30.3% of the C's height)
 *   dot centre        12.41 units from the C centre, on the +x axis
 *   dot clearance      1.26 units of negative space between dot and C
 *
 * Those reference units are NOT the emitted ones. The emitted mark is refitted
 * into a 32-unit viewBox WITH margin, so the C comes out at 29.744 units and the
 * dot at 8.918; the ratios above are what is preserved exactly (see the measured
 * ratio constants below). The script prints the emitted geometry on every run.
 *
 * The dot therefore sits BESIDE the C's open mouth, not inside its cavity — that
 * offset is the whole point of the mark and is why it reads as "a cue entering
 * the C" rather than a ringed dot.
 * ===========================================================================
 *
 * Usage: node scripts/generate-brand-assets.mjs
 *        node scripts/generate-brand-assets.mjs --dump-html <size>   (debug: print
 *        the exact rasterisation page for one icon size and paint it, without
 *        touching any committed file)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = join(root, "public", "brand");
const ICON_DIR = join(root, "public", "icons");

// ---------------------------------------------------------------- palette ---
/**
 * Colours are SAMPLED from the approved brand board's own pixels (see
 * sample-brand-colours.mjs): the mark's C is #141720 and its cue dot is #224AE6
 * on a #FFFFFF board. Nothing here is a guess.
 *
 * CONTRAST RULE (why there are three C colours and only one dot colour):
 * the approved near-black C has 15.85:1 contrast on light chrome but only
 * 1.12:1 on dark chrome, so a single near-black icon all but disappears in a
 * dark browser. The extension icon is therefore drawn in a restrained
 * medium cool-slate that clears BOTH chromes, and never with a background tile
 * as a workaround. The cue dot stays the same vivid blue in every variant.
 *
 *   measured C #141720  vs light chrome 15.85:1 / vs dark chrome  1.12:1  (invisible)
 *   toolbar  C #66779A  vs light chrome  3.98:1 / vs dark chrome  3.54:1  (balanced)
 *   dot      #224AE6    vs light chrome  5.83:1 / vs dark chrome  2.42:1
 */
const CUE_BLUE = "#224AE6"; // sampled from the reference dot
const MARK_LIGHT = "#141720"; // sampled from the reference C — light surfaces
const MARK_DARK = "#F2F3F5"; // off-white C — dark surfaces (Side Panel)
const MARK_TOOLBAR = "#66779A"; // contrast adaptation for the transparent icon only
const WORDMARK_INK = "#141720";

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
 * Fit the drawn lockup into the master viewBox.
 *
 * The horizontal extents are measured from the C's centre, in outerR units:
 *
 *   left  = 1                      the C's own outer edge
 *   right = max(arc, dot)          whichever reaches further:
 *           arc = cos(40) + stroke/2 = 0.766 + 0.116 = 0.882
 *           dot = dotDistance + dotR = 0.771 + 0.300 = 1.071   <- the wider one
 *
 * So the mark spans 2.071 outerR across, not the 2.142 that assuming the dot is
 * the rightmost element gives, and NOT 1 + 1.112 either: the right extent is
 * measured to the DOT's edge while the left is measured to the C's. Deriving
 * outerR from that span keeps the mark centred with equal side margins; getting
 * this wrong is what previously pushed the dot outside the viewBox and clipped
 * the C against the icon edge.
 */
const VIEW = 32;
const MARGIN = 0.6;
const LEFT_EXTENT_RATIO = 1;
const ARC_RIGHT_EXTENT_RATIO = Math.cos((GAP_HALF_DEG * Math.PI) / 180) + STROKE_RATIO / 2;
const DOT_RIGHT_EXTENT_RATIO = DOT_DISTANCE_RATIO + DOT_RATIO;
const RIGHT_EXTENT_RATIO = Math.max(ARC_RIGHT_EXTENT_RATIO, DOT_RIGHT_EXTENT_RATIO);
const FIT_SPAN_RATIO = LEFT_EXTENT_RATIO + RIGHT_EXTENT_RATIO;
/**
 * The C is exactly 2 outerR tall and the mark is FIT_SPAN_RATIO wide, so the
 * outerR that fits both dimensions with MARGIN on every side is the smaller of
 * the two allowances.
 */
const OUTER_R = Math.min(
  (VIEW - 2 * MARGIN) / 2, // vertical
  (VIEW - 2 * MARGIN) / FIT_SPAN_RATIO, // horizontal
);
const STROKE = OUTER_R * STROKE_RATIO;
const INNER_R = OUTER_R - STROKE;
/** Rounded to 3 decimals so every emitted attribute is legible and stable. */
const DOT_R = round(OUTER_R * DOT_RATIO);
/** Absolute dot-centre offset from the C centre (what the SVG needs). */
const DOT_DISTANCE = round(OUTER_R * DOT_DISTANCE_RATIO);

/**
 * The C's centre. Its left edge is exactly MARGIN from the left, and because
 * OUTER_R already accounts for the wider right-hand extent, the mark's right
 * edge lands on MARGIN from the right too. The C is vertically centred by
 * definition (it is the tallest element).
 */
const CENTRE_X = MARGIN + OUTER_R;
const CENTRE_Y = VIEW / 2;

/**
 * Drawn bounds in master units, derived from the ratios rather than assumed from
 * the nominal radius — the dot's edge reaches past the C's outer edge, and the
 * C's stroked arc reaches past its own nominal endpoint. The guard below and the
 * icon transform both consume these, so neither can under-measure the mark.
 */
const MARK_LEFT = CENTRE_X - OUTER_R;
const MARK_RIGHT = CENTRE_X + OUTER_R * RIGHT_EXTENT_RATIO;
const MARK_TOP = CENTRE_Y - OUTER_R;
const MARK_BOTTOM = CENTRE_Y + OUTER_R;

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

/**
 * Arc endpoints for the C's body.
 *
 * SVG's arc command has two traps, and both of them bit this file:
 *
 *  1. A single command cannot draw more than 180 degrees. Asking for the whole
 *     280 deg body in one `A` makes the renderer draw the 80 deg COMPLEMENT
 *     instead, silently turning the C into two stubby stroke ends.
 *  2. `sweep-flag` cannot simply be reasoned about from the math: it is the
 *     direction of the (sweep *and* large-arc) chosen arc, in screen space. In
 *     this viewBox (y down, angles counter-clockwise from +x) a command costs
 *     -sweep * span, so sweep=0 spans FORWARD.
 *
 * Therefore: split the body into ARC_SEGMENTS equal pieces of <=180 deg each and
 * use sweep=0 with large-arc-flag=0, which unambiguously draws that forward span.
 * Measured on the committed master with probe-path.mjs.
 */
const bodyStartDeg = GAP_HALF_DEG; // 40, the upper mouth corner
const ARC_SEGMENTS = 2;
const bodySpanDeg = 360 - GAP_HALF_DEG * 2; // 280
const segmentDeg = bodySpanDeg / ARC_SEGMENTS; // 140 <= 180

/** Points along the C's body at a fraction of the body arc. */
const bodyPoint = (radius, fraction) =>
  polar(radius, bodyStartDeg + segmentDeg * fraction);

const outerPts = Array.from({ length: ARC_SEGMENTS + 1 }, (_, i) => bodyPoint(OUTER_R, i));
const innerPts = Array.from({ length: ARC_SEGMENTS + 1 }, (_, i) => bodyPoint(INNER_R, i));

/**
 * Open C as one filled path.
 *
 * Outer boundary forwards (40 -> 320 deg), then the inner boundary backwards, so
 * the two boundaries wind oppositely and the nonzero fill leaves the C's body
 * filled and its cavity empty.
 */
const C_PATH = [
  `M ${outerPts[0].x} ${outerPts[0].y}`,
  ...outerPts.slice(1).map((p) => `A ${round(OUTER_R)} ${round(OUTER_R)} 0 0 0 ${p.x} ${p.y}`),
  `L ${innerPts[innerPts.length - 1].x} ${innerPts[innerPts.length - 1].y}`,
  ...innerPts
    .slice(0, -1)
    .reverse()
    .map((p) => `A ${round(INNER_R)} ${round(INNER_R)} 0 0 1 ${p.x} ${p.y}`),
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
/**
 * Mark on a transparent background. There is deliberately NO tile, box or
 * container: the approved logo is the C plus the dot and nothing else, so it can
 * float directly on whatever surface it is placed on.
 */
function markSvg({ ink }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}" role="img" aria-hidden="true" focusable="false">
  <path d="${C_PATH}" fill="${ink}"/>
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
    <path d="${C_PATH}" fill="${WORDMARK_INK}"/>
    <circle cx="${round(DOT_CX)}" cy="${round(DOT_CY)}" r="${DOT_R}" fill="${CUE_BLUE}"/>
  </g>
  <text x="55" y="32" font-family="Inter, 'Segoe UI', system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" letter-spacing="-0.4" fill="${WORDMARK_INK}">CueParcel</text>
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
 * Extension icons: TRANSPARENT, no tile.
 *
 * A transparent icon cannot rely on a background for contrast, so the C uses the
 * restrained cool-slate that stays visible on both light and dark browser chrome
 * (the approved near-black would sit at 1.12:1 on dark chrome). The dot keeps the
 * approved vivid blue.
 *
 * Both the C and the dot must clear the canvas edge: at 16px a single clipped
 * pixel is a visibly flat side on the glyph.
 */

function iconHtml(size) {
  // Map the master's own [MARK_LEFT, MARK_RIGHT] x [MARK_TOP, MARK_BOTTOM] bounds
  // onto the icon with MARGIN units of padding on every side, so no element is
  // ever clipped and the mark stays optically centred. A uniform scale is used
  // (matching preserveAspectRatio "meet"), so the padding stays symmetric.
  const uniform = Math.min(
    (VIEW - 2 * MARGIN) / (MARK_RIGHT - MARK_LEFT),
    (VIEW - 2 * MARGIN) / (MARK_BOTTOM - MARK_TOP),
  );
  const scale = round((size * uniform) / VIEW);
  const insetX = round((size * (MARGIN - MARK_LEFT * uniform)) / VIEW);
  const insetY = round((size * (MARGIN - MARK_TOP * uniform)) / VIEW);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}
    svg{display:block;image-rendering:auto}
  </style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${insetX} ${insetY}) scale(${scale})">
    <path d="${C_PATH}" fill="${MARK_TOOLBAR}"/>
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
        // Transparent: the approved icon has no tile, box or container.
        omitBackground: true,
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
// Everything above is pure: it computes the geometry and builds strings. All
// file writing and rasterising happens here, so `--dump-html` and any future
// inspection can reuse the exact geometry without touching committed files.

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
/**
 * Arc-feasibility guard. The body must be split into pieces of at most 180 deg,
 * or the renderer draws the complement and the C degrades into two stub ends
 * (see the C_PATH comment). Asserting the split rather than the outcome means a
 * future edit to GAP_HALF_DEG fails here instead of shipping a broken mark.
 */
const bodyDeg = 360 - GAP_HALF_DEG * 2;
const maxSegmentDeg = 180;
const piecesNeeded = Math.ceil(bodyDeg / maxSegmentDeg);
if (ARC_SEGMENTS < piecesNeeded) {
  problems.push(
    `C body is ${bodyDeg} deg but is split into ${ARC_SEGMENTS} arc command(s); at most ${maxSegmentDeg} deg each means ${piecesNeeded} are required`,
  );
}
if (segmentDeg > maxSegmentDeg) {
  problems.push(`an arc command spans ${round(segmentDeg)} deg, the SVG limit is ${maxSegmentDeg}`);
}
const arcCount = C_PATH.split("A ").length - 1;
if (arcCount !== ARC_SEGMENTS * 2) {
  problems.push(`expected ${ARC_SEGMENTS * 2} arc commands in the path, found ${arcCount}`);
}
/**
 * Fit guard. The whole drawn mark must sit inside the viewBox with margin. The
 * horizontal bounds come from whichever of the C's stroked arc or the dot reaches
 * further right; assuming the dot is always outside the C is what previously
 * pushed the mark past the right edge and clipped it.
 */
const eps = 1e-9;
const fitsLeft = MARK_LEFT > 0 + eps;
const fitsRight = MARK_RIGHT < VIEW - eps;
const fitsTop = MARK_TOP > 0 + eps;
const fitsBottom = MARK_BOTTOM < VIEW - eps;
if (!fitsLeft || !fitsRight || !fitsTop || !fitsBottom) {
  problems.push(
    `mark does not fit the viewBox: x ${round(MARK_LEFT)}..${round(MARK_RIGHT)}, y ${round(MARK_TOP)}..${round(MARK_BOTTOM)} of ${VIEW}`,
  );
}
if (problems.length > 0) {
  console.error("\nBrand geometry violation:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const [flag, flagArg] = process.argv.slice(2);

if (flag === "--dump-html") {
  const size = Number(flagArg);
  if (!ICON_SIZES.includes(size)) {
    console.error(`--dump-html needs one of: ${ICON_SIZES.join(", ")}`);
    process.exit(1);
  }
  console.log(iconHtml(size));
} else {
  await mkdir(BRAND_DIR, { recursive: true });
  await mkdir(ICON_DIR, { recursive: true });

  for (const [name, contents] of Object.entries(FILES)) {
    await writeFile(join(BRAND_DIR, name), contents, "utf8");
    console.log(`  wrote public/brand/${name}`);
  }

  console.log("\nGeometry (measured from the approved brand board):");
  console.log(JSON.stringify(GEOMETRY_REPORT, null, 2));
  console.log("\nRasterising icons with Playwright's bundled Chromium...");
  await renderIcons();
  console.log("\nBrand assets generated.");
}
