/**
 * CueParcel brand regression coverage.
 *
 * Pins the brand migration from both directions:
 *  - the public brand IS CueParcel everywhere a user can see it, and
 *  - the machine-readable TaskSpec contract still reports Page2Agent, because
 *    `producer.name` is a serialized compatibility identifier that an external
 *    consumer may branch on.
 *
 * A mass "Page2Agent -> CueParcel" replacement would break the second half of
 * that contract, so these tests fail loudly if anyone tries.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_TAGLINE, ONBOARDING_STEPS, PIN_HINT_TEXT } from "../../../src/extension/sidepanel/onboarding";
import { serializeAgentContext } from "../../../src/application/workbench/delivery";
import { buildTaskSpec } from "../../../src/application/workbench/task-spec-builder";
import { addContextSource, createEmptyCart } from "../../../src/core/workbench/context-cart";
import { makeFullPageItem } from "../../helpers/workbench-fixtures";
import { TASK_SPEC_PRODUCER } from "../../../src/core";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

interface Manifest {
  name?: string;
  version?: string;
  description?: string;
  permissions?: string[];
  host_permissions?: string[];
  icons?: Record<string, string>;
  action?: { default_title?: string; default_icon?: Record<string, string> };
  commands?: Record<string, { suggested_key?: { default?: string }; description?: string }>;
  content_security_policy?: { extension_pages?: string };
}

function loadJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(rootDir, ...segments), "utf8")) as T;
}

function readSource(...segments: string[]): string {
  return readFileSync(join(rootDir, ...segments), "utf8");
}

/** Every file in a directory, recursively. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const manifest = loadJson<Manifest>("public", "manifest.json");
const pkg = loadJson<{ name?: string; version?: string; description?: string }>("package.json");
const lock = loadJson<{
  name?: string;
  version?: string;
  packages?: Record<string, { name?: string; version?: string }>;
}>("package-lock.json");

// ---------------------------------------------------------------- A. manifest
describe("A. manifest branding", () => {
  it("is named CueParcel", () => {
    expect(manifest.name).toBe("CueParcel");
  });

  it("keeps the product version at 1.1.0 (branding is not a version bump)", () => {
    expect(manifest.version).toBe("1.1.0");
    expect(pkg.version).toBe("1.1.0");
  });

  it("carries the approved concise description", () => {
    expect(manifest.description).toBe(
      "Collect what matters from the web and turn it into structured, source-grounded context for AI.",
    );
  });

  it("brands the toolbar action and the keyboard command", () => {
    expect(manifest.action?.default_title).toBe("CueParcel");
    expect(manifest.commands?._execute_action?.description).toBe(
      "Capture the current page with CueParcel",
    );
  });

  it("keeps the shortcut on the combination Chrome actually assigns", () => {
    // Alt+Shift+P is Chrome's own "Pin tab" accelerator and is left unassigned.
    expect(manifest.commands?._execute_action?.suggested_key?.default).toBe("Alt+Shift+Y");
  });

  it("declares the full icon set for the extension and the action", () => {
    expect(manifest.icons).toEqual({
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    });
    expect(manifest.action?.default_icon).toEqual(manifest.icons);
  });

  it("keeps permissions EXACTLY the least-privilege set", () => {
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "sidePanel", "storage"]);
    expect(manifest.permissions).toHaveLength(4);
    expect(manifest.host_permissions).toBeUndefined();
    for (const forbidden of [
      "tabs", "history", "cookies", "webRequest", "downloads", "nativeMessaging", "bookmarks",
    ]) {
      expect(manifest.permissions).not.toContain(forbidden);
    }
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("keeps the strict extension CSP", () => {
    const csp = manifest.content_security_policy?.extension_pages ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
  });
});

// ------------------------------------------------------------- B. icons on disc
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICON_SIZES = [16, 32, 48, 128] as const;

function pngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("B. committed icon assets", () => {
  it("ships a real PNG at every declared size, with exact dimensions", () => {
    for (const size of ICON_SIZES) {
      const file = join(rootDir, "public", "icons", `icon${size}.png`);
      expect(existsSync(file), `missing ${file}`).toBe(true);
      const buffer = readFileSync(file);
      expect(buffer.subarray(0, 8).equals(PNG_SIGNATURE), `icon${size} is not a PNG`).toBe(true);
      expect(pngSize(buffer)).toEqual({ width: size, height: size });
    }
  });

  it("declares a manifest icon path that exists for every size", () => {
    for (const [size, relative] of Object.entries(manifest.icons ?? {})) {
      expect(existsSync(join(rootDir, "public", relative)), `missing ${relative}`).toBe(true);
      expect(relative).toBe(`icons/icon${size}.png`);
    }
  });

  it("keeps the vector masters and the wordmark", () => {
    for (const name of ["cueparcel-mark.svg", "cueparcel-mark-dark.svg", "cueparcel-wordmark.svg"]) {
      const file = join(rootDir, "public", "brand", name);
      expect(existsSync(file), `missing ${name}`).toBe(true);
      const svg = readFileSync(file, "utf8");
      expect(svg).toContain("<svg");
      // Brand rules: no gradient dependency, no filters/shadows, no AI cliché.
      expect(svg).not.toMatch(/gradient/i);
      expect(svg).not.toMatch(/<filter|drop-shadow|blur\(/i);
      expect(svg).not.toMatch(/sparkle|robot|brain|wand/i);
      // The single accent must be exactly the brand blue.
      expect(svg).toContain("#3157FF");
    }
  });

  it("uses the approved palette and nothing else as an accent", () => {
    const mark = readFileSync(join(rootDir, "public", "brand", "cueparcel-mark.svg"), "utf8");
    expect(mark).toContain("#111318");
    expect(mark).toContain("#3157FF");
    const dark = readFileSync(join(rootDir, "public", "brand", "cueparcel-mark-dark.svg"), "utf8");
    expect(dark).toContain("#3157FF");
    expect(dark).not.toContain("#111318"); // the dark master uses a light C
  });

  it("keeps the header mark geometry identical to the committed master", () => {
    // The panel inlines the mark for crispness; the two must not drift. Assert
    // the actual attributes rather than hardcoded numbers, so a future approved
    // tweak to the master cannot silently leave the header behind.
    const app = readSource("src", "extension", "sidepanel", "App.tsx");
    const master = readFileSync(join(rootDir, "public", "brand", "cueparcel-mark.svg"), "utf8");
    const pathOf = (text: string) => text.match(/d="(M [^"]+)"/)?.[1] ?? null;
    const circleOf = (text: string) => {
      const match = text.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
      return match === null ? null : { cx: match[1], cy: match[2], r: match[3] };
    };

    const masterPath = pathOf(master);
    expect(masterPath).not.toBeNull();
    expect(app).toContain(masterPath as string);

    const circle = circleOf(master);
    expect(circle).not.toBeNull();
    expect(app).toContain(`cx="${circle?.cx}"`);
    expect(app).toContain(`cy="${circle?.cy}"`);
    expect(app).toContain(`r="${circle?.r}"`);
    expect(app).toContain('fill="#3157FF"');
  });

  /**
   * Logo fidelity (hotfix). The first brand pass drew the cue dot at ~19% of the
   * C's height and placed it inside the C's cavity, which is not the approved
   * mark. The approved brand board measures the dot at ~30% of the C's height,
   * centred 0.77 of the C's outer radius to the RIGHT, so it sits in the open
   * mouth and reaches past the C's own right edge. These assertions pin those
   * measured proportions so the artwork cannot quietly regress.
   */
  it("keeps the cue dot at the measured approved proportions", () => {
    const master = readFileSync(join(rootDir, "public", "brand", "cueparcel-mark.svg"), "utf8");
    const path = master.match(/d="M ([\d.]+) ([\d.]+) A ([\d.]+)/);
    const circle = master.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
    expect(path).not.toBeNull();
    expect(circle).not.toBeNull();

    const outerR = Number(path?.[3]);
    const dotR = Number(circle?.[3]);
    const dotCx = Number(circle?.[1]);
    const cCx = Number(path?.[1]) - outerR * Math.cos((40 * Math.PI) / 180);

    const dotShareOfHeight = dotR / outerR;
    expect(dotShareOfHeight).toBeGreaterThanOrEqual(0.28);
    expect(dotShareOfHeight).toBeLessThanOrEqual(0.32);

    // The dot must be a genuinely separate circle, not a speck.
    expect(dotR).toBeGreaterThan(4);

    // Distance to the right of the C centre, in units of the C's outer radius.
    const dotDistanceRatio = (dotCx - cCx) / outerR;
    expect(dotDistanceRatio).toBeGreaterThan(0.74);
    expect(dotDistanceRatio).toBeLessThan(0.80);

    // And it must reach past the C's outer edge (approved overhang ~1.1 units).
    expect(dotCx + dotR).toBeGreaterThan(cCx + outerR);
  });

  it("keeps the C's stroke at the measured light weight", () => {
    const master = readFileSync(join(rootDir, "public", "brand", "cueparcel-mark.svg"), "utf8");
    const path = master.match(/A ([\d.]+) [\d.]+ 0 1 1 [\d.]+ [\d.]+ L [\d.]+ [\d.]+ A ([\d.]+)/);
    expect(path).not.toBeNull();
    const outerR = Number(path?.[1]);
    const innerR = Number(path?.[2]);
    const strokeOverHeight = (outerR - innerR) / (outerR * 2);
    // Approved is 11.6%; the first pass was 18.7% (far too heavy).
    expect(strokeOverHeight).toBeGreaterThan(0.10);
    expect(strokeOverHeight).toBeLessThan(0.135);
  });

  it("never commits a third-party font file", () => {
    const fontExtensions = [".woff", ".woff2", ".ttf", ".otf", ".eot"];
    const offenders = [...walk(join(rootDir, "public")), ...walk(join(rootDir, "src"))].filter((file) =>
      fontExtensions.some((ext) => file.toLowerCase().endsWith(ext)),
    );
    expect(offenders).toEqual([]);
  });
});

