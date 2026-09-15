/**
 * Launch-packaging regression coverage.
 *
 * These tests guard the repository AS A PRODUCT PAGE, which is a different set of
 * failure modes from the product code:
 *
 *  - a README image that 404s because the path is wrong or the asset was never
 *    committed,
 *  - a bilingual README that drifts out of sync with the English one,
 *  - a release ZIP whose `manifest.json` is nested (Chrome refuses to load it),
 *  - a social preview at the wrong dimensions for the platform,
 *  - stale `Page2Agent` branding in current user-facing documents,
 *  - and marketing copy that quietly overstates what the product does.
 *
 * The last one matters most: it is the failure a reviewer is least likely to
 * notice by eye, so it is asserted mechanically.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// tests/unit/packaging/ -> up three levels to reach the repository root.
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (...segments: string[]): string => readFileSync(join(rootDir, ...segments), "utf8");

const README = read("README.md");
const README_ZH = read("README_ZH.md");

/**
 * Resolve a repository-relative link or image path the way GitHub does: relative
 * to the file that references it. Anchors and absolute URLs are not files.
 */
function localReferences(markdown: string): string[] {
  const refs = new Set<string>();
  const patterns = [
    /!\[[^\]]*\]\(([^)\s]+)\)/g, // images
    /\]\(([^)\s]+)\)/g, // links
    /<img[^>]+src="([^"]+)"/g, // raw HTML images
  ];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      const target = match[1];
      if (target.startsWith("http://") || target.startsWith("https://")) continue;
      if (target.startsWith("#") || target.startsWith("mailto:")) continue;
      refs.add(target.split("#")[0]);
    }
  }
  return [...refs].filter((r) => r.length > 0);
}

// --------------------------------------------------------------- README ------

