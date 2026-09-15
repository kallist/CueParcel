/**
 * Package the built extension as a release artifact.
 *
 *   node scripts/package-release.mjs
 *
 * Produces, at the repository root:
 *   cueparcel-v<version>-chromium.zip   ready to load unpacked, or to upload
 *   SHA256SUMS.txt                      checksums for the artifacts
 *
 * WHY THIS IS HAND-WRITTEN
 * The archive layout has one requirement that a naive "zip the folder" gets
 * wrong: `manifest.json` must be at the ARCHIVE ROOT, not under `dist/`. Chrome
 * rejects an archive whose manifest is nested. Writing the ZIP here makes that
 * layout explicit and asserted, keeps the build dependency-free, and makes the
 * output byte-reproducible (fixed timestamps, sorted entries, no OS metadata).
 *
 * The artifact is NOT published by this script. Publishing is a separate,
 * explicit step.
 */
import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
/**
 * `dist/` and the output directory are overridable so the packaging guards can be
 * exercised against a temporary tree in tests, without touching the real build
 * output. Everything else stays relative to the repository root.
 */
const DIST = process.env.CUEPARCEL_DIST_DIR ?? join(root, "dist");
const OUT_DIR = process.env.CUEPARCEL_OUT_DIR ?? root;
const MANIFEST = join(DIST, "manifest.json");

/** Files that must never end up in a release artifact. */
const EXCLUDED = [
  ".DS_Store",
  "Thumbs.db",
  ".map",
];

/* ------------------------------------------------------------------ crc32 -- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* -------------------------------------------------------------------- zip -- */

/**
 * Build a ZIP (deflate) from a list of { name, data } entries.
 *
 * Timestamps are fixed to the DOS epoch value for 1980-01-01 so the same input
 * always produces the same bytes; `externalAttributes` is left at 0 so no
 * platform-specific mode bits leak in.
 */
function buildZip(entries) {
  const DOS_TIME = 0; // 00:00:00
  const DOS_DATE = (1 << 5) | 1; // 1980-01-01
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const deflated = deflateRawSync(entry.data, { level: 9 });
    // Only use deflate when it actually helps.
    const useDeflate = deflated.length < entry.data.length;
    const payload = useDeflate ? deflated : entry.data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, centralBuffer, end]);
}

/* --------------------------------------------------------------- collect -- */

/** Every file under dist/, as archive-relative POSIX paths, sorted. */
async function collect(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collect(full, base)));
      continue;
    }
    const name = relative(base, full).split(sep).join("/");
    if (EXCLUDED.some((suffix) => name.endsWith(suffix))) continue;
    out.push({ name, full });
  }
  return out;
}

/* ------------------------------------------------------------------ main -- */

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = manifest.version;
const zipName = `cueparcel-v${version}-chromium.zip`;

/**
 * Sort entries so `manifest.json` is first, then everything else alphabetically.
 *
 * The requirement is that the manifest sits at the ARCHIVE ROOT (not under
 * `dist/`); entry ORDER is not required by Chrome, but writing the manifest first
 * makes the archive self-describing to a human running `unzip -l`.
 */
const files = (await collect(DIST)).sort((a, b) => {
  if (a.name === "manifest.json") return -1;
  if (b.name === "manifest.json") return 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
});

const problems = [];
if (files.length === 0) problems.push("dist/ contains no files — run `npm run build` first");
if (!files.some((f) => f.name === "manifest.json")) {
  problems.push("dist/manifest.json is missing, so the archive would have no manifest at its root");
}
if (files.some((f) => f.name.startsWith("dist/"))) {
  problems.push("a path under dist/ leaked into the archive names");
}
if (manifest.manifest_version !== 3) problems.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
/**
 * Version agreement. Packaging whatever happens to be in dist/ is how you ship
 * the wrong build: a stale dist/ silently produces an artifact whose version
 * disagrees with package.json, the tag and the CHANGELOG. Measured: with
 * dist/manifest.json tampered to 9.9.9 this script happily packaged "9.9.9"
 * until this check existed.
 */