// ------------------------------------------------------ C. built artifact check
describe("C. production build artifact", () => {
  const distManifestPath = join(rootDir, "dist", "manifest.json");
  const built = existsSync(distManifestPath);

  it.runIf(built)("ships the CueParcel manifest with its icons present in dist", () => {
    const distManifest = JSON.parse(readFileSync(distManifestPath, "utf8")) as Manifest;
    expect(distManifest.name).toBe("CueParcel");
    expect(distManifest.action?.default_title).toBe("CueParcel");
    for (const [size, relative] of Object.entries(distManifest.icons ?? {})) {
      const file = join(rootDir, "dist", relative);
      expect(existsSync(file), `dist is missing ${relative}`).toBe(true);
      const parsed = pngSize(readFileSync(file));
      expect(parsed).toEqual({ width: Number(size), height: Number(size) });
    }
  });

  it.runIf(built)("ships a sidepanel document titled CueParcel", () => {
    const html = readFileSync(join(rootDir, "dist", "sidepanel.html"), "utf8");
    expect(html).toContain("<title>CueParcel</title>");
  });
});

// -------------------------------------------------------------- D. user-visible
describe("D. user-facing surfaces", () => {
  it("titles the Side Panel document CueParcel", () => {
    const html = readSource("sidepanel.html");
    expect(html).toContain("<title>CueParcel</title>");
    expect(html).not.toContain("Page2Agent");
  });

  it("brands the panel header and every public notice", () => {
    const app = readSource("src", "extension", "sidepanel", "App.tsx");
    expect(app).toContain("<h1>CueParcel</h1>");
    expect(app).toContain("Click the CueParcel toolbar icon");
    expect(app).toContain("CueParcel identifies the page type");
    // No stale public copy anywhere in the panel component.
    const publicCopy = app.match(/>[^<>{}]*Page2Agent[^<>{}]*</g) ?? [];
    expect(publicCopy).toEqual([]);
  });

  it("keeps the brand mark aria-hidden so the heading is the only label", () => {
    const app = readSource("src", "extension", "sidepanel", "App.tsx");
    const mark = app.slice(app.indexOf("function BrandMark"));
    expect(mark.slice(0, 600)).toContain('aria-hidden="true"');
    // The mark must not introduce a second accessible name.
    expect(mark.slice(0, 600)).not.toMatch(/aria-label|<title>/);
  });

  it("uses the approved tagline and onboarding copy", () => {
    expect(BRAND_TAGLINE).toBe("A quieter way to collect what matters.");
    expect(ONBOARDING_STEPS[0].title).toBe("Pin CueParcel");
    expect(PIN_HINT_TEXT).toBe("Pin CueParcel from Chrome's Extensions menu for one-click access.");
    for (const step of ONBOARDING_STEPS) {
      expect(step.title).not.toContain("Page2Agent");
      expect(step.detail).not.toContain("Page2Agent");
    }
  });

  it("does not promise capabilities the product does not have", () => {
    const onboarding = readSource("src", "extension", "sidepanel", "onboarding.ts");
    const app = readSource("src", "extension", "sidepanel", "App.tsx");
    const copy = `${onboarding}\n${app}`;
    for (const overclaim of [
      /automatically (sends?|sending|runs?)/i,
      /cloud sync/i,
      /AI summar/i,
      /RAG\b/,
      /Codex/i,
    ]) {
      expect(copy).not.toMatch(overclaim);
    }
  });

  it("keeps feature vocabulary stable (not renamed by the brand pass)", () => {
    const app = readSource("src", "extension", "sidepanel", "App.tsx");
    for (const term of ["Context Lens", "Context Cart", "TaskSpec", "Context Receipt"]) {
      expect(app).toContain(term);
    }
    // The Cart is not renamed to "Parcel" in this migration.
    expect(app).not.toContain("Parcel Cart");
  });
});

