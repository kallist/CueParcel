/**
 * Decorative atmosphere + unified line-icon system (V1.1 Premium UI).
 *
 * Atmosphere: a single soft aurora wash plus a bounded set of CSS-only
 * particles. Deliberately not a canvas or a requestAnimationFrame loop — the
 * particles are static DOM nodes animated purely by CSS transforms, so cost is
 * one compositor layer and there is nothing to clean up on unmount. Marked
 * aria-hidden and pointer-events:none so it can never take focus or a click.
 *
 * Icons: small, consistent 24×24 line icons drawn with currentColor. Five
 * recipes need five icons; shipping an icon dependency for that would not be
 * justified, so they are inline SVG paths (no network, no remote assets).
 */
import type { ContextRole, RecipeId } from "../../../core";

/** Particle count is bounded: enough to read as atmosphere, never a screensaver. */
const PARTICLES = 12;

function particleStyle(index: number): React.CSSProperties {
  // Deterministic pseudo-random spread: pure function of the index, so the
  // field is stable across renders and identical between sessions.
  const left = ((index * 37) % 97) + 1.5;
  const size = 1 + ((index * 13) % 3) * 0.5;
  const duration = 18 + ((index * 7) % 13);
  const delay = (index * 1.7) % 12;
  const hue = index % 3;

  return {
    left: `${left}%`,
    bottom: `${((index * 23) % 60) - 10}%`,
    "--particle-size": `${size}px`,
    "--particle-duration": `${duration}s`,
    "--particle-delay": `${delay}s`,
    "--particle-color":
      hue === 0
        ? "var(--accent-blue)"
        : hue === 1
          ? "var(--accent-violet)"
          : "var(--accent-cyan)",
  } as React.CSSProperties;
}

/** Aurora wash for a surface that already has `position: relative` + isolation. */
export function Aurora() {
  return <div className="atmosphere" aria-hidden="true" />;
}

/** Bounded particle field for idle / onboarding surfaces. */
export function ParticleAtmosphere() {
  return (
    <div className="atmosphere-canvas" aria-hidden="true">
      {Array.from({ length: PARTICLES }, (_, index) => (
        <span key={index} className="particle" style={particleStyle(index)} />
      ))}
    </div>
  );
}

/** Shared SVG shell so every icon keeps identical geometry and stroke weight. */
function LineIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Recipe icons — one coherent line set instead of five unrelated emoji. */
export const RECIPE_ICON_PATHS: Record<RecipeId, React.ReactNode> = {
  // Learn — an open book.
  learn: (
    <>
      <path d="M12 6.5C10.5 5.2 8.6 4.5 6.5 4.5H3.5v13h3c2.1 0 4 .7 5.5 2 1.5-1.3 3.4-2 5.5-2h3v-13h-3c-2.1 0-4 .7-5.5 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // Compare — a balance scale.
  compare: (
    <>
      <path d="M12 4v16" />
      <path d="M6 20h12" />
      <path d="M4 9h16" />
      <path d="M4 9l-2 5h4z" />
      <path d="M20 9l-2 5h4z" />
    </>
  ),
  // Verify — a magnifier over a check.
  verify: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4.5 4.5" />
      <path d="M8 10.6l1.9 1.9 3.3-3.6" />
    </>
  ),
  // Build — a wrench and ruler.
  build: (
    <>
      <path d="M14.5 6.5a3.5 3.5 0 004.9 4.9l-8.6 8.6a2 2 0 01-2.8-2.8z" />
      <path d="M6.5 3.5l3 3-2 2-3-3z" />
      <path d="M9 7l-5.5 5.5" />
    </>
  ),
  // Fix — a bug.
  fix: (
    <>
      <rect x="8" y="7" width="8" height="11" rx="4" />
      <path d="M9.5 7V5.5a2.5 2.5 0 015 0V7" />
      <path d="M3.5 11h4.5M16 11h4.5" />
      <path d="M4.5 16.5l3.5-2M19.5 16.5l-3.5-2" />
      <path d="M4.5 5.5L8 8M19.5 5.5L16 8" />
    </>
  ),
};

/** Role icons — same line language, distinguished by glyph not by emoji. */
export const ROLE_ICON_PATHS: Record<ContextRole, React.ReactNode> = {
  task: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  reference: (
    <>
      <path d="M5 4.5h9a3 3 0 013 3v12H8a3 3 0 01-3-3z" />
      <path d="M5 16.5a3 3 0 013-3h9" />
    </>
  ),
  evidence: (
    <>
      <path d="M9.5 3.5h5v5l3.5 8.5a2 2 0 01-1.9 2.5H7.9A2 2 0 016 17z" />
      <path d="M7.5 14h9" />
    </>
  ),
  example: (
    <>
      <path d="M12 3.5a6 6 0 00-3.5 10.9V17h7v-2.6A6 6 0 0012 3.5z" />
      <path d="M9.5 20h5" />
    </>
  ),
  selection: (
    <>
      <path d="M6 4.5l5.5 15 2-6.5 6.5-2z" />
    </>
  ),
};

export function RecipeIcon({ recipe }: { recipe: RecipeId }) {
  return <LineIcon>{RECIPE_ICON_PATHS[recipe]}</LineIcon>;
}

export function RoleIcon({ role }: { role: ContextRole }) {
  return <LineIcon>{ROLE_ICON_PATHS[role]}</LineIcon>;
}
