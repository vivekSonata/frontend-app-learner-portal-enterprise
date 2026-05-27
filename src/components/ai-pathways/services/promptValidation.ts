/**
 * Service for validating Xpert prompt bundles before execution.
 *
 * It enforces structural integrity (required parts), content presence, and
 * character count thresholds to ensure prompts are safe, effective, and
 * within reasonable token limits.
 */
import { XpertPromptBundle, PromptPartLabel } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Character count above which a bundle's `combined` string is considered
 * unusually large.  A warning is issued but execution is NOT blocked.
 */
export const PROMPT_SIZE_WARNING_THRESHOLD = 8_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'error' | 'warning';

export interface PromptValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
}

export interface PromptValidationResult {
  /** `true` when there are no `error`-severity issues (warnings are non-blocking). */
  valid: boolean;
  issues: PromptValidationIssue[];
  /** Convenience alias — only `warning`-severity issues. */
  warnings: PromptValidationIssue[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Constructs a `PromptValidationIssue` from its constituent fields.
 *
 * @param severity Whether this issue blocks execution (`'error'`) or is advisory only (`'warning'`).
 * @param code A stable, machine-readable issue code (e.g. `'EMPTY_REQUIRED_PART'`).
 * @param message A human-readable explanation suitable for the DebugConsole.
 * @returns A structured `PromptValidationIssue` object.
 */
function makeIssue(
  severity: ValidationSeverity,
  code: string,
  message: string,
): PromptValidationIssue {
  return { severity, code, message };
}

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------

/**
 * Check 1 — Required parts present.
 *
 * Every part marked `required: true` in the bundle must exist and must have a
 * non-empty `label`.  Parts with missing or blank labels are reported as errors.
 *
 * @param bundle The prompt bundle to inspect.
 * @returns An array of `error`-severity issues for any missing or empty required parts.
 */
function checkRequiredParts(bundle: XpertPromptBundle): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];

  const missingRequired = bundle.parts.filter((p) => p.required && !p.label);
  missingRequired.forEach(() => {
    issues.push(
      makeIssue(
        'error',
        'MISSING_REQUIRED_PART_LABEL',
        'A required prompt part is missing a label.',
      ),
    );
  });

  // Verify that required parts actually have content (empty required part is an error).
  const emptyRequired = bundle.parts.filter((p) => p.required && p.content.trim() === '');
  emptyRequired.forEach((p) => {
    issues.push(
      makeIssue(
        'error',
        'EMPTY_REQUIRED_PART',
        `Required prompt part "${p.label}" is empty.`,
      ),
    );
  });

  return issues;
}

/**
 * Check 2 — Prompt not empty.
 *
 * `bundle.combined` must be non-empty after trimming.  If `combined` is empty
 * despite parts existing, something went wrong during concatenation.
 *
 * @param bundle The prompt bundle to inspect.
 * @returns An array containing a single `error` issue if `combined` is empty, otherwise `[]`.
 */
function checkNotEmpty(bundle: XpertPromptBundle): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];

  if (bundle.combined.trim() === '') {
    issues.push(
      makeIssue(
        'error',
        'EMPTY_COMBINED_PROMPT',
        'The combined prompt string is empty — nothing will be sent to Xpert.',
      ),
    );
  }

  return issues;
}

/**
 * Check 3 — Size threshold warning.
 *
 * When `combined` exceeds `PROMPT_SIZE_WARNING_THRESHOLD` characters a warning
 * is emitted.  This does NOT block execution.
 *
 * @param bundle The prompt bundle to inspect.
 * @returns An array containing a single `warning` issue if `combined` exceeds the threshold,
 *   otherwise `[]`.
 */
function checkSizeThreshold(bundle: XpertPromptBundle): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];

  if (bundle.combined.length > PROMPT_SIZE_WARNING_THRESHOLD) {
    issues.push(
      makeIssue(
        'warning',
        'PROMPT_SIZE_EXCEEDS_THRESHOLD',
        `Combined prompt is ${bundle.combined.length.toLocaleString()} characters, which exceeds the `
        + `${PROMPT_SIZE_WARNING_THRESHOLD.toLocaleString()}-character warning threshold. `
        + 'Consider trimming facet context or schema parts to reduce token usage.',
      ),
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a `XpertPromptBundle` against the three standard checks:
 *
 * 1. All `required` parts are present and non-empty.
 * 2. The `combined` string is non-empty.
 * 3. `combined` does not exceed `PROMPT_SIZE_WARNING_THRESHOLD` characters.
 *
 * The returned `valid` flag is `true` when there are no `error`-severity issues
 * — warnings alone do **not** make a bundle invalid.
 *
 * This function is **pure** (no side-effects) and is safe to call anywhere.
 *
 * @param bundle The bundle to validate.
 * @param requiredLabels Optional list of `PromptPartLabel` values that **must**
 *   appear in `bundle.parts` regardless of the `required` flag on each part.
 *   Useful when a call-site has extra invariants (e.g. "base" must always exist).
 * @returns A `PromptValidationResult` with `valid` (`true` when no errors), all `issues`,
 *   and a `warnings` convenience subset.
 */
export function validateBundle(
  bundle: XpertPromptBundle,
  requiredLabels?: PromptPartLabel[],
): PromptValidationResult {
  const allIssues: PromptValidationIssue[] = [
    ...checkRequiredParts(bundle),
    ...checkNotEmpty(bundle),
    ...checkSizeThreshold(bundle),
  ];

  // Optional: caller-specified labels that must be present.
  if (requiredLabels && requiredLabels.length > 0) {
    const existingLabels = new Set(bundle.parts.map((p) => p.label));
    requiredLabels.forEach((label) => {
      if (!existingLabels.has(label)) {
        allIssues.push(
          makeIssue(
            'error',
            'MISSING_REQUIRED_LABEL',
            `Expected a prompt part with label "${label}" but none was found in the bundle.`,
          ),
        );
      }
    });
  }

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues: allIssues,
    warnings,
  };
}