// ------------------------------------------------------- E. agent-facing output
describe("E. human-readable agent output", () => {
  it("titles the agent package with the CueParcel brand", () => {
    const serializer = readSource("src", "application", "package", "agent-package-serializer.ts");
    expect(serializer).toContain('"# CueParcel Context"');
    expect(serializer).toContain('"## CueParcel Agent Instructions"');
    expect(serializer).not.toContain("Page2Agent Context");
  });

  it("titles the workbench task output with the CueParcel brand", () => {
    const delivery = readSource("src", "application", "workbench", "delivery.ts");
    expect(delivery).toContain('"# CueParcel Task"');
    expect(delivery).not.toContain("Page2Agent Task");
  });

  it("never brands the source Markdown (it stays source-oriented)", () => {
    const delivery = readSource("src", "application", "workbench", "delivery.ts");
    const sourcesSerializer = delivery.slice(delivery.indexOf("export function serializeSourcesMarkdown"));
    expect(sourcesSerializer).not.toContain("CueParcel");
  });
});

// ---------------------------------------------------- F. TaskSpec compatibility
describe("F. TaskSpec v1.0 compatibility (must NOT be rebranded)", () => {
  it("retains producer.name = Page2Agent as a serialized identifier", () => {
    expect(TASK_SPEC_PRODUCER.name).toBe("Page2Agent");
  });

  it("retains producer.version = 1.1.0", () => {
    expect(TASK_SPEC_PRODUCER.version).toBe("1.1.0");
  });

  it("declares the constant literally, not via the brand", () => {
    const source = readSource("src", "core", "workbench", "task-spec.ts");
    expect(source).toContain('export const TASK_SPEC_PRODUCER = { name: "Page2Agent", version: "1.1.0" } as const;');
  });

  it("keeps schemaVersion at 1.0 (a visual change is not a protocol change)", () => {
    const source = readSource("src", "core", "workbench", "task-spec.ts");
    expect(source).toContain('TASK_SPEC_SCHEMA_VERSION = "1.0"');
  });

  it("does not add a branding key to the schema", () => {
    const source = readSource("src", "core", "workbench", "task-spec.ts");
    for (const forbiddenKey of ["displayName", "brand", "legacyProducer", "productName"]) {
      expect(source).not.toContain(forbiddenKey);
    }
  });

  it("serializes the Page2Agent producer into real TaskSpec output", () => {
    // Built through the production builder so this pins the genuine contract
    // rather than a hand-written approximation of it.
    const added = addContextSource(createEmptyCart(), makeFullPageItem());
    if (added.status !== "added") {
      throw new Error("expected the fixture source to be added");
    }
    const built = buildTaskSpec(added.cart, "learn");
    if (built.status !== "ok") {
      throw new Error("expected a buildable TaskSpec");
    }

    // The machine identity is the legacy compatibility identifier...
    expect(built.spec.producer.name).toBe("Page2Agent");
    expect(built.spec.producer.version).toBe("1.1.0");
    expect(built.spec.schemaVersion).toBe("1.0");
    expect(JSON.parse(JSON.stringify(built.spec.producer))).toEqual({
      name: "Page2Agent",
      version: "1.1.0",
    });

    // ...while the human-readable rendering carries the new brand.
    const agent = serializeAgentContext(built.spec);
    expect(agent.startsWith("# CueParcel Task")).toBe(true);
    expect(agent).not.toContain("# Page2Agent Task");
  });
});

