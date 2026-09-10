/**
 * Small, reusable runtime validation primitives for the core domain.
 *
 * Policy: strict key sets at the input boundary — unknown fields on domain
 * objects are rejected so malformed or future-incompatible data cannot pass
 * through silently. Runtime validation is separate from compile-time shape.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when every key present on `value` is in `allowed` (missing optional keys are fine). */
export function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** A string with at least one non-whitespace character. */
export function isMeaningfulText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** ISO 8601 date-time with an explicit zone (Z or ±hh:mm). */
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * A real ISO 8601 timestamp, not merely something Date.parse() tolerates.
 *
 * Source facts must be machine-consumable: a rendered phrase such as
 * "on Aug 28, 2026" parses in V8 but is not a timestamp, and must never reach
 * the domain. Every value the adapters emit already carries an explicit zone.
 */
export function isIsoDateTimeString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DATE_TIME_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** A non-empty array of meaningful (non-whitespace-only) strings. */
export function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.every(isMeaningfulText);
}

export function isOptionalMeaningfulString(value: unknown): value is string | undefined {
  return value === undefined || isMeaningfulText(value);
}

export function isOptionalNonEmptyStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isNonEmptyStringArray(value);
}

/** Exhaustiveness helper for discriminated-union switches. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value reached exhaustive switch: ${String(value)}`);
}