if (pkg.version !== manifest.version) {
  problems.push(
    `version mismatch: package.json says ${pkg.version} but dist/manifest.json says ${manifest.version} — dist/ is stale, rebuild before packaging`,
  );
}
/**
 * Rebuild evidence. `npm run package:release` rebuilds first, but running this
 * script directly does not, so a dist/ older than the sources would package stale
 * code.
 *
 * The reference timestamp must be a file the BUILD GENERATES, never
 * `dist/manifest.json`: that file is copied verbatim from `public/manifest.json`,
 * so it keeps the source's mtime and made a fresh build look stale.
 * `dist/assets/sidepanel.js` is written by Vite on every build.
 */
{
  const generated = join(DIST, "assets", "sidepanel.js");
  const generatedInfo = await stat(generated).catch(() => null);
  if (generatedInfo === null) {
    problems.push("dist/assets/sidepanel.js is missing — dist/ does not look like a completed build");
  } else {
    let newestSource = 0;
    let newestSourceFile = "";
    const consider = (mtimeMs, name) => {
      if (mtimeMs > newestSource) {
        newestSource = mtimeMs;
        newestSourceFile = name;
      }
    };
    const walk = async (dir) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        const info = await stat(full);
        consider(info.mtimeMs, relative(root, full).split(sep).join("/"));
      }
    };
    for (const dir of ["src", "public"]) await walk(join(root, dir));
    for (const script of ["vite.config.ts", "vite.content.config.ts", "scripts/validate-build.mjs"]) {
      const info = await stat(join(root, script)).catch(() => null);
      if (info !== null) consider(info.mtimeMs, script);
    }
    if (newestSource > generatedInfo.mtimeMs) {
      problems.push(
        `dist/ is older than ${newestSourceFile} — the artifact would contain stale code; run \`npm run build\` first`,
      );
    }
  }
}
if (problems.length > 0) {
  console.error("\nRelease packaging refused:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const entries = [];
for (const file of files) {
  entries.push({ name: file.name, data: await readFile(file.full) });
}

const zip = buildZip(entries);
const zipPath = join(OUT_DIR, zipName);
await writeFile(zipPath, zip);

const sha256 = createHash("sha256").update(zip).digest("hex");
const sums = `${sha256}  ${zipName}\n`;
await writeFile(join(OUT_DIR, "SHA256SUMS.txt"), sums, "utf8");

/* ------------------------------------------------------------ self-check -- */

// Re-open the archive we just wrote and verify the layout, rather than trusting
// the writer. Chrome rejects a nested manifest, so this is the property that
// matters most.
function readCentralDirectory(buffer) {
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0) throw new Error("no end-of-central-directory record");
  const count = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  const names = [];
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

/** Extract one entry's bytes by walking the local file headers. */
function readEntry(buffer, wanted) {
  let cursor = 0;
  while (cursor < buffer.length - 4) {
    if (buffer.readUInt32LE(cursor) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(cursor + 8);
    const compressedSize = buffer.readUInt32LE(cursor + 18);
    const nameLength = buffer.readUInt16LE(cursor + 26);
    const extraLength = buffer.readUInt16LE(cursor + 28);
    const name = buffer.toString("utf8", cursor + 30, cursor + 30 + nameLength);
    const dataStart = cursor + 30 + nameLength + extraLength;
    const payload = buffer.subarray(dataStart, dataStart + compressedSize);
    if (name === wanted) {
      return {
        name,
        method,
        data: method === 8 ? inflateRawSync(payload) : Buffer.from(payload),
      };
    }
    cursor = dataStart + compressedSize;
  }
  throw new Error(`entry ${wanted} not found in the archive`);
}

/**
 * Verify EVERY entry by decompressing it and comparing its CRC-32 with the value
 * stored in the archive.
 *
 * Checking only the entry names and the manifest would let a corrupted asset
 * through: a truncated icon still has its name in the central directory. Chrome
 * would then refuse the extension for a reason the release notes never mention.
 */
function verifyAllEntries(buffer) {
  const results = [];
  let cursor = 0;
  while (cursor < buffer.length - 4) {
    if (buffer.readUInt32LE(cursor) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(cursor + 8);
    const expectedCrc = buffer.readUInt32LE(cursor + 14);
    const compressedSize = buffer.readUInt32LE(cursor + 18);
    const uncompressedSize = buffer.readUInt32LE(cursor + 22);
    const nameLength = buffer.readUInt16LE(cursor + 26);
    const extraLength = buffer.readUInt16LE(cursor + 28);
    const name = buffer.toString("utf8", cursor + 30, cursor + 30 + nameLength);
    const dataStart = cursor + 30 + nameLength + extraLength;
    const payload = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    let error = null;
    try {
      data = method === 8 ? inflateRawSync(payload) : Buffer.from(payload);
    } catch (cause) {
      error = `decompress failed: ${String(cause).slice(0, 80)}`;
    }
    if (error === null && data.length !== uncompressedSize) {
      error = `size mismatch: header says ${uncompressedSize}, got ${data.length}`;
    }
    if (error === null && crc32(data) !== expectedCrc) {
      error = `CRC mismatch: header says ${expectedCrc.toString(16)}, computed ${crc32(data).toString(16)}`;
    }
    results.push({ name, error });
    cursor = dataStart + compressedSize;
  }
  return results;
}

const names = readCentralDirectory(zip);
const checkFailures = [];
if (!names.includes("manifest.json")) {
  checkFailures.push('archive does not contain "manifest.json" at its root');
}
if (names.some((n) => n.startsWith("dist/"))) checkFailures.push("archive contains a dist/ prefix");
if (names.some((n) => n.includes(".."))) checkFailures.push("archive contains a path traversal segment");
if (names.length !== files.length) checkFailures.push(`archive lists ${names.length} entries, collected ${files.length}`);
// The manifest must parse, and must be the version we just packaged.
{
  const { data } = readEntry(zip, "manifest.json");
  try {
    const parsed = JSON.parse(data.toString("utf8"));
    if (parsed.version !== version) checkFailures.push(`archived manifest version is ${parsed.version}, expected ${version}`);
    if (parsed.manifest_version !== 3) checkFailures.push(`archived manifest_version is ${parsed.manifest_version}, expected 3`);
  } catch (error) {
    checkFailures.push(`archived manifest.json does not parse: ${String(error).slice(0, 100)}`);
  }
}

// Verify every entry really decompresses and matches its recorded CRC.
const entryChecks = verifyAllEntries(zip);
const corrupt = entryChecks.filter((entry) => entry.error !== null);
for (const entry of corrupt) checkFailures.push(`corrupt entry ${entry.name}: ${entry.error}`);
if (entryChecks.length !== names.length) {
  checkFailures.push(`verified ${entryChecks.length} entries but the central directory lists ${names.length}`);
}

// Every file the manifest points at must actually be in the archive, or Chrome
// rejects the extension at load time with a missing-file error.
{
  const { data } = readEntry(zip, "manifest.json");
  const parsed = JSON.parse(data.toString("utf8"));
  const referenced = new Set();
  for (const value of Object.values(parsed.icons ?? {})) referenced.add(String(value));
  for (const value of Object.values(parsed.action?.default_icon ?? {})) referenced.add(String(value));
  if (typeof parsed.action?.default_popup === "string") referenced.add(parsed.action.default_popup);
  if (typeof parsed.background?.service_worker === "string") referenced.add(parsed.background.service_worker);
  if (typeof parsed.side_panel?.default_path === "string") referenced.add(parsed.side_panel.default_path);
  const missing = [...referenced].filter((file) => !names.includes(file));
  if (missing.length > 0) {
    checkFailures.push(`manifest references files that are not in the archive: ${missing.join(", ")}`);
  }
  console.log(`  manifest refs    : ${referenced.size} checked, ${missing.length} missing`);
}

console.log(`packaged ${files.length} files from dist/`);
console.log(`  manifest_version : ${manifest.manifest_version}`);
console.log(`  product version  : ${version}`);
console.log(`  archive root     : ${JSON.stringify(names[0])} (root is flat: ${!names.some((n) => n.startsWith("dist/"))})`);
console.log(`  entry integrity  : ${entryChecks.length - corrupt.length}/${entryChecks.length} entries decompress with a matching CRC-32`);
console.log(`  archive size     : ${(zip.length / 1024).toFixed(1)} KB`);
console.log(`  sha256           : ${sha256}`);
console.log(`  wrote            : ${zipName}, SHA256SUMS.txt`);

if (checkFailures.length > 0) {
  console.error("\nRelease artifact self-check FAILED:");
  for (const f of checkFailures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nRelease artifact self-check PASSED: manifest.json is at the archive root.");