// -------------------------------------------------------- G. internal identifiers
describe("G. internal identifiers retained (brand must not risk runtime)", () => {
  it("keeps the page2agent.* session storage keys", () => {
    const sessionState = readSource("src", "extension", "session", "session-state.ts");
    expect(sessionState).toContain('"page2agent.latest-capture.v1."');
    expect(sessionState).toContain('"page2agent.capture-result.v1."');
    const cartSession = readSource("src", "extension", "session", "cart-session.ts");
    expect(cartSession).toContain('"page2agent.workbench.cart.v1."');
    const documentCache = readSource("src", "extension", "session", "document-cache.ts");
    expect(documentCache).toContain('"page2agent.window-document.v1."');
  });

  it("keeps the p2a-prefixed lens host id and styles", () => {
    const engine = readSource("src", "extension", "content", "lens", "lens-engine.ts");
    expect(engine).toContain('"page2agent-context-lens-host"');
    expect(engine).toContain(".p2a-dock");
  });

  it("keeps the Page2AgentError type names", () => {
    const errors = readSource("src", "core", "errors", "error-codes.ts");
    expect(errors).toContain("Page2AgentErrorCode");
    const errorClass = readSource("src", "core", "errors", "page2agent-error.ts");
    expect(errorClass).toContain("class Page2AgentError");
  });

  it("keeps the onboarding-dismissed localStorage key", () => {
    const onboarding = readSource("src", "extension", "sidepanel", "onboarding.ts");
    expect(onboarding).toContain('"page2agent.onboarding.pinDismissed.v1"');
  });

  it("keeps the token estimate method identifier", () => {
    const tokenEstimate = readSource("src", "core", "workbench", "token-estimate.ts");
    expect(tokenEstimate).toContain('"page2agent-heuristic-v1"');
  });
});

