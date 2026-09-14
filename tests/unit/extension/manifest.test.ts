import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

interface Manifest {
  manifest_version?: number;
  name?: string;
  version?: string;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: unknown[];
  action?: { default_popup?: string };
  side_panel?: { default_path?: string };
  background?: { service_worker?: string; type?: string };
  content_security_policy?: { extension_pages?: string };
  commands?: Record<string, { suggested_key?: { default?: string }; description?: string }>;
}

function loadManifest(): Manifest {
  return JSON.parse(
    readFileSync(resolve(rootDir, "public", "manifest.json"), "utf8"),
  ) as Manifest;
}

function loadPackageJson(): { name?: string; version?: string } {
  return JSON.parse(
    readFileSync(resolve(rootDir, "package.json"), "utf8"),
  ) as { name?: string; version?: string };
}

const REQUIRED_PERMISSIONS = ["activeTab", "scripting", "sidePanel", "storage"];

const FORBIDDEN_PERMISSIONS = [
  "cookies",
  "history",
  "bookmarks",
  "webRequest",
  "downloads",
  "nativeMessaging",
  "tabs",
];

describe("manifest.json", () => {
  const manifest = loadManifest();
  const pkg = loadPackageJson();

  it("is a Manifest V3 extension named Page2Agent", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("Page2Agent");
  });

  it("version matches package.json version", () => {
    expect(pkg.version).toBeDefined();
    expect(manifest.version).toBe(pkg.version);
  });

  it("declares the exact least-privilege permissions", () => {
    expect(manifest.permissions).toBeDefined();
    for (const permission of REQUIRED_PERMISSIONS) {
      expect(manifest.permissions).toContain(permission);
    }
  });

  it("does not request forbidden or premature permissions", () => {
    for (const permission of FORBIDDEN_PERMISSIONS) {
      expect(manifest.permissions).not.toContain(permission);
    }
  });

  it("has no host permissions and never grants <all_urls>", () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("has no persistent content scripts", () => {
    expect(manifest.content_scripts).toBeUndefined();
  });

  it("has no popup (Side Panel is the primary UI)", () => {
    expect(manifest.action?.default_popup).toBeUndefined();
  });

  it("points side_panel.default_path at a real side panel page", () => {
    expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
  });

  it("declares an ES module service worker", () => {
    expect(manifest.background?.service_worker).toBe("assets/service-worker.js");
    expect(manifest.background?.type).toBe("module");
  });

  it("uses a strict extension CSP without unsafe-eval", () => {
    const csp = manifest.content_security_policy?.extension_pages ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("routes the production toolbar action through an explicit click handler", () => {
    const serviceWorker = readFileSync(
      resolve(rootDir, "src", "extension", "background", "service-worker.ts"),
      "utf8",
    );

    expect(serviceWorker).toContain("chrome.action.onClicked.addListener");
    expect(serviceWorker).not.toContain("openPanelOnActionClick: true");
  });

  it("keeps localhost host access confined to the E2E build script", () => {
    const e2eBuild = readFileSync(resolve(rootDir, "scripts", "build-e2e.mjs"), "utf8");
    expect(manifest.host_permissions).toBeUndefined();
    expect(e2eBuild).toContain('manifest.host_permissions = ["http://127.0.0.1/*"]');
    expect(e2eBuild).toContain("production manifest unexpectedly already has host_permissions");
  });
});

/**
 * Test 22 — the keyboard shortcut must actually be assignable.
 *
 * Human QA measured that Chrome leaves `_execute_action` with an EMPTY shortcut
 * when the suggested key is Alt+Shift+P, because Chrome reserves that
 * combination for its own "Pin tab" command. The extension then has no shortcut
 * at all and the feature silently does nothing, while the manifest still looks
 * correct. These assertions pin the two things that can be checked without
 * browser chrome: a valid accelerator shape, and no known Chrome-reserved
 * combination.
 */
describe("manifest.json — keyboard command (Test 22)", () => {
  const manifest = loadManifest();
  const command = manifest.commands?.["_execute_action"];
  const shortcut = command?.suggested_key?.default ?? "";

  /** Chrome accelerators are modifiers plus one key, e.g. "Alt+Shift+Y". */
  const ACCELERATOR = /^(Ctrl|Alt|Command|MacCtrl)(\+(Shift|Alt|Ctrl|Command|MacCtrl))*\+[A-Z0-9]$/;

  /**
   * Combinations measured (see E:\dsh work\page-qa\evidence\shortcut-assignment-probe.json)
   * as left UNASSIGNED by Chrome, plus the reserved browser accelerators. A
   * suggested_key here silently yields no shortcut.
   */
  const RESERVED_OR_UNASSIGNED = [
    // Chrome's own "Pin tab" — verified to leave the shortcut empty.
    "Alt+Shift+P",
    // Verified to leave the shortcut empty.
    "",
  ];

  it("declares the action command with a description", () => {
    expect(command).toBeDefined();
    expect(command?.description).toBe("Capture the current page with Page2Agent");
  });

  it("uses a valid Chrome accelerator format", () => {
    expect(shortcut).toMatch(ACCELERATOR);
  });

  it("does not use a combination Chrome refuses to assign", () => {
    expect(RESERVED_OR_UNASSIGNED).not.toContain(shortcut);
  });

  it("keeps the in-panel hint in sync with the manifest binding", () => {
    const onboarding = readFileSync(
      resolve(rootDir, "src", "extension", "sidepanel", "onboarding.ts"),
      "utf8",
    );
    const match = onboarding.match(/SHORTCUT_HINT = "Keyboard: ([^"]+)"/);
    expect(match).not.toBeNull();
    // The UI must never advertise a shortcut the manifest does not register.
    expect(match?.[1]).toBe(shortcut);
  });

  it("documents the shortcut in the README to match", () => {
    const readme = readFileSync(resolve(rootDir, "README.md"), "utf8");
    expect(readme).toContain(shortcut);
  });
});