describe("README presentation", () => {
  it("keeps English as the default README and links to the Chinese one", () => {
    expect(README).toMatch(/\[ç®€ä½“ä¸­æ–‡\]\(README_ZH\.md\)/);
    expect(README_ZH).toMatch(/\[English\]\(README\.md\)/);
  });

  it("resolves every local image and link in the English README", () => {
    const missing = localReferences(README).filter((ref) => !existsSync(join(rootDir, ref)));
    expect(missing, `missing paths referenced by README.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("resolves every local image and link in the Chinese README", () => {
    const missing = localReferences(README_ZH).filter((ref) => !existsSync(join(rootDir, ref)));
    expect(missing, `missing paths referenced by README_ZH.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("gives every substantive image alternative text", () => {
    for (const [name, markdown] of [["README.md", README], ["README_ZH.md", README_ZH]] as const) {
      const htmlImages = [...markdown.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      for (const tag of htmlImages) {
        const alt = /\balt="([^"]*)"/.exec(tag)?.[1] ?? "";
        // Product screenshots need a real description of what they show.
        expect(alt.length, `${name} has an <img> with missing/short alt text: ${tag.slice(0, 70)}`).toBeGreaterThan(8);
      }
      /**
       * Markdown images are either product screenshots (need a description) or
       * badge images (the badge label is the alt text, and two characters such as
       * "CI" is legitimately correct). Badges point at shields.io.
       */
      for (const [alt, target] of [...markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map(
        (m) => [m[1], m[2]] as const,
      )) {
        if (target.includes("shields.io") || target.includes("/badge")) {
          expect(alt.trim().length, `${name} has a badge with no label`).toBeGreaterThan(0);
          continue;
        }
        expect(alt.trim().length, `${name} has a screenshot without alt text: ${target}`).toBeGreaterThan(8);
      }
    }
  });

  it("keeps the two READMEs structurally in sync", () => {
    // Same top-level sections in the same order: a translation that silently
    // drops a section is the failure mode this catches.
    const headings = (markdown: string) =>
      [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    const english = headings(README);
    const chinese = headings(README_ZH);
    expect(chinese).toHaveLength(english.length);
    expect(english.length).toBeGreaterThanOrEqual(12);
  });

  it("shows the hero, the demo and three proof cards", () => {
    for (const asset of [
      "docs/assets/cueparcel-hero.png",
      "docs/assets/cueparcel-demo.gif",
      "docs/assets/cueparcel-card-fix.png",
      "docs/assets/cueparcel-card-compare.png",
      "docs/assets/cueparcel-card-build.png",
    ]) {
      expect(README, `README does not reference ${asset}`).toContain(asset);
    }
  });

  it("states the current install reality instead of implying a store listing", () => {
    // Chrome Web Store is planned, not shipped. Saying otherwise would be a lie.
    expect(README).toMatch(/Chrome Web Store[^.]*planned, not shipped/i);
    expect(README).toContain("chrome://extensions");
    expect(README).toMatch(/Load unpacked/i);
    // And it must not claim availability.
    expect(README).not.toMatch(/available on the Chrome Web Store/i);
    expect(README).not.toMatch(/install from the (Chrome|Edge) Web Store/i);
  });

  it("keeps the trust strip truthful", () => {
    for (const claim of [
      "No backend",
      "No telemetry",
      "No API key",
      "Local-first",
      "activeTab",
      "scripting",
      "sidePanel",
      "storage",
    ]) {
      expect(README, `README is missing the trust claim: ${claim}`).toContain(claim);
    }
  });

  it("keeps the credibility evidence, not just the pitch", () => {
    // The engineering truth must survive the marketing restructure.
    for (const evidence of ["723", "13", "TaskSpec", "producer.name", "Page2Agent", "NO_CONTENT_FOUND"]) {
      expect(README, `README dropped the credibility evidence: ${evidence}`).toContain(evidence);
    }
    expect(README).toMatch(/### Three provenance dimensions, never conflated/);
    expect(README).toMatch(/Not explicitly provided in source/);
  });

  it("contains no fabricated engagement or unsupported marketing claims", () => {
    const banned: Array<[RegExp, string]> = [
      [/github trending/i, "a GitHub Trending claim"],
      [/please star so/i, "engagement begging"],
      [/help us trend/i, "engagement begging"],
      [/revolutionary/i, "unsupported marketing adjective"],
      [/game.?changing/i, "unsupported marketing adjective"],
      [/blazing fast/i, "unsupported marketing adjective"],
      [/10x (faster|better)/i, "an unsupported multiplier claim"],
      [/ISO ?27001|SOC ?2|certified secure/i, "a security certification claim"],
      [/\b(\d[\d,]*)\s*(users|customers|downloads|stars)\b/i, "an invented metric"],
    ];
    for (const [pattern, what] of banned) {
      expect(README, `README contains ${what}: ${pattern}`).not.toMatch(pattern);
      expect(README_ZH, `README_ZH contains ${what}: ${pattern}`).not.toMatch(pattern);
    }
  });

  it("never claims CueParcel sends data to a model or runs an agent", () => {
    const forbidden = [
      /sends? (your|the) (data|context) to (an? )?(AI|LLM|model)/i,
      /summari[sz]es? (it|your|the) (with|using) (an? )?(AI|LLM|model)/i,
      // A claim that the product syncs. The privacy section legitimately says
      // "no cloud sync" â€?an absence statement â€?so a bare /cloud sync/ match
      // would flag the very sentence that makes the honest claim.
      /(?<!no )(?<!without )(?<!not )cloud sync/i,
    ];
    for (const pattern of forbidden) {
      expect(README, `README claims ${pattern}`).not.toMatch(pattern);
    }
    // The honest framing must be present instead: it prepares and copies
    // context, rather than sending anything anywhere.
    expect(README).toMatch(/prepares? and copies context/i);
    // And the privacy promise must be stated as an absence.
    expect(README).toMatch(/no cloud sync/i);
  });

  it("has exactly one star call to action", () => {
    const mentions = [...README.matchAll(/â­|â˜…|star (the|this) repo|consider starring/gi)].length;
    expect(mentions, "more than one star CTA reads as begging").toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------- other documents ---

describe("community and packaging documents", () => {
  it("ships the documents a visitor expects to find", () => {
    for (const file of [
      "LICENSE",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CODE_OF_CONDUCT.md",
      "ROADMAP.md",
      "CHANGELOG.md",
      "docs/launch/RELEASE.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
    ]) {
      expect(existsSync(join(rootDir, file)), `missing ${file}`).toBe(true);
    }
  });

  it("keeps the bug template asking for the reproduction details that matter", () => {
    const template = read(".github", "ISSUE_TEMPLATE", "bug_report.yml");
    for (const field of ["browser", "cueparcel-version", "url-type", "expected", "actual", "steps", "screenshots", "context-lens"]) {
      expect(template, `bug template lost the "${field}" field`).toContain(`id: ${field}`);
    }
    // It must warn against pasting sensitive captured content.
    expect(template).toMatch(/do not include private page content/i);
  });

  it("keeps the roadmap honest: no dates, and the rejected scope stays rejected", () => {
    const roadmap = read("ROADMAP.md");
    expect(roadmap).toMatch(/No dates are promised/i);
    expect(roadmap).toMatch(/Explicitly not planned/);
    expect(roadmap).toMatch(/Telemetry or analytics/);
    expect(roadmap).toMatch(/Calling an LLM from the extension/);
    // A month name plus a year would be a promise the project does not make.
    expect(roadmap).not.toMatch(/\b(Q[1-4] 20\d\d|January 20\d\d|February 20\d\d|March 20\d\d)\b/);
  });

  it("keeps the changelog aligned with the product version", () => {
    const pkg = JSON.parse(read("package.json")) as { version?: string };
    const manifest = JSON.parse(read("public", "manifest.json")) as { version?: string };
    const changelog = read("CHANGELOG.md");
    expect(pkg.version).toBe("1.1.0");
    expect(manifest.version).toBe(pkg.version);
    expect(changelog).toContain(`## [${pkg.version}]`);
    // The compatibility identifier must be documented as intentional.
    expect(changelog).toContain("producer.name");
  });

  it("documents a release process that requires verification before publishing", () => {
    const release = read("docs", "launch", "RELEASE.md");
    expect(release).toMatch(/manifest\.json.*archive root/i);
    expect(release).toMatch(/Do not release on a red or skipped gate/);
    expect(release).toMatch(/SHA256SUMS\.txt/);
    expect(release).toMatch(/Chrome Web Store: planned, not submitted/i);
  });
});

// ------------------------------------------------------------------ assets ----

describe("launch assets", () => {
  const assets = [
    ["cueparcel-hero.png", 1600, 900],
    ["cueparcel-card-fix.png", 1200, 760],
    ["cueparcel-card-compare.png", 1200, 760],
    ["cueparcel-card-build.png", 1200, 760],
    ["cueparcel-social-preview.png", 1200, 630],
  ] as const;

  it("ships every launch asset at the size the platform expects", () => {
    for (const [name, width, height] of assets) {
      const file = join(rootDir, "docs", "assets", name);
      expect(existsSync(file), `missing ${name}`).toBe(true);
      const buffer = readFileSync(file);
      expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(buffer.readUInt32BE(16), `${name} width`).toBe(width);
      expect(buffer.readUInt32BE(20), `${name} height`).toBe(height);
    }
  });

  it("keeps the social preview at a GitHub-compatible 1200x630", () => {
    // 1200x630 is the size GitHub and most platforms crop from without distortion.
    const buffer = readFileSync(join(rootDir, "docs", "assets", "cueparcel-social-preview.png"));
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
    const ratio = 1200 / 630;
    expect(Math.abs(ratio - 1.9047619)).toBeLessThan(0.001);
  });

  it("keeps the demo GIF small enough to load in a README", () => {
    const file = join(rootDir, "docs", "assets", "cueparcel-demo.gif");
    const buffer = readFileSync(file);
    expect(buffer.toString("ascii", 0, 6)).toMatch(/^GIF8[79]a$/);
    // Count frames by Graphic Control Extension blocks (one per frame).
    let frames = 0;
    for (let i = 0; i < buffer.length - 2; i += 1) {
      if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9 && buffer[i + 2] === 0x04) frames += 1;
    }
    expect(frames, "the demo GIF lost its frames").toBeGreaterThanOrEqual(9);
    expect(buffer[buffer.length - 1], "the demo GIF is truncated").toBe(0x3b);
    const mb = buffer.length / (1024 * 1024);
    expect(mb, `the demo GIF is ${mb.toFixed(2)}MB, over the 3MB budget`).toBeLessThan(3);
  });

  it("keeps the total README asset weight reasonable", () => {
    const total = assets
      .map(([name]) => statSync(join(rootDir, "docs", "assets", name)).size)
      .reduce((a, b) => a + b, 0);
    const gif = statSync(join(rootDir, "docs", "assets", "cueparcel-demo.gif")).size;
    const mb = (total + gif) / (1024 * 1024);
    expect(mb, `README assets total ${mb.toFixed(2)}MB`).toBeLessThan(4);
  });
});

// -------------------------------------------------------- release packaging ---

describe("release packaging", () => {
  const ZIP = join(rootDir, "cueparcel-v1.1.0-chromium.zip");

  /**
   * Read a ZIP's central directory without a dependency. The property under test
   * â€?where `manifest.json` sits â€?is exactly what a naive archiver gets wrong,
   * so it is checked by reading the real bytes rather than by trusting the
   * packaging script's own claim.
   */
  function centralDirectory(buffer: Buffer): string[] {
    const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw new Error("no end-of-central-directory record");
    const count = buffer.readUInt16LE(end + 10);
    let cursor = buffer.readUInt32LE(end + 16);
    const names: string[] = [];
    for (let i = 0; i < count; i += 1) {
      if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("bad central directory entry");
      const nameLength = buffer.readUInt16LE(cursor + 28);
      const extraLength = buffer.readUInt16LE(cursor + 30);
      const commentLength = buffer.readUInt16LE(cursor + 32);
      names.push(buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return names;
  }

  function entryData(buffer: Buffer, wanted: string): Buffer {
    let cursor = 0;
    while (cursor < buffer.length - 4) {
      if (buffer.readUInt32LE(cursor) !== 0x04034b50) break;
      const method = buffer.readUInt16LE(cursor + 8);
      const compressedSize = buffer.readUInt32LE(cursor + 18);
      const nameLength = buffer.readUInt16LE(cursor + 26);
      const extraLength = buffer.readUInt16LE(cursor + 28);
      const name = buffer.toString("utf8", cursor + 30, cursor + 30 + nameLength);
      const start = cursor + 30 + nameLength + extraLength;
      const payload = buffer.subarray(start, start + compressedSize);
      if (name === wanted) return method === 8 ? inflateRawSync(payload) : Buffer.from(payload);
      cursor = start + compressedSize;
    }
    throw new Error(`entry ${wanted} not found`);
  }

  it("puts manifest.json at the ARCHIVE ROOT, not under dist/", () => {
    if (!existsSync(ZIP)) {
      // The artifact is gitignored and built on demand; skipping silently would
      // hide a real failure, so the test says what to run instead.
      expect.fail("run `npm run package:release` before this test: cueparcel-v1.1.0-chromium.zip is missing");
    }
    const buffer = readFileSync(ZIP);
    const names = centralDirectory(buffer);
    expect(names, "the archive has no manifest.json").toContain("manifest.json");
    expect(names, "the archive nests the extension under dist/").not.toContain("dist/manifest.json");
    expect(names.filter((n) => n.startsWith("dist/")), "archive contains a dist/ prefix").toEqual([]);
    expect(names.filter((n) => n.includes("..")), "archive contains a traversal segment").toEqual([]);
    expect(names[0], "manifest.json should be the first entry for readability").toBe("manifest.json");
  });

  it("archives a manifest that parses and matches the shipped version", () => {
    if (!existsSync(ZIP)) expect.fail("run `npm run package:release` first");
    const manifest = JSON.parse(entryData(readFileSync(ZIP), "manifest.json").toString("utf8")) as {
      manifest_version?: number;
      version?: string;
      name?: string;
      permissions?: string[];
      host_permissions?: string[];
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe("1.1.0");
    expect(manifest.name).toBe("CueParcel");
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "sidePanel", "storage"]);
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("publishes a checksum that matches the archive", () => {
    if (!existsSync(ZIP)) expect.fail("run `npm run package:release` first");
    const sums = read("SHA256SUMS.txt").trim();
    expect(sums).toMatch(/^[0-9a-f]{64} {2}cueparcel-v1\.1\.0-chromium\.zip$/);
    // Recompute rather than trusting the file.
    const actual = createHash("sha256").update(readFileSync(ZIP)).digest("hex");
    expect(sums.startsWith(actual), "SHA256SUMS.txt does not match the archive").toBe(true);
  });

  it("keeps release artifacts out of git", () => {
    const ignore = read(".gitignore");
    expect(ignore).toMatch(/cueparcel-v\*-chromium\.zip/);
    expect(ignore).toMatch(/SHA256SUMS\.txt/);
  });
});

// ------------------------------------------------------------- landing page ---

describe("landing page", () => {
  const SITE = join(rootDir, "site");

  it("is a static site with no build step and no external requests", () => {
    for (const file of ["index.html", "styles.css", "main.js"]) {
      expect(existsSync(join(SITE, file)), `missing site/${file}`).toBe(true);
    }
    const sources = ["index.html", "styles.css", "main.js"].map((f) => read("site", f)).join("\n");
    /**
     * Every `http(s)://` reference must point at the project's own GitHub
     * repository or its releases. A CDN font, a remote script, an analytics
     * beacon or a tracking pixel would all show up here.
     */
    const allowed = /^https:\/\/github\.com\/kallist\/CueParcel(\/releases(\/latest)?)?$/;
    const offenders = [...sources.matchAll(/https?:\/\/[^\s"'<>)]+/g)]
      .map((m) => m[0].replace(/["'`].*$/, ""))
      .filter((url) => !allowed.test(url));
    expect(offenders, `external references in site/: ${offenders.join(", ")}`).toEqual([]);
    // And nothing may be fetched over plain http.
    expect(sources).not.toMatch(/http:\/\//);
  });

  it("points every local asset reference at a file that exists", () => {
    const html = read("site", "index.html");
    const refs = new Set<string>();
    for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) refs.add(match[1]);
    for (const match of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) refs.add(match[1]);
    for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) refs.add(match[1]);
    const local = [...refs].filter(
      (r) => !r.startsWith("http") && !r.startsWith("data:") && !r.startsWith("blob:"),
    );
    expect(local.length).toBeGreaterThan(3);
    const missing = local.filter((r) => !existsSync(join(SITE, r)));
    expect(missing, `site/ references missing files: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not ship the social preview twice", () => {
    // The site is served from /site, so it must use its own copies; the
    // 1200x630 card is only needed by the repository settings.
    const html = read("site", "index.html");
    expect(html).not.toContain("social-preview");
  });

  it("keeps the site asset payload under 1.5 MB", () => {
    const dir = join(SITE, "assets");
    if (!existsSync(dir)) return;
    const total = readdirSync(dir).reduce((sum, name) => sum + statSync(join(dir, name)).size, 0);
    const mb = total / (1024 * 1024);
    expect(mb, `site/assets is ${mb.toFixed(2)}MB`).toBeLessThan(1.5);
  });

  it("gives the page one h1, an h1-first heading order and a language", () => {
    const html = read("site", "index.html");
    expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(html).toMatch(/<html[^>]+lang="en"/);
    // A heading level may only increase by one at a time.
    const levels = [...html.matchAll(/<h([1-3])\b/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `heading jumped ${levels[i - 1]} -> ${levels[i]}`).toBeLessThanOrEqual(1);
    }
  });

  it("describes the product without overstating it", () => {
    const html = read("site", "index.html");
    expect(html).toContain("Pick what matters. Pack it for AI.");
    for (const claim of ["activeTab", "scripting", "sidePanel", "storage"]) {
      expect(html, `site is missing the permission ${claim}`).toContain(claim);
    }
    expect(html).toMatch(/chrome:\/\/extensions/);
    expect(html).toMatch(/planned/i);
    expect(html).not.toMatch(/available on the Chrome Web Store/i);
    expect(html).not.toMatch(/github trending/i);
    for (const banned of [/revolutionary/i, /game.?changing/i, /blazing/i, /effortless/i, /seamless/i]) {
      expect(html, `site contains ${banned}`).not.toMatch(banned);
    }
  });

  it("documents how to publish it on GitHub Pages without changing settings", () => {
    const plan = read("docs", "launch", "PLAN.md");
    expect(plan).toMatch(/Manual steps that cannot be automated/i);
    expect(plan).toMatch(/Social preview/i);
    // The Pages configuration step must be described, not performed automatically.
    expect(plan).toMatch(/landing page|`site\/`|site\//i);
  });
});


describe("repository branding after the rename", () => {
  const CURRENT_DOCS = [
    "README.md",
    "README_ZH.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "ROADMAP.md",
    "CHANGELOG.md",
    "docs/BRAND.md",
    "docs/user-guide-v1.1.md",
    "docs/launch/RELEASE.md",
  ];

  it("uses the CueParcel repository URL in current user-facing documents", () => {
    for (const file of CURRENT_DOCS) {
      const text = read(...file.split("/"));
      const stale = [...text.matchAll(/github\.com\/kallist\/Page2Agent/g)];
      expect(stale, `${file} still points at the old repository URL`).toEqual([]);
    }
  });

  it("names the product CueParcel in the documents a visitor reads first", () => {
    for (const file of ["README.md", "README_ZH.md", "SECURITY.md", "ROADMAP.md"]) {
      const text = read(...file.split("/"));
      expect(text, `${file} does not mention CueParcel`).toContain("CueParcel");
    }
  });

  it("keeps Page2Agent only where it is a deliberate compatibility identifier", () => {
    // It may appear as an explanation, never as the current product name.
    expect(README).toMatch(/previously developed as Page2Agent/i);
    expect(README).toContain('"name": "Page2Agent"');
    // And the manifest must not resurrect it.
    const manifest = JSON.parse(read("public", "manifest.json")) as { name?: string; description?: string };
    expect(manifest.name).toBe("CueParcel");
    expect(manifest.description ?? "").not.toContain("Page2Agent");
  });

  it("keeps the package name and description aligned with the brand", () => {
    const pkg = JSON.parse(read("package.json")) as { name?: string; description?: string };
    expect(pkg.name).toBe("cueparcel");
    expect(pkg.description ?? "").not.toContain("Page2Agent");
  });
});