// ------------------------------------------------------------ H. package metadata
describe("H. package metadata", () => {
  it("renames the package to cueparcel and keeps the version", () => {
    expect(pkg.name).toBe("cueparcel");
    expect(pkg.version).toBe("1.1.0");
  });

  it("keeps package-lock consistent with package.json", () => {
    expect(lock.name).toBe("cueparcel");
    expect(lock.packages?.[""]?.name).toBe("cueparcel");
    expect(lock.version).toBe("1.1.0");
    expect(lock.packages?.[""]?.version).toBe("1.1.0");
  });

  it("aligns the package description with the product description", () => {
    expect(pkg.description).toBe(manifest.description);
  });
});

// ------------------------------------------------------------------ I. security
describe("I. security posture unchanged by branding", () => {
  it("does not add a host permission or broaden permission scope", () => {
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "sidePanel", "storage"]);
  });

  it("keeps the brand pass free of remote code or eval", () => {
    const app = readSource("src", "extension", "sidepanel", "App.tsx");
    expect(app).not.toMatch(/\beval\(|new Function\(/);
    const svgFiles = walk(join(rootDir, "public", "brand"));
    for (const file of svgFiles) {
      const svg = readFileSync(file, "utf8");
      expect(svg).not.toMatch(/<script|onload=|xlink:href="https?:/i);
    }
  });

  it("introduces no telemetry or analytics", () => {
    for (const file of walk(join(rootDir, "src"))) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/google-analytics|gtag\(|mixpanel|segment\.(io|com)|posthog|sentry/i);
    }
  });
});
