/**
 * Custom hook providing a self-contained interception layer for Xpert AI prompts.
 *
 * It allows the UI (DebugConsole) to asynchronously intercept outbound AI
 * requests, permitting developers to review, edit, or cancel prompts before
 * they are sent to the backend.
 *
 * Lifecycle:
 * 1. Stage service calls interceptPrompt() and awaits the result.
 * 2. Hook sets 'isPending' to true and exposes 'pendingInterception' data.
 * 3. UI renders an editor (PromptEditorModal) based on this state.
 * 4. User actions (Accept/Reject/Cancel) resolve the original promise.
 * 5. Stage service receives the decision and optionally modified bundle.
 */
import { useCallback, useRef, useState } from 'react';
import { XpertPromptBundle, XpertMessage } from '../types';
import { validateBundle, PromptValidationIssue } from '../services/promptValidation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The outcome of a single interception decision.
 *
 * - `accepted`  — caller should proceed using `bundle` (may have been edited).
 * - `rejected`  — caller should fall back to the original, unmodified bundle.
 * - `cancelled` — caller should abort the Xpert call entirely.
 */
export type InterceptDecision = 'accepted' | 'rejected' | 'cancelled';

export interface InterceptResult {
  decision: InterceptDecision;
  /** Present only when decision is `accepted`; contains the (possibly edited) bundle. */
  bundle?: XpertPromptBundle;
  /**
   * Validation issues surfaced before execution.  Warnings are always included;
   * errors cause `valid: false` on the `PromptValidationResult` but do NOT
   * automatically block execution — the caller decides what to do.
   */
  validationWarnings?: PromptValidationIssue[];
}

/**
 * Optional context passed to the interceptor alongside the bundle.
 * Carries enough metadata for an editor UI or validation layer to display
 * meaningful information without coupling to a specific call site.
 */
export interface InterceptContext {
  /** Human-readable label for the interception point, e.g. "Intent Extraction". */
  label: string;
  /** The outbound messages that will be sent together with the system prompt. */
  messages: XpertMessage[];
  /** Arbitrary extra metadata (e.g. requestId, careerTitle). */
  meta?: Record<string, unknown>;
}

/**
 * Signature of the resolver function that a UI layer (or test stub) must call
 * to supply a decision to the pending `interceptPrompt` promise.
 */
export type InterceptResolver = (result: InterceptResult) => void;

/**
 * Shape returned by `usePromptInterceptor`.
 */
export interface UsePromptInterceptorReturn {
  /**
   * When `true`, an interception is currently in progress (a promise is pending).
   * Useful for driving modal open/close state in a future UI layer.
   */
  isPending: boolean;

  /**
   * The bundle and context that are currently being intercepted.
   * `null` when no interception is in progress.
   */
  pendingInterception: { bundle: XpertPromptBundle; context: InterceptContext } | null;

  /**
   * Asynchronously intercepts a prompt bundle before it is sent to Xpert.
   *
   * Behaviour:
   * - When no pending interception is active the call suspends until one of
   *   `accept`, `reject`, or `cancel` is called.
   * - When called without a UI connected (i.e. `accept`/`reject`/`cancel` are
   *   never invoked), the promise will remain pending indefinitely — wire the
   *   modal to these methods to resolve it.
   *
   * @param bundle   The prompt bundle to intercept.
   * @param context  Metadata describing this interception point.
   * @returns        A promise resolving to an `InterceptResult`.
   */
  interceptPrompt: (bundle: XpertPromptBundle, context: InterceptContext) => Promise<InterceptResult>;

  /**
   * Convenience method — resolves the current pending interception as `accepted`,
   * optionally with an edited bundle.
   */
  accept: (editedBundle?: XpertPromptBundle) => void;

  /**
   * Convenience method — resolves the current pending interception as `rejected`
   * (caller uses the original bundle).
   */
  reject: () => void;

  /**
   * Convenience method — resolves the current pending interception as `cancelled`
   * (caller aborts the Xpert call).
   */
  cancel: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `usePromptInterceptor` provides a self-contained interception layer for Xpert
 * prompt bundles.  It exposes an async `interceptPrompt()` function that Xpert
 * call sites can await before sending.
 *
 * `interceptPrompt` fully owns the lifecycle:
 *  → called → sets pendingInterception state → waits → resolves via accept/reject/cancel
 *
 * When `isPending` is false (no outstanding interception) calls to `accept`,
 * `reject`, or `cancel` are no-ops.
 */
export const usePromptInterceptor = (): UsePromptInterceptorReturn => {
  // Holds the resolve function for the currently-pending promise, if any.
  // Stored in a ref so async closures always read the latest value without
  // stale-closure issues and without causing extra re-renders.
  const resolverRef = useRef<((result: InterceptResult) => void) | null>(null);

  // Mirror of pendingInterception kept in a ref so the async resolver closure
  // can clear state without stale captures.
  const pendingRef = useRef<{ bundle: XpertPromptBundle; context: InterceptContext } | null>(null);

  // React state: drives modal visibility and re-renders.
  const [pendingInterception, setPendingInterception] = useState<{
    bundle: XpertPromptBundle;
    context: InterceptContext;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // interceptPrompt — fully owns lifecycle
  // ---------------------------------------------------------------------------
  const interceptPrompt = useCallback(
    async (bundle: XpertPromptBundle, context: InterceptContext): Promise<InterceptResult> => {
      // Run validation before any interception decision.
      const validation = validateBundle(bundle);
      const validationWarnings = validation.issues.length > 0 ? validation.issues : undefined;

      // Suspend until accept / reject / cancel is called.
      return new Promise<InterceptResult>((resolve) => {
        const pending = { bundle, context };
        pendingRef.current = pending;
        setPendingInterception(pending);

        // Store the promise's resolve function so the convenience methods can settle it.
        resolverRef.current = (result: InterceptResult) => {
          // Clear pending state before resolving so the modal closes on the same tick.
          pendingRef.current = null;
          resolverRef.current = null;
          setPendingInterception(null);
          // Attach validation warnings so callers always have them.
          resolve({ ...result, validationWarnings });
        };
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Convenience decision methods
  // ---------------------------------------------------------------------------

  const accept = useCallback((editedBundle?: XpertPromptBundle) => {
    const resolver = resolverRef.current;
    if (resolver) {
      resolver({
        decision: 'accepted',
        bundle: editedBundle ?? pendingRef.current?.bundle,
      });
    }
  }, []);

  const reject = useCallback(() => {
    const resolver = resolverRef.current;
    if (resolver) {
      resolver({ decision: 'rejected' });
    }
  }, []);

  const cancel = useCallback(() => {
    const resolver = resolverRef.current;
    if (resolver) {
      resolver({ decision: 'cancelled' });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    isPending: pendingInterception !== null,
    pendingInterception,
    interceptPrompt,
    accept,
    reject,
    cancel,
  };
};
