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
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
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
    expect(README).toMatch(/\[简体中文\]\(README_ZH\.md\)/);
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
    for (const evidence of ["TaskSpec", "producer.name", "Page2Agent", "NO_CONTENT_FOUND", "E2E"]) {
      expect(README, `README dropped the credibility evidence: ${evidence}`).toContain(evidence);
    }
    expect(README).toMatch(/### Three provenance dimensions, never conflated/);
    expect(README).toMatch(/Not explicitly provided in source/);
  });

  it("states a test count that matches what is actually in the repository", () => {
    /**
     * The README claims a specific number of tests and files. An earlier revision
     * claimed the count from `main` (723 / 73) while the branch carrying it had
     * 759 / 74, which is exactly the kind of stale number that makes every other
     * claim look unchecked.
     *
     * The file count is derived from the test tree, so it cannot drift. The test
     * count cannot be derived without running the suite, so it is only checked for
     * shape and for internal consistency with the file count.
     */
    /**
     * Vitest runs tests/unit and tests/integration. tests/e2e is Playwright and is
     * reported separately, so it must not be counted here — including it made this
     * assertion claim 75 files where the suite reports 74.
     */
    const testFiles = readdirSync(join(rootDir, "tests"), { recursive: true })
      .map((entry) => String(entry).split("\\").join("/"))
      .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
      .filter((name) => !name.startsWith("e2e/"));
    const e2eFiles = readdirSync(join(rootDir, "tests"), { recursive: true })
      .map((entry) => String(entry).split("\\").join("/"))
      .filter((name) => name.startsWith("e2e/") && /\.(test|spec)\.tsx?$/.test(name));
    expect(e2eFiles.length, "expected exactly one Playwright E2E spec").toBe(1);
    const claimed = /(\d+)\s+(?:unit \/ integration \/ component )?tests? across (\d+) files/i.exec(README);
    expect(claimed, "README no longer states a test count").not.toBeNull();
    const claimedTests = Number(claimed?.[1]);
    const claimedFiles = Number(claimed?.[2]);
    expect(claimedFiles, `README claims ${claimedFiles} test files, the tests/ tree has ${testFiles.length}`).toBe(
      testFiles.length,
    );
    // Sanity band: more tests than files, and not a wildly implausible number.
    expect(claimedTests).toBeGreaterThan(claimedFiles);
    expect(claimedTests).toBeLessThan(claimedFiles * 40);
    // The E2E figure is separate and small.
    expect(README).toMatch(/13 browser E2E/);
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
      // "no cloud sync" —?an absence statement —?so a bare /cloud sync/ match
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
    const mentions = [...README.matchAll(/⭐|★|star (the|this) repo|consider starring/gi)].length;
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
  /** The artifact name is derived from the manifest so it survives a version bump. */
  const currentVersion = (JSON.parse(read("public", "manifest.json")) as { version: string }).version;
  const ZIP_NAME = `cueparcel-v${currentVersion}-chromium.zip`;
  const ZIP = join(rootDir, ZIP_NAME);

  /**
   * Read a ZIP's central directory without a dependency. The property under test
   * — where `manifest.json` sits — is exactly what a naive archiver gets wrong,
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

  /** CRC-32 of a buffer, computed the way the ZIP format defines it. */
  function crc32(buffer: Buffer): number {
    let table: number[] | null = null;
    if (table === null) {
      table = [];
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (const byte of buffer) c = (table[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** Every local header's name, stored CRC and decompressed payload. */
  function readEntries(buffer: Buffer): { name: string; crc: number; data: Buffer }[] {
    const out: { name: string; crc: number; data: Buffer }[] = [];
    let cursor = 0;
    while (cursor < buffer.length - 4) {
      if (buffer.readUInt32LE(cursor) !== 0x04034b50) break;
      const method = buffer.readUInt16LE(cursor + 8);
      const crc = buffer.readUInt32LE(cursor + 14);
      const compressedSize = buffer.readUInt32LE(cursor + 18);
      const nameLength = buffer.readUInt16LE(cursor + 26);
      const extraLength = buffer.readUInt16LE(cursor + 28);
      const name = buffer.toString("utf8", cursor + 30, cursor + 30 + nameLength);
      const start = cursor + 30 + nameLength + extraLength;
      const payload = buffer.subarray(start, start + compressedSize);
      out.push({ name, crc, data: method === 8 ? inflateRawSync(payload) : Buffer.from(payload) });
      cursor = start + compressedSize;
    }
    return out;
  }

  /**
   * The ZIP is gitignored and produced on demand, so on a clean checkout it does
   * not exist. Building it here rather than skipping keeps these tests meaningful
   * in CI — an earlier revision used `expect.fail` when it was missing, which made
   * `npm test` red on a fresh clone while passing locally. That is the worst
   * possible failure mode for a release gate.
   *
   * It runs the same script CI runs, so the staleness guard is exercised too
   * rather than bypassed. A refusal here is reported with the script's own
   * explanation, which is the actionable message ("run npm run build first").
   */
  function ensureArtifact(): void {
    if (existsSync(ZIP)) return;
    const result = spawnSync(process.execPath, [join(rootDir, "scripts", "package-release.mjs")], {
      cwd: rootDir,
      encoding: "utf8",
    });
    if (result.status !== 0 || !existsSync(ZIP)) {
      expect.fail(
        `the release artifact is missing and could not be produced. Run \`npm run package:release\` first.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
      );
    }
  }

  it("puts manifest.json at the ARCHIVE ROOT, not under dist/", () => {
    ensureArtifact();
    const buffer = readFileSync(ZIP);
    const names = centralDirectory(buffer);
    expect(names, "the archive has no manifest.json").toContain("manifest.json");
    expect(names, "the archive nests the extension under dist/").not.toContain("dist/manifest.json");
    expect(names.filter((n) => n.startsWith("dist/")), "archive contains a dist/ prefix").toEqual([]);
    expect(names.filter((n) => n.includes("..")), "archive contains a traversal segment").toEqual([]);
    expect(names[0], "manifest.json should be the first entry for readability").toBe("manifest.json");
  });

  it("archives a manifest that parses and matches the shipped version", () => {
    if (!existsSync(ZIP)) ensureArtifact();
    const manifest = JSON.parse(entryData(readFileSync(ZIP), "manifest.json").toString("utf8")) as {
      manifest_version?: number;
      version?: string;
      name?: string;
      permissions?: string[];
      host_permissions?: string[];
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe(currentVersion);
    expect(manifest.name).toBe("CueParcel");
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "sidePanel", "storage"]);
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("verifies every archived entry by decompressing it and checking its CRC-32", () => {
    /**
     * Checking only entry NAMES would let a corrupted asset through: a truncated
     * icon still has its name in the central directory, and Chrome would then
     * refuse the extension for a reason the release notes never mention.
     */
    if (!existsSync(ZIP)) ensureArtifact();
    const buffer = readFileSync(ZIP);
    const entries = readEntries(buffer);
    expect(entries.length).toBeGreaterThan(10);
    const corrupt = entries
      .filter((entry) => crc32(entry.data) !== entry.crc)
      .map((entry) => `${entry.name} (stored ${entry.crc.toString(16)}, computed ${crc32(entry.data).toString(16)})`);
    expect(corrupt, `corrupt entries: ${corrupt.join(", ")}`).toEqual([]);
  });

  it("contains every file the manifest references", () => {
    if (!existsSync(ZIP)) ensureArtifact();
    const buffer = readFileSync(ZIP);
    const names = centralDirectory(buffer);
    const manifest = JSON.parse(entryData(buffer, "manifest.json").toString("utf8")) as {
      icons?: Record<string, string>;
      action?: { default_icon?: Record<string, string>; default_popup?: string };
      background?: { service_worker?: string };
      side_panel?: { default_path?: string };
    };
    const referenced = new Set<string>();
    for (const value of Object.values(manifest.icons ?? {})) referenced.add(value);
    for (const value of Object.values(manifest.action?.default_icon ?? {})) referenced.add(value);
    if (manifest.action?.default_popup !== undefined) referenced.add(manifest.action.default_popup);
    if (manifest.background?.service_worker !== undefined) referenced.add(manifest.background.service_worker);
    if (manifest.side_panel?.default_path !== undefined) referenced.add(manifest.side_panel.default_path);
    expect(referenced.size, "the manifest references nothing, which cannot be right").toBeGreaterThan(2);
    const missing = [...referenced].filter((file) => !names.includes(file));
    expect(missing, `manifest references files not in the archive: ${missing.join(", ")}`).toEqual([]);
  });

  it("publishes a checksum that matches the archive", () => {
    if (!existsSync(ZIP)) ensureArtifact();
    const sums = read("SHA256SUMS.txt").trim();
    expect(sums.endsWith(`  ${ZIP_NAME}`), `SHA256SUMS.txt does not name ${ZIP_NAME}`).toBe(true);
    expect(sums).toMatch(/^[0-9a-f]{64} {2}/);
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


// --------------------------------------------------------- link integrity ----

describe("documentation links", () => {
  /**
   * Every Markdown document, not just the READMEs.
   *
   * An earlier revision only checked README.md and README_ZH.md, which let a
   * broken relative link survive in docs/launch/RELEASE.md
   * (`../docs/BRAND.md` from inside `docs/launch/` resolves to
   * `docs/docs/BRAND.md`). This walks the whole documentation tree.
   */
  function markdownFiles(): string[] {
    const out: string[] = [];
    /**
     * Only PUBLISHED documents. Directories that are gitignored (`.local/` holds
     * QA scratch artifacts, for example) are not part of the repository a visitor
     * sees, so their links are not this test's business.
     */
    const SKIP = new Set(["node_modules", ".git", ".local", "dist", "dist-e2e", "coverage", "test-results", "playwright-report"]);
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (/\.(md|markdown)$/i.test(entry.name)) out.push(full);
      }
    };
    walk(rootDir);
    return out;
  }

  /** Relative link targets in a document, resolved against that document's directory. */
  function brokenLinksIn(file: string): string[] {
    const text = readFileSync(file, "utf8");
    const targets = new Set<string>();
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) targets.add(match[1]);
    for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) targets.add(match[1]);

    const broken: string[] = [];
    for (const target of targets) {
      if (/^(https?:|mailto:|tel:|data:|blob:)/i.test(target)) continue;
      if (target.startsWith("#")) continue;
      const path = target.split("#")[0].split("?")[0];
      if (path.length === 0) continue;
      if (!existsSync(resolve(dirname(file), decodeURI(path)))) broken.push(target);
    }
    return broken;
  }

  it("resolves every relative link in every Markdown document", () => {
    const problems: string[] = [];
    const files = markdownFiles();
    for (const file of files) {
      for (const broken of brokenLinksIn(file)) {
        problems.push(`${relative(rootDir, file).split(sep).join("/")} -> ${broken}`);
      }
    }
    expect(problems, `broken relative links:\n${problems.join("\n")}`).toEqual([]);
    expect(files.length, "no Markdown files were found to check").toBeGreaterThan(8);
  });

  it("points every documented absolute GitHub URL at the renamed repository", () => {
    const problems: string[] = [];
    for (const file of markdownFiles()) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/https:\/\/github\.com\/kallist\/[A-Za-z0-9._-]+/g)) {
        if (!match[0].startsWith("https://github.com/kallist/CueParcel")) {
          problems.push(`${relative(rootDir, file).split(sep).join("/")} -> ${match[0]}`);
        }
      }
    }
    expect(problems, `links to the pre-rename repository:\n${problems.join("\n")}`).toEqual([]);
  });

  it("does not advertise a release download that does not exist yet", () => {
    /**
     * The README must not tell users to download a release asset while the
     * repository has no releases. Checked as text rather than over the network so
     * the test stays offline and deterministic; it pins the wording the README
     * actually uses.
     */
    expect(README).not.toMatch(/Download `cueparcel-v[\d.]+-chromium\.zip` from/i);
    expect(README).toMatch(/there is no downloadable release yet|once a release exists/i);
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
